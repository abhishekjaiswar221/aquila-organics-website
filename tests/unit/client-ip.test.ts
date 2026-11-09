import { describe, expect, it } from "vitest";
// The login limiter's own resolver: the RFQ limiter must apply the same rules.
import { getIPFromHeader } from "@better-auth/core/utils/ip";
import { getClientIp, hashIp, ipFromHeaderValue } from "@/lib/client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("getClientIp", () => {
  it("trusts a single-address x-forwarded-for when no proxies are configured", () => {
    expect(getClientIp(h({ "x-forwarded-for": "198.51.100.7" }), {})).toBe("198.51.100.7");
    expect(getClientIp(h({ "x-forwarded-for": " 198.51.100.7 " }), {})).toBe("198.51.100.7");
  });

  it("refuses a multi-address header without trusted proxies (first value is spoofable)", () => {
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" }), {})).toBeNull();
  });

  it("refuses junk and missing headers", () => {
    expect(getClientIp(h({ "x-forwarded-for": "not-an-ip" }), {})).toBeNull();
    expect(getClientIp(h({ "x-forwarded-for": "" }), {})).toBeNull();
    expect(getClientIp(h({}), {})).toBeNull();
  });

  it("strips trusted proxies from the right and stops at the first untrusted hop", () => {
    const config = { trustedProxies: ["10.0.0.0/8"] };
    expect(getClientIp(h({ "x-forwarded-for": "198.51.100.10, 10.0.0.1" }), config)).toBe("198.51.100.10");
    // A client-supplied extra hop on the left does not change the result.
    expect(
      getClientIp(h({ "x-forwarded-for": "203.0.113.99, 198.51.100.10, 10.0.0.1, 10.2.3.4" }), config),
    ).toBe("198.51.100.10");
    // Every hop trusted: no client address.
    expect(getClientIp(h({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" }), config)).toBeNull();
  });

  it("with a configured header reads only that header", () => {
    const config = { ipAddressHeaders: ["cf-connecting-ip"] };
    expect(
      getClientIp(h({ "cf-connecting-ip": "198.51.100.20", "x-forwarded-for": "203.0.113.1" }), config),
    ).toBe("198.51.100.20");
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.1" }), config)).toBeNull();
  });

  it("normalises IPv6 to its /64 and IPv4-mapped IPv6 to IPv4", () => {
    expect(getClientIp(h({ "x-forwarded-for": "2001:DB8:1:2:3:4:5:6" }), {})).toBe(
      "2001:0db8:0001:0002:0000:0000:0000:0000",
    );
    expect(getClientIp(h({ "x-forwarded-for": "::ffff:192.0.2.1" }), {})).toBe("192.0.2.1");
  });

  it("agrees with Better Auth's resolver (used by the login limiter)", () => {
    const cases: [string, string[] | undefined][] = [
      ["198.51.100.7", undefined],
      ["203.0.113.9, 198.51.100.7", undefined],
      ["198.51.100.10, 10.0.0.1", ["10.0.0.1"]],
      ["203.0.113.99, 198.51.100.10, 10.0.0.1", ["10.0.0.0/8"]],
      ["10.0.0.1, 10.0.0.2", ["10.0.0.0/8"]],
      ["garbage, 10.0.0.1", ["10.0.0.1"]],
      ["2001:db8::1", undefined],
      ["::ffff:192.0.2.1", undefined],
      ["2001:db8::1, fd00::1", ["fd00::/8"]],
      ["", undefined],
      ["not-an-ip", undefined],
    ];
    for (const [value, trustedProxies] of cases) {
      expect(ipFromHeaderValue(value, trustedProxies), value).toBe(
        getIPFromHeader(value, { trustedProxies }),
      );
    }
  });
});

describe("hashIp", () => {
  it("is a salted SHA-256 hex digest, never the raw IP", () => {
    const a = hashIp("198.51.100.7", "salt-one-12345");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("198.51.100.7");
    expect(hashIp("198.51.100.7", "salt-one-12345")).toBe(a);
    expect(hashIp("198.51.100.7", "salt-two-12345")).not.toBe(a);
    expect(hashIp("198.51.100.8", "salt-one-12345")).not.toBe(a);
  });
});
