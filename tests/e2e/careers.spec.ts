import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  applicationsFor,
  createJobOpening,
  deleteApplicationsFor,
  deleteJobOpening,
  storedFileExists,
  tinyPdf,
  type TestJob,
} from "./support/admin";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";
import { testIp, withDb } from "./support/rfq-db";

/*
 * Public careers: the empty list, the apply form (valid, invalid and
 * keyboard-only submissions), the confirmation page and, in the
 * @catalogue-write tests, a published opening in the list, its page and the
 * sitemap. Published openings change the public sitemap other specs compare
 * exactly, so they only ever exist inside a @catalogue-write test, which runs
 * once at the end.
 */

const REF = /^CA-\d{4}-\d{6}$/;

let email = "";

test.beforeEach(async ({ page }) => {
  // Unique per test: rows are found (and cleaned up) by email; each test has its own rate-limit bucket.
  email = `e2e-${randomBytes(6).toString("hex")}@test-candidate.example`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
});

test.afterEach(async () => {
  await deleteApplicationsFor(email);
});

const send = (page: Page) => page.getByRole("button", { name: "Send application" });
const consent = (page: Page) => page.getByRole("checkbox", { name: /I agree/ });
const cvInput = (page: Page) => page.getByLabel("CV", { exact: true });

async function fillApplicant(page: Page, opts: { email?: string; consent?: boolean } = {}) {
  await page.getByLabel("Full name").fill("TEST Jane Candidate");
  await page.getByLabel("Email", { exact: true }).fill(opts.email ?? email);
  await page.getByLabel("Telephone (optional)").fill("+91 98000 00000");
  await page.getByLabel("Country (optional)").fill("India");
  await page.getByLabel("Message (optional)").fill("TEST I would like to apply.");
  if (opts.consent !== false) await consent(page).check();
}

const pdfFile = (name = "TEST-cv.pdf") => ({ name, mimeType: "application/pdf", buffer: tinyPdf() });

async function expectNoindex(page: Page) {
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
}

test.describe("careers: public pages", () => {
  test("/careers with no openings shows the empty state and the general-application link", async ({ page }) => {
    const res = await page.goto("/careers");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Careers" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "There are no current openings." })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Send a general application" })).toHaveAttribute(
      "href",
      "/careers/apply",
    );
    await expect(page.getByRole("list", { name: "Current openings" })).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/careers$/);
    await expectHeadingOutline(page);
    await expectNoOverflow(page);
    await expectAxeClean(page);
  });

  test("the apply page is a noindex general application with one h1, and passes the gates", async ({ page }) => {
    const res = await page.goto("/careers/apply");
    expect(res?.status()).toBe(200);
    await expectNoindex(page);
    await expect(page.getByText("This is a general application.")).toBeVisible();
    await expectHeadingOutline(page);
    await expectNoOverflow(page);
    await expectAxeClean(page);
    // The form's fields are labelled and the CV input is real.
    for (const label of ["Full name", "Email", "Telephone (optional)", "Country (optional)", "Message (optional)", "CV"]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(1);
    }
    await expect(cvInput(page)).toHaveAttribute("accept", ".pdf,.docx");
    await expect(page.getByRole("link", { name: "privacy notice", exact: true }).first()).toHaveAttribute("href", "/privacy");
  });

  test("the confirmation page shows only a well-formed reference, is noindex, and never echoes anything else", async ({ page }) => {
    await page.goto("/careers/apply/confirmation?ref=CA-2026-000042");
    await expectNoindex(page);
    await expect(page.getByTestId("application-reference")).toHaveText("CA-2026-000042");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/application has been sent/i);
    await expectHeadingOutline(page);
    await expectNoOverflow(page);
    await expectAxeClean(page);
    for (const ref of ["<b>x</b>", "CA-2026-1", "jane@example.com", "AQ-2026-000042"]) {
      await page.goto(`/careers/apply/confirmation?ref=${encodeURIComponent(ref)}`);
      await expect(page.getByTestId("application-reference")).toHaveCount(0);
      await expect(page.locator("main")).not.toContainText(ref);
      await expectHeadingOutline(page);
    }
    await expectAxeClean(page);
  });

  test("a draft opening's slug in ?job= is ignored: a general application, nothing reflected", async ({ page }) => {
    const draft = await createJobOpening("DRAFT", "draft");
    try {
      for (const slug of [draft.slug, "no-such-opening", "<script>x</script>"]) {
        await page.goto(`/careers/apply?job=${encodeURIComponent(slug)}`);
        await expect(page.getByText("This is a general application.")).toBeVisible();
        await expect(page.locator("main")).not.toContainText(draft.title);
        await expect(page.locator("main")).not.toContainText(slug);
      }
      // A draft has no public page: a real 404, and it is not listed.
      expect((await page.goto(`/careers/${draft.slug}`))?.status()).toBe(404);
      await page.goto("/careers");
      await expect(page.locator("main")).not.toContainText(draft.title);
    } finally {
      await deleteJobOpening(draft);
    }
  });
});

