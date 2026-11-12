import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./setup";
import { getPublishedJobBySlug, isPublishedJobSlug, listPublishedJobs } from "@/features/careers/job-queries";

// Public visibility of openings: published AND (no closing date OR closing date today or later, UTC).

const NOW = new Date("2026-06-15T12:00:00Z");

const makeRow = (slug: string, data: Record<string, unknown> = {}) =>
  db.jobOpening.create({
    data: {
      slug,
      title: `TEST ${slug}`,
      location: "Mumbai",
      employmentType: "FULL_TIME",
      summary: "s",
      description: "d",
      ...data,
    },
  });

beforeEach(async () => {
  await resetDb();
});

describe("public job queries", () => {
  beforeEach(async () => {
    await makeRow("live", { status: "PUBLISHED", publishedAt: new Date("2026-06-01T00:00:00Z") });
    await makeRow("live-closes-today", {
      status: "PUBLISHED",
      publishedAt: new Date("2026-06-02T00:00:00Z"),
      closesOn: new Date("2026-06-15T00:00:00Z"),
    });
    await makeRow("live-closes-later", {
      status: "PUBLISHED",
      publishedAt: new Date("2026-06-03T00:00:00Z"),
      closesOn: new Date("2026-07-01T00:00:00Z"),
    });
    await makeRow("expired", {
      status: "PUBLISHED",
      publishedAt: new Date("2026-05-01T00:00:00Z"),
      closesOn: new Date("2026-06-14T00:00:00Z"),
    });
    await makeRow("draft", { status: "DRAFT" });
    await makeRow("closed", { status: "CLOSED", publishedAt: new Date("2026-05-01T00:00:00Z") });
  });

  it("lists only published, non-expired openings", async () => {
    const slugs = (await listPublishedJobs(NOW)).map((j) => j.slug).sort();
    expect(slugs).toEqual(["live", "live-closes-later", "live-closes-today"]);
  });

  it("returns an opening by slug only when it is public", async () => {
    for (const slug of ["live", "live-closes-today", "live-closes-later"]) {
      expect((await getPublishedJobBySlug(slug, NOW))?.slug, slug).toBe(slug);
    }
    for (const slug of ["expired", "draft", "closed", "no-such-opening", ""]) {
      expect(await getPublishedJobBySlug(slug, NOW), slug).toBeNull();
    }
  });

  it("isPublishedJobSlug is true only for a currently published, non-expired opening", async () => {
    for (const slug of ["live", "live-closes-today", "live-closes-later"]) {
      expect(await isPublishedJobSlug(slug, NOW), slug).toBe(true);
    }
    for (const slug of ["expired", "draft", "closed", "no-such-opening", "apply"]) {
      expect(await isPublishedJobSlug(slug, NOW), slug).toBe(false);
    }
  });

  it("an opening expires when the clock passes its closing day", async () => {
    expect(await isPublishedJobSlug("live-closes-today", new Date("2026-06-15T23:59:59Z"))).toBe(true);
    expect(await isPublishedJobSlug("live-closes-today", new Date("2026-06-16T00:00:00Z"))).toBe(false);
  });

  it("never exposes a status or admin field on the public shape", async () => {
    const job = await getPublishedJobBySlug("live", NOW);
    expect(Object.keys(job ?? {}).sort()).toEqual(
      [
        "closesOn",
        "department",
        "description",
        "employmentType",
        "id",
        "location",
        "publishedAt",
        "slug",
        "summary",
        "title",
        "updatedAt",
      ].sort(),
    );
  });
});
