import { db } from "@/lib/db";
import type { RateLimitStore } from "@/lib/rate-limit";

/**
 * RateLimitHit-backed store. One INSERT ... ON CONFLICT statement increments
 * the (key, windowStart) row atomically, so concurrent requests can neither
 * lose a count nor hit a unique-constraint race.
 */
export const dbRateLimitStore: RateLimitStore = {
  async increment(key, windowStart) {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limit_hit" ("key", "windowStart", "count", "updatedAt")
      VALUES (${key}, ${windowStart}, 1, now())
      ON CONFLICT ("key", "windowStart")
      DO UPDATE SET "count" = "rate_limit_hit"."count" + 1, "updatedAt" = now()
      RETURNING "count"`;
    const count = rows[0]?.count;
    if (typeof count !== "number") throw new Error("Rate limit increment returned no count");
    return count;
  },
};
