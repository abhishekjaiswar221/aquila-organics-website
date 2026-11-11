import type { ApplicationStatus } from "@/generated/prisma/enums";

export type { ApplicationStatus };

/** Every application status, in hiring-workflow order. Client-safe (no server imports). */
export const APPLICATION_STATUSES = [
  "NEW",
  "REVIEWING",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
  "REJECTED",
] as const satisfies readonly ApplicationStatus[];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  SHORTLISTED: "Shortlisted",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}
