import { describe, expect, it } from "vitest";
import {
  ADMIN_HOME_PATH,
  GENERIC_LOGIN_ERROR,
  RATE_LIMIT_LOGIN_ERROR,
  loginErrorMessage,
  safeAdminNext,
} from "@/features/admin/login";

describe("safeAdminNext", () => {
  it("keeps same-origin paths inside /admin, with their query", () => {
    expect(safeAdminNext("/admin/enquiries")).toBe("/admin/enquiries");
    expect(safeAdminNext("/admin/enquiries?status=NEW&page=2")).toBe("/admin/enquiries?status=NEW&page=2");
    expect(safeAdminNext("/admin")).toBe("/admin");
    expect(safeAdminNext("/admin/enquiries/00000000-0000-4000-8000-000000000001")).toBe(
      "/admin/enquiries/00000000-0000-4000-8000-000000000001",
    );
  });

  it("falls back to the products page for anything missing or unusable", () => {
    for (const value of [undefined, null, "", " ", 42, ["/admin/enquiries"], {}]) {
      expect(safeAdminNext(value), String(value)).toBe(ADMIN_HOME_PATH);
    }
  });

  it("refuses open redirects to other origins", () => {
    const attacks = [
      "//evil.com",
      "//evil.com/admin",
      "https://evil.com",
      "https://evil.com/admin",
      "http:evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "/\\/evil.com/admin",
      "javascript:alert(1)",
      "JavaScript:alert(1)//admin",
      "data:text/html,<script>alert(1)</script>",
      " //evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "/%2F%2Fevil.com",
      "/%5C%5Cevil.com",
      "%2F%2Fevil.com",
      "/admin@evil.com",
      "https://localhost/admin",
    ];
    for (const value of attacks) expect(safeAdminNext(value), value).toBe(ADMIN_HOME_PATH);
  });

  it("refuses paths that escape /admin by traversal, encoded or not", () => {
    for (const value of [
      "/admin/../x",
      "/admin/..",
      "/admin/./../aroma-chemicals",
      "/admin/%2e%2e/x",
      "/admin/%2E%2E/x",
      "/admin/.%2e/x",
      "/admin/..%2fx",
      "/admin/..%5cx",
      "/admin%2f..%2fx",
      "/administrator",
      "/admin-evil",
      "/aroma-chemicals",
      "/",
    ]) {
      expect(safeAdminNext(value), value).toBe(ADMIN_HOME_PATH);
    }
  });

  it("never sends a signed-in user back to the login page", () => {
    expect(safeAdminNext("/admin/login")).toBe(ADMIN_HOME_PATH);
    expect(safeAdminNext("/admin/login?next=/admin/login")).toBe(ADMIN_HOME_PATH);
  });

  it("refuses absurdly long values", () => {
    expect(safeAdminNext(`/admin/${"a".repeat(2048)}`)).toBe(ADMIN_HOME_PATH);
  });
});

describe("loginErrorMessage", () => {
  it("is the same generic message for every credential failure", () => {
    for (const status of [400, 401, 403, 404, 422, 500, 503, undefined, 0]) {
      expect(loginErrorMessage(status)).toBe(GENERIC_LOGIN_ERROR);
    }
    expect(GENERIC_LOGIN_ERROR).toBe("Incorrect email or password.");
  });

  it("says when sign-in is rate limited", () => {
    expect(loginErrorMessage(429)).toBe(RATE_LIMIT_LOGIN_ERROR);
    expect(RATE_LIMIT_LOGIN_ERROR).toMatch(/too many/i);
    expect(RATE_LIMIT_LOGIN_ERROR).not.toMatch(/password is|email is|not found|exist/i);
  });
});
