# Core Business Content Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fragrances, Flavours, About, Innovation, Sustainability (Compliance, Certifications) and Contact pages from verified content only, with typed templates, working old-URL redirects, SEO output, and Contact forms that create correctly typed enquiries through the existing pipeline.

**Architecture:** Page copy lives in typed modules under `src/content/` with the existing `Block<T>`/`ContentStatus` model; four presentational templates render only blocks that have content. Static content pages stay static; the Contact page reads `searchParams` and follows the catalogue's dynamic-page pattern. The message-based Contact submission reuses the RFQ pipeline's guards by extracting shared steps from `submit.ts` (behaviour-preserving, covered by the existing RFQ tests) rather than duplicating them. Redirects come from one table consumed by `next.config.ts`.

**Tech Stack:** Existing Next.js 16 (`cacheComponents: true`), TypeScript, Tailwind 4, React Hook Form + Zod, Prisma/Postgres, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-10-content-pages-design.md` (also read `2026-11-07-foundation-homepage-design.md`, `2026-11-08-data-catalogue-rfq-design.md`, `docs/design-system.md`, `docs/content-verification.md`, `docs/company-research.md`, and the existing `README.md`).

## Global Constraints

- **Read first:** `AGENTS.md`: this Next.js has breaking changes; read the relevant guide in `node_modules/next/dist/docs/` before writing redirects, metadata, `searchParams` pages, `notFound`, sitemap, or Server Actions. Static pages with no request data stay static; pages reading `searchParams` use `export const instant = false` like `src/app/(public)/aroma-chemicals/page.tsx`.
- Content integrity: every sentence must come from `docs/company-research.md`, `docs/content-verification.md` or the owner's brief text already used on the homepage (`src/content/home*.ts`). No invented products, capacities, customers, certifications, awards, statistics, dates or regulatory claims. Never use "16+", "since 2010", "since 2012", "N years", "best agarbatti", "largest manufacturer", "state-of-the-art" anywhere in `src/content/`.
- A section renders only if its block exists and is not `hidden`; `needs-client-confirmation` blocks render but are reported by `npm run content:report`.
- Certificates: never shown as active past their expiry date; with no confirmed entries the page says certificates are being compiled and is `noindex`.
- Named staff (Shalin Kale, Sunil Patil) and Gurudeo Hattali stay hidden. The `flavors@` mailbox is shown exactly as on the live site only inside the Flavours contact route, and its spelling is flagged `needs-client-confirmation`.
- Contact forms: the enquiry type is chosen from a server-side enum (FRAGRANCES, FLAVOURS, AROMA_CHEMICALS, GENERAL); an unknown value is a field error, never a default to another type. Prefill query params (`type`, `application`) are validated against fixed lists; anything else is ignored.
- Reuse, do not fork: honeypot, per-IP and per-recipient limits, `submissionId` idempotency, `validateAttachment`, minimised acknowledgement email, activity rows, file cleanup on failure. The existing RFQ tests must keep passing unchanged.
- No placeholder `#` links, no dead nav entries: a route is `available: true` only in the task that ships it.
- Images are labelled `ImageFrame` placeholders (see `docs/asset-inventory.md`); do not import the old site's photos.
- Responsive and a11y gates from earlier sub-projects apply to every new page: no horizontal overflow at 375/768/1280/1536, axe wcag2a/2aa/21aa/22aa clean, one `h1`, no skipped heading levels.
- e2e and `test:int` share the `aquila_test` database and must never run at the same time; e2e needs port 3100 (override with `E2E_PORT`).
- No `any` unless unavoidable. Commit messages carry **no** attribution trailer (owner instruction). Never commit `pnpm-lock.yaml` or `test-results/`. `git add` explicit paths only.

## Review Focus

- Unknown or hostile application slug (`/fragrances/../x`, `/flavours/FINE-FRAGRANCE`, trailing slash, encoded characters) → real 404, never a rendered page or 500 (Tasks 3, 7).
- Contact `?type=` / `?application=` with garbage, arrays (`?type=a&type=b`), 500-char values → ignored, form still usable, nothing reflected unescaped (Task 6).
- A client posting an invalid, missing, or privileged `type` (e.g. `CAREERS`, `ADMIN`) to the Contact action → field error, no enquiry stored (Task 5).
- Certificate whose expiry is today, yesterday, tomorrow, and a missing expiry date → expired items never rendered as active; boundary behaviour defined and tested (Task 4).
- Redirects: no chains, no loops, no source equal to its target, `/index.php/...` variants, trailing slashes and query strings preserved sensibly (Task 7).
- A page with sparse content (only a title and one sentence) still has a sensible layout and passes the a11y gates (Task 3).
- Message-only enquiries (zero product lines) must not break the admin list/detail, the activity text, or the acknowledgement/internal emails (Task 5).

