import { describe, expect, it } from "vitest";
import { DEFAULT_E2E_PORT, resolveE2ePort } from "../e2e/support/e2e-port";

describe("resolveE2ePort (shell environment first, then .env, default 3100)", () => {
  it("defaults to 3100 when neither is set (blank counts as unset)", () => {
    expect(DEFAULT_E2E_PORT).toBe(3100);
    expect(resolveE2ePort({}, {})).toBe(3100);
    expect(resolveE2ePort({ E2E_PORT: "  " }, { E2E_PORT: "" })).toBe(3100);
  });

  it("uses the .env value when only .env sets it", () => {
    expect(resolveE2ePort({}, { E2E_PORT: "3110" })).toBe(3110);
    expect(resolveE2ePort({ E2E_PORT: "" }, { E2E_PORT: "3110" })).toBe(3110);
  });

  it("lets the shell environment win over .env", () => {
    expect(resolveE2ePort({ E2E_PORT: "3120" }, { E2E_PORT: "3110" })).toBe(3120);
    expect(resolveE2ePort({ E2E_PORT: "3120" }, {})).toBe(3120);
  });

  it("accepts the full port range", () => {
    expect(resolveE2ePort({ E2E_PORT: "1" }, {})).toBe(1);
    expect(resolveE2ePort({}, { E2E_PORT: "65535" })).toBe(65535);
  });

  it.each(["abc", "0", "65536", "-1", "3100.5", "31 00", "0x0c1c"])("rejects %j with an error naming E2E_PORT", (value) => {
    expect(() => resolveE2ePort({ E2E_PORT: value }, {})).toThrow(/E2E_PORT/);
    expect(() => resolveE2ePort({}, { E2E_PORT: value })).toThrow(/E2E_PORT must be an integer from 1 to 65535/);
  });
});
