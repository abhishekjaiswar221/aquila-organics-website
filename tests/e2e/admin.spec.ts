import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  activitiesOf,
  createDraftProduct,
  createEnquiry,
  deleteEnquiry,
  deleteProduct,
  productState,
  signInViaApi,
  type TestEnquiry,
} from "./support/admin";
import { E2E_BASE_URL } from "./support/e2e-env";
import { ADMIN_USERS, ARCHIVED, DRAFT, ETHANOL } from "./support/fixtures";
import { expectAxeClean, expectHeadingOutline, expectNoOverflow } from "./support/quality";
import { testIp, withDb } from "./support/rfq-db";

/*
 * Minimal admin. Read-only and per-test-data tests run at all four widths in
 * parallel. Tests tagged @catalogue-write publish a product (which changes the
 * public catalogue counts other specs assert on), so playwright.config.ts runs
 * them once, at 1280, after every width project has finished.
 * Login-form flows run at every width (they are cheap); the rate-limit test
 * runs at desktop widths only.
 */

const { superAdmin, salesManager, contentEditor } = ADMIN_USERS;

test.beforeEach(async ({ page }) => {
  // Own client address per test: Better Auth rate limits sign-in per IP.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
});

const isDesktop = (info: TestInfo) => info.project.use.viewport!.width >= 1024;

async function expectNoindex(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /nofollow/);
}

/** Page quality gates: axe, no page-level overflow (tables scroll in their own region), headings, noindex. */
async function expectQualityGates(page: Page, path: string) {
  await expectNoindex(page, path);
  await expectNoOverflow(page);
  await expectHeadingOutline(page);
  await expectAxeClean(page);
}

