import { redirect } from "next/navigation";
import { adminMetadata } from "@/features/admin/metadata";
import { adminHomePath } from "@/lib/access";
import { requireRole } from "@/lib/permissions";

export const instant = false;
export const metadata = adminMetadata("Admin");

// Bare /admin: signed out -> login (requireRole), not permitted -> 403, else the role's first page.
export default async function AdminIndexPage() {
  const { role } = await requireRole();
  redirect(adminHomePath(role));
}
