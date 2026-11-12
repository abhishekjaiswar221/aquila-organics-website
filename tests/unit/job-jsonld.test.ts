import { describe, expect, it } from "vitest";
import type { PublishedJob } from "@/features/careers/job-queries";
import { jobPostingJsonLd } from "@/features/careers/jsonld";
import { serializeJsonLd } from "@/lib/seo/product-jsonld";

const BASE = "https://example.test";

function job(overrides: Partial<PublishedJob> = {}): PublishedJob {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "quality-analyst",
    title: "Quality Analyst",
    location: "Mumbai",
    department: null,
    employmentType: "FULL_TIME",
    summary: "Summary.",
    description: "Description.",
    publishedAt: new Date("2026-06-01T10:00:00Z"),
    closesOn: null,
    updatedAt: new Date("2026-06-02T10:00:00Z"),
    ...overrides,
  };
}

describe("jobPostingJsonLd", () => {
  it("builds a JobPosting from the opening's own data", () => {
    expect(jobPostingJsonLd(job(), BASE)).toEqual({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Quality Analyst",
      description: "Description.",
      datePosted: "2026-06-01T10:00:00.000Z",
      employmentType: "FULL_TIME",
      url: "https://example.test/careers/quality-analyst",
      hiringOrganization: { "@type": "Organization", name: "Aquila Organics Private Limited", sameAs: BASE },
      jobLocation: { "@type": "Place", address: "Mumbai" },
    });
  });

  it("is null when location, title, description or publishedAt is missing", () => {
    expect(jobPostingJsonLd(job({ location: "" }), BASE)).toBeNull();
    expect(jobPostingJsonLd(job({ location: "   " }), BASE)).toBeNull();
    expect(jobPostingJsonLd(job({ title: "" }), BASE)).toBeNull();
    expect(jobPostingJsonLd(job({ description: "" }), BASE)).toBeNull();
    expect(jobPostingJsonLd(job({ publishedAt: null }), BASE)).toBeNull();
  });

  it("includes validThrough only when the opening has a closing date", () => {
    expect(jobPostingJsonLd(job(), BASE)).not.toHaveProperty("validThrough");
    expect(jobPostingJsonLd(job({ closesOn: new Date("2026-12-31T00:00:00Z") }), BASE)).toMatchObject({
      validThrough: "2026-12-31T23:59:59Z",
    });
  });

  it("maps employment types to schema.org values", () => {
    const type = (t: PublishedJob["employmentType"]) =>
      (jobPostingJsonLd(job({ employmentType: t }), BASE) as { employmentType: string }).employmentType;
    expect([type("FULL_TIME"), type("PART_TIME"), type("CONTRACT"), type("INTERNSHIP")]).toEqual([
      "FULL_TIME",
      "PART_TIME",
      "CONTRACTOR",
      "INTERN",
    ]);
  });

  it("never emits salary or other invented fields", () => {
    const json = JSON.stringify(jobPostingJsonLd(job({ closesOn: new Date("2026-12-31T00:00:00Z") }), BASE)).toLowerCase();
    for (const banned of ["salary", "baseSalary", "benefit", "remote", "experience", "education", "identifier", "logo"]) {
      expect(json).not.toContain(banned.toLowerCase());
    }
  });

  it("escapes markup in free text when serialised", () => {
    const out = serializeJsonLd(jobPostingJsonLd(job({ description: "</script><script>alert(1)</script>" }), BASE) as object);
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).description).toBe("</script><script>alert(1)</script>");
  });
});
