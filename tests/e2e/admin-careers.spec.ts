import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  applicationsFor,
  auditRowsFor,
  createApplication,
  createJobOpening,
  deleteApplicationsFor,
  deleteAuditRowsFor,
  deleteJobOpening,
  deleteUserByEmail,
  jobBySlug,
  signInViaApi,
  storedFileExists,
  userIdByEmail,
  type TestApplication,
} from "./support/admin";
import { ADMIN_USERS } from "./support/fixtures";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";
import { testIp } from "./support/rfq-db";

/*
 * Careers admin: the HR manager role, jobs, the applications inbox, the CV
 * route and the roles that must be refused. Throwaway openings and
 * applications are created per test and removed afterwards. Tests that publish
 * an opening (a public change) are @catalogue-write.
 */

const { superAdmin, administrator, salesManager, contentEditor, hrManager } = ADMIN_USERS;

const FORBIDDEN_TITLE = "You do not have access to the admin";

test.beforeEach(async ({ page }) => {
  // Own client address per test: Better Auth rate limits sign-in per IP.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
});

async function newContextPage(browser: Browser) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
  return { context, page: await context.newPage() };
}

async function expectNoindex(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  return res;
}

async function expectQualityGates(page: Page, path: string) {
  await expectNoindex(page, path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoOverflow(page);
  await expectHeadingOutline(page);
  await expectAxeClean(page);
}

const cookieHeader = async (page: Page) =>
  (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

const jobRow = (page: Page, title: string) => page.getByTestId("job-row").filter({ hasText: title });
const applicationRow = (page: Page, reference: string) => page.getByTestId("application-row").filter({ hasText: reference });

test.describe("careers admin: the HR manager role", () => {
  test("HR signs in with the form, lands on Applications, and sees only Jobs and Applications", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(hrManager.email);
    await page.getByLabel("Password").fill(hrManager.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin\/applications$/);
    await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText(hrManager.email);
    await expect(page.getByRole("banner")).toContainText(hrManager.roleLabel);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link")).toHaveText(["Jobs", "Applications"]);
    await expect(nav.getByRole("link", { name: "Applications" })).toHaveAttribute("aria-current", "page");

    // The brand link and the bare /admin page both open the role's own first page, never a 403.
    await page.getByRole("link", { name: /Aquila Organics/ }).click();
    await page.waitForURL(/\/admin\/applications$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/applications$/);
    // An already signed-in HR visiting the login page goes to the same place.
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/applications$/);
  });

  test("HR is refused with the 403 page everywhere outside careers", async ({ page }) => {
    await signInViaApi(page, hrManager);
    for (const path of ["/admin/products", "/admin/users", "/admin/settings", "/admin/audit", "/admin/enquiries"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(FORBIDDEN_TITLE);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    }
    await expectAxeClean(page);
    await expectNoOverflow(page);
  });

  test("super admin creates an HR user who must change the password and then lands on Applications", async ({ browser, page }) => {
    test.setTimeout(90_000);
    const t = randomBytes(4).toString("hex");
    const email = `test-hr-${t}@admin.example.test`;
    const fresh = await newContextPage(browser);
    try {
      await signInViaApi(page, superAdmin);
      await page.goto("/admin/users");
      await expect(async () => {
        await page.getByLabel("Name", { exact: true }).fill(`TEST HR ${t}`);
        await page.getByLabel("Email", { exact: true }).fill(email);
        await page.getByLabel("Role", { exact: true }).selectOption({ label: "HR manager" });
        await page.getByRole("button", { name: "Create user" }).click();
        await expect(page.getByRole("heading", { level: 2, name: "One-time password" })).toBeVisible({ timeout: 2_000 });
      }).toPass();
      const oneTime = (await page.locator("section[aria-labelledby='one-time-heading'] code").innerText()).trim();
      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toContainText("Must change password");
      await expect(row).toContainText("HR manager");

      const hr = fresh.page;
      await hr.goto("/admin/login");
      await hr.getByLabel("Email").fill(email);
      await hr.getByLabel("Password").fill(oneTime);
      await hr.getByRole("button", { name: "Sign in" }).click();
      await hr.waitForURL(/\/admin\/change-password$/);
      // Careers pages send them back to the password change first.
      await hr.goto("/admin/applications");
      await expect(hr).toHaveURL(/\/admin\/change-password$/);

      await hr.getByLabel("Current password").fill(oneTime);
      await hr.getByLabel("New password", { exact: true }).fill("TEST-hr-brand-new-passphrase-1");
      await hr.getByLabel("Repeat new password").fill("TEST-hr-brand-new-passphrase-1");
      await hr.getByRole("button", { name: "Change password" }).click();
      await hr.waitForURL(/\/admin\/applications$/);
      await expect(hr.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
      await expect(hr.getByRole("banner")).toContainText("HR manager");
      await expect(hr.getByRole("navigation", { name: "Admin" }).getByRole("link")).toHaveText(["Jobs", "Applications"]);
      await hr.goto("/admin/users");
      await expect(hr.getByRole("heading", { level: 1 })).toHaveText(FORBIDDEN_TITLE);

      // The audit row for the creation holds ids and the role only.
      const id = (await userIdByEmail(email))!;
      const audit = await auditRowsFor(id);
      expect(audit.map((a) => a.action)).toEqual(["user.create"]);
      expect(JSON.stringify(audit)).not.toContain(email);
      expect(JSON.stringify(audit)).not.toContain(oneTime);
    } finally {
      await fresh.context.close();
      await deleteUserByEmail(email);
    }
  });
});

test.describe("careers admin: roles that must be refused", () => {
  let app: TestApplication;

  test.beforeEach(async () => {
    app = await createApplication();
  });
  test.afterEach(async () => {
    await deleteApplicationsFor(app.email);
  });

  for (const user of [administrator, salesManager, contentEditor]) {
    test(`${user.roleLabel} gets the 403 page on jobs and applications, and an empty 403 from the CV route`, async ({ page }) => {
      await signInViaApi(page, user);
      for (const path of ["/admin/jobs", "/admin/jobs/new", "/admin/applications", `/admin/applications/${app.id}`]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(FORBIDDEN_TITLE);
        await expect(page.locator("main")).not.toContainText(app.reference);
        await expect(page.locator("main")).not.toContainText(app.fullName);
      }
      // No careers links in their navigation.
      const nav = page.getByRole("navigation", { name: "Admin" });
      await expect(nav.getByRole("link", { name: "Jobs", exact: true })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Applications", exact: true })).toHaveCount(0);

      const res = await page.request.get(`/api/admin/applications/${app.id}/cv`, { headers: { cookie: await cookieHeader(page) } });
      expect(res.status()).toBe(403);
      expect(await res.text()).toBe("");
      // Nothing was served or audited.
      expect((await auditRowsFor(app.id)).filter((a) => a.action === "application.cv-download")).toEqual([]);
    });
  }

  test("signed out: careers admin pages redirect to the login page and the CV route answers 401 with nothing", async ({ request }) => {
    for (const path of ["/admin/jobs", "/admin/applications", `/admin/applications/${app.id}`]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers()["location"], path).toBe(`/admin/login?next=${encodeURIComponent(path)}`);
      expect(await res.text()).not.toContain(app.fullName);
    }
    const cv = await request.get(`/api/admin/applications/${app.id}/cv`);
    expect(cv.status()).toBe(401);
    expect(await cv.text()).toBe("");
    expect(cv.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });
});

test.describe("careers admin: applications", () => {
  let app: TestApplication;

  test.beforeEach(async ({ page }) => {
    app = await createApplication();
    await signInViaApi(page, hrManager);
  });
  test.afterEach(async () => {
    await deleteApplicationsFor(app.email);
    await deleteAuditRowsFor(app.id);
  });

  test("the inbox lists the application and the filters narrow it", async ({ page }) => {
    await page.goto("/admin/applications");
    const row = applicationRow(page, app.reference);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(app.fullName);
    await expect(row).toContainText(app.email);
    await expect(row).toContainText("General application");
    await expect(row).toContainText("New");
    await expect(row.getByRole("cell", { name: "Yes" })).toBeVisible();
    // The storage key never reaches the page.
    expect(await page.content()).not.toContain(app.files[0].storageKey);

    await page.goto("/admin/applications?status=HIRED");
    await expect(applicationRow(page, app.reference)).toHaveCount(0);
    await expect(page.getByText("No applications match these filters.")).toBeVisible();
    await page.goto("/admin/applications?status=NEW");
    await expect(applicationRow(page, app.reference)).toHaveCount(1);
  });

  test("detail: candidate, CV link; a status change is saved and audited with ids only", async ({ page }) => {
    await page.goto("/admin/applications");
    await page.getByRole("link", { name: app.reference }).click();
    await page.waitForURL(new RegExp(`/admin/applications/${app.id}$`));
    const main = page.locator("main");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(app.reference);
    await expect(main).toContainText(app.fullName);
    await expect(main).toContainText(app.email);
    await expect(main).toContainText("TEST candidate message");
    await expect(main.getByRole("link", { name: app.files[0].filename })).toHaveAttribute(
      "href",
      `/api/admin/applications/${app.id}/cv`,
    );
    expect(await page.content()).not.toContain(app.files[0].storageKey);

    const status = page.getByRole("region", { name: "Change status" }).getByLabel("Status");
    await status.selectOption("REVIEWING");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Status saved: Reviewing.")).toBeVisible();
    await expect(status).toHaveValue("REVIEWING");
    expect((await applicationsFor(app.email))[0].status).toBe("REVIEWING");

    // Saving the same status again writes no second audit row.
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Status saved: Reviewing.")).toBeVisible();

    const audit = (await auditRowsFor(app.id)).filter((a) => a.action === "application.status");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorRole: "HR_MANAGER", entityType: "application", outcome: "ok", detail: { from: "NEW", to: "REVIEWING" } });
    const text = JSON.stringify(audit);
    for (const secret of [app.fullName, app.email, "TEST candidate message", app.files[0].filename]) {
      expect(text).not.toContain(secret);
    }
  });

  test("the CV downloads as an attachment with the PDF bytes, and the download is audited", async ({ page }) => {
    await page.goto(`/admin/applications/${app.id}`);
    const href = await page.getByRole("link", { name: app.files[0].filename }).getAttribute("href");
    const res = await page.request.get(href ?? "");
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h["content-type"]).toBe("application/pdf");
    expect(h["content-disposition"]).toMatch(/^attachment; /);
    expect(h["content-disposition"]).toContain(app.files[0].filename);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["cache-control"]).toBe("private, no-store");
    expect(h["x-robots-tag"]).toBe("noindex, nofollow");
    const body = await res.body();
    expect(body.equals(app.cv)).toBe(true);
    for (const value of [...Object.values(h), body.toString("latin1")]) {
      expect(value).not.toContain(app.files[0].storageKey);
    }
    const downloads = (await auditRowsFor(app.id)).filter((a) => a.action === "application.cv-download");
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatchObject({ actorRole: "HR_MANAGER", entityType: "application", detail: { files: 1 } });

    // The browser download carries the file name.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: app.files[0].filename }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(app.files[0].filename);

    // A cross-site request and HEAD are refused and never recorded as a download.
    expect((await page.request.get(href ?? "", { headers: { "sec-fetch-site": "cross-site" } })).status()).toBe(403);
    expect((await page.request.head(href ?? "")).status()).toBe(405);
    expect((await page.request.get("/api/admin/applications/not-a-uuid/cv")).status()).toBe(404);
    await expect
      .poll(async () => (await auditRowsFor(app.id)).filter((a) => a.action === "application.cv-download").length)
      .toBe(2);
  });

  test("deleting is two-step; the application, its CV route and its stored file are gone afterwards", async ({ page }) => {
    const key = app.files[0].storageKey;
    expect(await storedFileExists(key)).toBe(true);
    await page.goto(`/admin/applications/${app.id}`);
    await page.getByRole("button", { name: "Delete application" }).click();
    // The first click only asks.
    expect(await applicationsFor(app.email)).toHaveLength(1);
    await expect(page.getByText(/Delete this application permanently\?/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/Delete this application permanently\?/)).toHaveCount(0);
    expect(await applicationsFor(app.email)).toHaveLength(1);

    await page.getByRole("button", { name: "Delete application" }).click();
    await expectAxeClean(page);
    await page.getByRole("button", { name: "Yes, delete application and CV" }).click();
    await page.waitForURL(/\/admin\/applications$/);
    await expect(applicationRow(page, app.reference)).toHaveCount(0);

    expect(await applicationsFor(app.email)).toHaveLength(0);
    expect(await storedFileExists(key)).toBe(false);
    const gone = await page.request.get(`/api/admin/applications/${app.id}/cv`);
    expect(gone.status()).toBe(404);
    await page.goto(`/admin/applications/${app.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Not found", exact: true })).toBeVisible();
    const audit = (await auditRowsFor(app.id)).filter((a) => a.action === "application.delete");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorRole: "HR_MANAGER", detail: { files: 1 } });
    expect(JSON.stringify(audit)).not.toContain(app.fullName);
  });

  test("applications list and detail: noindex, axe, overflow, headings", async ({ page }) => {
    await expectQualityGates(page, "/admin/applications");
    await expectQualityGates(page, `/admin/applications/${app.id}`);
  });
});

test.describe("careers admin: jobs", () => {
  test("HR creates a draft through the form, edits it, and deletes it; nothing becomes public", async ({ page }) => {
    test.setTimeout(90_000);
    const t = randomBytes(4).toString("hex");
    const title = `TEST-Job form ${t}`;
    const slug = `test-job-form-${t}`;
    await signInViaApi(page, hrManager);
    try {
      await page.goto("/admin/jobs/new");
      await expectQualityGates(page, "/admin/jobs/new");

      // Missing fields are reported inline, and nothing is created.
      await page.getByRole("button", { name: "Create opening" }).click();
      await expect(page.locator("#jf-title-error")).toHaveText(/required/i);
      await expect(page.getByLabel("Title", { exact: true })).toHaveAttribute("aria-invalid", "true");
      await expectAxeClean(page);

      await expect(async () => {
        await page.getByLabel("Title", { exact: true }).fill(title);
        await page.getByLabel("URL slug").fill(slug);
        await page.getByLabel("Location").fill("TEST-Location");
        await page.getByLabel("Summary").fill("TEST summary.");
        await page.getByLabel("Description").fill("TEST first paragraph.\n\nTEST second paragraph.");
        await page.getByRole("button", { name: "Create opening" }).click();
        await page.waitForURL(/\/admin\/jobs\/[0-9a-f-]{36}\/edit$/, { timeout: 4_000 });
      }).toPass();
      await expectQualityGates(page, page.url().replace(/^https?:\/\/[^/]+/, ""));
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);

      // New openings are drafts and public pages answer 404.
      const stored = await jobBySlug(slug);
      expect(stored).toMatchObject({ title, status: "DRAFT", publishedAt: null });
      expect((await page.request.get(`/careers/${slug}`)).status()).toBe(404);

      // Edit.
      await page.getByLabel("Location").fill("TEST-Other Location");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();

      // The list shows it as a draft, and a draft can be deleted after a confirmation.
      await page.goto("/admin/jobs");
      const row = jobRow(page, title);
      await expect(row).toContainText("Draft");
      await expect(row).toContainText("TEST-Other Location");
      page.once("dialog", (d) => void d.accept());
      await row.getByRole("button", { name: /^Delete\s*:/ }).click();
      await expect(jobRow(page, title)).toHaveCount(0);
      expect(await jobBySlug(slug)).toBeNull();
    } finally {
      await deleteJobOpening({ slug });
    }
  });

  test("the jobs list: noindex, axe, overflow (the table scrolls in its own region), headings", async ({ page }) => {
    const job = await createJobOpening("DRAFT", "list");
    try {
      await signInViaApi(page, hrManager);
      await expectQualityGates(page, "/admin/jobs");
      await expect(jobRow(page, job.title)).toBeVisible();
      await page.goto("/admin/jobs?status=PUBLISHED");
      await expect(jobRow(page, job.title)).toHaveCount(0);
    } finally {
      await deleteJobOpening(job);
    }
  });

  test("a draft that has an application cannot be deleted, and the inbox filters by opening", async ({ page }) => {
    const job = await createJobOpening("DRAFT", "kept");
    const app = await createApplication({ job });
    try {
      await signInViaApi(page, hrManager);
      await page.goto("/admin/jobs");
      await expect(jobRow(page, job.title)).toBeVisible();
      await expect(jobRow(page, job.title).getByRole("button", { name: /^Delete\s*:/ })).toHaveCount(0);
      await page.goto(`/admin/applications?job=${job.id}`);
      await expect(applicationRow(page, app.reference)).toContainText(job.title);
    } finally {
      await deleteApplicationsFor(app.email);
      await deleteJobOpening(job);
    }
  });
});

test.describe("careers admin: publishing @catalogue-write", () => {
  test("HR publishes an opening in the admin, applies to it as a visitor, then closes it: public until then, a real 404 after", async ({
    browser,
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const t = randomBytes(4).toString("hex");
    const title = `TEST-Job publish ${t}`;
    const slug = `test-job-publish-${t}`;
    const email = `e2e-${randomBytes(6).toString("hex")}@test-candidate.example`;
    const visitor = await newContextPage(browser);
    try {
      await signInViaApi(page, hrManager);
      await page.goto("/admin/jobs/new");
      await expect(async () => {
        await page.getByLabel("Title", { exact: true }).fill(title);
        await page.getByLabel("URL slug").fill(slug);
        await page.getByLabel("Location").fill("TEST-Location");
        await page.getByLabel("Department").fill("TEST-Department");
        await page.getByLabel("Summary").fill("TEST summary of the publishing journey.");
        await page.getByLabel("Description").fill("TEST first paragraph.\n\nTEST second paragraph.");
        await page.getByRole("button", { name: "Create opening" }).click();
        await page.waitForURL(/\/admin\/jobs\/[0-9a-f-]{36}\/edit$/, { timeout: 4_000 });
      }).toPass();

      // Draft: not public yet.
      expect((await request.get(`/careers/${slug}`)).status()).toBe(404);
      expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug);

      // Publish from the list.
      await page.goto("/admin/jobs");
      await jobRow(page, title).getByRole("button", { name: /^Publish\s*:/ }).click();
      await expect(page.getByText("Opening published.")).toBeVisible();
      await expect(jobRow(page, title)).toContainText("Published");
      expect(await jobBySlug(slug)).toMatchObject({ status: "PUBLISHED" });

      // Public at once: list, page, sitemap.
      const v = visitor.page;
      await v.goto("/careers");
      await expect(v.getByRole("heading", { level: 2, name: title })).toBeVisible();
      expect((await v.goto(`/careers/${slug}`))?.status()).toBe(200);
      await expect(v.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(v.locator("main")).toContainText("TEST-Department");
      expect(await (await request.get("/sitemap.xml")).text()).toContain(`/careers/${slug}</loc>`);

      // Apply to it as a visitor.
      await v.getByRole("link", { name: "Apply for this opening" }).click();
      await v.waitForURL(new RegExp(`/careers/apply\\?job=${slug}$`));
      await v.getByLabel("Full name").fill("TEST Publish Candidate");
      await v.getByLabel("Email", { exact: true }).fill(email);
      await v.getByRole("checkbox", { name: /I agree/ }).check();
      await v.getByLabel("CV", { exact: true }).setInputFiles({
        name: "TEST-cv.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% TEST publish journey\n%%EOF\n"),
      });
      await v.getByRole("button", { name: "Send application" }).click();
      await v.waitForURL(/\/careers\/apply\/confirmation\?ref=CA-\d{4}-\d{6}$/);
      const reference = ((await v.getByTestId("application-reference").textContent()) ?? "").trim();

      // HR sees the application under that opening, with the opening's title.
      await page.goto("/admin/applications");
      await expect(applicationRow(page, reference)).toContainText(title);

      // A published opening cannot be deleted; close it from the list.
      await page.goto("/admin/jobs");
      await expect(jobRow(page, title).getByRole("button", { name: /^Delete\s*:/ })).toHaveCount(0);
      await jobRow(page, title).getByRole("button", { name: /^Close\s*:/ }).click();
      await expect(page.getByText("Opening closed.")).toBeVisible();
      await expect(jobRow(page, title)).toContainText("Closed");

      // Closed: a real 404, out of the list and the sitemap, and no longer selectable.
      expect((await request.get(`/careers/${slug}`)).status()).toBe(404);
      expect((await v.goto(`/careers/${slug}`))?.status()).toBe(404);
      expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug);
      await v.goto("/careers");
      await expect(v.locator("main")).not.toContainText(title);
      await v.goto(`/careers/apply?job=${slug}`);
      await expect(v.getByText("This is a general application.")).toBeVisible();

      // The stored application keeps the title it was made under.
      expect((await applicationsFor(email))[0]).toMatchObject({ jobTitleSnapshot: title });
    } finally {
      await visitor.context.close();
      await deleteApplicationsFor(email);
      await deleteJobOpening({ slug });
    }
  });
});

// The Careers recipients row is covered in admin-settings-audit.spec.ts (one @catalogue-write test owns the
// recipients settings, so two tests never race on them).
