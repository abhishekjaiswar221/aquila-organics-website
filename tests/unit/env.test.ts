import { describe, expect, it } from "vitest";
import { parseEnv, secretEnvSchema } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/aquila",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  STORAGE_DRIVER: "local",
  EMAIL_DRIVER: "dev",
  RATE_LIMIT_SALT: "salt-salt-salt",
};

describe("parseEnv", () => {
  it("throws naming every missing key", () => {
    expect(() => parseEnv({})).toThrowError(
      /DATABASE_URL[\s\S]*BETTER_AUTH_SECRET[\s\S]*BETTER_AUTH_URL[\s\S]*RATE_LIMIT_SALT/,
    );
  });

  it("returns typed values for a valid source, admin keys optional", () => {
    const env = parseEnv(valid);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.EMAIL_DRIVER).toBe("dev");
    expect(env.ADMIN_EMAIL).toBeUndefined();
    expect(parseEnv({ ...valid, ADMIN_EMAIL: "a@b.co", ADMIN_PASSWORD: "pw" }).ADMIN_EMAIL).toBe(
      "a@b.co",
    );
  });

  it("rejects unsupported drivers", () => {
    expect(() => parseEnv({ ...valid, STORAGE_DRIVER: "s3" })).toThrowError(/STORAGE_DRIVER/);
  });

  it("keeps secrets out of NEXT_PUBLIC_ keys", () => {
    const keys = Object.keys(secretEnvSchema.shape);
    expect(keys.filter((k) => k.startsWith("NEXT_PUBLIC_"))).toEqual([]);
  });
});

describe("parseEnv client-IP settings", () => {
  it("leaves both unset by default", () => {
    const env = parseEnv(valid);
    expect(env.AUTH_IP_HEADER).toBeUndefined();
    expect(env.AUTH_TRUSTED_PROXIES).toBeUndefined();
  });

  it("parses a lower-cased header name and a comma-separated proxy list", () => {
    const env = parseEnv({
      ...valid,
      AUTH_IP_HEADER: "CF-Connecting-IP",
      AUTH_TRUSTED_PROXIES: " 10.0.0.1, 192.0.2.0/24 ,2001:db8::/32,",
    });
    expect(env.AUTH_IP_HEADER).toBe("cf-connecting-ip");
    expect(env.AUTH_TRUSTED_PROXIES).toEqual(["10.0.0.1", "192.0.2.0/24", "2001:db8::/32"]);
  });

  it("rejects malformed values", () => {
    expect(() => parseEnv({ ...valid, AUTH_TRUSTED_PROXIES: "10.0.0.1,not-an-ip" })).toThrowError(
      /AUTH_TRUSTED_PROXIES/,
    );
    expect(() => parseEnv({ ...valid, AUTH_IP_HEADER: "x forwarded for" })).toThrowError(/AUTH_IP_HEADER/);
  });
});
