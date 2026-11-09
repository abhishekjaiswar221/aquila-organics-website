// The publish rule (spec §3): a PUBLISHED product must be verified and have a
// non-empty name and slug. Enforced here with friendly messages, and by the
// database CHECK product_published_requires_verified as a backstop.

export const PUBLISH_CHECK_CONSTRAINT = "product_published_requires_verified";

export const UNVERIFIED_ERROR =
  "This product has not been verified yet. A super admin must mark it verified before it can be published.";
export const PUBLISH_REQUIREMENTS_ERROR =
  "This product cannot be published: it needs a name and a URL slug, and it must be verified.";

export type PublishCandidate = { name: string; slug: string; verified: boolean };

/** Why this product may not be published, or null when it may. */
export function publishBlockReason(p: PublishCandidate): string | null {
  if (p.name.trim() === "" || p.slug.trim() === "") return PUBLISH_REQUIREMENTS_ERROR;
  if (!p.verified) return UNVERIFIED_ERROR;
  return null;
}

/** True when `err` is the database refusing a publish through the CHECK constraint. */
export function isPublishCheckViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  // Walk the error and its causes (the driver adapter wraps the Postgres error).
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const { message, meta, cause } = current as { message?: unknown; meta?: unknown; cause?: unknown };
    if (typeof message === "string" && message.includes(PUBLISH_CHECK_CONSTRAINT)) return true;
    if (meta && typeof meta === "object") {
      try {
        if (JSON.stringify(meta).includes(PUBLISH_CHECK_CONSTRAINT)) return true;
      } catch {
        // Unserialisable meta: ignore.
      }
    }
    current = cause;
  }
  return false;
}
