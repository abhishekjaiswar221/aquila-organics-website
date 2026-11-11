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

  it("requires the four R2 variables only when STORAGE_DRIVER=r2", () => {
    const r2 = {
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "key-id",
      R2_SECRET_ACCESS_KEY: "super-secret-value",
      R2_BUCKET: "bucket",
    };
    expect(parseEnv({ ...valid, STORAGE_DRIVER: "r2", ...r2 }).R2_BUCKET).toBe("bucket");
    expect(parseEnv(valid).R2_BUCKET).toBeUndefined();
    expect(() => parseEnv({ ...valid, STORAGE_DRIVER: "r2" })).toThrowError(
      /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET/,
    );
    const { R2_SECRET_ACCESS_KEY: _omit, ...partial } = r2;
    void _omit;
    let message = "";
    try {
      parseEnv({ ...valid, STORAGE_DRIVER: "r2", ...partial });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/R2_SECRET_ACCESS_KEY/);
    expect(message).not.toMatch(/R2_BUCKET|acct|key-id/);
    expect(() => parseEnv({ ...valid, STORAGE_DRIVER: "r2", ...r2, R2_BUCKET: "  " })).toThrowError(/R2_BUCKET/);
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
