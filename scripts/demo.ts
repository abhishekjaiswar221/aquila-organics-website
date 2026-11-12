// Demo kit: loads or removes the clearly labelled SAMPLE catalogue (data/demo-products.json).
//
//   npm run demo:seed                 load the sample products (published and verified)
//   npm run demo:seed -- --with-job   also add one sample job opening
//   npm run demo:seed -- --force      allow it on a database that already has other products
//   npm run demo:reset                remove only the sample products and the sample opening
//
// Never run this against a real database: it refuses to unless --force is given.
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resetDemo, seedDemo } from "@/features/demo/seed";
import { db } from "@/lib/db";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args.find((a) => !a.startsWith("--"));

  if (command === "reset") {
    const result = await resetDemo(db);
    console.log(`demo:reset: removed ${result.products} sample products and ${result.jobs} sample openings.`);
    return 0;
  }
  if (command !== "seed") {
    console.error("Usage: npm run demo:seed [-- --with-job] [-- --force]   |   npm run demo:reset");
    return 1;
  }

  const file = path.resolve(process.cwd(), "data/demo-products.json");
  const result = await seedDemo(db, JSON.parse(readFileSync(file, "utf8")), {
    force: args.includes("--force"),
    includeJob: args.includes("--with-job"),
  });
  if (!result.ok) {
    console.error(`demo:seed: ${result.reason}`);
    return 1;
  }
  console.log(
    `demo:seed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ` +
      `${result.published} newly published${result.jobCreated ? ", 1 sample opening added" : ""}.`,
  );
  return 0;
}

main()
  .then(async (code) => {
    await db.$disconnect();
    process.exit(code);
  })
  .catch(async (error: unknown) => {
    console.error("demo failed:", error instanceof Error ? error.message : error);
    try {
      await db.$disconnect();
    } finally {
      process.exit(1);
    }
  });
