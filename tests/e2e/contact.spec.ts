import { expect, test, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { contactEnquiriesFor } from "./support/contact-db";
import { deleteEnquiriesFor, seedRfqRateLimit, testEmail, testIp } from "./support/rfq-db";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";

const REF = /^AQ-\d{4}-\d{6}$/;
const FLAVOURS_MAILBOX = "flavors@aquilaorganics.com";
const HIDDEN_PEOPLE = ["Shalin Kale", "Sunil Patil", "Gurudeo Hattali"];

const TABS = {
  GENERAL: "General",
  FRAGRANCES: "Fragrances",
  FLAVOURS: "Flavours",
  AROMA_CHEMICALS: "Aroma chemicals",
} as const;
type ContactType = keyof typeof TABS;

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

const tablist = (page: Page) => page.getByRole("tablist", { name: "Enquiry type" });
const tab = (page: Page, type: ContactType) => tablist(page).getByRole("tab", { name: TABS[type], exact: true });
/** The one visible form panel (hidden panels are not in the accessibility tree). */
const panel = (page: Page) => page.getByRole("tabpanel");
const sendButton = (scope: Locator) => scope.getByRole("button", { name: /send message/i });

async function fillMessage(scope: Locator, overrides: { email?: string; message?: string; consent?: boolean } = {}) {
  await scope.getByLabel("Full name").fill("TEST Jane Buyer");
  await scope.getByLabel("Company name").fill("TEST Fragrance House Ltd");
  await scope.getByLabel("Business email").fill(overrides.email ?? email);
  await scope.getByLabel("Telephone").fill("+44 20 7946 0000");
  await scope.getByLabel("Country").fill("United Kingdom");
  await scope.getByLabel("Message", { exact: true }).fill(overrides.message ?? "TEST We would like to discuss a new project.");
  if (overrides.consent !== false) await scope.getByRole("checkbox", { name: /I agree/ }).check();
}

async function expectConfirmation(page: Page): Promise<string> {
  await page.waitForURL(/\/contact\/confirmation\?ref=AQ-\d{4}-\d{6}$/);
  const reference = (await page.getByTestId("enquiry-reference").textContent()) ?? "";
  expect(reference).toMatch(REF);
  // The confirmation URL carries the reference only.
  expect(new URL(page.url()).searchParams.toString()).toBe(`ref=${reference}`);
  await expect(page.locator("main")).not.toContainText(email);
  return reference;
}

async function expectSelected(page: Page, type: ContactType) {
  await expect(tab(page, type)).toHaveAttribute("aria-selected", "true");
  await expect(panel(page)).toHaveCount(1);
  await expect(panel(page)).toHaveAccessibleName(new RegExp(TABS[type]));
}

test.describe("contact: page", () => {
  test("answers 200 with one h1 and passes the overflow, heading and axe gates", async ({ page }) => {
    const response = await page.goto("/contact");
    expect(response?.status()).toBe(200);
    await expectHeadingOutline(page);
    await expectNoOverflow(page);
    await expectAxeClean(page);
    await tab(page, "FLAVOURS").click();
    await panel(page).getByLabel("Application (optional)").selectOption("bakery");
    await expectNoOverflow(page);
    await expectAxeClean(page);
    await expect(page).toHaveTitle(/Contact/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/contact$/);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.some((t) => t.includes('"BreadcrumbList"') && t.includes("/contact"))).toBe(true);
  });

  test("shows the verified details and never the named individuals", async ({ page }) => {
    await page.goto("/contact");
    const details = page.getByRole("region", { name: "Contact details" });
    await expect(details).toContainText("Head office");
    await expect(details).toContainText("W-353, TTC Industrial Area, Rabale MIDC");
    await expect(details).toContainText("Registered office");
    await expect(details).toContainText("Wagle Industrial Estate");
    await expect(details.getByRole("link", { name: "+91 98193 43989" })).toHaveAttribute("href", "tel:+919819343989");
    await expect(details.getByRole("link", { name: "+91 82912 31180" })).toHaveAttribute("href", "tel:+918291231180");
    for (const box of ["info", "sales", "fragrances", "hr"]) {
      await expect(details.getByRole("link", { name: `${box}@aquilaorganics.com` })).toHaveAttribute(
        "href",
        `mailto:${box}@aquilaorganics.com`,
      );
    }
    await expect(details).toContainText("Monday to Saturday, 09:00 to 17:00");
    const html = await page.content();
    for (const name of HIDDEN_PEOPLE) expect(html).not.toContain(name);
    // No map: the coordinates are not confirmed.
    await expect(page.locator("main iframe")).toHaveCount(0);
  });

  test("the flavors@ mailbox appears only inside the Flavours panel", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("region", { name: "Contact details" })).not.toContainText(FLAVOURS_MAILBOX);
    const links = page.locator(`main a[href="mailto:${FLAVOURS_MAILBOX}"]`);
    await expect(links).toHaveCount(1);
    const inFlavoursPanel = await links.evaluate(
      (a) => a.closest('[role="tabpanel"]')?.getAttribute("aria-labelledby") ?? null,
    );
    expect(inFlavoursPanel).toBe(await tab(page, "FLAVOURS").getAttribute("id"));
    expect(await page.locator("main").evaluate((m, box) => m.textContent!.split(box).length - 1, FLAVOURS_MAILBOX)).toBe(1);
    await expect(links).toBeHidden();
    await tab(page, "FLAVOURS").click();
    await expect(panel(page).getByRole("link", { name: FLAVOURS_MAILBOX })).toBeVisible();
  });

  test("the aroma chemicals panel links to the quotation form", async ({ page }) => {
    await page.goto("/contact?type=AROMA_CHEMICALS");
    await expectSelected(page, "AROMA_CHEMICALS");
    await expect(panel(page)).toContainText("Need prices for several products?");
    await expect(panel(page).getByRole("link", { name: /quotation request form/i })).toHaveAttribute("href", "/rfq");
    await expect(panel(page).getByLabel("Application (optional)")).toHaveCount(0);
  });
});

