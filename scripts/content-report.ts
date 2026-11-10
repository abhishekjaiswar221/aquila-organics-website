import * as about from "../src/content/about";
import * as certifications from "../src/content/certifications";
import * as contact from "../src/content/contact";
import * as home from "../src/content/home";
import * as homeBusiness from "../src/content/home-business";
import * as innovation from "../src/content/innovation";
import * as segments from "../src/content/segments";
import * as sustainability from "../src/content/sustainability";
import { collectOpenBlocks } from "../src/content/report";

/**
 * Prints every content block that still needs the client's confirmation, or came from the
 * owner's brief rather than the live site. Run with `npm run content:report`.
 */
const open = collectOpenBlocks({ home, homeBusiness, segments, about, innovation, sustainability, certifications, contact });

const byModule = new Map<string, typeof open>();
for (const o of open) byModule.set(o.module, [...(byModule.get(o.module) ?? []), o]);

for (const [module, blocks] of byModule) {
  console.log(`\n${module}`);
  for (const b of blocks) console.log(`  [${b.status}] ${b.id}`);
}
console.log(`\n${open.length} open block(s) across ${byModule.size} module(s).`);
