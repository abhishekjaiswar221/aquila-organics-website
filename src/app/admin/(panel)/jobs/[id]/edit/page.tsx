import Link from "next/link";
import { notFound } from "next/navigation";
import { JobForm } from "@/components/admin/job-form";
import { Badge, PageHeader, linkCls } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { updateJob } from "@/features/careers/job-actions";
import { getJobForEdit } from "@/features/careers/job-queries";
import { JOB_STATUS_LABELS } from "@/features/careers/job-schema";
import { requireAction } from "@/lib/permissions";

// Per request (session + database), no `use cache`.
export const instant = false;
export const metadata = adminMetadata("Edit opening");

export default async function EditJobPage({ params }: PageProps<"/admin/jobs/[id]/edit">) {
  await requireAction("jobs.manage");
  const { id } = await params;
  const job = await getJobForEdit(id);
  if (!job) notFound();
  return (
    <>
      <PageHeader title="Edit opening">
        <Link href="/admin/jobs" className={linkCls}>
          Back to openings
        </Link>
      </PageHeader>
      <p className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span>{job.title}</span>
        <Badge value={job.status}>{JOB_STATUS_LABELS[job.status]}</Badge>
      </p>
      <JobForm action={updateJob} job={job} />
    </>
  );
}