test.describe("careers: applying", () => {
  test("a valid application shows a confirmation with only the reference and is stored with its CV", async ({ page }) => {
    await page.goto("/careers/apply");
    await fillApplicant(page, { email: email.toUpperCase() });
    await cvInput(page).setInputFiles(pdfFile("TEST-my-cv.pdf"));
    await send(page).click();

    await page.waitForURL(/\/careers\/apply\/confirmation\?ref=CA-\d{4}-\d{6}$/);
    const reference = ((await page.getByTestId("application-reference").textContent()) ?? "").trim();
    expect(reference).toMatch(REF);
    // The URL carries the reference only; the page shows nothing the candidate typed.
    expect(new URL(page.url()).searchParams.toString()).toBe(`ref=${reference}`);
    for (const typed of [email, "TEST Jane Candidate", "TEST-my-cv.pdf"]) {
      await expect(page.locator("main")).not.toContainText(typed);
    }
    await expectNoindex(page);

    const stored = await applicationsFor(email);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      reference,
      jobId: null,
      jobTitleSnapshot: "General application",
      fullName: "TEST Jane Candidate",
      status: "NEW",
      message: "TEST I would like to apply.",
    });
    expect(stored[0].files).toHaveLength(1);
    expect(stored[0].files[0]).toMatchObject({ filename: "TEST-my-cv.pdf", mimeType: "application/pdf" });
    expect(await storedFileExists(stored[0].files[0].storageKey)).toBe(true);
    // The storage key is opaque and never the file name.
    expect(stored[0].files[0].storageKey).toMatch(/^cv-/);
  });

  test("an executable renamed .pdf shows a visible error and stores nothing", async ({ page }) => {
    await page.goto("/careers/apply");
    await fillApplicant(page);
    await cvInput(page).setInputFiles({
      name: "TEST-evil.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200, 1)]),
    });
    await send(page).click();

    const error = page.locator("#careers-apply-cv-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveText(/\w/);
    await expect(cvInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(cvInput(page)).toBeFocused();
    await expect(page).toHaveURL(/\/careers\/apply$/);
    await expectAxeClean(page);
    expect(await applicationsFor(email)).toHaveLength(0);
    // The typed details are still there.
    await expect(page.getByLabel("Full name")).toHaveValue("TEST Jane Candidate");
  });

  test("a wrong file type is refused in the browser before anything is sent", async ({ page }) => {
    await page.goto("/careers/apply");
    await fillApplicant(page);
    await cvInput(page).setInputFiles({ name: "TEST-photo.png", mimeType: "image/png", buffer: Buffer.from("\x89PNG\r\n\x1a\n") });
    await send(page).click();
    await expect(page.locator("#careers-apply-cv-error")).toHaveText("Your CV must be a PDF or DOCX file");
    expect(await applicationsFor(email)).toHaveLength(0);
  });

  test("missing CV and missing consent are reported on their fields", async ({ page }) => {
    await page.goto("/careers/apply");
    await fillApplicant(page, { consent: false });
    await send(page).click();

    await expect(page.locator("#careers-apply-cv-error")).toHaveText("Attach your CV");
    await expect(cvInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(consent(page)).toHaveAttribute("aria-invalid", "true");
    await expect(consent(page)).toHaveAccessibleDescription(/agree to the privacy notice/i);
    await expect(page.getByRole("heading", { name: /There are 2 problems with your application/ })).toBeVisible();
    // Focus lands on the first invalid control in page order (the CV comes before the consent).
    await expect(cvInput(page)).toBeFocused();
    await expectAxeClean(page);
    await expectNoOverflow(page);
    expect(await applicationsFor(email)).toHaveLength(0);

    // Fixing both sends it.
    await cvInput(page).setInputFiles(pdfFile());
    await consent(page).check();
    await send(page).click();
    await page.waitForURL(/\/careers\/apply\/confirmation\?ref=CA-/);
    expect(await applicationsFor(email)).toHaveLength(1);
  });

  test("invalid name and email are reported inline, with focus on the first", async ({ page }) => {
    await page.goto("/careers/apply");
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await cvInput(page).setInputFiles(pdfFile());
    await consent(page).check();
    await send(page).click();
    const name = page.getByLabel("Full name");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    await expect(page.getByLabel("Email", { exact: true })).toHaveAccessibleDescription(/valid email/i);
    expect(await applicationsFor(email)).toHaveLength(0);
  });

  test("the whole form can be completed with the keyboard alone", async ({ page }) => {
    await page.goto("/careers/apply");
    // Wait for hydration: a submit before it would be a native POST.
    await expect(send(page)).toBeEnabled();
    await page.getByLabel("Full name").focus();
    await page.keyboard.type("TEST Keyboard Candidate");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
    await page.keyboard.type(email);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Telephone (optional)")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Country (optional)")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Message (optional)")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cvInput(page)).toBeFocused();
    // A native file dialog cannot be driven by key presses; the focused input receives the file.
    await cvInput(page).setInputFiles(pdfFile());
    await page.keyboard.press("Tab");
    // The honeypot is skipped; the next stop is the consent checkbox.
    await expect(consent(page)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(consent(page)).toBeChecked();
    // The privacy-notice link in the consent hint is the next stop, then the submit button.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "privacy notice", exact: true }).first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(send(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/careers\/apply\/confirmation\?ref=CA-\d{4}-\d{6}$/);
    const stored = await applicationsFor(email);
    expect(stored).toHaveLength(1);
    expect(stored[0].fullName).toBe("TEST Keyboard Candidate");
  });

  test("a bot-filled honeypot gets a normal confirmation and stores nothing", async ({ page }) => {
    await page.goto("/careers/apply");
    await fillApplicant(page);
    await cvInput(page).setInputFiles(pdfFile());
    await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
      el.value = "http://spam.example";
    });
    await send(page).click();
    await page.waitForURL(/\/careers\/apply\/confirmation\?ref=CA-\d{4}-\d{6}$/);
    expect(await applicationsFor(email)).toHaveLength(0);
  });
});

