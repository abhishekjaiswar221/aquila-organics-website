import { Client } from "pg";

/*
 * The integration suite and the e2e suite share one database (aquila_test) and
 * both reset or seed it, so running them at the same time corrupts both runs in
 * confusing ways. Each takes this session-level Postgres advisory lock for the
 * whole run; the second one to start fails at once with a clear message instead.
 * The lock lives on a dedicated connection, so it is also released by Postgres if
 * the process dies without running teardown.
 */
const LOCK_KEY_A = 7_301_001;
const LOCK_KEY_B = 4_200_017;

let held: Client | null = null;

export async function acquireTestDbLock(databaseUrl: string, who: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1, $2) AS ok", [
      LOCK_KEY_A,
      LOCK_KEY_B,
    ]);
    if (!rows[0]?.ok) {
      throw new Error(
        `${who}: the shared test database is already in use by another test run (integration and e2e ` +
          `share aquila_test). Wait for that run to finish, then start again.`,
      );
    }
  } catch (err) {
    await client.end().catch(() => undefined);
    throw err;
  }
  held = client;
}

export async function releaseTestDbLock(): Promise<void> {
  const client = held;
  held = null;
  if (client) await client.end().catch(() => undefined);
}
