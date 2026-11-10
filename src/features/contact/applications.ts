import { findApplication } from "@/content/segments";
import type { ApplicationRecord } from "@/content/types";
import { contactSegmentId, type ContactType } from "./schema";

/**
 * The fixed application record (with its display name) for a contact type and slug, exact match.
 * Server-side only: it reads the page content records, which the client validator must not import.
 */
export function contactApplication(type: ContactType, slug: string): ApplicationRecord | undefined {
  const segment = contactSegmentId(type);
  return segment ? findApplication(segment, slug) : undefined;
}
