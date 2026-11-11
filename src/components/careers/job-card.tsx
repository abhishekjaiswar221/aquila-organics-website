import Link from "next/link";
import { EMPLOYMENT_LABELS } from "@/features/careers/job-schema";
import type { PublishedJob } from "@/features/careers/job-queries";
import { jobPath } from "@/features/careers/paths";

type Props = { job: Pick<PublishedJob, "slug" | "title" | "location" | "employmentType" | "summary" | "department"> };

/** One opening on the list: only what an admin entered, nothing added. */
export function JobCard({ job }: Props) {
  return (
    <li className="border-t border-charcoal pt-6">
      <h2 className="text-2xl sm:text-3xl">
        <Link href={jobPath(job.slug)} className="underline-offset-4 hover:text-bronze-text hover:underline">
          {job.title}
        </Link>
      </h2>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {[job.location, EMPLOYMENT_LABELS[job.employmentType], job.department].filter(Boolean).join(" / ")}
      </p>
      <p className="mt-4 max-w-2xl text-base leading-relaxed">{job.summary}</p>
      <p className="mt-4 text-sm">
        <Link
          href={jobPath(job.slug)}
          aria-label={`View ${job.title}`}
          className="text-bronze-text underline underline-offset-4"
        >
          View opening
        </Link>
      </p>
    </li>
  );
}
