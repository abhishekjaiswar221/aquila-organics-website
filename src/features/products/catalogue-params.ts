import type { Metadata } from "next";
import { CATALOGUE_PATH } from "@/lib/seo/site-url";
import type { CatalogueSort } from "./queries";

export const SORTS: readonly { value: CatalogueSort; label: string }[] = [
  { value: "name-asc", label: "Name, A to Z" },
  { value: "name-desc", label: "Name, Z to A" },
  { value: "newest", label: "Newest first" },
];
const DEFAULT_SORT: CatalogueSort = "name-asc";
const MAX_Q = 200;
const MAX_CATEGORY = 100;
const MAX_PAGE = 10_000;

/** Normalised catalogue URL state. Every field has a value; defaults mean "unset". */
export type CatalogueState = { q: string; category: string; sort: CatalogueSort; page: number };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v : "";
}

function isSort(value: string): value is CatalogueSort {
  return SORTS.some((s) => s.value === value);
}

export function parseCatalogueSearchParams(raw: RawParams): CatalogueState {
  const sort = first(raw.sort);
  const page = Math.floor(Number(first(raw.page)));
  return {
    q: first(raw.q).trim().slice(0, MAX_Q),
    category: first(raw.category).trim().slice(0, MAX_CATEGORY),
    sort: isSort(sort) ? sort : DEFAULT_SORT,
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

export function isFilteredList(s: CatalogueState): boolean {
  return s.q !== "" || s.category !== "" || s.sort !== DEFAULT_SORT || s.page !== 1;
}

/** URL for the list with the given state; defaults are omitted. */
export function catalogueHref(s: CatalogueState, overrides: Partial<CatalogueState> = {}): string {
  const next = { ...s, ...overrides };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.category) qs.set("category", next.category);
  if (next.sort !== DEFAULT_SORT) qs.set("sort", next.sort);
  if (next.page > 1) qs.set("page", String(next.page));
  const query = qs.toString();
  return query ? `${CATALOGUE_PATH}?${query}` : CATALOGUE_PATH;
}

export const CATALOGUE_TITLE = "Aroma chemicals catalogue";
export const CATALOGUE_DESCRIPTION =
  "Search Aquila Organics aroma chemicals by product name, product code or CAS number, and request a quotation.";

/**
 * The bare list is indexable; every search, filter, sort or page variant is
 * noindex,follow and canonicalises to the bare list.
 */
export function catalogueListMetadata(s: CatalogueState): Metadata {
  return {
    title: CATALOGUE_TITLE,
    description: CATALOGUE_DESCRIPTION,
    alternates: { canonical: CATALOGUE_PATH },
    robots: isFilteredList(s) ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export type CatalogueView = "empty-catalogue" | "no-results" | "page-out-of-range" | "results";

export function catalogueView(
  s: CatalogueState,
  result: { total: number; page: number; pageCount: number },
): CatalogueView {
  if (result.total === 0) {
    return s.q === "" && s.category === "" ? "empty-catalogue" : "no-results";
  }
  if (result.page > result.pageCount) return "page-out-of-range";
  return "results";
}
