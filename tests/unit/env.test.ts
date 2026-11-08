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
