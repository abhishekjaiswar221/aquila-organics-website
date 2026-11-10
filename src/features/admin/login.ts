// Pure helpers for the admin sign-in page. Safe on the client and the server.

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_CHANGE_PASSWORD_PATH = "/admin/change-password";
export const ADMIN_HOME_PATH = "/admin/products";

export const GENERIC_LOGIN_ERROR = "Incorrect email or password.";
export const RATE_LIMIT_LOGIN_ERROR = "Too many sign-in attempts. Wait a minute, then try again.";

const MAX_NEXT_LENGTH = 512;
const BASE = "https://admin.invalid";

/**
 * The page to open after signing in, from an untrusted `next` value: only a
 * relative path inside /admin (never the login page itself) is accepted; any
 * other value, including absolute, protocol-relative, backslash, control
 * character, encoded-separator and traversal tricks, falls back to
 * ADMIN_HOME_PATH. The returned value is the normalised path and query.
 */
export function safeAdminNext(value: unknown): string {
  if (typeof value !== "string") return ADMIN_HOME_PATH;
  if (value.length === 0 || value.length > MAX_NEXT_LENGTH) return ADMIN_HOME_PATH;
  // Must be a plain absolute path: one leading slash, no backslashes,
  // no control characters or whitespace (the URL parser silently drops tabs
  // and newlines, which would turn "/\t/evil.com" into "//evil.com").
  if (!value.startsWith("/") || value.startsWith("//")) return ADMIN_HOME_PATH;
  if (/[\\\u0000- \u007f-\u009f]/.test(value)) return ADMIN_HOME_PATH;
  // Encoded slashes, backslashes and dots are never needed in an admin path.
  if (/%(2f|5c|2e)/i.test(value)) return ADMIN_HOME_PATH;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return ADMIN_HOME_PATH;
  }
  if (url.origin !== BASE) return ADMIN_HOME_PATH;
  const path = url.pathname;
  // Dot segments are resolved by the parser; refuse the input if it had any.
  if (path + url.search + url.hash !== value) return ADMIN_HOME_PATH;
  if (path !== "/admin" && !path.startsWith("/admin/")) return ADMIN_HOME_PATH;
  if (path === ADMIN_LOGIN_PATH || path.startsWith(`${ADMIN_LOGIN_PATH}/`)) return ADMIN_HOME_PATH;
  return path + url.search;
}

/** One message for every failure, so the form never reveals whether an email exists. */
export function loginErrorMessage(status: number | undefined): string {
  return status === 429 ? RATE_LIMIT_LOGIN_ERROR : GENERIC_LOGIN_ERROR;
}
