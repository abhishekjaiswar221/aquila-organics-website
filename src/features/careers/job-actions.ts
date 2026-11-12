"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import type { JobStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/features/admin/audit";
import {
  STALE_JOB_ERROR,
  changedJobFields,
  isJobStatus,
  missingForPublish,
  parseJobForm,
  type JobFormData,
} from "@/features/careers/job-schema";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/permissions";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin job-opening create, update, status change and delete. Each exported
 * function is a public Server Action endpoint: requireAction() first (outside
 * any try/catch: it throws redirect/forbidden), then validation of the
 * untrusted form. Results carry our own messages only. Status and publishedAt
 * are never read from the edit form: create is always DRAFT, and status moves
 * only through setJobStatus. Audit rows hold ids, enum values and field names,
 * never what the editor typed, and commit in the same transaction.
 */

export type JobFormState = { ok: boolean; message: string; fieldErrors?: Record<string, string> } | null;

const FIX_FIELDS = "Fix the highlighted fields and try again.";
const NOT_FOUND = "Opening not found.";
const FAILED = "The opening could not be saved. Try again.";
const SLUG_TAKEN = "That URL slug is already used by another opening.";
const INVALID_STATUS = "That status is not valid.";
const PUBLISH_REQUIREMENTS =
  "Fill in the title, URL slug, location, summary and description before publishing.";
const DELETE_NOT_DRAFT = "Only a draft opening can be deleted. Close it instead.";
const DELETE_HAS_APPLICATIONS = "This opening has applications and cannot be deleted. Close it instead.";

function errorClass(err: unknown): string {
  return err instanceof Error ? err.name : typeof err;
}

