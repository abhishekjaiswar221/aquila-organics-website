import "server-only";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { isApplicationStatus } from "@/features/careers/application-status";
import { db } from "@/lib/db";
import { normalizeUuid } from "@/lib/uuid";

/*
 * Admin-only application queries. Callers authorise first (requireAction).
 * ipHash and userAgent are never selected, and a storage key leaves this
 * module only through getApplicationCv(), for the download route.
 */

export const APPLICATION_PAGE_SIZE = 25;

export type ApplicationFilter = { status?: ApplicationStatus; jobId?: string; page?: number };

export type ApplicationListItem = {
  id: string;
  reference: string;
  fullName: string;
  email: string;
  jobTitleSnapshot: string;
  status: ApplicationStatus;
  createdAt: Date;
  fileCount: number;
};

export type ApplicationList = { items: ApplicationListItem[]; total: number; page: number; pageCount: number };

export type ApplicationDetail = {
  id: string;
  reference: string;
  jobId: string | null;
  jobTitleSnapshot: string;
  fullName: string;
  email: string;
  phone: string | null;
  country: string | null;
  message: string | null;
  consentAt: Date;
  status: ApplicationStatus;
  createdAt: Date;
  files: { id: string; filename: string; sizeBytes: number; mimeType: string }[];
};

function normalizePage(page: number | undefined): number {
  if (typeof page !== "number" || !Number.isFinite(page)) return 1;
  return Math.min(1_000_000, Math.max(1, Math.floor(page)));
}

export async function listApplications(filter: ApplicationFilter): Promise<ApplicationList> {
  const page = normalizePage(filter.page);
  const jobId = filter.jobId ? normalizeUuid(filter.jobId) : null;
  const where = {
    ...(isApplicationStatus(filter.status) ? { status: filter.status } : {}),
    ...(jobId ? { jobId } : {}),
  };
  const [total, rows] = await Promise.all([
    db.jobApplication.count({ where }),
    db.jobApplication.findMany({
      where,
      select: {
        id: true,
        reference: true,
        fullName: true,
        email: true,
        jobTitleSnapshot: true,
        status: true,
        createdAt: true,
        _count: { select: { files: true } },
      },
      orderBy: [{ createdAt: "desc" }, { reference: "desc" }],
      skip: (page - 1) * APPLICATION_PAGE_SIZE,
      take: APPLICATION_PAGE_SIZE,
    }),
  ]);
  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, fileCount: _count.files })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / APPLICATION_PAGE_SIZE)),
  };
}

/** Every opening (id and title) for the list filter, newest first. */
export async function listJobFilterOptions(): Promise<{ id: string; title: string }[]> {
  return db.jobOpening.findMany({
    select: { id: true, title: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 500,
  });
}

export async function getApplication(id: string): Promise<ApplicationDetail | null> {
  const applicationId = normalizeUuid(id);
  if (!applicationId) return null;
  return db.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      jobId: true,
      jobTitleSnapshot: true,
      fullName: true,
      email: true,
      phone: true,
      country: true,
      message: true,
      consentAt: true,
      status: true,
      createdAt: true,
      files: {
        select: { id: true, filename: true, sizeBytes: true, mimeType: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
}

export type ApplicationCv = { applicationId: string; fileId: string; storageKey: string; mimeType: string; filename: string };

/**
 * SERVER ONLY (CV download route): the application's first file with its
 * storage key. The key opens the stream and must never be sent to a browser.
 */
export async function getApplicationCv(applicationId: string): Promise<ApplicationCv | null> {
  const id = normalizeUuid(applicationId);
  if (!id) return null;
  const file = await db.applicationFile.findFirst({
    where: { applicationId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, applicationId: true, storageKey: true, mimeType: true, filename: true },
  });
  if (!file) return null;
  return {
    applicationId: file.applicationId,
    fileId: file.id,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    filename: file.filename,
  };
}
