import { UserManager } from "@/components/admin/user-manager";
import { PageHeader } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { listUsers } from "@/features/users/queries";
import { requireAction } from "@/lib/permissions";

// Per request (session + database), no `use cache`: a change shows at once.
export const instant = false;
export const metadata = adminMetadata("Users");

export default async function AdminUsersPage() {
  const actor = await requireAction("users.manage");
  const users = await listUsers();
  return (
    <>
      <PageHeader title="Users">
        {users.length} {users.length === 1 ? "user" : "users"}. Disabling a user signs them out at once.
      </PageHeader>
      <UserManager users={users} currentUserId={actor.userId} />
    </>
  );
}
