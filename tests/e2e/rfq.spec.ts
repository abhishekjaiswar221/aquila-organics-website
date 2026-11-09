import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { E2E_STORAGE_ROOT } from "./support/e2e-env";
import { DRAFT, ETHANOL, WATER } from "./support/fixtures";
import { deleteEnquiriesFor, enquiriesFor, seedRfqRateLimit, testEmail, testIp } from "./support/rfq-db";
import { expectAxeClean, expectNoOverflow } from "./support/quality";

const ENQUIRY_KEY = "aquila.enquiry.v1";
const UNKNOWN_ID = "e2e00000-0000-4000-8000-00000000fffe";
const REF = /^AQ-\d{4}-\d{6}$/;

const PDF = {
  name: "TEST-specification.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n% TEST e2e attachment, not a real document\n%%EOF\n"),
};

let email = "";
let ip = "";

test.beforeEach(async ({ page }) => {
  // Unique per test: rows are found (and cleaned up) by email, and each test
  // has its own rate-limit bucket.
  email = testEmail();
  ip = testIp();
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
});

test.afterEach(async () => {
  await deleteEnquiriesFor(email);
});

const isDesktop = (info: TestInfo) => info.project.use.viewport!.width >= 1024;

/** The header enquiry link: in the bar on desktop, inside the drawer below lg. */
async function enquiryLink(page: Page, info: TestInfo) {
  if (isDesktop(info)) return page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /^Enquiry list/ });
  await page.getByRole("button", { name: /open menu/i }).click();
  return page.getByRole("dialog").getByRole("link", { name: /^Enquiry list/ });
}

