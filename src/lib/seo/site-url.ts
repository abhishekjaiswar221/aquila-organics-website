export const LOCAL_SITE_URL = "http://localhost:3000";

export type SiteUrlEnv = { NEXT_PUBLIC_SITE_URL?: string; NODE_ENV?: string };

type WarnState = { warned: boolean };

// One flag per process (globalThis), however many bundles load this module.
const PROCESS_STATE_KEY = Symbol.for("aquila.siteUrl.missingWarning");

function processState(): WarnState {
  const holder = globalThis as typeof globalThis & { [PROCESS_STATE_KEY]?: WarnState };
  holder[PROCESS_STATE_KEY] ??= { warned: false };
  return holder[PROCESS_STATE_KEY];
}

/**
 * The public base URL: NEXT_PUBLIC_SITE_URL (trimmed), else localhost. In
 * production an unset value would put localhost into canonical URLs, JSON-LD,
 * the sitemap and robots.txt, so it logs one warning per process. It never
 * throws: a CI build without the variable must still succeed.
 */
export function resolveSiteUrl(
  env: SiteUrlEnv,
  warn: (message: string) => void = () => {},
  state: WarnState = processState(),
): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production" && !state.warned) {
    state.warned = true;
    warn(
      `[site-url] NEXT_PUBLIC_SITE_URL is not set in production: canonical URLs, JSON-LD, the sitemap and robots.txt will use ${LOCAL_SITE_URL}. Set it and rebuild (the value is inlined at build time).`,
    );
  }
  return LOCAL_SITE_URL;
}

/**
 * Public base URL of the site, used for canonical URLs, JSON-LD and the
 * sitemap; also the root layout's metadataBase. NEXT_PUBLIC_SITE_URL is
 * inlined at build time. The warning is logged on the server only.
 */
export const SITE_URL = resolveSiteUrl(
  { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, NODE_ENV: process.env.NODE_ENV },
  typeof window === "undefined" ? (message) => console.warn(message) : undefined,
);

/** Joins a base URL and an absolute path without doubling slashes. */
export function absoluteUrl(base: string, pathname: string): string {
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export const CATALOGUE_PATH = "/aroma-chemicals";
export const PRIVACY_PATH = "/privacy";

export function productPath(slug: string): string {
  return `${CATALOGUE_PATH}/${encodeURIComponent(slug)}`;
}
