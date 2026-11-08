// Imports products from a JSON array or CSV file as unverified DRAFT rows.
//
//   npm run import:products -- data/legacy-products.json
//   npm run import:products -- products.csv
//
// CSV header: name,slug,code,casNumber,category,description,sourceNote
// (optional "applications" column, semicolon-separated). Existing products
// (matched by slug) keep their status and verified flag.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { csvToProductRows } from "@/features/products/csv";
import { importProducts } from "@/features/products/import";
import { db } from "@/lib/db";

async function main(): Promise<number> {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: npm run import:products -- <file.json|file.csv>");
    return 1;
  }

  let rows: unknown[];
  try {
    const text = readFileSync(file, "utf8");
    if (file.toLowerCase().endsWith(".csv")) {
      rows = csvToProductRows(text);
    } else {
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        console.error("import:products: the JSON file must contain an array of products.");
        return 1;
      }
      rows = parsed;
    }
  } catch (error) {
    console.error(
      `import:products: cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }

  const result = await importProducts(rows, db);
  console.log(
    `import:products: ${result.created} created, ${result.updated} updated, ${result.skipped.length} skipped (all new rows are DRAFT and unverified).`,
  );
  for (const s of result.skipped) console.log(`  row ${s.index + 1}: ${s.reason}`);
  return 0;
}

main()
  .then(async (code) => {
    await db.$disconnect();
    process.exit(code);
  })
  .catch(async (error: unknown) => {
    console.error("import:products failed:", error instanceof Error ? error.message : error);
    try {
      await db.$disconnect();
    } catch {
      // the client may never have been created (e.g. invalid environment)
    }
    process.exit(1);
  });
