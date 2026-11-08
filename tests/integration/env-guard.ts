// Integration tests truncate tables. This guard makes sure they can only ever
// point at the dedicated test database, never the development one.

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

/**
 * Returns the test database URL, or throws when `DATABASE_URL_TEST` is
 * missing, unparsable, or names the same database as `DATABASE_URL`.
 */
export function resolveTestDatabaseUrl(source: Record<string, string | undefined>): string {
  const testUrl = source.DATABASE_URL_TEST?.trim();
  if (!testUrl) {
    throw new Error("Refusing to run integration tests: DATABASE_URL_TEST is not set.");
  }
  const testName = databaseName(testUrl);
  if (!testName) {
    throw new Error("Refusing to run integration tests: DATABASE_URL_TEST has no database name.");
  }
  const devUrl = source.DATABASE_URL?.trim();
  if (devUrl && (devUrl === testUrl || databaseName(devUrl) === testName)) {
    throw new Error(
      "Refusing to run integration tests: DATABASE_URL_TEST points at the same database as DATABASE_URL.",
    );
  }
  return testUrl;
}