/** The list row button; its name is "Add to enquiry : <product>" (visible text + sr-only suffix). */
const addFromList = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^Add to enquiry\\s*:\\s*${name}$`) }).click();

const line = (page: Page, n: number) => page.getByRole("group", { name: new RegExp(`^Product ${n}\\b`) });

async function fillContact(page: Page, overrides: { email?: string; consent?: boolean } = {}) {
  await page.getByLabel("Full name").fill("TEST Jane Buyer");
  await page.getByLabel("Company name").fill("TEST Fragrance House Ltd");
  await page.getByLabel("Business email").fill(overrides.email ?? email);
  await page.getByLabel("Telephone").fill("+44 20 7946 0000");
  await page.getByLabel("Country").fill("United Kingdom");
  await page.getByLabel("Business segment").selectOption("FRAGRANCES");
  await page.getByLabel("Intended application (optional)").fill("TEST fine fragrance");
  if (overrides.consent !== false) await page.getByRole("checkbox", { name: /I agree/ }).check();
}

const submitButton = (page: Page) => page.getByRole("button", { name: /send enquiry/i });

async function expectConfirmation(page: Page): Promise<string> {
  await page.waitForURL(/\/rfq\/confirmation\?ref=AQ-\d{4}-\d{6}$/);
  const reference = await page.getByTestId("enquiry-reference").textContent();
  expect(reference ?? "").toMatch(REF);
  expect(page.url()).toContain(`ref=${reference}`);
  return reference ?? "";
}

function plantList(page: Page, ids: string[]) {
  return page.addInitScript(
    ([key, value]) => {
      // Only plant once per test, so later reloads see what the page stored.
      if (!window.sessionStorage.getItem("e2e-planted")) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.setItem("e2e-planted", "1");
      }
    },
    [ENQUIRY_KEY, JSON.stringify(ids)] as const,
  );
}

test.describe("rfq: building and sending an enquiry", () => {
  test("two catalogue products, an attachment, a reference and a cleared list", async ({ page }, info) => {
    await page.goto("/aroma-chemicals");
    await addFromList(page, ETHANOL.name);
    // TEST-Water sorts onto page 2; find it with the list search instead.
    await page.goto(`/aroma-chemicals?q=${encodeURIComponent(WATER.name)}`);
    await addFromList(page, WATER.name);

    const link = await enquiryLink(page, info);
    await expect(link).toHaveAccessibleName("Enquiry list, 2 products");
    await expect(link).toHaveText("Enquiry (2)");
    await link.click();
    await page.waitForURL(/\/rfq$/);

    await expect(line(page, 1)).toContainText(ETHANOL.name);
    await expect(line(page, 1)).toContainText(ETHANOL.cas);
    await expect(line(page, 2)).toContainText(WATER.name);
    await expect(line(page, 2)).toContainText(WATER.cas);
    // A catalogue line's name is read-only.
    await expect(line(page, 1).getByLabel("Product name")).toHaveCount(0);
    await expect(line(page, 3)).toHaveCount(0);

    await line(page, 1).getByLabel("Quantity").fill("25");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await line(page, 1).getByLabel("Notes (optional)").fill("TEST 25 kg drums");
    await line(page, 2).getByLabel("Quantity").fill("200");
    await line(page, 2).getByLabel("Unit").selectOption("L");
    await fillContact(page);
    await page.getByLabel("Attachments (optional)").setInputFiles(PDF);
    await expect(page.getByRole("list", { name: "Selected files" })).toContainText(PDF.name);

    await submitButton(page).click();
    const reference = await expectConfirmation(page);

    const stored = await enquiriesFor(email);
    expect(stored).toHaveLength(1);
    expect(stored[0].reference).toBe(reference);
    expect(stored[0].submissionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored[0].items).toEqual([
      { productId: ETHANOL.id, name: ETHANOL.name, cas: ETHANOL.cas, quantity: "25.000", unit: "KG" },
      { productId: WATER.id, name: WATER.name, cas: WATER.cas, quantity: "200.000", unit: "L" },
    ]);
    expect(stored[0].attachments).toHaveLength(1);
    expect(stored[0].attachments[0]).toMatchObject({ filename: PDF.name, sizeBytes: PDF.buffer.length });
    // Uploaded under the e2e storage root, never ./storage itself.
    expect(fs.existsSync(path.join(E2E_STORAGE_ROOT, stored[0].attachments[0].storageKey))).toBe(true);

    expect(await page.evaluate((k) => window.localStorage.getItem(k), ENQUIRY_KEY)).toBe("[]");
    await expect(await enquiryLink(page, info)).toHaveText("Enquiry");
    // The confirmation carries the reference only.
    expect(new URL(page.url()).searchParams.toString()).toBe(`ref=${reference}`);
    await expect(page.locator("main")).not.toContainText(email);
  });

  test("a free-text line works with an empty saved list", async ({ page }) => {
    await page.goto("/rfq");
    await expect(line(page, 1)).toBeVisible();
    await expect(page.getByRole("link", { name: /browse the catalogue/i })).toHaveAttribute("href", "/aroma-chemicals");
    await line(page, 1).getByLabel("Product name").fill("TEST Custom amber accord");
    await line(page, 1).getByLabel("Quantity").fill("5");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await fillContact(page);
    await submitButton(page).click();
    await expectConfirmation(page);
    const stored = await enquiriesFor(email);
    expect(stored).toHaveLength(1);
    expect(stored[0].items).toEqual([
      { productId: null, name: "TEST Custom amber accord", cas: null, quantity: "5.000", unit: "KG" },
    ]);
  });

  test("lines can be added and removed", async ({ page }) => {
    await page.goto("/rfq");
    await page.getByRole("button", { name: "Add another product" }).click();
    await expect(line(page, 2)).toBeVisible();
    await expect(line(page, 2).getByLabel("Product name")).toBeFocused();
    await line(page, 2).getByRole("button", { name: /remove/i }).click();
    await expect(line(page, 2)).toHaveCount(0);
  });

  test("double-clicking Send creates exactly one enquiry", async ({ page }) => {
    await page.goto("/rfq");
    await line(page, 1).getByLabel("Product name").fill("TEST Double click blend");
    await line(page, 1).getByLabel("Quantity").fill("1");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await fillContact(page);
    await submitButton(page).dblclick();
    await expectConfirmation(page);
    expect(await enquiriesFor(email)).toHaveLength(1);
  });

  test("a retry after a lost response returns the same reference (same submissionId)", async ({ page }) => {
    await page.goto("/rfq");
    await line(page, 1).getByLabel("Product name").fill("TEST Retry blend");
    await line(page, 1).getByLabel("Quantity").fill("2");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await fillContact(page);

    // First post reaches the server, but the browser never sees the response.
    let dropped = false;
    await page.route("**/rfq", async (route) => {
      const req = route.request();
      if (!dropped && req.method() === "POST" && req.headers()["next-action"]) {
        dropped = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await submitButton(page).click();
    // Scoped to main: Next.js's route announcer is also role=alert.
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText(/could not reach/i);
    await expect(submitButton(page)).toBeEnabled();
    const first = await enquiriesFor(email);
    expect(first).toHaveLength(1);

    await submitButton(page).click();
    const reference = await expectConfirmation(page);
    expect(reference).toBe(first[0].reference);
    expect(await enquiriesFor(email)).toHaveLength(1);
  });

  test("saved products that are unpublished or unknown are dropped with a message", async ({ page }) => {
    await plantList(page, [DRAFT.id, ETHANOL.id, UNKNOWN_ID]);
    await page.goto("/rfq");
    await expect(page.getByRole("status").filter({ hasText: "2 saved products are no longer available" })).toBeVisible();
    await expect(line(page, 1)).toContainText(ETHANOL.name);
    await expect(line(page, 2)).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(DRAFT.name);
    expect(JSON.parse((await page.evaluate((k) => window.localStorage.getItem(k), ENQUIRY_KEY)) ?? "[]")).toEqual([
      ETHANOL.id,
    ]);
  });
});

test.describe("rfq: validation and errors", () => {
  test("invalid email and missing consent: inline accessible errors, focus on the first", async ({ page }) => {
    await page.goto("/rfq");
    await line(page, 1).getByLabel("Product name").fill("TEST Validation blend");
    await line(page, 1).getByLabel("Quantity").fill("1");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await fillContact(page, { email: "not-an-email", consent: false });
    await submitButton(page).click();

    const emailField = page.getByLabel("Business email");
    await expect(emailField).toHaveAttribute("aria-invalid", "true");
    await expect(emailField).toBeFocused();
    await expect(emailField).toHaveAccessibleDescription(/Enter a valid email address/);
    const consent = page.getByRole("checkbox", { name: /I agree/ });
    await expect(consent).toHaveAttribute("aria-invalid", "true");
    await expect(consent).toHaveAccessibleDescription(/agree to the privacy notice/i);
    await expect(page.getByRole("heading", { name: /There (is|are) \d+ problems?/ })).toBeVisible();
    await expect(page.getByLabel("Full name")).not.toHaveAttribute("aria-invalid", "true");
    expect(await enquiriesFor(email)).toHaveLength(0);
    await expectAxeClean(page);
  });

  test("a missing quantity is reported on its line", async ({ page }) => {
    await page.goto("/rfq");
    await line(page, 1).getByLabel("Product name").fill("TEST Quantity blend");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await fillContact(page);
    await submitButton(page).click();
    const qty = line(page, 1).getByLabel("Quantity");
    await expect(qty).toHaveAttribute("aria-invalid", "true");
    await expect(qty).toBeFocused();
    expect(await enquiriesFor(email)).toHaveLength(0);
  });

  test("the rate limit shows as a form-level error", async ({ page }) => {
    await seedRfqRateLimit(ip, 5);
    await page.goto("/rfq");
    await line(page, 1).getByLabel("Product name").fill("TEST Limited blend");
    await line(page, 1).getByLabel("Quantity").fill("1");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await fillContact(page);
    await submitButton(page).click();
    // Scoped to main: Next.js's route announcer is also role=alert.
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText("Too many requests. Please try again later.");
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL(/\/rfq$/);
    // Nothing the visitor typed is lost.
    await expect(page.getByLabel("Full name")).toHaveValue("TEST Jane Buyer");
    expect(await enquiriesFor(email)).toHaveLength(0);
  });

  test("too many or oversize attachments are reported before sending", async ({ page }) => {
    await page.goto("/rfq");
    const input = page.getByLabel("Attachments (optional)");
    await input.setInputFiles(
      Array.from({ length: 6 }, (_, i) => ({ ...PDF, name: `TEST-file-${i + 1}.pdf` })),
    );
    await expect(page.getByRole("list", { name: "Selected files" }).getByRole("listitem")).toHaveCount(5);
    await expect(page.locator("#rfq-attachments-error")).toContainText("You can attach up to 5 files. Not added: TEST-file-6.pdf");
    await expect(input).toHaveAttribute("aria-invalid", "true");

    await page.getByRole("button", { name: "Remove TEST-file-1.pdf" }).click();
    await expect(page.getByRole("list", { name: "Selected files" }).getByRole("listitem")).toHaveCount(4);

    await input.setInputFiles({ name: "TEST-big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 0x20) });
    await expect(page.locator("#rfq-attachments-error")).toContainText("TEST-big.pdf: larger than 10 MB");
    await input.setInputFiles({ name: "TEST-tool.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
    await expect(page.locator("#rfq-attachments-error")).toContainText("TEST-tool.exe: this file type is not accepted");
    await expect(page.getByRole("list", { name: "Selected files" }).getByRole("listitem")).toHaveCount(4);
  });
});

test.describe("rfq: unit is an explicit choice", () => {
  test("an unselected unit shows an inline accessible error on its line, is focused, and sends nothing", async ({ page }) => {
    await page.goto("/rfq");
    const unit = line(page, 1).getByLabel("Unit");
    await expect(unit).toHaveValue("");
    await expect(unit.locator("option:checked")).toHaveText("Select unit");
    await line(page, 1).getByLabel("Product name").fill("TEST Unitless blend");
    await line(page, 1).getByLabel("Quantity").fill("5");
    await fillContact(page);
    await submitButton(page).click();
    await expect(unit).toHaveAttribute("aria-invalid", "true");
    await expect(unit).toBeFocused();
    await expect(unit).toHaveAccessibleDescription(/Choose a unit/);
    await expect(page).toHaveURL(/\/rfq$/);
    expect(await enquiriesFor(email)).toHaveLength(0);
  });
});

/** Second, different RFQ from the same (reset) form instance. */
async function sendSecondRfq(page: Page): Promise<string> {
  await line(page, 1).getByLabel("Product name").fill("TEST Second blend");
  await line(page, 1).getByLabel("Quantity").fill("7");
  await line(page, 1).getByLabel("Unit").selectOption("L");
  await fillContact(page);
  await page.getByLabel("Full name").fill("TEST John Second");
  await submitButton(page).click();
  return expectConfirmation(page);
}

async function expectPristine(page: Page) {
  await expect(page.getByLabel("Full name")).toHaveValue("");
  await expect(page.getByLabel("Business email")).toHaveValue("");
  await expect(page.getByLabel("Company name")).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: /I agree/ })).not.toBeChecked();
  await expect(page.getByRole("list", { name: "Selected files" })).toHaveCount(0);
  await expect(line(page, 1).getByLabel("Product name")).toHaveValue("");
  await expect(line(page, 1).getByLabel("Unit")).toHaveValue("");
  await expect(line(page, 2)).toHaveCount(0);
  await expect(submitButton(page)).toBeEnabled();
}

async function sendFirstRfq(page: Page): Promise<string> {
  await page.goto("/rfq");
  await line(page, 1).getByLabel("Product name").fill("TEST First blend");
  await line(page, 1).getByLabel("Quantity").fill("4");
  await line(page, 1).getByLabel("Unit").selectOption("KG");
  await fillContact(page);
  await page.getByLabel("Attachments (optional)").setInputFiles(PDF);
  await submitButton(page).click();
  return expectConfirmation(page);
}

test.describe("rfq: after a successful send", () => {
  test("Back shows a pristine form and a second RFQ gets a new reference", async ({ page }) => {
    const first = await sendFirstRfq(page);
    await page.goBack();
    await page.waitForURL(/\/rfq$/);
    await expectPristine(page);
    const second = await sendSecondRfq(page);
    expect(second).not.toBe(first);
    const stored = await enquiriesFor(email);
    expect(stored.map((e) => e.reference).sort()).toEqual([first, second].sort());
    expect(stored[0].submissionId).not.toBe(stored[1].submissionId);
  });

  test("the header Enquiry link shows a pristine form and a second RFQ gets a new reference", async ({ page }, info) => {
    const first = await sendFirstRfq(page);
    await (await enquiryLink(page, info)).click();
    await page.waitForURL(/\/rfq$/);
    await expectPristine(page);
    const second = await sendSecondRfq(page);
    expect(second).not.toBe(first);
    expect(await enquiriesFor(email)).toHaveLength(2);
  });
});

test.describe("rfq: typed values survive leaving and returning", () => {
  async function typeLines(page: Page) {
    await page.goto(`/aroma-chemicals/${ETHANOL.slug}`);
    await page.getByRole("button", { name: /add to enquiry/i }).click();
    await page.goto("/rfq");
    await expect(line(page, 1)).toContainText(ETHANOL.name);
    await line(page, 1).getByLabel("Quantity").fill("25");
    await line(page, 1).getByLabel("Unit").selectOption("MT");
    await line(page, 1).getByLabel("Notes (optional)").fill("TEST drums");
    await page.getByRole("button", { name: "Add another product" }).click();
    await line(page, 2).getByLabel("Product name").fill("TEST Typed blend");
    await line(page, 2).getByLabel("Quantity").fill("3");
    await line(page, 2).getByLabel("Unit").selectOption("L");
    await page.getByLabel("Full name").fill("TEST Jane Buyer");
  }

  async function expectTyped(page: Page) {
    await expect(line(page, 1)).toContainText(ETHANOL.name);
    await expect(line(page, 1).getByLabel("Quantity")).toHaveValue("25");
    await expect(line(page, 1).getByLabel("Unit")).toHaveValue("MT");
    await expect(line(page, 1).getByLabel("Notes (optional)")).toHaveValue("TEST drums");
    await expect(line(page, 2).getByLabel("Product name")).toHaveValue("TEST Typed blend");
    await expect(line(page, 2).getByLabel("Quantity")).toHaveValue("3");
    await expect(line(page, 2).getByLabel("Unit")).toHaveValue("L");
    await expect(line(page, 3)).toHaveCount(0);
    await expect(page.getByLabel("Full name")).toHaveValue("TEST Jane Buyer");
  }

  async function browseCatalogue(page: Page) {
    await page.getByRole("link", { name: /browse the catalogue/i }).click();
    await page.waitForURL(/\/aroma-chemicals$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/aroma chemicals/i);
  }

  test("via Browse the catalogue then Back, and then the header Enquiry link", async ({ page }, info) => {
    await typeLines(page);
    await browseCatalogue(page);
    await page.goBack();
    await page.waitForURL(/\/rfq$/);
    await expectTyped(page);

    await browseCatalogue(page);
    await (await enquiryLink(page, info)).click();
    await page.waitForURL(/\/rfq$/);
    await expectTyped(page);
  });

  test("a newly saved product is added as exactly one new line without touching the others", async ({ page }) => {
    await typeLines(page);
    await page.evaluate(
      ([key, ids]) => window.localStorage.setItem(key, JSON.stringify(ids)),
      [ENQUIRY_KEY, [ETHANOL.id, WATER.id]] as const,
    );
    await browseCatalogue(page);
    await page.goBack();
    await page.waitForURL(/\/rfq$/);
    await expect(line(page, 3)).toContainText(WATER.name);
    await expect(line(page, 3).getByLabel("Quantity")).toHaveValue("");
    await expect(line(page, 4)).toHaveCount(0);
    await expect(line(page, 1).getByLabel("Quantity")).toHaveValue("25");
    await expect(line(page, 2).getByLabel("Product name")).toHaveValue("TEST Typed blend");
  });
});

test.describe("rfq: honeypot", () => {
  test("is unreachable by keyboard and hidden from assistive technology", async ({ page }) => {
    await page.goto("/rfq");
    const hp = page.locator('input[name="website"]');
    await expect(hp).toHaveCount(1);
    await expect(hp).toHaveAttribute("tabindex", "-1");
    await expect(hp).toHaveAttribute("autocomplete", "off");
    expect(await hp.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
    await expect(page.getByRole("textbox", { name: /website/i })).toHaveCount(0);
    const box = await hp.boundingBox();
    expect(box === null || box.width <= 1 || box.x + box.width <= 0).toBe(true);
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name)).not.toBe("website");
    }
  });

  test("a bot-filled honeypot gets a normal confirmation and stores nothing", async ({ page }) => {
    await page.goto("/rfq");
    await line(page, 1).getByLabel("Product name").fill("TEST Bot blend");
    await line(page, 1).getByLabel("Quantity").fill("1");
    await line(page, 1).getByLabel("Unit").selectOption("KG");
    await fillContact(page);
    await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
      el.value = "http://spam.example";
    });
    await submitButton(page).click();
    await expectConfirmation(page);
    expect(await enquiriesFor(email)).toHaveLength(0);
  });
});

test.describe("rfq: confirmation page", () => {
  test("shows the reference, next steps and the sales contacts; noindex", async ({ page }) => {
    await page.goto("/rfq/confirmation?ref=AQ-2026-000042");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("enquiry-reference")).toHaveText("AQ-2026-000042");
    await expect(page.locator("main")).toContainText(/member of the team will review/i);
    await expect(page.locator("main").getByRole("link", { name: "sales@aquilaorganics.com" })).toHaveAttribute(
      "href",
      "mailto:sales@aquilaorganics.com",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("an invalid ref shows a generic message and never echoes it", async ({ page }) => {
    for (const ref of ["<b>x</b>", "AQ-2026-1", "jane@example.com"]) {
      await page.goto(`/rfq/confirmation?ref=${encodeURIComponent(ref)}`);
      await expect(page.getByTestId("enquiry-reference")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(ref);
      await expect(page.locator("main")).toContainText(/no enquiry reference/i);
    }
  });
});

test.describe("rfq: privacy page", () => {
  test("is a clearly marked draft, linked from the form and footer, in the sitemap", async ({ page, request }) => {
    await page.goto("/rfq");
    await expect(page.locator("main").getByRole("link", { name: /privacy notice/i })).toHaveAttribute("href", "/privacy");
    await expect(page.locator("footer").getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/privacy/i);
    await expect(page.locator("main")).toContainText("This notice is a draft and is being reviewed");
    await expect(page.locator("main")).toContainText("info@aquilaorganics.com");
    await expect(page.locator("main")).toContainText(/to be confirmed by Aquila/i);
    await expect(page.locator("main")).not.toContainText(/GDPR|DPDP|compliant with|certified/i);
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/privacy</loc>");
  });
});

test.describe("rfq: quality gates", () => {
  // Overflow, axe and heading gates for /rfq (with saved products), both
  // confirmation states and /privacy live in quality-catalogue.spec.ts; the
  // empty form state is checked here because it is specific to this spec.
  test("axe finds no violations on the empty form", async ({ page }) => {
    await page.goto("/rfq");
    await expect(line(page, 1)).toBeVisible();
    await expectAxeClean(page);
    await expectNoOverflow(page);
  });

  test("metadata: titles, descriptions, confirmation noindex", async ({ page }) => {
    await page.goto("/rfq");
    await expect(page).toHaveTitle(/Request a quotation/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await page.goto("/privacy");
    await expect(page).toHaveTitle(/Privacy/);
    await page.goto("/rfq/confirmation?ref=AQ-2026-000042");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("rfq: review screenshots", () => {
  test("capture rfq and confirmation", async ({ page }, info) => {
    const width = info.project.use.viewport!.width;
    test.skip(width !== 375 && width !== 1280, "375 and 1280 only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const dir = path.resolve(__dirname, "../../docs/screenshots");
    fs.mkdirSync(dir, { recursive: true });
    await page.goto("/rfq");
    await expect(line(page, 1)).toBeVisible();
    await page.screenshot({ path: path.join(dir, `rfq-empty-${width}.png`), fullPage: true });
    await plantList(page, [ETHANOL.id, WATER.id]);
    await page.goto("/rfq");
    await expect(line(page, 2)).toBeVisible();
    await page.screenshot({ path: path.join(dir, `rfq-lines-${width}.png`), fullPage: true });
    await page.goto("/rfq/confirmation?ref=AQ-2026-000042");
    await page.screenshot({ path: path.join(dir, `rfq-confirmation-${width}.png`), fullPage: true });
  });
});
