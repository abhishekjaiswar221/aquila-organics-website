import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { visibleBlocks, unflaggedClaims } from "@/content";
import type { Block } from "@/content/types";
import { addresses } from "@/content/site";

const mk = (id: string, status: Block<string>["status"]): Block<string> => ({ id, status, data: id });

describe("visibleBlocks", () => {
  it("drops hidden blocks and keeps the other statuses", () => {
    const out = visibleBlocks([
      mk("a", "verified"),
      mk("b", "brief-supplied"),
      mk("c", "needs-client-confirmation"),
      mk("d", "hidden"),
    ]);
    expect(out.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});

describe("unflaggedClaims", () => {
  it("returns only ids needing client confirmation", () => {
    expect(
      unflaggedClaims([mk("a", "verified"), mk("c", "needs-client-confirmation"), mk("d", "hidden")]),
    ).toEqual(["c"]);
  });
});

describe("site addresses", () => {
  it("keeps registered office (Thane) and head office (Navi Mumbai) separate", () => {
    expect(addresses.registeredOffice.lines.join(" ")).toContain("Thane");
    expect(addresses.headOffice.lines.join(" ")).toContain("Rabale");
  });
});

describe("content copy guard", () => {
  const dir = path.resolve(__dirname, "../../src/content");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
  it("contains at least the expected content modules", () => {
    expect(files).toEqual(expect.arrayContaining(["site.ts", "types.ts", "index.ts"]));
  });
  it.each(files)("%s has no unconfirmed age/founding claims", (f) => {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    expect(text).not.toMatch(/16\+|since 20(10|12)|\b\d+\s+years/i);
  });
});
