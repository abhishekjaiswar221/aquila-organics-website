import Link from "next/link";
import { JobForm } from "@/components/admin/job-form";
import { PageHeader, linkCls } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { createJob } from "@/features/careers/job-actions";
import { requireAction } from "@/lib/permissions";

// Per request (session), no `use cache`.
export const instant = false;
export const metadata = adminMetadata("New opening");

export default async function NewJobPage() {
  await requireAction("jobs.manage");
  return (
    <>
      <PageHeader title="New opening">
        <Link href="/admin/jobs" className={linkCls}>
          Back to openings
        </Link>
      </PageHeader>
      <JobForm action={createJob} />
    </>
  );
}
