import { contactApplication, isContactType, type ContactType } from "@/features/contact/schema";

/** No valid type or slug is anywhere near this long; longer values are dropped unread. */
const MAX_PARAM = 64;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && v.length <= MAX_PARAM ? v : undefined;
}

/**
 * Prefill for /contact?type=<TYPE>&application=<slug>. A URL convenience, so
 * anything invalid is silently dropped (never an error): only the first value
 * of a repeated key is considered, the type must be one of CONTACT_TYPES
 * exactly, and the application is kept only when it is a fixed slug of that
 * type's segment.
 */
export function parseContactParams(search: Record<string, string | string[] | undefined>): {
  type?: ContactType;
  application?: string;
} {
  const type = first(search.type);
  if (!isContactType(type)) return {};
  const slug = first(search.application);
  const application = slug === undefined ? undefined : contactApplication(type, slug);
  return application ? { type, application: application.slug } : { type };
}
