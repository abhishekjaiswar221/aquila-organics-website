import Link from "next/link";
import { PageHeader, linkCls } from "@/components/admin/ui";

// notFound() from an admin page (e.g. an unknown enquiry id), inside the admin shell.
export default function AdminNotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <p className="mt-6 text-sm">
        This record does not exist or has been removed.{" "}
        <Link href="/admin/enquiries" className={linkCls}>
          Back to enquiries
        </Link>
      </p>
    </>
  );
}
