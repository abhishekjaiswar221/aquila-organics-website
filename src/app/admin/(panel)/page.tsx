import { redirect } from "next/navigation";
import { ADMIN_HOME_PATH } from "@/features/admin/login";
import { adminMetadata } from "@/features/admin/metadata";
import { requireRole } from "@/lib/permissions";

export const instant = false;
export const metadata = adminMetadata("Admin");

// Bare /admin: signed out -> login (requireRole), not permitted -> 403, else the products list.
export default async function AdminIndexPage() {
  await requireRole();
  redirect(ADMIN_HOME_PATH);
}
