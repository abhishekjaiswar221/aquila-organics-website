import { describe, expect, it } from "vitest";
import { auth, createAuth } from "@/lib/auth";

// Better Auth's memory limiter store is module-wide and keyed by
// "<ip>|<path>", so every test uses its own client IPs.
type Handler = { handler: (request: Request) => Promise<Response> };

function failedSignIn(target: Handler, ipHeaders: Record<string, string>): Promise<Response> {
  return target.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", ...ipHeaders },
      body: JSON.stringify({ email: "nobody@example.test", password: "definitely-not-right" }),
    }),
  );
}

async function statuses(target: Handler, count: number, headers: () => Record<string, string>) {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push((await failedSignIn(target, headers())).status);
  return out;
}

describe("sign-in rate limiting", () => {
  it("returns 429 after five failed sign-ins from one IP, other IPs unaffected", async () => {
    expect(await statuses(auth, 5, () => ({ "x-forwarded-for": "198.51.100.1" }))).toEqual([
      401, 401, 401, 401, 401,
    ]);
    const blocked = await failedSignIn(auth, { "x-forwarded-for": "198.51.100.1" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("x-retry-after")).toBeTruthy();
    expect((await failedSignIn(auth, { "x-forwarded-for": "198.51.100.2" })).status).toBe(401);
  });

  it("with trusted proxies, clients behind an appending proxy get separate buckets", async () => {
    const proxied = createAuth({ trustedProxies: ["10.0.0.1"] });
    const chain = (client: string) => ({ "x-forwarded-for": `${client}, 10.0.0.1` });
    expect(await statuses(proxied, 5, () => chain("198.51.100.10"))).toEqual([401, 401, 401, 401, 401]);
    expect((await failedSignIn(proxied, chain("198.51.100.10"))).status).toBe(429);
    // A different client through the same proxy is not locked out.
    expect((await failedSignIn(proxied, chain("198.51.100.11"))).status).toBe(401);
    // A client-supplied extra hop does not escape its own bucket.
    expect(
      (await failedSignIn(proxied, { "x-forwarded-for": "203.0.113.99, 198.51.100.10, 10.0.0.1" })).status,
    ).toBe(429);
  });

  it("with a configured IP header, a rotating spoofed x-forwarded-for is ignored", async () => {
    const edge = createAuth({ ipAddressHeaders: ["cf-connecting-ip"] });
    let n = 0;
    const headers = () => ({ "cf-connecting-ip": "198.51.100.20", "x-forwarded-for": `203.0.113.${++n}` });
    expect(await statuses(edge, 5, headers)).toEqual([401, 401, 401, 401, 401]);
    expect((await failedSignIn(edge, headers())).status).toBe(429);
  });
});
