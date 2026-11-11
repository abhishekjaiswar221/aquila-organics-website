import "server-only";
import { db } from "@/lib/db";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
};

/** Every user, oldest first. Never selects password data (that lives on the account table). */
export async function listUsers(): Promise<UserRow[]> {
  return db.user.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, email: true, role: true, disabled: true, mustChangePassword: true, createdAt: true },
  });
}
