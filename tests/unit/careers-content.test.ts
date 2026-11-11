import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { visibleBlocks } from "@/content";
import * as careers from "@/content/careers";
import type { Block } from "@/content/types";
import { applyHref, jobPath, parseApplicationRef, parseJobParam } from "@/features/careers/paths";

const root = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

/** Every string reachable from the careers content module's exports. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const BANNED =
  /16\+|since 20(10|12)|\b\d+\s+years|best agarbatti|largest manufacturer|state-of-the-art|salary|salaries|benefit|perks|culture|headcount|employees|competitive|world-class|award|leading|growing|fast-paced/i;

describe("careers copy", () => {
  const blocks = (Object.values(careers) as unknown[]).filter(
    (v): v is Block<unknown> => !!v && typeof v === "object" && "status" in v && "id" in v && "data" in v,
  );

  it("exports its copy as Blocks with a content status", () => {
    expect(blocks.map((b) => b.id)).toEqual(
      expect.arrayContaining(["careers-intro", "careers-empty", "careers-apply-intro", "careers-form-notice"]),
    );
    for (const b of blocks) expect(["verified", "brief-supplied", "needs-client-confirmation", "hidden"]).toContain(b.status);
  });

  it("marks the intro as needing client confirmation and the form notice as pending review", () => {
    expect(careers.careersIntro.status).toBe("needs-client-confirmation");
    expect(careers.careersFormNotice.status).toBe("needs-client-confirmation");
  });

  it("passes the banned-claims scan (no job, salary, benefit, headcount or culture claim)", () => {
    for (const text of strings(careers)) expect(text, text).not.toMatch(BANNED);
  });

  it("keeps the empty-state wording the spec requires", () => {
    expect(careers.careersEmptyState.data).toBe("There are no current openings.");
  });

  it("states retention as to be confirmed by Aquila", () => {
    expect(careers.careersFormNotice.data.retention).toMatch(/to be confirmed by Aquila/);
  });

  it("never renders a hidden block", () => {
    const hidden: Block<string> = { id: "x", status: "hidden", data: "secret" };
    expect(visibleBlocks([careers.careersIntro, hidden]).map((b) => b.id)).toEqual(["careers-intro"]);
  });
});

describe("no job content is hard-coded", () => {
  const FILES = [
    "src/content/careers.ts",
    "src/app/(public)/careers/page.tsx",
    "src/app/(public)/careers/[slug]/page.tsx",
    "src/app/(public)/careers/apply/page.tsx",
    "src/app/(public)/careers/apply/confirmation/page.tsx",
    "src/components/careers/job-card.tsx",
    "src/components/careers/apply-fields.tsx",
    "src/components/careers/application-form.tsx",
  ];
  it.each(FILES)("%s has no salary, benefit or invented job claims", (f) => {
    const text = read(f);
    expect(text).not.toMatch(/\b(salary|benefits?|perks|headcount|culture|vacanc(y|ies))\b/i);
    expect(text).not.toMatch(/\b(chemist|engineer|analyst|manager|executive|technician|intern)\b/i);
  });

  it("the list page renders openings from the database, never from a constant", () => {
    const page = read("src/app/(public)/careers/page.tsx");
    expect(page).toContain("listPublishedJobs(");
    expect(page).toContain("await connection()");
  });
});

describe("careers paths", () => {
  it("builds opening and apply links", () => {
    expect(jobPath("quality-analyst")).toBe("/careers/quality-analyst");
    expect(jobPath("a b")).toBe("/careers/a%20b");
    expect(applyHref()).toBe("/careers/apply");
    expect(applyHref("quality-analyst")).toBe("/careers/apply?job=quality-analyst");
  });

  it("shows a confirmation reference only when it is exactly well-formed", () => {
    expect(parseApplicationRef("CA-2026-000123")).toBe("CA-2026-000123");
    for (const bad of [undefined, "", "AQ-2026-000123", "CA-2026-12345", "CA-2026-000123x", ["CA-2026-000123"], "<b>x</b>"]) {
      expect(parseApplicationRef(bad as string)).toBeNull();
    }
  });

  it("takes the first value of ?job= and drops absurd ones", () => {
    expect(parseJobParam("a-slug")).toBe("a-slug");
    expect(parseJobParam(["first", "second"])).toBe("first");
    expect(parseJobParam("")).toBeUndefined();
    expect(parseJobParam("x".repeat(201))).toBeUndefined();
    expect(parseJobParam(undefined)).toBeUndefined();
  });
});
