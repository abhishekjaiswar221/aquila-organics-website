// Creates the first SUPER_ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD.
//
//   npm run seed:admin                       # create, or leave an existing user's password alone
//   npm run seed:admin -- --reset-password   # also set an existing user's password (signs out their sessions)
//
// Idempotent: re-running never creates a second user. An existing user with
// this email is promoted to SUPER_ADMIN. The password is never printed.
import "dotenv/config";
import { SeedInputError, seedAdmin } from "@/lib/admin-seed";
import { db } from "@/lib/db";

async function main(): Promise<number> {
  const resetPassword = process.argv.slice(2).includes("--reset-password");
  try {
    const result = await seedAdmin({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      resetPassword,
    });
    if (result.created) {
      console.log("seed:admin: created SUPER_ADMIN account.");
    } else {
      const notes = [
        result.promoted ? "promoted to SUPER_ADMIN" : "role unchanged",
        result.passwordSet ? "password set" : "password unchanged",
      ];
      console.log(`seed:admin: account already exists (${notes.join(", ")}).`);
    }
    return 0;
  } catch (error) {
    if (error instanceof SeedInputError) {
      console.error(`seed:admin: ${error.message}`);
    } else {
      // Avoid dumping internals (connection strings, stack traces) by default.
      console.error("seed:admin: failed. Check DATABASE_URL and that migrations have run.");
      if (process.env.DEBUG) console.error(error);
    }
    return 1;
  } finally {
    await db.$disconnect();
  }
}

main().then((code) => {
  process.exitCode = code;
});
