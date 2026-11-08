import { describe, expect, it } from "vitest";
import { resolveTestDatabaseUrl } from "../integration/env-guard";

const dev = "postgresql://u:p@localhost:5432/aquila";
const test = "postgresql://u:p@localhost:5432/aquila_test";

describe("resolveTestDatabaseUrl", () => {
  it("returns the test URL when it differs from the dev URL", () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: dev, DATABASE_URL_TEST: test })).toBe(test);
  });

  it("refuses when DATABASE_URL_TEST is missing or blank", () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: dev })).toThrow(/DATABASE_URL_TEST is not set/);
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: dev, DATABASE_URL_TEST: "  " })).toThrow(
      /not set/,
    );
  });

  it("refuses when DATABASE_URL_TEST equals DATABASE_URL", () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: dev, DATABASE_URL_TEST: dev })).toThrow(
      /same database/,
    );
  });

  it("refuses when both URLs name the same database on a different host spelling", () => {
    const sameDb = "postgresql://other:x@127.0.0.1:5432/aquila";
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: dev, DATABASE_URL_TEST: sameDb })).toThrow(
      /same database/,
    );
  });

  it("refuses a URL without a database name", () => {
    expect(() =>
      resolveTestDatabaseUrl({ DATABASE_URL: dev, DATABASE_URL_TEST: "postgresql://u:p@localhost:5432" }),
    ).toThrow(/no database name/);
  });
});