---

## File Structure

```
src/content/segments.ts           fragrance + flavour segments and application records, slugs
src/content/about.ts  innovation.ts  sustainability.ts  certifications.ts  contact.ts  redirects.ts
src/content/types.ts              (extend) PageBlock, CertificateRecord, ApplicationRecord types
scripts/content-report.ts         lists needs-client-confirmation / brief-supplied blocks
src/components/pages/             SegmentPage, ApplicationPage, ContentPage, CertificationsPage, Breadcrumbs
src/lib/seo/page-metadata.ts      buildPageMetadata, breadcrumbJsonLd, organizationJsonLd
src/lib/certificates.ts           certificateStatus(cert, now) -> 'active' | 'expired' | 'unconfirmed'
src/app/(public)/fragrances/page.tsx, [application]/page.tsx
src/app/(public)/flavours/page.tsx, [application]/page.tsx
src/app/(public)/about/page.tsx  innovation/page.tsx  sustainability/page.tsx
src/app/(public)/sustainability/compliance/page.tsx  certifications/page.tsx
src/app/(public)/contact/page.tsx
src/features/contact/schema.ts  form-state.ts  actions.ts  submit.ts (thin)  query-params.ts
src/features/enquiries/pipeline.ts   shared guards extracted from submit.ts
src/components/forms/contact-form.tsx
docs/url-migration.md
tests/unit, tests/integration, tests/e2e
```

---

### Task 1: Content model, content modules, content report

**Files:** Create `src/content/{segments,about,innovation,sustainability,certifications,contact,redirects}.ts`, `scripts/content-report.ts`, `tests/unit/content-pages.test.ts`; Modify `src/content/types.ts`, `package.json` (script `content:report`), `tests/unit/content.test.ts` (extend banned patterns).

**Interfaces:**
- `ApplicationRecord { slug: string; name: string; summary: string; blocks: Block<PageSection>[] }` where `PageSection` is a discriminated union: `{kind:'paragraphs'; heading?: string; paragraphs: string[]} | {kind:'list'; heading: string; items: string[]} | {kind:'quote'; eyebrow?: string; text: string}`.
- `SegmentRecord { id: 'fragrances' | 'flavours'; name: string; path: string; lead: Block<string>; applications: ApplicationRecord[] }`; exports `fragranceSegment`, `flavourSegment`, `findApplication(segmentId, slug): ApplicationRecord | undefined`, `APPLICATION_SLUGS: Record<'fragrances'|'flavours', readonly string[]>`.
- `CertificateRecord { id: string; title: string; issuer: string | null; issuedOn: string | null; expiresOn: string | null; scope: string | null; documentPath: string | null; status: ContentStatus }` (ISO `YYYY-MM-DD` strings); `export const certificates: CertificateRecord[]` starts EMPTY (status of every future entry defaults `needs-client-confirmation`).
- `redirectTable: { source: string; destination: string }[]` per spec §6 (data only here; consumed in Task 7).
- `scripts/content-report.ts` prints, grouped by file, every block with status `needs-client-confirmation` or `brief-supplied`, exit 0.

