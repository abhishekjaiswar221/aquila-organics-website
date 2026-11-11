// Parsing for the admin list pages' GET filters (URL state: q, status, page).

type Raw = string | string[] | undefined;

export function firstParam(value: Raw): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.slice(0, 200) : "";
}

export function pageParam(value: Raw): number {
  const n = Number.parseInt(firstParam(value), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1_000_000) : 1;
}

/** `${path}?q=..&status=..&page=..`, omitting empty values and page 1. */
export function listHref(path: string, params: { q?: string; status?: string; page?: number; imported?: boolean }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.imported) sp.set("imported", "1");
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
