import { describe, expect, it } from "vitest";
import {
  changedJobFields,
  isJobPublic,
  isRealDate,
  missingForPublish,
  parseJobForm,
  type JobFormData,
} from "@/features/careers/job-schema";

const VALID = {
  title: "Quality Analyst",
  location: "Mumbai",
  employmentType: "FULL_TIME",
  summary: "Runs incoming material checks.",
  description: "First paragraph.\n\nSecond paragraph.",
};

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

function parsed(entries: Record<string, string>) {
  const result = parseJobForm(form({ ...VALID, ...entries }));
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.fieldErrors)}`);
  return result.data;
}

function errors(entries: Record<string, string>) {
  const result = parseJobForm(form({ ...VALID, ...entries }));
  if (result.ok) throw new Error("expected errors");
  return result.fieldErrors;
}

describe("parseJobForm", () => {
  it("accepts a valid form and builds the slug from the title", () => {
    const data = parsed({});
    expect(data).toMatchObject({ title: "Quality Analyst", slug: "quality-analyst", department: null, closesOn: null });
  });

  it("rejects a blank title", () => {
    expect(errors({ title: "   " }).title).toBe("Title is required");
  });

  it("keeps an explicit slug (normalised) over the title", () => {
    expect(parsed({ slug: "QA Analyst!" }).slug).toBe("qa-analyst");
  });

  it.each(["apply", "confirmation", "Apply"])("rejects the reserved slug %s", (slug) => {
    expect(errors({ slug }).slug).toBe("That URL slug is reserved. Choose another.");
  });

  it("rejects a reserved slug built from the title", () => {
    expect(errors({ title: "Apply" }).slug).toBeDefined();
  });

  it("rejects over-long fields with a message each", () => {
    const e = errors({
      title: "t".repeat(151),
      location: "l".repeat(121),
      department: "d".repeat(81),
      summary: "s".repeat(301),
      description: "x".repeat(10_001),
    });
    expect(e.title).toBe("Title is too long (150 characters at most)");
    expect(e.location).toBe("Location is too long (120 characters at most)");
    expect(e.department).toBe("Department is too long (80 characters at most)");
    expect(e.summary).toBe("Summary is too long (300 characters at most)");
    expect(e.description).toBe("Description is too long (10000 characters at most)");
  });

  it("accepts fields at their limits", () => {
    const data = parsed({ title: "t".repeat(150), slug: "ok", location: "l".repeat(120), summary: "s".repeat(300), description: "x".repeat(10_000), department: "d".repeat(80) });
    expect(data.title).toHaveLength(150);
  });

  it("requires location, summary and description", () => {
    const e = errors({ location: "", summary: "", description: "" });
    expect(Object.keys(e).sort()).toEqual(["description", "location", "summary"]);
  });

  it("rejects an employment type outside the four values", () => {
    expect(errors({ employmentType: "VOLUNTEER" }).employmentType).toBeDefined();
    expect(errors({ employmentType: "" }).employmentType).toBeDefined();
    for (const t of ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]) {
      expect(parsed({ employmentType: t }).employmentType).toBe(t);
    }
  });

  it("validates closesOn as a real YYYY-MM-DD date", () => {
    expect(parsed({ closesOn: "2026-12-31" }).closesOn).toBe("2026-12-31");
    expect(parsed({ closesOn: "2028-02-29" }).closesOn).toBe("2028-02-29");
    expect(errors({ closesOn: "2026-02-31" }).closesOn).toBeDefined();
    expect(errors({ closesOn: "2026-13-01" }).closesOn).toBeDefined();
    expect(errors({ closesOn: "31/12/2026" }).closesOn).toBeDefined();
    expect(errors({ closesOn: "2027-02-29" }).closesOn).toBeDefined();
    expect(parsed({ closesOn: "" }).closesOn).toBeNull();
  });

  it("normalises CRLF in the description to LF", () => {
    expect(parsed({ description: "One\r\n\r\nTwo\rThree" }).description).toBe("One\n\nTwo\nThree");
  });

  it("ignores status and publishedAt posted by a client", () => {
    const data = parsed({ status: "PUBLISHED", publishedAt: "2026-01-01" }) as Record<string, unknown>;
    expect(data.status).toBeUndefined();
    expect(data.publishedAt).toBeUndefined();
  });
});

describe("isRealDate", () => {
  it("rejects impossible calendar dates", () => {
    expect(isRealDate("2026-04-31")).toBe(false);
    expect(isRealDate("2026-02-28")).toBe(true);
  });
});

describe("changedJobFields", () => {
  const base: JobFormData = { ...(parsed({}) as JobFormData) };
  it("names only the fields that differ", () => {
    expect(changedJobFields(base, { ...base, location: "Pune", closesOn: "2026-12-01" })).toEqual(["location", "closesOn"]);
    expect(changedJobFields(base, base)).toEqual([]);
  });
});

describe("missingForPublish", () => {
  it("lists blank required fields", () => {
    expect(missingForPublish({ title: "T", slug: "t", location: " ", summary: "s", description: "" })).toEqual([
      "location",
      "description",
    ]);
    expect(missingForPublish({ title: "T", slug: "t", location: "L", summary: "s", description: "d" })).toEqual([]);
  });
});

describe("isJobPublic", () => {
  const now = new Date("2026-06-15T13:00:00Z");
  const day = (s: string) => new Date(`${s}T00:00:00Z`);
  it("is public only when PUBLISHED and not past closesOn (UTC day)", () => {
    expect(isJobPublic({ status: "PUBLISHED", closesOn: null }, now)).toBe(true);
    expect(isJobPublic({ status: "PUBLISHED", closesOn: day("2026-06-15") }, now)).toBe(true);
    expect(isJobPublic({ status: "PUBLISHED", closesOn: day("2026-06-16") }, now)).toBe(true);
    expect(isJobPublic({ status: "PUBLISHED", closesOn: day("2026-06-14") }, now)).toBe(false);
    expect(isJobPublic({ status: "DRAFT", closesOn: null }, now)).toBe(false);
    expect(isJobPublic({ status: "CLOSED", closesOn: null }, now)).toBe(false);
  });
});