/** True when `err` (or a cause) is a Prisma unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (code === "P2002") return true;
    if (typeof message === "string" && message.includes("Unique constraint")) return true;
    current = cause;
  }
  return false;
}

const invalid = (fieldErrors: Record<string, string>): JobFormState => ({ ok: false, message: FIX_FIELDS, fieldErrors });

const toDate = (closesOn: string | null): Date | null => (closesOn ? new Date(`${closesOn}T00:00:00.000Z`) : null);

function columns(data: JobFormData) {
  return {
    title: data.title,
    slug: data.slug,
    location: data.location,
    department: data.department,
    employmentType: data.employmentType,
    summary: data.summary,
    description: data.description,
    closesOn: toDate(data.closesOn),
  };
}

async function slugTaken(
  client: Prisma.TransactionClient | typeof db,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const row = await client.jobOpening.findFirst({
    where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return row !== null;
}

export async function createJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const actor = await requireAction("jobs.manage");
  const parsed = parseJobForm(formData);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const data = parsed.data;

  let id: string;
  try {
    if (await slugTaken(db, data.slug)) return invalid({ slug: SLUG_TAKEN });
    id = await db.$transaction(async (tx) => {
      const created = await tx.jobOpening.create({
        data: { ...columns(data), status: "DRAFT" },
        select: { id: true },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "job.create",
          entityType: "job",
          entityId: created.id,
          outcome: "ok",
          changedFields: [
            "title",
            "slug",
            "location",
            ...(data.department ? ["department"] : []),
            "employmentType",
            "summary",
            "description",
            ...(data.closesOn ? ["closesOn"] : []),
          ],
          detail: { status: "DRAFT", employmentType: data.employmentType },
        },
        tx,
      );
      return created.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return invalid({ slug: SLUG_TAKEN });
    console.error("[admin] job create failed:", errorClass(err));
    return { ok: false, message: FAILED };
  }
  // redirect() throws: it must stay outside the try/catch.
  redirect(`/admin/jobs/${id}/edit`);
}

type UpdateOutcome =
  | { kind: "not-found" }
  | { kind: "stale" }
  | { kind: "invalid"; fieldErrors: Record<string, string> }
  | { kind: "unchanged" }
  | { kind: "saved" };

export async function updateJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const actor = await requireAction("jobs.manage");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return { ok: false, message: NOT_FOUND };
  const rawStamp = formData.get("updatedAt");
  const expected = typeof rawStamp === "string" ? new Date(rawStamp) : null;
  if (!expected || Number.isNaN(expected.getTime())) return { ok: false, message: STALE_JOB_ERROR };
  const parsed = parseJobForm(formData);
  if (!parsed.ok) return invalid(parsed.fieldErrors);
  const data = parsed.data;

  let outcome: UpdateOutcome;
  try {
    outcome = await db.$transaction(async (tx): Promise<UpdateOutcome> => {
      const current = await tx.jobOpening.findUnique({ where: { id } });
      if (!current) return { kind: "not-found" };
      if (current.updatedAt.getTime() !== expected.getTime()) return { kind: "stale" };

      const changed = changedJobFields(
        {
          title: current.title,
          slug: current.slug,
          location: current.location,
          department: current.department,
          employmentType: current.employmentType,
          summary: current.summary,
          description: current.description,
          closesOn: current.closesOn ? current.closesOn.toISOString().slice(0, 10) : null,
        },
        data,
      );
      if (changed.length === 0) return { kind: "unchanged" };

      if (changed.includes("slug") && (await slugTaken(tx, data.slug, id))) {
        return { kind: "invalid", fieldErrors: { slug: SLUG_TAKEN } };
      }

      // Compare-and-set on updatedAt: a concurrent save makes this match nothing.
      const { count } = await tx.jobOpening.updateMany({
        where: { id, updatedAt: current.updatedAt },
        data: columns(data),
      });
      if (count === 0) return { kind: "stale" };

      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "job.update",
          entityType: "job",
          entityId: id,
          outcome: "ok",
          changedFields: changed,
          detail: { status: current.status },
        },
        tx,
      );
      return { kind: "saved" };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return invalid({ slug: SLUG_TAKEN });
    console.error("[admin] job update failed:", errorClass(err));
    return { ok: false, message: FAILED };
  }

  switch (outcome.kind) {
    case "not-found":
      return { ok: false, message: NOT_FOUND };
    case "stale":
      return { ok: false, message: STALE_JOB_ERROR };
    case "invalid":
      return invalid(outcome.fieldErrors);
    case "unchanged":
      return { ok: true, message: "No changes to save." };
    case "saved":
      refresh();
      return { ok: true, message: "Saved." };
  }
}

type StatusOutcome =
  | { kind: "not-found" }
  | { kind: "stale" }
  | { kind: "incomplete" }
  | { kind: "unchanged" }
  | { kind: "saved"; to: JobStatus };

const STATUS_DONE: Record<JobStatus, string> = {
  PUBLISHED: "Opening published.",
  CLOSED: "Opening closed.",
  DRAFT: "Opening moved back to draft.",
};

/** Hidden fields `id` and `status` (PUBLISHED | DRAFT | CLOSED). Publishing sets publishedAt. */
export async function setJobStatus(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const actor = await requireAction("jobs.manage");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return { ok: false, message: NOT_FOUND };
  const target = formData.get("status");
  if (!isJobStatus(target)) return { ok: false, message: INVALID_STATUS };

  let outcome: StatusOutcome;
  try {
    outcome = await db.$transaction(async (tx): Promise<StatusOutcome> => {
      const current = await tx.jobOpening.findUnique({ where: { id } });
      if (!current) return { kind: "not-found" };
      if (current.status === target) return { kind: "unchanged" };
      if (target === "PUBLISHED" && missingForPublish(current).length > 0) return { kind: "incomplete" };

      // Compare-and-set on the status we read: a concurrent change makes this match nothing.
      const publishing = target === "PUBLISHED";
      const { count } = await tx.jobOpening.updateMany({
        where: { id, status: current.status },
        data: { status: target, ...(publishing ? { publishedAt: new Date() } : {}) },
      });
      if (count === 0) return { kind: "stale" };

      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "job.status",
          entityType: "job",
          entityId: id,
          outcome: "ok",
          changedFields: publishing ? ["status", "publishedAt"] : ["status"],
          detail: { from: current.status, to: target },
        },
        tx,
      );
      return { kind: "saved", to: target };
    });
  } catch (err) {
    console.error("[admin] job status change failed:", errorClass(err));
    return { ok: false, message: FAILED };
  }

  switch (outcome.kind) {
    case "not-found":
      return { ok: false, message: NOT_FOUND };
    case "stale":
      return { ok: false, message: STALE_JOB_ERROR };
    case "incomplete":
      return { ok: false, message: PUBLISH_REQUIREMENTS };
    case "unchanged":
      return { ok: true, message: "The opening already has that status." };
    case "saved":
      refresh();
      return { ok: true, message: STATUS_DONE[outcome.to] };
  }
}

class Refused extends Error {
  constructor(readonly userMessage: string) {
    super("refused");
  }
}

/** Hidden field `id`. Only a DRAFT opening with no applications can be deleted. */
export async function deleteJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const actor = await requireAction("jobs.manage");
  const id = normalizeUuid(formData.get("id"));
  if (!id) return { ok: false, message: NOT_FOUND };

  try {
    await db.$transaction(async (tx) => {
      // One statement re-checks both conditions atomically with the delete.
      const { count } = await tx.jobOpening.deleteMany({
        where: { id, status: "DRAFT", applications: { none: {} } },
      });
      if (count === 0) {
        const row = await tx.jobOpening.findUnique({
          where: { id },
          select: { status: true, _count: { select: { applications: true } } },
        });
        if (!row) throw new Refused(NOT_FOUND);
        if (row.status !== "DRAFT") throw new Refused(DELETE_NOT_DRAFT);
        throw new Refused(DELETE_HAS_APPLICATIONS);
      }
      await recordAudit(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: "job.delete",
          entityType: "job",
          entityId: id,
          outcome: "ok",
          changedFields: [],
          detail: { status: "DRAFT" },
        },
        tx,
      );
    });
  } catch (err) {
    if (err instanceof Refused) return { ok: false, message: err.userMessage };
    console.error("[admin] job delete failed:", errorClass(err));
    return { ok: false, message: FAILED };
  }
  refresh();
  return { ok: true, message: "Opening deleted." };
}
