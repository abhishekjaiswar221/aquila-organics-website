import type { Metadata } from "next";

/** Every admin page: never indexed, links never followed. */
export const ADMIN_ROBOTS: Metadata["robots"] = { index: false, follow: false };

/** Metadata for an admin page titled "<title> | Admin". */
export function adminMetadata(title: string): Metadata {
  return { title: { absolute: `${title} | Admin` }, robots: ADMIN_ROBOTS };
}
