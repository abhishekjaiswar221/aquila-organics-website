import "server-only";
import type { EmploymentType, JobStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { normalizeUuid } from "@/lib/uuid";
import { isJobPublic, isJobStatus } from "./job-schema";

/*
 * Job-opening reads. The admin ones are for callers that authorised first with
 * requireAction("jobs.manage"). The two public ones return an opening only when
 * isJobPublic() says so; that function is the one place the rule lives.
 */

export const ADMIN_JOB_PAGE_SIZE = 25;

export type AdminJobRow = {
  id: string;
  slug: string;
  title: string;
  location: string;
  employmentType: EmploymentType;
  status: JobStatus;
  publishedAt: Date | null;
  closesOn: Date | null;
  updatedAt: Date;
  applicationCount: number;
};

export type AdminJobList = { items: AdminJobRow[]; total: number; page: number; pageCount: number };

export async function listAdminJobs(filter: { status?: JobStatus; page?: number }): Promise<AdminJobList> {
  const raw = filter.page;
  const page = typeof raw === "number" && Number.isFinite(raw) ? Math.min(1_000_000, Math.max(1, Math.floor(raw))) : 1;
  const where = isJobStatus(filter.status) ? { status: filter.status } : {};
  const [total, rows] = await Promise.all([
    db.jobOpening.count({ where }),
    db.jobOpening.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        location: true,
        employmentType: true,
        status: true,
        publishedAt: true,
        closesOn: true,
        updatedAt: true,
        _count: { select: { applications: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ADMIN_JOB_PAGE_SIZE,
      take: ADMIN_JOB_PAGE_SIZE,
    }),
  ]);
  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, applicationCount: _count.applications })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_JOB_PAGE_SIZE)),
  };
}

export type JobEditModel = {
  id: string;
  slug: string;
  title: string;
  location: string;
  department: string | null;
  employmentType: EmploymentType;
  summary: string;
  description: string;
  status: JobStatus;
  /** `YYYY-MM-DD` or null. */
  closesOn: string | null;
  /** ISO string; posted back as the optimistic-concurrency token. */
  updatedAt: string;
};

export async function getJobForEdit(id: string): Promise<JobEditModel | null> {
  const uuid = normalizeUuid(id);
  if (!uuid) return null;
  const row = await db.jobOpening.findUnique({ where: { id: uuid } });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    location: row.location,
    department: row.department,
    employmentType: row.employmentType,
    summary: row.summary,
    description: row.description,
    status: row.status,
    closesOn: row.closesOn ? row.closesOn.toISOString().slice(0, 10) : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type PublishedJob = {
  id: string;
  slug: string;
  title: string;
  location: string;
  department: string | null;
  employmentType: EmploymentType;
  summary: string;
  description: string;
  publishedAt: Date | null;
  closesOn: Date | null;
  updatedAt: Date;
};

const PUBLISHED_SELECT = {
  id: true,
  slug: true,
  title: true,
  location: true,
  department: true,
  employmentType: true,
  summary: true,
  description: true,
  status: true,
  publishedAt: true,
  closesOn: true,
  updatedAt: true,
} as const;

function toPublished(job: PublishedJob & { status: JobStatus }): PublishedJob {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    location: job.location,
    department: job.department,
    employmentType: job.employmentType,
    summary: job.summary,
    description: job.description,
    publishedAt: job.publishedAt,
    closesOn: job.closesOn,
    updatedAt: job.updatedAt,
  };
}

/** Openings visible to the public at `now`, newest publication first. */
export async function listPublishedJobs(now: Date): Promise<PublishedJob[]> {
  const rows = await db.jobOpening.findMany({
    // Narrowing only; isJobPublic() below still decides.
    where: { status: "PUBLISHED" },
    select: PUBLISHED_SELECT,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { title: "asc" }, { id: "asc" }],
  });
  return rows.filter((row) => isJobPublic(row, now)).map(toPublished);
}

/** One opening by slug, or null unless it is public at `now`. */
export async function getPublishedJobBySlug(slug: string, now: Date): Promise<PublishedJob | null> {
  if (typeof slug !== "string" || slug === "" || slug.length > 200) return null;
  const row = await db.jobOpening.findUnique({ where: { slug }, select: PUBLISHED_SELECT });
  return row && isJobPublic(row, now) ? toPublished(row) : null;
}

/**
 * Cheap public-visibility check (unique slug index) used by src/proxy.ts before
 * rendering: true only for an opening that is public right now.
 */
export async function isPublishedJobSlug(slug: string, now: Date = new Date()): Promise<boolean> {
  return (await getPublishedJobBySlug(slug, now)) !== null;
}
