import { describe, expect, it, vi } from "vitest";
import { LOCAL_SITE_URL, resolveSiteUrl } from "@/lib/seo/site-url";

const fresh = () => ({ warned: false });

describe("resolveSiteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL when it is set (trimmed) and never warns", () => {
    const warn = vi.fn();
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: " https://www.example.test ", NODE_ENV: "production" }, warn, fresh()),
    ).toBe("https://www.example.test");
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to localhost quietly outside production", () => {
    const warn = vi.fn();
    for (const NODE_ENV of ["development", "test", undefined]) {
      expect(resolveSiteUrl({ NODE_ENV }, warn, fresh())).toBe(LOCAL_SITE_URL);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("in production an unset value still falls back (no throw) but warns once per process", () => {
    const warn = vi.fn();
    const state = fresh();
    for (let i = 0; i < 3; i++) {
      expect(resolveSiteUrl({ NODE_ENV: "production" }, warn, state)).toBe(LOCAL_SITE_URL);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/NEXT_PUBLIC_SITE_URL is not set/);
    expect(warn.mock.calls[0]?.[0]).toContain(LOCAL_SITE_URL);
  });

  it("treats a blank value as unset", () => {
    const warn = vi.fn();
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "   ", NODE_ENV: "production" }, warn, fresh())).toBe(LOCAL_SITE_URL);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("shares the once-per-process state by default", () => {
    const warn = vi.fn();
    resolveSiteUrl({ NODE_ENV: "production" }, warn);
    resolveSiteUrl({ NODE_ENV: "production" }, warn);
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
