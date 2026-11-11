import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => vi.fn<(slug: string) => Promise<boolean>>());
vi.mock("@/features/careers/job-queries", () => ({ isPublishedJobSlug: lookup }));

const { proxy } = await import("@/proxy");

const call = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`));
const isRewriteTo404 = (res: Response) => res.headers.get("x-middleware-rewrite")?.endsWith("/_catalogue/not-found") ?? false;
const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  lookup.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("proxy: /careers/:slug", () => {
  it("lets a currently published opening through", async () => {
    lookup.mockResolvedValue(true);
    expect(passesThrough(await call("/careers/quality-analyst"))).toBe(true);
    expect(lookup).toHaveBeenCalledWith("quality-analyst");
  });

  it("answers the not-found rewrite for an unknown, draft, closed or expired slug", async () => {
    lookup.mockResolvedValue(false);
    expect(isRewriteTo404(await call("/careers/not-public"))).toBe(true);
  });

  it("never looks up the reserved routes", async () => {
    expect(passesThrough(await call("/careers/apply"))).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("does not touch the list, the confirmation or deeper paths", async () => {
    expect(passesThrough(await call("/careers"))).toBe(true);
    expect(passesThrough(await call("/careers/apply/confirmation"))).toBe(true);
    expect(passesThrough(await call("/careers/a/b"))).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("treats a slug that cannot be decoded as unknown", async () => {
    expect(isRewriteTo404(await call("/careers/%E0%A4%A"))).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("fails open on a database error and logs only the error class name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    lookup.mockImplementation(async () => {
      throw new TypeError("connect ECONNREFUSED secret-host:5432");
    });
    expect(passesThrough(await call("/careers/quality-analyst"))).toBe(true);
    expect(log).toHaveBeenCalledWith("[proxy] job slug lookup failed:", "TypeError");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-host");
  });
});
