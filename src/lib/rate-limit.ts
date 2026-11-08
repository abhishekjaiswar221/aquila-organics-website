export interface RateLimitStore {
  increment(key: string, windowStart: Date): Promise<number>
}

export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs)
  const count = await store.increment(key, windowStart)
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
}