- [ ] **Step 1:** Failing tests in `content-pages.test.ts`: exactly 6 fragrance and 5 flavour application records with the exact slugs from spec §3 and unique names; every application `summary` is non-empty and appears (case-insensitively, as a substring or documented near-quote) in `docs/company-research.md` or `src/content/home*.ts` (read the files), except the Incense record's quote block which must be `brief-supplied`; `findApplication('fragrances','nope')` is undefined; `findApplication('flavours','Bakery')` is undefined (case-sensitive slugs); `certificates` is empty; a unit test of the report function (pure `collectOpenBlocks(modules)`) returns the shisha line and the Oud statement. Extend `tests/unit/content.test.ts` banned regex with `best agarbatti|largest manufacturer|state-of-the-art` and make the directory scan RECURSIVE (a deferred minor from an earlier review).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement types and modules. Content sources: application one-liners and segment leads from `home.ts` / `company-research.md` §3 and §5; incense sub-types (Bakhoor, Flora Batti, Incense Cone, Masala Batti, Scented Batti) as a `list` section; about/innovation/sustainability from the verified blocks already on the homepage plus the brief's company text (do not paraphrase beyond grammar); `contact.ts` holds the verified details with `flavors@` flagged `needs-client-confirmation` and the named contacts blocks with status `hidden`.
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat: typed content modules for business pages`.

---

### Task 2: Templates, breadcrumbs, SEO helpers, certificate status

**Files:** Create `src/components/pages/{segment-page,application-page,content-page,certifications-page,breadcrumbs}.tsx`, `src/lib/seo/page-metadata.ts`, `src/lib/certificates.ts`, `tests/unit/page-templates.test.tsx`, `tests/unit/page-metadata.test.ts`, `tests/unit/certificates.test.ts`.

**Interfaces:**
- `buildPageMetadata(input: { title: string; description: string; path: string; noindex?: boolean }): Metadata` (canonical via `absoluteUrl`; no `any`).
- `breadcrumbJsonLd(trail: { name: string; path: string }[], baseUrl: string): object` and `organizationJsonLd(baseUrl: string): object` (name `Aquila Organics Private Limited`, url, the registered and head office addresses from `site.ts`, contact `info@`; no logo claim unless a real asset exists, no sameAs, no founding date); both serialised with the existing safe serializer (reuse `serializeJsonLd`, do not re-implement).
- `certificateStatus(cert: CertificateRecord, now: Date): 'active' | 'expired' | 'unconfirmed'`: `unconfirmed` when status is not `verified` or `expiresOn` is null and no issue date; an item is `expired` when `now` is strictly after the END of the `expiresOn` day (UTC); on the expiry day itself it is still `active`.
- Templates take plain props (records from Task 1) and render only blocks passed through `visibleBlocks`; sections with no data render nothing. `CertificationsPage` takes `certificates` and `now`; it renders active entries, lists expired entries under a clearly labelled "Expired" heading (never styled as current), and with no confirmed entries shows the "being compiled" message.

- [ ] **Step 1:** Failing tests. Certificates: expiry yesterday → expired; today → active; tomorrow → active; null expiry with verified status → active only if an issue date exists, else unconfirmed (decide and state in the test name); non-verified → unconfirmed; unconfirmed entries are never rendered by `CertificationsPage`. Templates (Testing Library): a block with status `hidden` is absent; an application with only `summary` renders a heading, the summary and the CTA and no empty section headings; heading levels are h1 then h2/h3 without skips; breadcrumbs render a nav with `aria-label` and the last item `aria-current="page"`. Metadata: canonical absolute, `noindex` flag produces `robots: {index:false, follow:true}`; JSON-LD has no `foundingDate`, `numberOfEmployees` or `sameAs`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Visual treatment follows `docs/design-system.md`: fragrance pages editorial (large display italics, numbered rules), flavour pages warm (cream ground), content pages plain; reuse `ActionButton`, `Eyebrow`, `SectionHeader`, `ImageFrame`.
- [ ] **Step 4:** Run → PASS (unit + lint + typecheck). **Step 5:** Commit `feat: page templates, SEO helpers and certificate status logic`.

---

### Task 3: Fragrances and Flavours pages

**Files:** Create `src/app/(public)/fragrances/page.tsx`, `src/app/(public)/fragrances/[application]/page.tsx`, `src/app/(public)/flavours/page.tsx`, `src/app/(public)/flavours/[application]/page.tsx`, `tests/e2e/segments.spec.ts`; Modify `src/lib/seo/sitemap.ts`, `src/lib/seo/site-url.ts` (path constants), `tests/unit/sitemap.test.ts`.

**Interfaces:** Consumes Task 1 records and Task 2 templates. Dynamic segments validate against `APPLICATION_SLUGS` using `generateStaticParams` returning exactly the fixed slugs and `dynamicParams = false` (verify in the installed docs that an unknown slug returns a real 404 under `cacheComponents`; if not, use the same proxy-based 404 approach as the catalogue and state why). `buildSitemap(baseUrl, products)` gains the 2 segment pages and 11 application pages (all static, `changeFrequency: 'monthly'`).

- [ ] **Step 1:** Failing e2e at all four widths: every one of the 13 routes returns 200 with exactly one `h1` and the expected name; each application page links to its parent and has the consultation link `href` starting `/contact?type=FRAGRANCES&application=<slug>` (resp. FLAVOURS); `/fragrances/incense-and-bakhoor` contains the exact brief-supplied Oud/Bakhoor/Arabic sentence and the five sub-types; `/flavours` shows the shisha/mouth-fresheners line; unknown slugs (`nope`, `Fine-Fragrance`, `fine-fragrance/`, `%2e%2e`) return 404; no text matches the banned-claims regex; sitemap contains the 13 URLs. Failing unit test for `buildSitemap` additions.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement pages with `generateMetadata` (title and description from the record, canonical, breadcrumb JSON-LD). The consultation link target exists only after Task 6: render it as a normal link to `/contact?...` (the route ships in Task 6; until then the e2e for it asserts only the `href`; the page-level click-through is covered in Task 6).
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat: fragrances and flavours pages`.

