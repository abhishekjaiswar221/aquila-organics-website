import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

/**
 * How the client IP is found, for every IP-keyed rate limit (admin sign-in via
 * Better Auth, and RFQ submissions). See README "Deployment: reverse proxy and
 * client IP". The rules below deliberately match Better Auth's own resolver
 * (@better-auth/core utils/ip, checked by tests/unit/client-ip.test.ts), so
 * both limiters trust exactly the same addresses.
 */
export type ClientIpConfig = {
  /** Headers to read, in order. Default: ["x-forwarded-for"]. */
  ipAddressHeaders?: string[];
  /**
   * Proxies that append to x-forwarded-for. With none, a header is trusted
   * only when it holds exactly one address.
   */
  trustedProxies?: string[];
};

export function clientIpConfigFromEnv(): ClientIpConfig {
  return {
    ipAddressHeaders: env.AUTH_IP_HEADER ? [env.AUTH_IP_HEADER] : undefined,
    trustedProxies: env.AUTH_TRUSTED_PROXIES?.length ? env.AUTH_TRUSTED_PROXIES : undefined,
  };
}

const DEFAULT_IP_HEADERS = ["x-forwarded-for"];
const IPV6_SUBNET = 64;

const ipv4 = z.ipv4();
const ipv6 = z.ipv6();
const isIPv4 = (ip: string) => ipv4.safeParse(ip).success;
const isIPv6 = (ip: string) => ipv6.safeParse(ip).success;

function expandIPv6(ip: string): string[] {
  if (ip.includes("::")) {
    const [l, r] = ip.split("::");
    const left = l ? l.split(":") : [];
    const right = r ? r.split(":") : [];
    const zeros = Array<string>(8 - left.length - right.length).fill("0000");
    return [...left.map((g) => g.padStart(4, "0")), ...zeros, ...right.map((g) => g.padStart(4, "0"))];
  }
  return ip.split(":").map((g) => g.padStart(4, "0"));
}

/** IPv4 inside an IPv4-mapped IPv6 address (::ffff:a.b.c.d), else null. */
function mappedIPv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    if (isIPv4(v4)) return v4;
  }
  const parts = ip.split(":");
  if (parts.length === 7 && parts[5]?.toLowerCase() === "ffff") {
    const v4 = parts[6];
    if (v4 && isIPv4(v4)) return v4;
  }
  if (lower.includes("::ffff:") || lower.includes(":ffff:")) {
    const g = expandIPv6(ip);
    if (g.length === 8 && g.slice(0, 5).every((x) => x === "0000") && g[5] === "ffff" && g[6] && g[7]) {
      const byte = (s: string, at: number) => Number.parseInt(s.substring(at, at + 2), 16);
      return `${byte(g[6], 0)}.${byte(g[6], 2)}.${byte(g[7], 0)}.${byte(g[7], 2)}`;
    }
  }
  return null;
}

/** Canonical form; IPv6 is reduced to its /64 so one host cannot rotate addresses. */
function normalizeIp(ip: string): string {
  if (isIPv4(ip) || !isIPv6(ip)) return ip.toLowerCase();
  const v4 = mappedIPv4(ip);
  if (v4) return v4.toLowerCase();
  let bits = IPV6_SUBNET;
  return expandIPv6(ip)
    .map((group) => {
      if (bits <= 0) return "0000";
      if (bits >= 16) {
        bits -= 16;
        return group;
      }
      const masked = Number.parseInt(group, 16) & ((0xffff << (16 - bits)) & 0xffff);
      bits = 0;
      return masked.toString(16).padStart(4, "0");
    })
    .join(":")
    .toLowerCase();
}

function ipToBytes(ip: string): Uint8Array | null {
  if (isIPv4(ip)) return Uint8Array.from(ip.split(".").map(Number));
  if (!isIPv6(ip)) return null;
  const v4 = mappedIPv4(ip);
  if (v4) return Uint8Array.from(v4.split(".").map(Number));
  const bytes = new Uint8Array(16);
  expandIPv6(ip).forEach((g, i) => {
    const n = Number.parseInt(g, 16);
    bytes[i * 2] = (n >> 8) & 0xff;
    bytes[i * 2 + 1] = n & 0xff;
  });
  return bytes;
}

type Network = { bytes: Uint8Array; prefix: number };

function parseCidr(value: string): Network | null {
  const slash = value.lastIndexOf("/");
  const bytes = ipToBytes(slash === -1 ? value : value.slice(0, slash));
  if (!bytes) return null;
  const maxBits = bytes.length * 8;
  if (slash === -1) return { bytes, prefix: maxBits };
  const prefixPart = value.slice(slash + 1);
  if (!/^\d+$/.test(prefixPart)) return null;
  const prefix = Number(prefixPart);
  return prefix <= maxBits ? { bytes, prefix } : null;
}

function inNetwork(ip: Uint8Array, net: Network): boolean {
  if (ip.length !== net.bytes.length) return false;
  let bits = net.prefix;
  for (let i = 0; i < ip.length && bits > 0; i++) {
    const take = Math.min(8, bits);
    const mask = (0xff << (8 - take)) & 0xff;
    if (((ip[i] ?? 0) & mask) !== ((net.bytes[i] ?? 0) & mask)) return false;
    bits -= 8;
  }
  return true;
}

/**
 * Client IP from one forwarded-header value. The leftmost entry is spoofable,
 * so with trusted proxies the chain is walked from the right to the first
 * untrusted hop; without them only a single-address value is trusted. Null
 * when no trustworthy address can be found.
 */
export function ipFromHeaderValue(value: string, trustedProxies?: string[]): string | null {
  const hops = value
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (hops.length === 0) return null;
  const proxies = (trustedProxies ?? []).map(parseCidr).filter((n): n is Network => n !== null);
  if (proxies.length > 0) {
    for (let i = hops.length - 1; i >= 0; i--) {
      const ip = hops[i];
      const bytes = ip ? ipToBytes(ip) : null;
      if (!ip || !bytes) return null;
      if (proxies.some((net) => inNetwork(bytes, net))) continue;
      return normalizeIp(ip);
    }
    return null;
  }
  if (hops.length !== 1) return null;
  const only = hops[0];
  if (!only || !(isIPv4(only) || isIPv6(only))) return null;
  return normalizeIp(only);
}

/** The trusted client IP of a request, or null if none can be established. */
export function getClientIp(headers: Headers, config: ClientIpConfig = clientIpConfigFromEnv()): string | null {
  for (const name of config.ipAddressHeaders ?? DEFAULT_IP_HEADERS) {
    const value = headers.get(name);
    if (typeof value === "string") {
      const ip = ipFromHeaderValue(value, config.trustedProxies);
      if (ip) return ip;
    }
  }
  return null;
}

/** Salted SHA-256 of an IP: what is stored and used as a rate-limit key. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