test.describe("careers: a published opening @catalogue-write", () => {
  test("appears in the list, on its page and in the sitemap; applying to it stores its title; closing it is a real 404", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const job: TestJob = await createJobOpening("PUBLISHED", "live");
    try {
      // The list.
      await page.goto("/careers");
      const list = page.getByRole("list", { name: "Current openings" });
      await expect(list.getByRole("heading", { level: 2, name: job.title })).toBeVisible();
      await expect(page.getByRole("link", { name: "Send a general application" })).toHaveAttribute("href", "/careers/apply");
      await expectHeadingOutline(page);
      await expectNoOverflow(page);
      await expectAxeClean(page);

      // Its page.
      await list.getByRole("link", { name: job.title, exact: true }).click();
      await page.waitForURL(new RegExp(`/careers/${job.slug}$`));
      await expect(page.getByRole("heading", { level: 1, name: job.title })).toBeVisible();
      await expect(page.locator("main")).toContainText("TEST-Location");
      await expect(page.locator("main")).toContainText("TEST first paragraph.");
      await expect(page.locator("main")).toContainText("TEST second paragraph.");
      // A fresh load: after a client navigation the hidden list page is still mounted (a second h1).
      await page.goto(`/careers/${job.slug}`);
      await expectHeadingOutline(page);
      await expectNoOverflow(page);
      await expectAxeClean(page);
      const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(jsonLd.some((t) => t.includes('"BreadcrumbList"') && t.includes(job.slug))).toBe(true);

      // The sitemap lists both the section and the opening.
      const xml = await (await request.get("/sitemap.xml")).text();
      expect(xml).toContain("/careers</loc>");
      expect(xml).toContain(`/careers/${job.slug}</loc>`);
      expect(xml).not.toContain("/careers/apply");

      // Applying to it stores its title.
      await page.getByRole("link", { name: "Apply for this opening" }).click();
      await page.waitForURL(new RegExp(`/careers/apply\\?job=${job.slug}$`));
      await expect(page.getByText(`You are applying for ${job.title}.`)).toBeVisible();
      await fillApplicant(page);
      await cvInput(page).setInputFiles(pdfFile());
      await send(page).click();
      await page.waitForURL(/\/careers\/apply\/confirmation\?ref=CA-\d{4}-\d{6}$/);
      const stored = await applicationsFor(email);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ jobId: job.id, jobTitleSnapshot: job.title });

      // Closed: a real 404, off the list and out of the sitemap, and not selectable in ?job=.
      await withDb((c) => c.query(`UPDATE "job_opening" SET "status" = 'CLOSED' WHERE "id" = $1`, [job.id]));
      expect((await request.get(`/careers/${job.slug}`)).status()).toBe(404);
      expect((await page.goto(`/careers/${job.slug}`))?.status()).toBe(404);
      expect(await (await request.get("/sitemap.xml")).text()).not.toContain(job.slug);
      await page.goto("/careers");
      await expect(page.locator("main")).not.toContainText(job.title);
      await page.goto(`/careers/apply?job=${job.slug}`);
      await expect(page.getByText("This is a general application.")).toBeVisible();
    } finally {
      await deleteJobOpening(job);
    }
  });
});