test.describe("contact: prefill from the URL", () => {
  test("type=FLAVOURS&application=bakery selects the Flavours form and Bakery", async ({ page }) => {
    await page.goto("/contact?type=FLAVOURS&application=bakery");
    await expectSelected(page, "FLAVOURS");
    const select = panel(page).getByLabel("Application (optional)");
    await expect(select).toHaveValue("bakery");
    // Exactly that segment's applications plus the empty "Not specified" choice.
    await expect(select.locator("option")).toHaveText(["Not specified", "Confectionery", "Bakery", "Beverages", "Dairy", "Savoury"]);
  });

  test("the fragrance form lists exactly the fragrance applications", async ({ page }) => {
    await page.goto("/contact?type=FRAGRANCES&application=air-care");
    await expectSelected(page, "FRAGRANCES");
    const select = panel(page).getByLabel("Application (optional)");
    await expect(select).toHaveValue("air-care");
    await expect(select.locator("option")).toHaveText([
      "Not specified",
      "Fine Fragrance",
      "Personal Care",
      "Air Care",
      "Fabric Care",
      "Home Care",
      "Incense and Bakhoor",
    ]);
  });

  test("no type selects the general form", async ({ page }) => {
    await page.goto("/contact");
    await expectSelected(page, "GENERAL");
    await expect(panel(page).getByLabel("Application (optional)")).toHaveCount(0);
  });

  const LONG = "A".repeat(500);
  const SCRIPT = `<script>window.__pwned=1</script>`;
  const IMG = `"><img src=x onerror="window.__pwned=1">`;
  const hostile: { query: string; selected: ContactType; values: string[] }[] = [
    { query: "type=CAREERS", selected: "GENERAL", values: ["CAREERS"] },
    { query: "type=ADMIN&application=bakery", selected: "GENERAL", values: ["ADMIN"] },
    { query: "type=a&type=b", selected: "GENERAL", values: [] },
    { query: "type=FLAVOURS&type=GENERAL", selected: "FLAVOURS", values: [] },
    { query: `type=${LONG}&application=${"b".repeat(500)}`, selected: "GENERAL", values: [LONG.slice(0, 64)] },
    { query: `type=FLAVOURS&application=${"b".repeat(500)}`, selected: "FLAVOURS", values: ["bbbbbbbbbbbbbbbb"] },
    { query: `type=${encodeURIComponent(SCRIPT)}`, selected: "GENERAL", values: ["__pwned"] },
    { query: `type=FLAVOURS&application=${encodeURIComponent(IMG)}`, selected: "FLAVOURS", values: ["__pwned", "onerror"] },
    { query: "type=FRAGRANCES&application=bakery", selected: "FRAGRANCES", values: [] },
    { query: "type=flavours&application=bakery", selected: "GENERAL", values: [] },
  ];

  for (const h of hostile) {
    test(`hostile params (${h.query.slice(0, 40)}) are ignored and reflect nothing`, async ({ page }) => {
      const response = await page.goto(`/contact?${h.query}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectSelected(page, h.selected);
      const select = panel(page).getByLabel("Application (optional)");
      if (await select.count()) await expect(select).toHaveValue("");
      const main = page.locator("main");
      const mainHtml = await main.innerHTML();
      for (const v of h.values) {
        await expect(main).not.toContainText(v);
        expect(mainHtml).not.toContain(v);
      }
      expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
      // Still usable.
      await panel(page).getByLabel("Full name").fill("TEST Still usable");
      await expect(panel(page).getByLabel("Full name")).toHaveValue("TEST Still usable");
    });
  }
});

test.describe("contact: sending", () => {
  const cases: { type: ContactType; application?: string; stored: string | null; segment: string }[] = [
    { type: "GENERAL", stored: null, segment: "OTHER" },
    { type: "FRAGRANCES", application: "air-care", stored: "Air Care", segment: "FRAGRANCES" },
    { type: "FLAVOURS", application: "bakery", stored: "Bakery", segment: "FLAVOURS" },
    { type: "AROMA_CHEMICALS", stored: null, segment: "AROMA_CHEMICALS" },
  ];

  for (const c of cases) {
    test(`the ${TABS[c.type]} form stores a ${c.type} enquiry with no product lines`, async ({ page }) => {
      await page.goto("/contact");
      await tab(page, c.type).click();
      await expectSelected(page, c.type);
      await fillMessage(panel(page), { message: `TEST ${c.type} message body.` });
      if (c.application) await panel(page).getByLabel("Application (optional)").selectOption(c.application);
      await sendButton(panel(page)).click();
      const reference = await expectConfirmation(page);

      const stored = await contactEnquiriesFor(email);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        reference,
        type: c.type,
        businessSegment: c.segment,
        intendedApplication: c.stored,
        additionalRequirements: `TEST ${c.type} message body.`,
        itemCount: 0,
      });
      expect(stored[0].submissionId).toMatch(/^[0-9a-f-]{36}$/);
    });
  }

  test("double-clicking Send creates exactly one enquiry", async ({ page }) => {
    await page.goto("/contact");
    await fillMessage(panel(page));
    await sendButton(panel(page)).dblclick();
    await expectConfirmation(page);
    expect(await contactEnquiriesFor(email)).toHaveLength(1);
  });

  test("a bot-filled honeypot gets a normal confirmation and stores nothing", async ({ page }) => {
    await page.goto("/contact");
    await fillMessage(panel(page));
    await panel(page)
      .locator('input[name="website"]')
      .evaluate((el: HTMLInputElement) => {
        el.value = "http://spam.example";
      });
    await sendButton(panel(page)).click();
    await expectConfirmation(page);
    expect(await contactEnquiriesFor(email)).toHaveLength(0);
  });

  test("the honeypot is unreachable by keyboard and hidden from assistive technology", async ({ page }) => {
    await page.goto("/contact");
    const hp = panel(page).locator('input[name="website"]');
    await expect(hp).toHaveCount(1);
    await expect(hp).toHaveAttribute("tabindex", "-1");
    await expect(hp).toHaveAttribute("autocomplete", "off");
    expect(await hp.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
    await expect(page.getByRole("textbox", { name: /website|leave this field empty/i })).toHaveCount(0);
  });

  test("a retry after a lost response returns the same reference (same submissionId)", async ({ page }) => {
    await page.goto("/contact");
    await fillMessage(panel(page));
    let dropped = false;
    await page.route("**/contact*", async (route) => {
      const req = route.request();
      if (!dropped && req.method() === "POST" && req.headers()["next-action"]) {
        dropped = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await sendButton(panel(page)).click();
    // Scoped to main: Next.js's route announcer is also role=alert.
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText(/could not reach/i);
    await expect(alert).toContainText(/will not create a duplicate/i);
    await expect(sendButton(panel(page))).toBeEnabled();
    await expect(panel(page).getByLabel("Full name")).toHaveValue("TEST Jane Buyer");
    const first = await contactEnquiriesFor(email);
    expect(first).toHaveLength(1);

    await sendButton(panel(page)).click();
    expect(await expectConfirmation(page)).toBe(first[0].reference);
    expect(await contactEnquiriesFor(email)).toHaveLength(1);
  });

  test("the shared rate limit shows as a focused form-level error and keeps the data", async ({ page }) => {
    await seedRfqRateLimit(ip, 5);
    await page.goto("/contact");
    await fillMessage(panel(page));
    await sendButton(panel(page)).click();
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText("Too many requests. Please try again later.");
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(panel(page).getByLabel("Full name")).toHaveValue("TEST Jane Buyer");
    expect(await contactEnquiriesFor(email)).toHaveLength(0);
  });
});

test.describe("contact: validation", () => {
  test("invalid email and a too-short message: inline accessible errors, focus on the first", async ({ page }) => {
    await page.goto("/contact");
    await fillMessage(panel(page), { email: "not-an-email", message: "short" });
    await sendButton(panel(page)).click();

    const emailField = panel(page).getByLabel("Business email");
    await expect(emailField).toHaveAttribute("aria-invalid", "true");
    await expect(emailField).toBeFocused();
    await expect(emailField).toHaveAccessibleDescription(/Enter a valid email address/);
    const message = panel(page).getByLabel("Message", { exact: true });
    await expect(message).toHaveAttribute("aria-invalid", "true");
    await expect(message).toHaveAccessibleDescription(/at least 10 characters/);
    await expect(panel(page).getByLabel("Full name")).not.toHaveAttribute("aria-invalid", "true");
    await expect(panel(page).getByRole("heading", { name: /There are 2 problems/ })).toBeVisible();
    await expect(page).toHaveURL(/\/contact$/);
    expect(await contactEnquiriesFor(email)).toHaveLength(0);
    await expectAxeClean(page);
  });

  test("missing consent is reported on the checkbox", async ({ page }) => {
    await page.goto("/contact");
    await fillMessage(panel(page), { consent: false });
    await sendButton(panel(page)).click();
    const consent = panel(page).getByRole("checkbox", { name: /I agree/ });
    await expect(consent).toHaveAttribute("aria-invalid", "true");
    await expect(consent).toBeFocused();
    await expect(consent).toHaveAccessibleDescription(/agree to the privacy notice/i);
    await expect(panel(page).getByRole("link", { name: "privacy notice", exact: true })).toHaveAttribute("href", "/privacy");
    expect(await contactEnquiriesFor(email)).toHaveLength(0);
  });
});

test.describe("contact: switching forms", () => {
  test("switching tabs keeps what was typed in each form", async ({ page }) => {
    await page.goto("/contact");
    await panel(page).getByLabel("Full name").fill("TEST General Name");
    await panel(page).getByLabel("Message", { exact: true }).fill("TEST general message typed");
    await tab(page, "FRAGRANCES").click();
    await expectSelected(page, "FRAGRANCES");
    await expect(panel(page).getByLabel("Full name")).toHaveValue("");
    await panel(page).getByLabel("Full name").fill("TEST Fragrance Name");
    await panel(page).getByLabel("Application (optional)").selectOption("fine-fragrance");
    await tab(page, "GENERAL").click();
    await expect(panel(page).getByLabel("Full name")).toHaveValue("TEST General Name");
    await expect(panel(page).getByLabel("Message", { exact: true })).toHaveValue("TEST general message typed");
    await tab(page, "FRAGRANCES").click();
    await expect(panel(page).getByLabel("Full name")).toHaveValue("TEST Fragrance Name");
    await expect(panel(page).getByLabel("Application (optional)")).toHaveValue("fine-fragrance");
  });

  test("tabs work with the keyboard alone (arrows, Home, End, roving tabindex)", async ({ page }) => {
    await page.goto("/contact");
    const general = tab(page, "GENERAL");
    await general.focus();
    await expect(general).toHaveAttribute("tabindex", "0");
    for (const t of ["FRAGRANCES", "FLAVOURS", "AROMA_CHEMICALS"] as const) {
      await expect(tab(page, t)).toHaveAttribute("tabindex", "-1");
    }
    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "FRAGRANCES")).toBeFocused();
    await expectSelected(page, "FRAGRANCES");
    await expect(tab(page, "FRAGRANCES")).toHaveAttribute("tabindex", "0");
    await expect(general).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("End");
    await expect(tab(page, "AROMA_CHEMICALS")).toBeFocused();
    await expectSelected(page, "AROMA_CHEMICALS");
    await page.keyboard.press("ArrowRight");
    await expect(general).toBeFocused();
    await expectSelected(page, "GENERAL");
    await page.keyboard.press("ArrowLeft");
    await expectSelected(page, "AROMA_CHEMICALS");
    await page.keyboard.press("Home");
    await expectSelected(page, "GENERAL");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expectSelected(page, "FLAVOURS");
    // Tab leaves the tablist into the selected panel, never to another tab.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("role"))).not.toBe("tab");
    expect(
      await page.evaluate(() => document.activeElement?.closest('[role="tabpanel"]')?.getAttribute("aria-labelledby") ?? null),
    ).toBe(await tab(page, "FLAVOURS").getAttribute("id"));
  });
});

test.describe("contact: after a successful send", () => {
  test("Back shows a pristine form and a second send gets a new reference", async ({ page }) => {
    await page.goto("/contact");
    await fillMessage(panel(page));
    await panel(page).getByLabel("Attachments (optional)").setInputFiles({
      name: "TEST-brief.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n% TEST e2e attachment\n%%EOF\n"),
    });
    await sendButton(panel(page)).click();
    const first = await expectConfirmation(page);

    await page.goBack();
    await page.waitForURL(/\/contact$/);
    await expectSelected(page, "GENERAL");
    const p = panel(page);
    for (const label of ["Full name", "Company name", "Business email", "Telephone", "Country", "Message"]) {
      await expect(p.getByLabel(label, { exact: true })).toHaveValue("");
    }
    await expect(p.getByRole("checkbox", { name: /I agree/ })).not.toBeChecked();
    await expect(p.getByRole("list", { name: "Selected files" })).toHaveCount(0);
    await expect(sendButton(p)).toBeEnabled();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

    await fillMessage(p, { message: "TEST A second, different message." });
    await sendButton(p).click();
    const second = await expectConfirmation(page);
    expect(second).not.toBe(first);
    const stored = await contactEnquiriesFor(email);
    expect(stored.map((e) => e.reference).sort()).toEqual([first, second].sort());
    expect(stored[0].submissionId).not.toBe(stored[1].submissionId);
  });

  test("the confirmation page shows the reference, is noindex, and never echoes a bad ref", async ({ page }) => {
    await page.goto("/contact/confirmation?ref=AQ-2026-000042");
    await expectHeadingOutline(page);
    await expect(page.getByTestId("enquiry-reference")).toHaveText("AQ-2026-000042");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/message has been sent/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoOverflow(page);
    await expectAxeClean(page);
    for (const ref of ["<b>x</b>", "AQ-2026-1", "jane@example.com"]) {
      await page.goto(`/contact/confirmation?ref=${encodeURIComponent(ref)}`);
      await expect(page.getByTestId("enquiry-reference")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(ref);
    }
  });
});

test.describe("contact: from an application page", () => {
  test("the consultation link opens the Flavours form with Bakery and sends a FLAVOURS enquiry", async ({ page }) => {
    await page.goto("/flavours/bakery");
    await page.locator("main").getByRole("link", { name: /request a consultation/i }).click();
    await page.waitForURL(/\/contact\?type=FLAVOURS&application=bakery$/);
    await expectSelected(page, "FLAVOURS");
    await expect(panel(page).getByLabel("Application (optional)")).toHaveValue("bakery");
    await fillMessage(panel(page), { message: "TEST A bakery consultation request." });
    await sendButton(panel(page)).click();
    await expectConfirmation(page);
    const stored = await contactEnquiriesFor(email);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ type: "FLAVOURS", intendedApplication: "Bakery", itemCount: 0 });
  });

  test("the fragrance consultation link preselects the Fragrances form and its application", async ({ page }) => {
    await page.goto("/fragrances/incense-and-bakhoor");
    await page.locator("main").getByRole("link", { name: /request a consultation/i }).click();
    await page.waitForURL(/\/contact\?type=FRAGRANCES&application=incense-and-bakhoor$/);
    await expectSelected(page, "FRAGRANCES");
    await expect(panel(page).getByLabel("Application (optional)")).toHaveValue("incense-and-bakhoor");
  });
});

test.describe("contact: review screenshots", () => {
  test("capture the default and Flavours forms", async ({ page }, info) => {
    const width = info.project.use.viewport!.width;
    test.skip(width !== 375 && width !== 1280, "375 and 1280 only");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const dir = path.resolve(__dirname, "../../docs/screenshots");
    fs.mkdirSync(dir, { recursive: true });
    await page.goto("/contact");
    await expectSelected(page, "GENERAL");
    await page.screenshot({ path: path.join(dir, `contact-default-${width}.png`), fullPage: true });
    await page.goto("/contact?type=FLAVOURS&application=bakery");
    await expectSelected(page, "FLAVOURS");
    await page.screenshot({ path: path.join(dir, `contact-flavours-${width}.png`), fullPage: true });
  });
});
