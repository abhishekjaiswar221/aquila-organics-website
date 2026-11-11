import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  auditRowsFor,
  createCategoryRow,
  createDraftProduct,
  deleteCategoriesNamed,
  deleteProductWithFiles,
  documentsOf,
  productBySlug,
  setProductCategory,
  signInViaApi,
} from "./support/admin";
import { ADMIN_USERS } from "./support/fixtures";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";
import { testIp, withDb } from "./support/rfq-db";

/*
 * Admin product create/edit, documents and categories. Tests that publish a
 * product or change the category list run once at 1280 (@catalogue-write):
 * they change what the public catalogue shows.
 */

const { superAdmin, administrator, contentEditor, salesManager } = ADMIN_USERS;

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
});

const tag = () => randomBytes(4).toString("hex");

async function expectNoindexAndQuality(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expectNoOverflow(page);
  await expectHeadingOutline(page);
  await expectAxeClean(page);
}

/** Clicks a button that adds a row until the new row's label exists (the click may precede hydration). */
async function addRow(page: Page, button: string, label: string) {
  await expect(async () => {
    const target = page.getByLabel(label, { exact: true });
    if ((await target.count()) === 0) await page.getByRole("button", { name: button, exact: true }).click();
    await expect(target).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

const productRow = (page: Page, name: string) => page.getByTestId("product-row").filter({ hasText: name });

test.describe("admin products: content editor", () => {
  test("creates a product with specs and an application; sees no publish or verify controls; is refused the other pages", async ({
    page,
  }) => {
    const t = tag();
    const name = `TEST-Created ${t}`;
    const slug = `test-created-${t}`;
    try {
      await signInViaApi(page, contentEditor);
      await page.goto("/admin/products/new");
      await expect(page.getByRole("heading", { level: 1, name: "New product" })).toBeVisible();
      await page.getByLabel("Name", { exact: true }).fill(name);
      await expect(page.getByLabel("URL slug")).toHaveValue("");
      await addRow(page, "Add specification", "Label 1");
      await page.getByLabel("Label 1", { exact: true }).fill("TEST-Purity");
      await page.getByLabel("Value 1", { exact: true }).fill("99 %");
      await addRow(page, "Add specification", "Label 2");
      await page.getByLabel("Label 2", { exact: true }).fill("TEST-Colour");
      await page.getByLabel("Value 2", { exact: true }).fill("Clear");
      await addRow(page, "Add application", "Application 1");
      await page.getByLabel("Application 1", { exact: true }).fill("TEST-Perfumery");
      await page.getByRole("button", { name: "Create product" }).click();

      await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}\/edit/);
      await expect(page.getByRole("heading", { level: 1, name: "Edit product" })).toBeVisible();
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
      await expect(page.getByLabel("Label 2", { exact: true })).toHaveValue("TEST-Colour");

      const stored = await productBySlug(slug);
      expect(stored).toMatchObject({ name, status: "DRAFT", verified: false });
      expect(stored?.specifications).toEqual([
        { label: "TEST-Purity", value: "99 %" },
        { label: "TEST-Colour", value: "Clear" },
      ]);
      expect(stored?.applications).toEqual(["TEST-Perfumery"]);
      expect((await auditRowsFor(stored!.id)).map((a) => a.action)).toEqual(["product.create"]);

      // No publish, archive or verify controls in the list.
      await page.goto(`/admin/products?q=${encodeURIComponent(name)}`);
      await expect(productRow(page, name)).toBeVisible();
      await expect(productRow(page, name).getByRole("link", { name: /^Edit/ })).toBeVisible();
      for (const control of [/^Publish/, /^Unpublish/, /^Archive/, /^Restore to draft/, /^Mark (un)?verified/]) {
        await expect(page.getByRole("button", { name: control })).toHaveCount(0);
      }

      // The restricted pages show the 403 page, with no data.
      for (const path of ["/admin/users", "/admin/audit", "/admin/settings", "/admin/enquiries"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("You do not have access to the admin");
        await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      }
      await expectAxeClean(page);
      await expectNoOverflow(page);
    } finally {
      await deleteProductWithFiles({ slug });
    }
  });

  test("rejects an invalid product with visible field errors and keeps what was typed", async ({ page }) => {
    const t = tag();
    await signInViaApi(page, contentEditor);
    await page.goto("/admin/products/new");
    await page.getByLabel("CAS number").fill("64-17-4");
    await page.getByLabel("Description", { exact: true }).fill(`TEST-kept-${t}`);
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Fix the highlighted fields" })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("CAS number")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue(`TEST-kept-${t}`);
    await expectAxeClean(page);
  });

  test("a content editor can open documents on the edit page", async ({ page }) => {
    const product = await createDraftProduct("editor-docs");
    try {
      await signInViaApi(page, contentEditor);
      await page.goto(`/admin/products/${product.id}/edit`);
      await expect(page.getByRole("heading", { level: 2, name: "Documents" })).toBeVisible();
      await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
    } finally {
      await deleteProductWithFiles({ id: product.id });
    }
  });
});

test.describe("admin products: concurrent edits", () => {
  test("a stale edit in a second browser context is refused and writes nothing", async ({ browser }) => {
    const product = await createDraftProduct("stale");
    const first = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
    const second = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
    try {
      const a = await first.newPage();
      const b = await second.newPage();
      await signInViaApi(a, salesManager);
      await signInViaApi(b, administrator);
      await a.goto(`/admin/products/${product.id}/edit`);
      await b.goto(`/admin/products/${product.id}/edit`);
      await expect(a.getByLabel("Name", { exact: true })).toHaveValue(product.name);
      await expect(b.getByLabel("Name", { exact: true })).toHaveValue(product.name);

      await a.getByLabel("Description", { exact: true }).fill("TEST-first description");
      await a.getByRole("button", { name: "Save changes" }).click();
      await expect(a.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

      await b.getByLabel("Description", { exact: true }).fill("TEST-second description");
      await b.getByRole("button", { name: "Save changes" }).click();
      await expect(b.getByText("This product was changed by someone else. Reload and try again.")).toBeVisible();
      expect(await productBySlug(product.slug)).toMatchObject({ description: "TEST-first description" });

      // Reloading picks up the new version and the save then works.
      await b.reload();
      await expect(b.getByLabel("Description", { exact: true })).toHaveValue("TEST-first description");
      await b.getByLabel("Description", { exact: true }).fill("TEST-second description");
      await b.getByRole("button", { name: "Save changes" }).click();
      await expect(b.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
      expect(await productBySlug(product.slug)).toMatchObject({ description: "TEST-second description" });
    } finally {
      await first.close();
      await second.close();
      await deleteProductWithFiles({ id: product.id });
    }
  });
});

test.describe("admin products: publish, edit and documents @catalogue-write", () => {
  test("super admin verifies and publishes; editing the description unpublishes it and the public URL answers 404", async ({
    browser,
    request,
  }) => {
    const product = await createDraftProduct("lifecycle");
    const admin = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
    const visitor = await browser.newContext();
    try {
      const page = await admin.newPage();
      const pub = await visitor.newPage();
      await signInViaApi(page, superAdmin);
      const search = `/admin/products?q=${encodeURIComponent(product.code)}`;
      await page.goto(search);
      await productRow(page, product.name).getByRole("button", { name: /^Mark verified/ }).click();
      await expect(productRow(page, product.name)).toContainText("Marked verified.");
      await productRow(page, product.name).getByRole("button", { name: /^Publish/ }).click();
      await expect(productRow(page, product.name)).toContainText("Published.");

      expect((await pub.goto(`/aroma-chemicals/${product.slug}`))?.status()).toBe(200);
      expect(await (await request.get("/sitemap.xml")).text()).toContain(`/aroma-chemicals/${product.slug}<`);

      // The edit form warns that saving unpublishes a published product.
      await page.goto(`/admin/products/${product.id}/edit`);
      await expect(
        page.getByText("Saving changes to a published product will unpublish it until it is verified again."),
      ).toBeVisible();
      await page.getByLabel("Description", { exact: true }).fill("TEST-edited description");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText(/Saved\. The product is now a draft/)).toBeVisible();

      expect(await productBySlug(product.slug)).toMatchObject({ status: "DRAFT", verified: false });
      expect((await pub.goto(`/aroma-chemicals/${product.slug}`))?.status()).toBe(404);
      expect(await (await request.get("/sitemap.xml")).text()).not.toContain(product.slug);

      const audit = (await auditRowsFor(product.id)).map((a) => a.action);
      expect(audit).toEqual(expect.arrayContaining(["product.verified", "product.status", "product.reverify"]));
      // The audit viewer lists these actions for this product.
      await page.goto("/admin/audit?action=product.reverify&entityType=product");
      await expect(page.getByTestId("audit-row").filter({ hasText: product.id })).toContainText("product.reverify");
      await page.goto(`/admin/products/${product.id}/edit`);
      // The warning is gone once it is a draft.
      await expect(page.getByText("Saving changes to a published product will unpublish it")).toHaveCount(0);
    } finally {
      await admin.close();
      await visitor.close();
      await deleteProductWithFiles({ id: product.id });
    }
  });

  test("a document uploaded in the admin shows on the public product page and downloads; an executable renamed .pdf is rejected", async ({
    browser,
  }) => {
    const product = await createDraftProduct("docs");
    const admin = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
    const visitor = await browser.newContext();
    try {
      await withDb((c) => c.query(`UPDATE "product" SET "verified" = true, "status" = 'PUBLISHED', "publishedAt" = now() WHERE "id" = $1`, [product.id]));
      const page = await admin.newPage();
      const pub = await visitor.newPage();
      await signInViaApi(page, administrator);
      await page.goto(`/admin/products/${product.id}/edit`);

      // A fake executable named .pdf is refused with a visible message and nothing is stored.
      await page.getByLabel("Title", { exact: true }).fill("TEST-bad document");
      await page.getByLabel("File").setInputFiles({
        name: "TEST-evil.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("MZ\x90\x00\x03\x00\x00\x00 TEST not a pdf"),
      });
      await page.getByRole("button", { name: "Upload document" }).click();
      const status = page.getByRole("status").filter({ hasText: /\w/ });
      await expect(status).toContainText("File content does not match its extension");
      expect(await documentsOf(product.id)).toEqual([]);

      const pdf = Buffer.from("%PDF-1.4\n% TEST e2e datasheet\n%%EOF\n");
      await page.getByLabel("Title", { exact: true }).fill("TEST-uploaded datasheet");
      await page.getByLabel("File").setInputFiles({ name: "TEST-datasheet.pdf", mimeType: "application/pdf", buffer: pdf });
      await page.getByRole("button", { name: "Upload document" }).click();
      await expect(page.getByRole("list").filter({ hasText: "TEST-uploaded datasheet" })).toBeVisible();
      const docs = await documentsOf(product.id);
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject({ kind: "DATASHEET", title: "TEST-uploaded datasheet" });
      // The audit row is keyed by the document id and holds only its kind.
      expect(await auditRowsFor(docs[0].id)).toMatchObject([
        { action: "document.upload", entityType: "document", outcome: "ok", detail: { kind: "DATASHEET" } },
      ]);

      await pub.goto(`/aroma-chemicals/${product.slug}`);
      const link = pub.getByRole("link", { name: /TEST-uploaded datasheet/ });
      await expect(link).toBeVisible();
      const href = await link.getAttribute("href");
      expect(href).toBe(`/aroma-chemicals/documents/${docs[0].id}`);
      const res = await pub.request.get(href!);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("application/pdf");
      expect((await res.body()).equals(pdf)).toBe(true);
      const [download] = await Promise.all([pub.waitForEvent("download"), link.click()]);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);

      // Deleting removes it from the public page.
      await page.getByRole("button", { name: "Delete document TEST-uploaded datasheet" }).click();
      await expect(page.getByText("No documents yet.")).toBeVisible();
      expect((await pub.request.get(href!)).status()).toBe(404);
    } finally {
      await admin.close();
      await visitor.close();
      await deleteProductWithFiles({ id: product.id });
    }
  });
});

test.describe("admin categories @catalogue-write", () => {
  test("create, rename, move, and delete is refused while a product uses the category", async ({ page }) => {
    const t = tag();
    const first = `TEST-Cat A ${t}`;
    const renamed = `TEST-Cat Renamed ${t}`;
    const second = `TEST-Cat B ${t}`;
    const product = await createDraftProduct("category");
    try {
      await signInViaApi(page, administrator);
      await page.goto("/admin/categories");
      const add = async (name: string) => {
        await expect(async () => {
          await page.getByLabel("New category").fill(name);
          await page.getByRole("button", { name: "Add category" }).click();
          await expect(page.getByLabel(new RegExp(`^Name of category ${name}$`))).toBeVisible({ timeout: 2_000 });
        }).toPass();
      };
      await add(first);
      await add(second);
      await expect(page.getByLabel(`Name of category ${first}`)).toBeVisible();

      // Rename keeps the row and changes its name.
      const nameInput = page.getByLabel(`Name of category ${first}`);
      await nameInput.fill(renamed);
      await page.getByRole("button", { name: `Rename ${first}` }).click();
      await expect(page.getByText("Category renamed.")).toBeVisible();
      await expect(page.getByLabel(`Name of category ${renamed}`)).toBeVisible();

      // Move the renamed category down: it ends up after the second one.
      const order = async () =>
        page.locator('input[id^="category-"]:not(#category-new)').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
      const before = (await order()).filter((n) => n === renamed || n === second);
      expect(before).toEqual([renamed, second]);
      await page.getByRole("button", { name: `Move down ${renamed}` }).click();
      await expect(page.getByText("Order updated.")).toBeVisible();
      await expect.poll(async () => (await order()).filter((n) => n === renamed || n === second)).toEqual([second, renamed]);

      // A category in use cannot be deleted.
      const catId = await withDb(async (c) => (await c.query<{ id: string }>(`SELECT "id" FROM "category" WHERE "name" = $1`, [renamed])).rows[0].id);
      await setProductCategory(product.id, catId);
      await page.reload();
      await expect(page.getByLabel(`Name of category ${renamed}`)).toBeVisible();
      await page.getByRole("button", { name: `Delete ${renamed}` }).click();
      await expect(page.getByText("1 product uses this category. Move them first.")).toBeVisible();
      await expect(page.getByLabel(`Name of category ${renamed}`)).toBeVisible();

      // An unused one can.
      await page.getByRole("button", { name: `Delete ${second}` }).click();
      await expect(page.getByText("Category deleted.")).toBeVisible();
      await expect(page.getByLabel(`Name of category ${second}`)).toHaveCount(0);
    } finally {
      await deleteProductWithFiles({ id: product.id });
      await deleteCategoriesNamed(first, renamed, second);
    }
  });
});

test.describe("admin products: quality gates", () => {
  test("products, new, edit and categories pages: noindex, one h1, no overflow, axe clean", async ({ page }) => {
    const product = await createDraftProduct("quality");
    const t = tag();
    const category = `TEST-Cat Q ${t}`;
    await createCategoryRow(category, `test-cat-q-${t}`);
    try {
      await signInViaApi(page, superAdmin);
      for (const path of [
        "/admin/products",
        "/admin/products/new",
        `/admin/products/${product.id}/edit`,
        "/admin/categories",
      ]) {
        await expectNoindexAndQuality(page, path);
      }
    } finally {
      await deleteProductWithFiles({ id: product.id });
      await deleteCategoriesNamed(category);
    }
  });

  test("a form with rows and errors is axe clean", async ({ page }) => {
    await signInViaApi(page, administrator);
    await page.goto("/admin/products/new");
    await addRow(page, "Add specification", "Label 1");
    await addRow(page, "Add application", "Application 1");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByText(/Fix the highlighted fields/)).toBeVisible();
    await expectNoOverflow(page);
    await expectAxeClean(page);
  });
});
