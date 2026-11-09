import { describe, expect, it } from "vitest";
import {
  catalogueHref,
  catalogueListMetadata,
  catalogueView,
  isFilteredList,
  parseCatalogueSearchParams,
} from "@/features/products/catalogue-params";

describe("parseCatalogueSearchParams", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseCatalogueSearchParams({})).toEqual({ q: "", category: "", sort: "name-asc", page: 1 });
  });

  it("takes the first value of repeated keys and trims text", () => {
    expect(
      parseCatalogueSearchParams({ q: ["  64-17-5 ", "x"], category: ["test-solvents"], sort: "newest", page: "2" }),
    ).toEqual({ q: "64-17-5", category: "test-solvents", sort: "newest", page: 2 });
  });

  it("falls back for unknown sorts and invalid pages", () => {
    for (const page of ["0", "-3", "abc", "1.5e9999", ""]) {
      expect(parseCatalogueSearchParams({ sort: "price", page }).page, page).toBe(1);
    }
    expect(parseCatalogueSearchParams({ sort: "price" }).sort).toBe("name-asc");
    expect(parseCatalogueSearchParams({ page: "3.7" }).page).toBe(3);
  });

  it("caps very long values", () => {
    const parsed = parseCatalogueSearchParams({ q: "a".repeat(500), category: "b".repeat(500), page: "9".repeat(40) });
    expect(parsed.q.length).toBeLessThanOrEqual(200);
    expect(parsed.category.length).toBeLessThanOrEqual(100);
    expect(parsed.page).toBeLessThanOrEqual(10_000);
  });
});

describe("isFilteredList", () => {
  it("is false only for the bare list", () => {
    const base = parseCatalogueSearchParams({});
    expect(isFilteredList(base)).toBe(false);
    expect(isFilteredList({ ...base, q: "x" })).toBe(true);
    expect(isFilteredList({ ...base, category: "c" })).toBe(true);
    expect(isFilteredList({ ...base, sort: "newest" })).toBe(true);
    expect(isFilteredList({ ...base, page: 2 })).toBe(true);
  });
});

describe("catalogueHref", () => {
  const base = parseCatalogueSearchParams({});

  it("omits defaults so the bare list is /aroma-chemicals", () => {
    expect(catalogueHref(base)).toBe("/aroma-chemicals");
  });

  it("keeps filters and overrides the page", () => {
    expect(catalogueHref({ ...base, q: "TEST Eth", category: "c", sort: "newest" }, { page: 3 })).toBe(
      "/aroma-chemicals?q=TEST+Eth&category=c&sort=newest&page=3",
    );
    expect(catalogueHref({ ...base, page: 4 }, { page: 1 })).toBe("/aroma-chemicals");
  });
});

describe("catalogueListMetadata", () => {
  it("indexes the bare list with a canonical to itself", () => {
    const meta = catalogueListMetadata(parseCatalogueSearchParams({}));
    expect(meta.alternates?.canonical).toBe("/aroma-chemicals");
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
  });

  it("noindexes search, filter, sort and page variants but keeps the bare canonical", () => {
    for (const raw of [{ q: "64-17-5" }, { category: "c" }, { sort: "newest" }, { page: "2" }]) {
      const meta = catalogueListMetadata(parseCatalogueSearchParams(raw));
      expect(meta.robots, JSON.stringify(raw)).toEqual({ index: false, follow: true });
      expect(meta.alternates?.canonical).toBe("/aroma-chemicals");
    }
  });
});

describe("catalogueView", () => {
  const bare = parseCatalogueSearchParams({});

  it("is the being-prepared state only when nothing is published and nothing is filtered", () => {
    expect(catalogueView(bare, { total: 0, page: 1, pageCount: 1 })).toBe("empty-catalogue");
  });

  it("is no-results when a query or filter matches nothing", () => {
    expect(catalogueView({ ...bare, q: "zzz" }, { total: 0, page: 1, pageCount: 1 })).toBe("no-results");
    expect(catalogueView({ ...bare, category: "c" }, { total: 0, page: 1, pageCount: 1 })).toBe("no-results");
  });

  it("flags a page past the end", () => {
    expect(catalogueView({ ...bare, page: 9 }, { total: 30, page: 9, pageCount: 2 })).toBe("page-out-of-range");
  });

  it("is results otherwise", () => {
    expect(catalogueView(bare, { total: 3, page: 1, pageCount: 1 })).toBe("results");
  });
});