async function signInWithForm(page: Page, user: { email: string; password: string }) {
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function hasSessionCookie(page: Page): Promise<boolean> {
  return (await page.context().cookies()).some((c) => c.name.includes("session_token"));
}

// The login form's alert (Next.js's route announcer is also role=alert).
const loginError = (page: Page) => page.locator("#login-error");
// Scoped to the status section: the list page may still be mounted (hidden) after navigating.
const statusSelect = (page: Page) => page.getByRole("region", { name: "Change status" }).getByLabel("Status");

const productRow = (page: Page, name: string) => page.getByTestId("product-row").filter({ hasText: name });

// Where the proxy sends a signed-out request for `path`.
const loginFor = (next: string) => `/admin/login?next=${encodeURIComponent(next)}`;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const atLogin = (next: string) => new RegExp(`${escapeRe(loginFor(next))}$`);

test.describe("admin: access control", () => {
  const SIGNED_OUT: [path: string, next: string][] = [
    ["/admin", "/admin/products"],
    ["/admin/products", "/admin/products"],
    ["/admin/enquiries", "/admin/enquiries"],
    ["/admin/enquiries/00000000-0000-4000-8000-000000000001", "/admin/enquiries/00000000-0000-4000-8000-000000000001"],
  ];
  for (const [path, next] of SIGNED_OUT) {
    test(`signed out, ${path} redirects to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(atLogin(next));
      await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    });
  }

  test("signed out, admin pages answer a real 307 to the login page; the login page answers 200", async ({ request }) => {
    for (const [path, next] of [
      ...SIGNED_OUT,
      ["/admin/enquiries?status=NEW", "/admin/enquiries?status=NEW"],
    ] as const) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers()["location"], path).toBe(loginFor(next));
      expect(await res.text(), path).not.toContain(DRAFT.name);
    }
    const login = await request.get("/admin/login", { maxRedirects: 0 });
    expect(login.status()).toBe(200);
    const withNext = await request.get(loginFor("/admin/enquiries"), { maxRedirects: 0 });
    expect(withNext.status()).toBe(200);
  });

  test("the proxy never redirects off-site, whatever the path", async ({ request, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    // (An encoded dot-dot path is resolved by the client's URL parser before sending, so it never reaches the admin.)
    for (const path of ["/admin//evil.example", "/admin/%5c%5cevil.example", "/admin/x?next=https://evil.example"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      // 307 from the proxy (Next.js may first answer 308 to fold repeated slashes).
      expect([307, 308], path).toContain(res.status());
      const location = res.headers()["location"] ?? "";
      const target = new URL(location, origin);
      expect(target.origin, `${path} -> ${location}`).toBe(origin);
      expect(target.pathname.startsWith("/admin"), `${path} -> ${location}`).toBe(true);
      if (res.status() === 307) {
        expect(location.startsWith("/admin/login?next=%2Fadmin"), `${path} -> ${location}`).toBe(true);
        expect(new URL(target.searchParams.get("next") ?? "", origin).origin).toBe(origin);
      }
    }
  });

  test("a Server Action POST without a session is not redirected by the proxy", async ({ request }) => {
    const res = await request.post("/admin/products", {
      maxRedirects: 0,
      headers: { "next-action": "0000000000000000000000000000000000000000" },
      data: "[]",
    });
    expect(res.status()).not.toBe(307);
  });

  test("a router prefetch of an admin page skips the proxy; the server-side gate still applies", async ({ request }) => {
    const prefetches: Record<string, string>[] = [
      { rsc: "1", "next-router-prefetch": "1" },
      { rsc: "1", "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree" },
    ];
    for (const headers of prefetches) {
      const res = await request.get("/admin/enquiries", { maxRedirects: 0, headers });
      // The proxy's answer would be a 307 to /admin/login?next=...; it never comes.
      expect(res.headers()["location"] ?? "", JSON.stringify(headers)).not.toContain("next=");
      const body = await res.text();
      expect(body).not.toContain(DRAFT.name);
      expect(body).not.toContain("enquiry-row");
    }
  });

  test("a client-side navigation request (RSC, not a prefetch) for an unpublished product is still a 404", async ({ request }) => {
    for (const slug of [DRAFT.slug, ARCHIVED.slug]) {
      const res = await request.get(`/aroma-chemicals/${slug}`, { maxRedirects: 0, headers: { rsc: "1" } });
      expect(res.status(), slug).toBe(404);
      expect(await res.text()).not.toContain(DRAFT.name);
    }
  });

  test("public pages and product status codes are unchanged by the admin branch", async ({ request }) => {
    expect((await request.get(`/aroma-chemicals/${ETHANOL.slug}`, { maxRedirects: 0 })).status()).toBe(200);
    expect((await request.get(`/aroma-chemicals/${DRAFT.slug}`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get("/aroma-chemicals/test-no-such-product", { maxRedirects: 0 })).status()).toBe(404);
    for (const path of ["/", "/aroma-chemicals", "/rfq", "/privacy"]) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
    }
  });

  test("a forged session cookie passes the proxy but the server still refuses it", async ({ page, request, baseURL }) => {
    const forged = "better-auth.session_token=TEST-forged-token.TEST-forged-signature";
    // Pages that WOULD show the draft product / the enquiry if access leaked.
    // The query is a different field than the one asserted absent, because the
    // page's search params can legitimately be echoed in the RSC payload.
    const enquiry = await createEnquiry();
    const productsUrl = `/admin/products?q=${encodeURIComponent(DRAFT.code)}`;
    const enquiriesUrl = `/admin/enquiries?q=${encodeURIComponent(enquiry.email)}`;
    try {
      // Past the proxy: the request reaches the server (no 307 from the proxy).
      for (const [url, secret] of [
        [productsUrl, DRAFT.name],
        [enquiriesUrl, enquiry.reference],
      ] as const) {
        const res = await request.get(url, { maxRedirects: 0, headers: { cookie: forged } });
        expect(res.status(), url).not.toBe(307);
        const body = await res.text();
        expect(body, url).not.toContain(secret);
        expect(body, url).not.toContain("product-row");
        expect(body, url).not.toContain("enquiry-row");
      }

      // In a browser the server-side check sends it to the login page.
      await page.context().addCookies([
        { name: "better-auth.session_token", value: "TEST-forged-token.TEST-forged-signature", url: baseURL ?? "" },
      ]);
      for (const [url, secret] of [
        [productsUrl, DRAFT.name],
        [enquiriesUrl, enquiry.reference],
      ] as const) {
        await page.goto(url);
        await expect(page).toHaveURL(/\/admin\/login(\?|$)/);
        await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
        await expect(page.locator("main"), url).not.toContainText(secret);
      }

      // Control: with a real session the same URLs do show them.
      await page.context().clearCookies();
      await signInViaApi(page, salesManager);
      await page.goto(productsUrl);
      await expect(productRow(page, DRAFT.name)).toBeVisible();
      await page.goto(enquiriesUrl);
      await expect(page.getByTestId("enquiry-row")).toContainText(enquiry.reference);
    } finally {
      await deleteEnquiry(enquiry);
    }
  });

  test("a deep link survives signing in: login with next lands on the requested enquiry", async ({ page }) => {
    const enquiry = await createEnquiry();
    try {
      const detail = `/admin/enquiries/${enquiry.id}`;
      await page.goto(detail);
      await expect(page).toHaveURL(atLogin(detail));
      await signInWithForm(page, salesManager);
      await page.waitForURL(new RegExp(`${escapeRe(detail)}$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText(enquiry.reference);
    } finally {
      await deleteEnquiry(enquiry);
    }
  });

  test("signed out, the attachment route answers 401 with nothing in the body", async ({ request }) => {
    const res = await request.get("/api/admin/attachments/00000000-0000-4000-8000-000000000001");
    expect(res.status()).toBe(401);
    expect(await res.text()).toBe("");
    expect(res.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("a wrong password shows the generic error and sets no session", async ({ page }) => {
    await page.goto("/admin/login");
    await signInWithForm(page, { email: salesManager.email, password: "TEST-wrong-password-123" });
    await expect(loginError(page)).toHaveText("Incorrect email or password.");
    // An unknown email gets exactly the same message.
    await signInWithForm(page, { email: "nobody@admin.example.test", password: "TEST-wrong-password-123" });
    await expect(loginError(page)).toHaveText("Incorrect email or password.");
    expect(await hasSessionCookie(page)).toBe(false);
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("repeated failures show the rate-limit message", async ({ page }, info) => {
    test.skip(!isDesktop(info), "rate limiting is width-independent");
    await page.goto("/admin/login");
    for (let i = 0; i < 6; i++) {
      await signInWithForm(page, { email: salesManager.email, password: `TEST-wrong-password-${i}xx` });
      await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    }
    await expect(loginError(page)).toHaveText(/too many sign-in attempts/i);
  });

  test("a sales manager signs in, sees the shell and drafts, signs out, and is locked out again", async ({ page }) => {
    await page.goto("/admin/login");
    await signInWithForm(page, salesManager);
    await page.waitForURL(/\/admin\/products$/);
    await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText(salesManager.email);
    await expect(page.getByRole("banner")).toContainText(salesManager.roleLabel);
    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto(`/admin/products?q=${encodeURIComponent(DRAFT.name)}`);
    await expect(productRow(page, DRAFT.name)).toContainText("Draft");
    // No verification control for a sales manager.
    await expect(page.getByRole("button", { name: /^Mark (un)?verified/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/admin\/login$/);
    expect(await hasSessionCookie(page)).toBe(false);
    await page.goto("/admin/products");
    await expect(page).toHaveURL(atLogin("/admin/products"));
  });

  test("an already signed-in admin visiting the login page goes to products", async ({ page }) => {
    await signInViaApi(page, salesManager);
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin\/products$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/products$/);
  });

  test("the next parameter returns to an admin page, and never leaves the admin", async ({ page }) => {
    await page.goto("/admin/login?next=%2Fadmin%2Fenquiries%3Fstatus%3DNEW");
    await signInWithForm(page, salesManager);
    await page.waitForURL(/\/admin\/enquiries\?status=NEW$/);

    await page.context().clearCookies();
    await page.goto(`/admin/login?next=${encodeURIComponent("//evil.example/admin")}`);
    await signInWithForm(page, salesManager);
    await page.waitForURL(/\/admin\/products$/);
    expect(page.url()).not.toContain("evil");
  });

  test("a content editor reaches products but is refused with the 403 page on enquiries", async ({ page, request }) => {
    await signInViaApi(page, contentEditor);
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Products");
    await expect(page.getByRole("link", { name: "Enquiries" })).toHaveCount(0);
    for (const path of ["/admin/enquiries"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("You do not have access to the admin");
      await expect(page.locator("main")).not.toContainText(DRAFT.name);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    }
    await expectAxeClean(page);
    await expectNoOverflow(page);
    // The route handler answers 403 with no body.
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await request.get("/api/admin/attachments/00000000-0000-4000-8000-000000000001", { headers: { cookie } });
    expect(res.status()).toBe(403);
    expect(await res.text()).toBe("");
    // Signing out from the 403 page works.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/admin\/login$/);
  });

  // Overflow, axe and heading gates for /admin/login: quality-catalogue.spec.ts.
  test("login page: noindex header and meta, no sign-up link", async ({ page }) => {
    await expectNoindex(page, "/admin/login");
    await expect(page.getByRole("link", { name: /sign up|register|create account/i })).toHaveCount(0);
  });
});

test.describe("admin: products", () => {
  test.beforeEach(async ({ page }) => {
    await signInViaApi(page, salesManager);
  });

  test("lists every status with internal fields, and filters", async ({ page }) => {
    await page.goto(`/admin/products?q=${encodeURIComponent(DRAFT.cas)}`);
    const draft = productRow(page, DRAFT.name);
    await expect(draft).toHaveCount(1);
    await expect(draft).toContainText(DRAFT.code);
    await expect(draft).toContainText("Not verified");

    await page.goto("/admin/products?status=ARCHIVED");
    await expect(productRow(page, ARCHIVED.name)).toHaveCount(1);
    await expect(page.getByTestId("product-row").filter({ hasText: ETHANOL.name })).toHaveCount(0);

    await page.goto("/admin/products");
    await page.getByLabel("Search name, code or CAS").fill(ETHANOL.code);
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.waitForURL(/status=PUBLISHED/);
    await expect(page.getByTestId("product-row")).toHaveCount(1);
    await expect(productRow(page, ETHANOL.name)).toContainText("TEST-internal-source-note");
  });

  test("publishing an unverified product is refused with a clear message", async ({ page }) => {
    await page.goto(`/admin/products?q=${encodeURIComponent(DRAFT.code)}`);
    await productRow(page, DRAFT.name).getByRole("button", { name: /^Publish/ }).click();
    await expect(productRow(page, DRAFT.name)).toContainText(/has not been verified yet/);
    await expect(productRow(page, DRAFT.name)).toContainText("Draft");
    expect((await productState(DRAFT.id)).status).toBe("DRAFT");
  });

  test("products page: noindex, axe, overflow (table scrolls in its own region), headings", async ({ page }) => {
    await expectQualityGates(page, "/admin/products");
  });
});

test.describe("admin: publishing @catalogue-write", () => {
  test("super admin verifies, sales manager publishes, the product goes live and comes down again", async ({ browser, request }) => {
    const product = await createDraftProduct("publish");
    const admin = await browser.newPage();
    const sales = await browser.newPage();
    try {
      await admin.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
      await sales.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
      await signInViaApi(admin, superAdmin);
      await signInViaApi(sales, salesManager);
      const search = `/admin/products?q=${encodeURIComponent(product.code)}`;

      // Not verified yet: refused.
      await sales.goto(search);
      await productRow(sales, product.name).getByRole("button", { name: /^Publish/ }).click();
      await expect(productRow(sales, product.name)).toContainText(/has not been verified yet/);

      // Super admin marks it verified.
      await admin.goto(search);
      await productRow(admin, product.name).getByRole("button", { name: /^Mark verified/ }).click();
      await expect(productRow(admin, product.name)).toContainText("Marked verified.");
      await expect(productRow(admin, product.name).getByRole("cell", { name: "Verified", exact: true })).toBeVisible();
      expect((await productState(product.id)).verified).toBe(true);

      // Sales manager publishes it.
      await sales.goto(search);
      await productRow(sales, product.name).getByRole("button", { name: /^Publish/ }).click();
      await expect(productRow(sales, product.name)).toContainText("Published.");
      await expect(productRow(sales, product.name).getByRole("button", { name: /^Unpublish/ })).toBeVisible();
      const state = await productState(product.id);
      expect(state.status).toBe("PUBLISHED");
      expect(state.publishedAt).not.toBeNull();

      // Public at once: list search, product page and sitemap (no stale cache).
      const visitor = await browser.newPage();
      try {
        await visitor.goto(`/aroma-chemicals?q=${encodeURIComponent(product.name)}`);
        await expect(visitor.getByRole("link", { name: product.name })).toBeVisible();
        const page = await visitor.goto(`/aroma-chemicals/${product.slug}`);
        expect(page?.status()).toBe(200);
        await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(product.name);
        expect(await (await request.get("/sitemap.xml")).text()).toContain(`/aroma-chemicals/${product.slug}<`);

        // Super admin marks it unverified: it is unpublished in the same change.
        await admin.goto(search);
        await productRow(admin, product.name).getByRole("button", { name: /^Mark unverified and unpublish/ }).click();
        await expect(productRow(admin, product.name)).toContainText("Marked unverified.");
        await expect(productRow(admin, product.name)).toContainText("Draft");
        expect(await productState(product.id)).toMatchObject({ status: "DRAFT", verified: false });

        const gone = await visitor.goto(`/aroma-chemicals/${product.slug}`);
        expect(gone?.status()).toBe(404);
        expect(await (await request.get("/sitemap.xml")).text()).not.toContain(product.slug);
      } finally {
        await visitor.close();
      }
    } finally {
      await admin.close();
      await sales.close();
      await deleteProduct(product.id);
    }
  });

  test("unpublish and archive take a product out of the catalogue at once", async ({ browser }) => {
    const product = await createDraftProduct("archive");
    const sales = await browser.newPage();
    const visitor = await browser.newPage();
    try {
      // Verified directly in the database for this test; the UI flow is covered above.
      await withDb((c) => c.query(`UPDATE "product" SET "verified" = true WHERE "id" = $1`, [product.id]));
      await sales.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
      await signInViaApi(sales, salesManager);
      const search = `/admin/products?q=${encodeURIComponent(product.code)}`;
      await sales.goto(search);
      await productRow(sales, product.name).getByRole("button", { name: /^Publish/ }).click();
      await expect(productRow(sales, product.name)).toContainText("Published.");
      expect((await visitor.goto(`/aroma-chemicals/${product.slug}`))?.status()).toBe(200);

      await productRow(sales, product.name).getByRole("button", { name: /^Unpublish/ }).click();
      await expect(productRow(sales, product.name)).toContainText("Moved to draft.");
      expect((await visitor.goto(`/aroma-chemicals/${product.slug}`))?.status()).toBe(404);

      await productRow(sales, product.name).getByRole("button", { name: /^Archive/ }).click();
      await expect(productRow(sales, product.name)).toContainText("Archived.");
      expect((await productState(product.id)).status).toBe("ARCHIVED");
      await expect(productRow(sales, product.name).getByRole("button", { name: /^Restore to draft/ })).toBeVisible();
    } finally {
      await sales.close();
      await visitor.close();
      await deleteProduct(product.id);
    }
  });
});

test.describe("admin: enquiries", () => {
  let enquiry: TestEnquiry;

  test.beforeEach(async ({ page }) => {
    enquiry = await createEnquiry();
    await signInViaApi(page, salesManager);
  });

  test.afterEach(async () => {
    await deleteEnquiry(enquiry);
  });

  test("the list finds the enquiry and warns that no recipients are configured", async ({ page }) => {
    await page.goto("/admin/enquiries");
    await expect(page.getByTestId("recipients-warning")).toContainText(
      "No notification recipients are configured for any enquiry type.",
    );
    await page.getByLabel("Search reference, name, company or email").fill(enquiry.email.toUpperCase());
    await page.getByRole("button", { name: "Filter" }).click();
    await page.waitForURL(/q=/);
    const rows = page.getByTestId("enquiry-row");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(enquiry.reference);
    await expect(rows).toContainText(enquiry.fullName);
    await expect(rows).toContainText("New");

    await page.goto(`/admin/enquiries?status=WON&q=${encodeURIComponent(enquiry.reference)}`);
    await expect(page.getByText("No enquiries match these filters.")).toBeVisible();
  });

  test("detail: contact, items, attachments; a status change is saved and logged", async ({ page }) => {
    await page.goto(`/admin/enquiries?q=${encodeURIComponent(enquiry.reference)}`);
    await page.getByRole("link", { name: enquiry.reference }).click();
    await page.waitForURL(new RegExp(`/admin/enquiries/${enquiry.id}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(enquiry.reference);
    const main = page.locator("main");
    await expect(main).toContainText(enquiry.fullName);
    await expect(main).toContainText(enquiry.email);
    await expect(main).toContainText("TEST-Ethanol");
    await expect(main).toContainText("64-17-5");
    await expect(main).toContainText("25 kg");
    await expect(main).toContainText("TEST-Free text compound");
    await expect(main).toContainText("TEST line note");
    await expect(main.getByRole("link", { name: enquiry.attachment.filename })).toHaveAttribute(
      "href",
      `/api/admin/attachments/${enquiry.attachment.id}`,
    );
    await expect(main.getByRole("listitem").filter({ hasText: enquiry.csv.filename })).toContainText(
      "Open with care: spreadsheet files can contain formulas.",
    );
    // Internal fields and storage keys never reach the page.
    const html = await page.content();
    for (const secret of ["TEST-ip-hash-secret", "TEST-user-agent-secret", enquiry.attachment.storageKey, enquiry.csv.storageKey]) {
      expect(html).not.toContain(secret);
    }
    const activity = page.getByTestId("activity");
    await expect(activity).toContainText("Enquiry received through the website form: 2 product lines, 2 attachments.");

    await statusSelect(page).selectOption("CONTACTED");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByText("Status saved: Contacted.")).toBeVisible();
    await expect(activity).toContainText("Status changed from New to Contacted.");
    await expect(activity).toContainText(`by user ${ADMIN_USERS.salesManager.id.slice(0, 8)}`);
    await expect(statusSelect(page)).toHaveValue("CONTACTED");

    const changes = (await activitiesOf(enquiry.id)).filter((a) => a.action === "status.changed");
    expect(changes).toEqual([
      { action: "status.changed", actorId: salesManager.id, detail: { from: "NEW", to: "CONTACTED" } },
    ]);
  });

  test("downloads an attachment with safe headers and logs the access", async ({ page }) => {
    await page.goto(`/admin/enquiries/${enquiry.id}`);
    const href = await page.getByRole("link", { name: enquiry.attachment.filename }).getAttribute("href");
    const res = await page.request.get(href ?? "");
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h["content-type"]).toBe("application/pdf");
    expect(h["content-disposition"]).toBe(
      `attachment; filename="${enquiry.attachment.filename}"; filename*=UTF-8''${enquiry.attachment.filename}`,
    );
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["cache-control"]).toBe("private, no-store");
    expect(h["content-security-policy"]).toContain("sandbox");
    expect(h["x-robots-tag"]).toBe("noindex, nofollow");
    const body = await res.body();
    expect(body.equals(enquiry.attachment.bytes)).toBe(true);
    for (const value of [...Object.values(h), body.toString("latin1")]) {
      expect(value).not.toContain(enquiry.attachment.storageKey);
    }
    const downloads = (await activitiesOf(enquiry.id)).filter((a) => a.action === "attachment.downloaded");
    expect(downloads).toEqual([
      { action: "attachment.downloaded", actorId: salesManager.id, detail: { attachmentId: enquiry.attachment.id } },
    ]);

    // The real browser download carries the file name.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: enquiry.attachment.filename }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(enquiry.attachment.filename);
    await page.reload();
    await expect(page.getByTestId("activity")).toContainText(`Attachment downloaded: ${enquiry.attachment.filename}.`);

    // A CSV is served as text/csv, still as a download.
    const csv = await page.request.get(`/api/admin/attachments/${enquiry.csv.id}`);
    expect(csv.headers()["content-type"]).toBe("text/csv");
    expect(csv.headers()["content-disposition"]).toMatch(/^attachment; /);
    expect((await page.request.get("/api/admin/attachments/not-a-uuid")).status()).toBe(404);
  });

  test("HEAD on an attachment: 405 when signed in, 401 signed out, and never logged as a download", async ({ page, playwright }) => {
    const url = `/api/admin/attachments/${enquiry.attachment.id}`;
    const res = await page.request.head(url);
    expect(res.status()).toBe(405);
    expect(res.headers()["allow"]).toBe("GET");
    const anonymous = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
    try {
      expect((await anonymous.head(url)).status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }
    // A cross-site browser fetch is refused as well.
    expect((await page.request.get(url, { headers: { "sec-fetch-site": "cross-site" } })).status()).toBe(403);
    expect((await activitiesOf(enquiry.id)).filter((a) => a.action === "attachment.downloaded")).toEqual([]);
  });

  test("an unknown enquiry id shows not found inside the admin", async ({ page }) => {
    await page.goto("/admin/enquiries/00000000-0000-4000-8000-00000000abcd");
    await expect(page.getByRole("heading", { level: 1, name: "Not found", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to enquiries" })).toBeVisible();
  });

  test("enquiries list and detail: noindex, axe, overflow, headings", async ({ page }) => {
    await expectQualityGates(page, "/admin/enquiries");
    await expectQualityGates(page, `/admin/enquiries/${enquiry.id}`);
  });
});

test.describe("admin: super admin view", () => {
  test("shows the verification controls and their consequence", async ({ page }) => {
    await signInViaApi(page, superAdmin);
    await page.goto(`/admin/products?q=${encodeURIComponent(ETHANOL.code)}`);
    await expect(productRow(page, ETHANOL.name).getByRole("button", { name: /^Mark unverified and unpublish/ })).toBeVisible();
    await expect(page.locator("main")).toContainText("Marking a published product unverified also unpublishes it.");
    await expect(page.getByRole("banner")).toContainText(superAdmin.roleLabel);
  });
});

