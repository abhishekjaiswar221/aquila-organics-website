// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SeedInputError, parseSeedInput } from "@/lib/admin-seed";

const email = "admin@example.test";

function envExampleAdminPassword(): string {
  const text = readFileSync(path.resolve(__dirname, "../../.env.example"), "utf8");
  const match = /^#?\s*ADMIN_PASSWORD=(.*)$/m.exec(text);
  if (!match) throw new Error(".env.example has no ADMIN_PASSWORD line");
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function rejectionOf(password: string): unknown {
  try {
    parseSeedInput({ email, password });
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("parseSeedInput", () => {
  it("rejects the ADMIN_PASSWORD placeholder from .env.example without echoing it", () => {
    const placeholder = envExampleAdminPassword();
    const error = rejectionOf(placeholder);
    expect(error).toBeInstanceOf(SeedInputError);
    expect((error as Error).message).toMatch(/placeholder/i);
    expect((error as Error).message).not.toContain(placeholder);
  });

  it.each([
    "change-me",
    "change-me-before-production",
    "CHANGE-ME-PLEASE-NOW",
    "replace-with-anything-long-enough",
    "  Replace-With-Spaces-Around  ",
  ])("rejects placeholder-style password %s", (password) => {
    const error = rejectionOf(password);
    expect(error).toBeInstanceOf(SeedInputError);
    expect((error as Error).message).not.toContain(password.trim());
  });

  it("rejects short passwords", () => {
    expect(rejectionOf("short-pw-11")).toBeInstanceOf(SeedInputError);
  });

  it("accepts a real passphrase and normalises the email", () => {
    expect(parseSeedInput({ email: "  Admin@Example.TEST ", password: "correct-horse-battery-staple" })).toEqual({
      email: "admin@example.test",
      password: "correct-horse-battery-staple",
    });
  });
});
