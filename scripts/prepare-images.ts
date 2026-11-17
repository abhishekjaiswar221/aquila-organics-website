// Prepares photos for the site: resizes and compresses everything in assets/incoming/<group>/ into
// public/images/<output>/ as WebP, and records each file's size and a tiny blur preview in
// src/content/image-data.generated.json (used by ImageFrame for a soft loading state).
//
//   npm run images:prepare
//
// Drop originals into assets/incoming/stock/ (free stock photos) or assets/incoming/old-site/ (files taken
// from the current Aquila site), run the command, then register each image in src/content/images.ts with its
// alt text and source. Originals are not committed (assets/incoming/.gitignore); the optimised files are.
//
// Photos are limited to 2000 px on the long edge; logos (any file whose name contains "logo") keep their
// transparency and are limited to 800 px wide. Next.js still serves smaller responsive AVIF/WebP variants.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "assets", "incoming");
const OUTPUT = path.join(ROOT, "public", "images");
const DATA_FILE = path.join(ROOT, "src", "content", "image-data.generated.json");

/** Output folder per input group. */
const GROUP_OUTPUT: Record<string, string> = { stock: "stock", "old-site": "client" };
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_PHOTO_EDGE = 2000;
const MAX_LOGO_WIDTH = 800;

type ImageData = { width: number; height: number; blurDataURL: string };

function slugName(file: string): string {
  return path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function processFile(input: string, outDir: string): Promise<{ publicPath: string; data: ImageData }> {
  const name = slugName(input);
  const isLogo = name.includes("logo");
  const pipeline = sharp(input).rotate();
  const resized = isLogo
    ? pipeline.resize({ width: MAX_LOGO_WIDTH, withoutEnlargement: true })
    : pipeline.resize({ width: MAX_PHOTO_EDGE, height: MAX_PHOTO_EDGE, fit: "inside", withoutEnlargement: true });
  const outFile = path.join(outDir, `${name}.webp`);
  const info = await resized.webp({ quality: isLogo ? 90 : 82, effort: 5 }).toFile(outFile);
  const blur = await sharp(outFile).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  const folder = path.basename(outDir);
  return {
    publicPath: `/images/${folder}/${name}.webp`,
    data: { width: info.width, height: info.height, blurDataURL: `data:image/webp;base64,${blur.toString("base64")}` },
  };
}

async function main(): Promise<number> {
  if (!existsSync(INPUT)) {
    console.error("images:prepare: no assets/incoming folder. Create assets/incoming/stock or assets/incoming/old-site.");
    return 1;
  }
  const existing: Record<string, ImageData> = existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, "utf8")) : {};
  let count = 0;

  for (const group of readdirSync(INPUT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const outName = GROUP_OUTPUT[group.name];
    if (!outName) {
      console.warn(`images:prepare: skipping unknown group "${group.name}" (known: ${Object.keys(GROUP_OUTPUT).join(", ")})`);
      continue;
    }
    const outDir = path.join(OUTPUT, outName);
    mkdirSync(outDir, { recursive: true });
    const files = readdirSync(path.join(INPUT, group.name)).filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()));
    for (const file of files) {
      const { publicPath, data } = await processFile(path.join(INPUT, group.name, file), outDir);
      existing[publicPath] = data;
      count += 1;
      console.log(`  ${publicPath}  ${data.width}x${data.height}`);
    }
  }

  // Forget entries whose file has been removed from public/images.
  for (const key of Object.keys(existing)) {
    if (!existsSync(path.join(ROOT, "public", key))) delete existing[key];
  }
  const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(DATA_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`images:prepare: ${count} images processed.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error("images:prepare failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
