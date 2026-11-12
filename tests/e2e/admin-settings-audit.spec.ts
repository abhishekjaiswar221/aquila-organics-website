import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { clearRecipients, deleteAuditRowsFor, insertAuditRow, signInViaApi, storedRecipients } from "./support/admin";
import { ADMIN_USERS } from "./support/fixtures";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";
import { testIp } from "./support/rfq-db";

/*
 * Settings (notification recipients) and the audit viewer. Saving recipients
 * changes state other specs read (the enquiries page warns when none are set),
 * so that test is @catalogue-write: it runs alone at the end and restores the
 * empty state.
 */

const { superAdmin, administrator, salesManager } = ADMIN_USERS;

// "Save recipients" plus a screen-reader-only ": <type>" suffix.
const SAVE_AROMA = /^Save recipients\s*: Aroma chemicals quotations$/;
const SAVE_CAREERS = /^Save recipients\s*: Careers applications$/;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
});

test.describe("admin settings @catalogue-write", () => {
  test("recipients are saved, shown after a reload, and validated", async ({ page }) => {
    const t = randomBytes(3).toString("hex");
    const one = `test-recipient-${t}@notify.example.test`;
    const two = `test-second-${t}@notify.example.test`;
    try {
      await signInViaApi(page, administrator);
      await page.goto("/admin/settings");
      const box = page.getByLabel("Aroma chemicals quotations");
      await expect(async () => {
        await box.fill(`${one}, ${two.toUpperCase()}\n${one}`);
        await page.getByRole("button", { name: SAVE_AROMA }).click();
        await expect(page.getByText("Saved. 2 recipient(s).")).toBeVisible({ timeout: 2_000 });
      }).toPass();
      expect(await storedRecipients("AROMA_CHEMICALS")).toEqual([one, two]);

      await page.reload();
      await expect(page.getByLabel("Aroma chemicals quotations")).toHaveValue(`${one}\n${two}`);
      // The other types are untouched.
      await expect(page.getByLabel("Flavours enquiries")).toHaveValue("");

      // An invalid entry is refused and the stored list stays.
      await page.getByLabel("Aroma chemicals quotations").fill("not-an-email");
      await page.getByRole("button", { name: SAVE_AROMA }).click();
      await expect(page.getByText(/valid email|invalid|not a valid/i).first()).toBeVisible();
      expect(await storedRecipients("AROMA_CHEMICALS")).toEqual([one, two]);

      // Careers is an editable row like the others: empty until set, then saved and shown after a reload.
      const careers = page.getByLabel("Careers applications");
      await expect(careers).toBeEnabled();
      await expect(careers).toHaveValue("");
      const careersAddress = `test-careers-${t}@notify.example.test`;
      await expect(async () => {
        await careers.fill(careersAddress.toUpperCase());
        await page.getByRole("button", { name: SAVE_CAREERS }).click();
        await expect(page.getByText("Saved. 1 recipient(s).")).toBeVisible({ timeout: 2_000 });
      }).toPass();
      expect(await storedRecipients("CAREERS")).toEqual([careersAddress]);
      await page.reload();
      await expect(page.getByLabel("Careers applications")).toHaveValue(careersAddress);
    } finally {
      await clearRecipients();
    }
  });
});

test.describe("admin settings: access and quality", () => {
  test("a sales manager is refused the settings page", async ({ page }) => {
    await signInViaApi(page, salesManager);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You do not have access to the admin");
  });

  test("settings and audit pages: noindex, one h1, no overflow, axe clean", async ({ page }) => {
    await signInViaApi(page, superAdmin);
    for (const path of ["/admin/settings", "/admin/audit", "/admin/audit?action=category.delete&entityType=category"]) {
      const res = await page.goto(path);
      expect(res?.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoOverflow(page);
      await expectHeadingOutline(page);
      await expectAxeClean(page);
    }
  });
});

test.describe("admin audit viewer", () => {
  test("lists recorded actions and the action filter narrows the list", async ({ page }) => {
    const entityA = randomUUID();
    const entityB = randomUUID();
    await insertAuditRow("category.delete", "category", entityA);
    await insertAuditRow("user.enable", "user", entityB);
    try {
      await signInViaApi(page, superAdmin);
      await page.goto("/admin/audit?entityType=category");
      await expect(page.getByTestId("audit-row").filter({ hasText: entityA })).toBeVisible();
      await expect(page.getByTestId("audit-row").filter({ hasText: entityA })).toContainText("category.delete");

      // Filter by action through the form.
      await page.goto("/admin/audit");
      await expect(async () => {
        await page.getByLabel("Action", { exact: true }).selectOption("user.enable");
        await page.getByLabel("Entity type").fill("user");
        await page.getByRole("button", { name: "Filter" }).click();
        await page.waitForURL(/action=user\.enable/, { timeout: 2_000 });
      }).toPass();
      await expect(page.getByTestId("audit-row").filter({ hasText: entityB })).toBeVisible();
      await expect(page.getByTestId("audit-row").filter({ hasText: entityA })).toHaveCount(0);
      for (const text of await page.getByTestId("audit-row").locator("td:nth-child(3)").allInnerTexts()) {
        expect(text.trim()).toBe("user.enable");
      }

      // A filter that matches nothing says so.
      await page.goto(`/admin/audit?action=user.enable&entityType=${encodeURIComponent(`nothing-${entityA}`)}`);
      await expect(page.getByText("No entries match these filters.")).toBeVisible();
    } finally {
      await deleteAuditRowsFor(entityA);
      await deleteAuditRowsFor(entityB);
    }
  });

  test("an administrator and a sales manager are refused the audit page", async ({ page }) => {
    for (const user of [administrator, salesManager]) {
      await page.context().clearCookies();
      await signInViaApi(page, user);
      await page.goto("/admin/audit");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("You do not have access to the admin");
      await expect(page.locator("main")).not.toContainText("category.delete");
    }
  });
});
