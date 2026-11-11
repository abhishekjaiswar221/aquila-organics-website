import { describe, expect, it } from "vitest";
import { generatePassword } from "@/features/users/password";

describe("generatePassword", () => {
  it("is 20 characters with every character class and no ambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(20);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[^A-Za-z0-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });

  it("gives 1,000 distinct passwords", () => {
    expect(new Set(Array.from({ length: 1000 }, generatePassword)).size).toBe(1000);
  });
});