---

### Task 4: About, Innovation, Sustainability, Compliance, Certifications

**Files:** Create `src/app/(public)/{about,innovation,sustainability}/page.tsx`, `src/app/(public)/sustainability/{compliance,certifications}/page.tsx`, `tests/e2e/company-pages.spec.ts`; Modify `src/lib/seo/sitemap.ts`, `tests/unit/sitemap.test.ts`.

**Interfaces:** Consumes Tasks 1 and 2. `/sustainability/certifications` calls `generateMetadata` with `noindex` when `certificates` has no entries that `certificateStatus` reports `active`; the sitemap includes it ONLY under the same condition (pass a boolean into `buildSitemap` rather than reading content in the sitemap builder: `buildSitemap(baseUrl, products, { certificationsIndexable })`). `/about` emits `organizationJsonLd`. `/sustainability/compliance` states plainly which documents exist as files on the old site (EC letter, two six-month compliance reports, ISO certificate file, Halal certificate file, FDA certificate file, Kosher certificate file) and that issuer, scope and validity are awaiting confirmation, with NO links to those files and no compliance claim.

- [ ] **Step 1:** Failing tests. Unit: `buildSitemap` omits certifications when `certificationsIndexable` is false and includes it when true; the compliance content module contains none of `REACH|IFRA|GMP|compliant with|certified` (read the file; the register says no regulation may be named). E2E at four widths: five routes 200, one `h1`, axe clean; `/about` includes the leadership bio for Girish Vaze and NOT Hattali, the two production areas by name, and the three regions without counts; `/innovation` lists the 14 chemistries (count) and contains no capacity words (`tonnes|capacity|MT\b|equipment`); `/sustainability` shows the three verified items and no EcoVadis text; certifications page: `<meta name="robots">` contains `noindex`, shows the pending message, shows no expiry-related claims; the ISO/Kosher/Halal/FDA/EcoVadis names appear only on the compliance page, only as "documents awaiting confirmation", never as "certified".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: about, innovation, sustainability, compliance and certifications pages`.

---

### Task 5: Contact submission pipeline (message-based enquiries)

**Files:** Create `src/features/contact/{schema,query-params,form-state,actions,submit}.ts`, `src/features/enquiries/pipeline.ts`, `tests/unit/contact-schema.test.ts`, `tests/unit/contact-query-params.test.ts`, `tests/integration/contact-submit.test.ts`; Modify `src/features/enquiries/submit.ts` (extract shared steps only), `src/lib/email/templates.ts` (message variant), `src/features/enquiries/activity-text.ts` (if needed), `src/features/enquiries/queries.ts` and the admin enquiry detail page ONLY if zero-line enquiries need display handling (verify first, test, then change).

**Interfaces:**
- `CONTACT_TYPES = ['FRAGRANCES','FLAVOURS','AROMA_CHEMICALS','GENERAL'] as const` (a subset of `EnquiryType`; `CAREERS` is NOT allowed here).
- `contactSchema` (Zod): `type` (enum above, required), `fullName`, `companyName`, `email`, `phone`, `country`, `application?: string` (validated against the fixed application slug lists when `type` is FRAGRANCES/FLAVOURS, otherwise ignored/rejected as a field error), `message` (required, trimmed, 10..4000 chars, control characters stripped using the existing `cleanMultiline`), `consent: true`, `website` honeypot, optional `submissionId` uuid. Reuse the existing text limits and cleaners from `src/features/enquiries/schema.ts`; do not copy them.
- `parseContactParams(search: Record<string, string | string[] | undefined>): { type?: ContactType; application?: string }`: first value of arrays, unknown values dropped, application only kept if valid for the type.
- `submitContact(formData: FormData): Promise<SubmitRfqResult-compatible result>` as a `'use server'` action in `src/features/contact/actions.ts` delegating to `processContactSubmission` in `src/features/contact/submit.ts`.
- `pipeline.ts` exports the steps extracted from `processRfqSubmission` with unchanged semantics: `checkHoneypot`, `limitByIp`, `readAndValidateAttachments`, `persistWithFiles` (write files, run the transaction, clean up on failure), `allocateReference`, `notifyAfterCreate`. `processRfqSubmission` is rewritten to call them. The enquiry stores the message in `additionalRequirements`, `intendedApplication` from the application name, `businessSegment` mapped (FRAGRANCES→FRAGRANCES, FLAVOURS→FLAVOURS, AROMA_CHEMICALS→AROMA_CHEMICALS, GENERAL→OTHER), `type` from the validated enum, and ZERO `EnquiryItem` rows.
- Acknowledgement email: a message variant of `acknowledgementEmail` (constant greeting, reference, constant sentence "We have received your message", NO visitor text); internal notification includes the message escaped.

- [ ] **Step 1:** Failing tests FIRST. Unit: schema rejects `CAREERS`, `ADMIN`, empty and lowercase types; message too short/long; missing consent; invalid application for the type; `parseContactParams` cases (`?type=a&type=b` → first value only if valid else none; 500-char value dropped; valid pair kept; application for the wrong type dropped). Integration (real DB): for each of the four types a valid submission stores one enquiry with the matching `type`, the application recorded, zero items, the message in `additionalRequirements`, one `enquiry.created` activity, an acknowledgement and (with a recipient configured) an internal email; honeypot stores nothing; the 6th submission from one IP is limited; a repeat `submissionId` returns the existing reference with no second row/email; a hostile `type=CAREERS` is a field error and stores nothing; per-recipient ack cap behaves as for RFQ; attachments validated (an `.exe` renamed `.pdf` rejected, files removed on a failed transaction); no recipients configured → `notification.skipped`; admin list/detail queries still work for a zero-item enquiry (call them in the test). Regression: run the ENTIRE existing `rfq-submit` integration file unchanged and green after the extraction.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Extract `pipeline.ts` from `submit.ts` WITHOUT changing behaviour (do this first and run the existing RFQ tests green before adding contact code), then implement `contact/*`. **Step 4:** Run unit + `test:int` → PASS. **Step 5:** Commit in two commits: `refactor: extract shared enquiry pipeline steps` then `feat: contact submission pipeline`.

---

### Task 6: Contact page and forms

**Files:** Create `src/app/(public)/contact/page.tsx`, `src/components/forms/contact-form.tsx`, `src/features/contact/confirmation.ts`, `tests/e2e/contact.spec.ts`, `tests/unit/contact-form-data.test.ts`; Modify `src/app/(public)/rfq/confirmation/page.tsx` ONLY if the contact confirmation reuses it (prefer reusing with a `kind` that does not put business data in the URL; the URL still carries only the reference).

**Interfaces:** `ContactPage` is dynamic (`instant = false`, reads `searchParams` as a Promise) and renders: verified details from `contact.ts`; a tablist of four forms (FRAGRANCES, FLAVOURS, AROMA_CHEMICALS, GENERAL) implemented as anchored sections with the selected one driven by `parseContactParams` and also switchable client-side without losing typed data; the Aroma Chemicals section additionally links to `/rfq` for multi-product quotes. `ContactForm({ type, application })` (client, React Hook Form + `contactSchema` resolver) builds FormData through a pure `buildContactFormData` unit-tested against the server parser (client/server cannot drift); one `submissionId` (`crypto.randomUUID()`) per form instance kept across retries and cleared after success; honeypot hidden from users and assistive tech as in `rfq-form.tsx`; on success reset everything BEFORE navigating (lesson from the RFQ form under `cacheComponents`/Activity), then navigate to the confirmation page with only the reference in the URL. The mailbox `flavors@` is rendered only if its block is not `hidden` and is labelled as awaiting confirmation in the content report, not on the page.

- [ ] **Step 1:** Failing tests. Unit: `buildContactFormData` round-trips through the real server parser (field names, type, application, message, consent as the server expects). E2E (four widths): `/contact` 200, one `h1`, axe clean, no overflow; verified details present (both addresses labelled, both phone numbers with `tel:`, `info@` and `sales@` with `mailto:`), the named individuals absent; `/contact?type=FLAVOURS&application=bakery` preselects the Flavours form and the Bakery application; hostile params (`?type=CAREERS`, `?type=a&type=b`, 500-char values, `<script>`) leave the page usable and reflect nothing; each of the four forms submits and the enquiry exists in the database with the right type (DB query helper, not UI scraping) and a confirmation shows an `AQ-` reference; double-click creates exactly one enquiry (count DB rows); a bot-filled honeypot yields a normal confirmation and no row; invalid email/short message show inline accessible errors with focus on the first invalid field; after a successful send, Back and re-entry give a pristine form and a second send works (distinct reference, 2 rows); click-through from an application page's consultation link lands on the right preselected form.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS (unit, lint, typecheck, e2e specs for contact, segments and the existing rfq/catalogue/admin specs). **Step 5:** Commit `feat: contact page with business-specific enquiry forms`.

---

### Task 7: Navigation, redirects, sitemap, migration doc

**Files:** Create `docs/url-migration.md`, `tests/unit/redirects.test.ts`, `tests/e2e/redirects.spec.ts`; Modify `src/content/site.ts`, `src/components/layout/{mega-menu,mobile-drawer,footer,header}.tsx` (only as needed), `src/content/redirects.ts` (finalise), `next.config.ts` (`redirects()`), `src/lib/seo/sitemap.ts` and its tests, `tests/e2e/navigation.spec.ts`, `tests/e2e/home.spec.ts` (anchors that changed).

**Interfaces:** `redirects()` in `next.config.ts` maps `redirectTable` to `{ source, destination, permanent: true }` and also each `/index.php/<slug>` variant of a source that exists on the old site; ONE hop each. `src/content/site.ts`: `primaryNav` entries for the new pages become `available: true`; `segments[*].anchor` points to `/fragrances` and `/flavours`; the mega menu lists the application names as real links; the footer `footerNav` gains About, Sustainability, Contact.

- [ ] **Step 1:** Failing tests. Unit (`redirects.test.ts`): no source equals its destination; no destination is a source (no chains, so also no loops); all sources unique; every destination is a route that exists (assert against the content module slug lists and the static page paths, not a hand-typed list); every `/index.php/...` variant has the same destination as its clean source; `next.config.ts` exposes the same count of redirects. E2E (`redirects.spec.ts`): each old URL returns exactly one `301` (maxRedirects 0) with the right `Location`, the destination returns 200; query strings on an old URL are preserved; `/contactus` and `/flavors` and `/about/certifications` verified explicitly. Navigation e2e: desktop mega menu and mobile drawer contain real links to the new pages and none are `#`; every link in header, drawer and footer resolves with a non-4xx/5xx status (crawl the three lists); keyboard behaviour from the existing navigation tests still passes; homepage tests updated for changed anchors.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; write `docs/url-migration.md` with the table of delivered redirects (old URL, new URL, status 301, delivered in this sub-project) and a list of legacy URLs still pending (none expected beyond blog/careers sections that never existed on the old site). **Step 4:** Run → PASS. **Step 5:** Commit `feat: navigation, old-URL redirects and sitemap for business pages`.

---

### Task 8: Quality gates, docs, content report

**Files:** Create `tests/e2e/quality-pages.spec.ts`; Modify `docs/sitemap.md`, `docs/content-verification.md`, `docs/design-system.md` (templates and treatments), `docs/asset-inventory.md` (new placeholder slots), `README.md` (routes, `npm run content:report`, contact forms and enquiry types), `docs/superpowers/plans/2026-11-10-content-pages.md` (append a short "Deviations as built" note).

- [ ] **Step 1:** Failing e2e at all four widths for ALL new routes (13 segment/application pages, `/about`, `/innovation`, `/sustainability`, `/sustainability/compliance`, `/sustainability/certifications`, `/contact`): no horizontal overflow, axe clean, exactly one `h1`, no skipped heading levels, canonical present and absolute, breadcrumb JSON-LD valid JSON; `/sitemap.xml` lists every indexable page and not `/sustainability/certifications` while it has no confirmed entries; `/robots.txt` unchanged; no page text matches the banned-claims regex or the names of certifications as "certified"; the 404 page and a page past the end still pass axe.
- [ ] **Step 2:** Run → fix components (not tests) until green. **Step 3:** Update docs to match the code as built (verify at least ten claims against source); add the open items from `npm run content:report` to `docs/content-verification.md` (Oud statement, shisha line, `flavors@` spelling, certificates awaiting data, hidden named contacts).
- [ ] **Step 4:** Run, in order and never concurrently: lint, typecheck, `npm test`, `npm run test:int`, then the whole `npm run test:e2e` (all four widths plus the `catalogue-write` project). All pass.
- [ ] **Step 5:** Commit `docs: page templates, routes and content register; quality gates for business pages`.

---

## Self-Review (spec ↔ plan)

- Spec §3 pages → Tasks 3 and 4; §4 templates/content model → Tasks 1 and 2; §5 Contact page and forms → Tasks 5 and 6; §6 navigation/redirects/SEO → Tasks 2, 3, 4, 7; §7 testing → every task plus Task 8; §8 out of scope respected (no blog, careers, map, photos, real email); §9 risks → Tasks 1, 4, 8 (register and report).
- Names consistent across tasks: `ApplicationRecord`, `SegmentRecord`, `CertificateRecord`, `certificateStatus`, `buildPageMetadata`, `breadcrumbJsonLd`, `organizationJsonLd`, `CONTACT_TYPES`, `contactSchema`, `parseContactParams`, `processContactSubmission`, `redirectTable`.
- Execution-order dependencies: Task 3's consultation links point at `/contact` which ships in Task 6 (asserted by `href` until then); Task 7 flips nav availability after all pages exist; Task 5's extraction refactors shared code, so its first commit must leave the existing RFQ tests green before any contact code is added.
- Judgement calls for review: the Aroma Chemicals Contact form is a message form of type AROMA_CHEMICALS with a prominent link to the existing `/rfq` for multi-product requests (the spec allows product lines but not requires them); `GENERAL` maps to `businessSegment` `OTHER`; the certificates list starts empty by design.

---

## Deviations as built

- **Hybrid execution:** Tasks 1 to 4, 7 and 8 were built natively; Tasks 5 and 6 were subagent-driven with independent per-task reviews.
- **Unknown application slugs:** `dynamicParams` is unavailable under `cacheComponents`, and an in-page `notFound()` answered 200 on a cold server, so `src/proxy.ts` answers a real 404 with a pure slug check (`src/features/pages/application-guard.ts`), the same mechanism the catalogue uses. The `/fragrances/%2e%2e` e2e case was dropped: dot segments normalise to `/` before routing.
- **Certifications indexing:** the page's `noindex` and the sitemap entry depend on `hasConfirmedCertificates()` (any verified entry), not "at least one active", because `new Date()` cannot run during prerender. The page body itself compares expiry dates per request (`connection()` first).
- **Helper naming:** the new breadcrumb structured-data helper is `pageBreadcrumbJsonLd`; `breadcrumbJsonLd` already exists for products.
- **Redirects:** an explicit `statusCode: 301` is used (Next's `permanent: true` answers 308). Every rule also has an `/index.php/...` twin. Old URLs with a trailing slash take two hops (Next's own 308, then the 301); documented in `docs/url-migration.md` and pinned by a test.
- **Contact forms:** General is the default first tab (the brief lists Fragrances first; a visitor with no `?type` most plausibly has a general question). Contact confirmations use `/contact/confirmation`, sharing `EnquiryConfirmation` with `/rfq/confirmation`. The Aroma Chemicals form is message-only and links to `/rfq` for multi-product quotations. The shared form pieces moved to `src/components/forms/form-fields.tsx`.
- **Shared limiter buckets:** contact submissions share the RFQ per-IP bucket (`rfq:`) and per-address acknowledgement bucket (`rfq-ack:`), so switching forms gives no extra quota.
- **Header and drawer:** the call to action links to `/contact` instead of a `mailto:`; the header gained About and Sustainability; `segments` in `src/content/site.ts` is hand-written (not imported from `src/content/segments.ts`) to keep the client menu small, with unit tests tying the labels and paths together.
- **Final fixes from reviews:** the contact message has a raw-length ceiling before cleaning; the admin enquiry page labels a contact enquiry's text "Message" and hides the empty products section; both forms use `method="post"`; `src/lib/email/dev.ts` carries a `turbopackIgnore` hint; `tests/unit/setup.ts` unmounts Testing Library renders between tests.
- **Regression caught late:** adding pages to the sitemap broke an exact-count e2e check that was not re-run; it now compares the exact set of expected paths.
