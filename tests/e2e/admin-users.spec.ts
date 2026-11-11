import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { auditRowsFor, deleteUserByEmail, signInViaApi, userIdByEmail } from "./support/admin";
import { ADMIN_USERS } from "./support/fixtures";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";
import { testIp, withDb } from "./support/rfq-db";

/*
 * User management and the forced password change. Throwaway users are created
 * through the UI and deleted afterwards. Sign-in is per client IP, so every
 * browser context gets its own address.
 */

const { superAdmin, administrator } = ADMIN_USERS;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
});

const userRow = (page: Page, email: string) => page.getByRole("row").filter({ hasText: email });

/** Creates a user in the admin UI and returns the one-time password shown. */
async function createUserViaUi(page: Page, name: string, email: string, role = "Content editor"): Promise<string> {
  await page.goto("/admin/users");
  await expect(async () => {
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Role", { exact: true }).selectOption({ label: role });
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "One-time password" })).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(page.getByText("Shown once. Copy it now.")).toBeVisible();
  const password = (await page.locator("section[aria-labelledby='one-time-heading'] code").innerText()).trim();
  expect(password.length).toBeGreaterThanOrEqual(16);
  return password;
}

async function newContextPage(browser: Browser) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
  return { context, page: await context.newPage() };
}

test.describe("admin users: onboarding", () => {
  test("super admin creates a user; they are forced to change the one-time password, then land in the admin; disabling signs them out", async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000); // a long, sequential journey across two browser contexts
    const t = randomBytes(4).toString("hex");
    const email = `test-onboard-${t}@admin.example.test`;
    const name = `TEST Onboard ${t}`;
    const fresh = await newContextPage(browser);
    try {
      await signInViaApi(page, superAdmin);
      const oneTime = await createUserViaUi(page, name, email);
      await expect(userRow(page, email)).toContainText("Must change password");
      await expect(userRow(page, email)).toContainText("Active");

      // Fresh context: sign in with the one-time password.
      const user = fresh.page;
      await user.goto("/admin/login");
      await user.getByLabel("Email").fill(email);
      await user.getByLabel("Password").fill(oneTime);
      await user.getByRole("button", { name: "Sign in" }).click();
      await user.waitForURL(/\/admin\/change-password$/);
      await expect(user.getByRole("heading", { level: 1, name: "Change password" })).toBeVisible();

      // Every other admin page sends them back here.
      await user.goto("/admin/products");
      await expect(user).toHaveURL(/\/admin\/change-password$/);

      // A wrong current password is refused and nothing changes.
      await user.getByLabel("Current password").fill("TEST-not-the-password-123");
      await user.getByLabel("New password", { exact: true }).fill("TEST-brand-new-passphrase-1");
      await user.getByLabel("Repeat new password").fill("TEST-brand-new-passphrase-1");
      await user.getByRole("button", { name: "Change password" }).click();
      await expect(
        user.getByText("The password could not be changed. Check your current password and try again."),
      ).toBeVisible();
      // The form resets once the action settles; wait for that before typing again.
      await expect(user.getByLabel("Current password")).toHaveValue("");
      await expect(user).toHaveURL(/\/admin\/change-password$/);

      // Mismatched repeat is refused with a field error.
      // (The form is cleared after each submit, so every field is filled again.)
      await user.getByLabel("Current password").fill(oneTime);
      await user.getByLabel("New password", { exact: true }).fill("TEST-brand-new-passphrase-1");
      await user.getByLabel("Repeat new password").fill("TEST-something-else-entirely");
      await user.getByRole("button", { name: "Change password" }).click();
      await expect(user.locator("#pw-confirm-error")).toHaveText("The passwords do not match.");
      await expect(user.getByLabel("Current password")).toHaveValue("");

      // The correct change lands in the admin.
      await user.getByLabel("Current password").fill(oneTime);
      await user.getByLabel("New password", { exact: true }).fill("TEST-brand-new-passphrase-1");
      await user.getByLabel("Repeat new password").fill("TEST-brand-new-passphrase-1");
      await user.getByRole("button", { name: "Change password" }).click();
      await user.waitForURL(/\/admin\/products$/);
      await expect(user.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
      await expect(user.getByRole("banner")).toContainText(email);
      await expect(user.getByRole("banner")).toContainText("Content editor");
      // No users page for a content editor.
      await user.goto("/admin/users");
      await expect(user.getByRole("heading", { level: 1 })).toHaveText("You do not have access to the admin");

      // The flag is cleared and the audit rows hold no email or password.
      const id = (await userIdByEmail(email))!;
      const stored = await withDb(async (c) => (await c.query<{ mustChangePassword: boolean }>(`SELECT "mustChangePassword" FROM "user" WHERE "id" = $1`, [id])).rows[0]);
      expect(stored.mustChangePassword).toBe(false);
      const audit = await auditRowsFor(id);
      expect(audit.map((a) => a.action)).toEqual(["user.create"]);
      expect(JSON.stringify(audit)).not.toContain(email);
      expect(JSON.stringify(audit)).not.toContain(oneTime);

      // Super admin disables them: their next request goes to the login page.
      await page.goto("/admin/users");
      await userRow(page, email).getByRole("button", { name: /^Disable/ }).click();
      await expect(page.getByText("User disabled and signed out.")).toBeVisible();
      await expect(userRow(page, email)).toContainText("Disabled");
      await user.goto("/admin/products");
      await expect(user).toHaveURL(/\/admin\/login/);
      // And they cannot sign in again.
      await user.getByLabel("Email").fill(email);
      await user.getByLabel("Password").fill("TEST-brand-new-passphrase-1");
      await user.getByRole("button", { name: "Sign in" }).click();
      await expect(user.locator("#login-error")).toHaveText(/\w/);
      await expect(user).toHaveURL(/\/admin\/login/);
      expect((await auditRowsFor(id)).map((a) => a.action)).toEqual(["user.create", "user.disable"]);

      // Enabling restores access.
      await userRow(page, email).getByRole("button", { name: /^Enable/ }).click();
      await expect(page.getByText("User enabled.")).toBeVisible();
      await expect(userRow(page, email)).toContainText("Active");
    } finally {
      await fresh.context.close();
      await deleteUserByEmail(email);
    }
  });

  test("a duplicate email shows a field error; reset password issues a new one-time password", async ({ page }) => {
    const t = randomBytes(4).toString("hex");
    const email = `test-reset-${t}@admin.example.test`;
    try {
      await signInViaApi(page, superAdmin);
      const first = await createUserViaUi(page, `TEST Reset ${t}`, email, "Sales manager");
      await expect(page.getByRole("button", { name: "I have copied it" })).toBeVisible();
      await page.getByRole("button", { name: "I have copied it" }).click();
      await expect(page.getByText("Shown once. Copy it now.")).toHaveCount(0);

      await page.getByLabel("Name", { exact: true }).fill("TEST Duplicate");
      await page.getByLabel("Email", { exact: true }).fill(email.toUpperCase());
      await page.getByRole("button", { name: "Create user" }).click();
      await expect(page.getByText("A user with this email already exists.")).toBeVisible();
      await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");

      await userRow(page, email).getByRole("button", { name: /^Reset password/ }).click();
      await expect(page.getByRole("heading", { level: 2, name: "One-time password" })).toBeVisible();
      const second = (await page.locator("section[aria-labelledby='one-time-heading'] code").innerText()).trim();
      expect(second).not.toBe(first);
      await expectAxeClean(page);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("you cannot disable or demote yourself, and an administrator is refused the users page", async ({ page, browser }) => {
    await signInViaApi(page, superAdmin);
    await page.goto("/admin/users");
    const me = userRow(page, superAdmin.email);
    await expect(me).toContainText("(you)");
    await expect(me.getByRole("button", { name: /^Disable/ })).toBeDisabled();
    await expect(me.getByRole("button", { name: /^Save role/ })).toBeDisabled();

    const other = await newContextPage(browser);
    try {
      await signInViaApi(other.page, administrator);
      await other.page.goto("/admin/users");
      await expect(other.page.getByRole("heading", { level: 1 })).toHaveText("You do not have access to the admin");
    } finally {
      await other.context.close();
    }
  });
});

test.describe("admin users: quality gates", () => {
  test("users and change-password pages: noindex, one h1, no overflow, axe clean", async ({ page }) => {
    await signInViaApi(page, superAdmin);
    for (const path of ["/admin/users", "/admin/change-password"]) {
      const res = await page.goto(path);
      expect(res?.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      await expectNoOverflow(page);
      await expectHeadingOutline(page);
      await expectAxeClean(page);
    }
  });
});
