import { describe, expect, it } from 'vitest'
import { checkRateLimit, type RateLimitStore } from '@/lib/rate-limit'

function fakeStore(): RateLimitStore {
  const counts = new Map<string, number>()
  return {
    async increment(key, windowStart) {
      const k = `${key}:${windowStart.getTime()}`
      const next = (counts.get(k) ?? 0) + 1
      counts.set(k, next)
      return next
    },
  }
}

describe('checkRateLimit', () => {
  const windowMs = 60_000
  const t0 = new Date(1_700_000_000_000)

  it('allows up to the limit then denies', async () => {
    const store = fakeStore()
    for (let i = 1; i <= 5; i++) {
      const r = await checkRateLimit(store, 'ip', 5, windowMs, t0)
      expect(r).toEqual({ allowed: true, remaining: 5 - i })
    }
    expect(await checkRateLimit(store, 'ip', 5, windowMs, t0)).toEqual({
      allowed: false,
      remaining: 0,
    })
  })

  it('resets in a new window', async () => {
    const store = fakeStore()
    for (let i = 0; i < 6; i++) await checkRateLimit(store, 'ip', 5, windowMs, t0)
    const later = new Date(t0.getTime() + windowMs)
    expect(await checkRateLimit(store, 'ip', 5, windowMs, later)).toEqual({
      allowed: true,
      remaining: 4,
    })
  })

  it('tracks keys independently', async () => {
    const store = fakeStore()
    for (let i = 0; i < 6; i++) await checkRateLimit(store, 'a', 5, windowMs, t0)
    expect((await checkRateLimit(store, 'b', 5, windowMs, t0)).allowed).toBe(true)
  })
})
