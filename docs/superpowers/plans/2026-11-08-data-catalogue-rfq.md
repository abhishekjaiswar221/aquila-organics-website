# Data Layer, Catalogue and RFQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Postgres-backed, CAS-searchable aroma chemical catalogue, a multi-product RFQ with attachments and notifications, and a minimal secured admin for publishing products and handling enquiries.

**Architecture:** Next.js App Router Server Components read through a thin data layer (`src/features/*`) over Prisma. Pure domain logic (CAS, search classification, rate limiting, validation) is isolated and unit-tested. Storage and email sit behind interfaces with local implementations. One `requireRole()` helper guards every admin page and action.

**Tech Stack:** Existing Next.js 16 / TypeScript / Tailwind app; add Prisma, PostgreSQL (Docker), Better Auth (Prisma adapter), Zod, React Hook Form, `@hookform/resolvers`, `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-11-08-data-catalogue-rfq-design.md` (also read `docs/superpowers/specs/2026-11-07-foundation-homepage-design.md`, `docs/content-verification.md`).

## Global Constraints

- **Read first:** `AGENTS.md` says this Next.js has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing route handlers, server actions, `cookies`/`headers`, caching or metadata code. Read the installed Better Auth and Prisma docs for their exact setup; do not rely on memory.
- Never publish or seed unverified data: imports create `DRAFT`, `verified=false`. A `PUBLISHED` product requires non-empty `name`, `slug` and `verified=true`. No invented products, CAS numbers or specifications. Test fixtures are clearly fake (prefix `TEST-`) and exist only under `tests/`.
- CAS numbers must pass the checksum. The known conflicts (methyl chloroacetate, the duplicate 1123-85-9 pair, Citronellyl Tiglate) are imported with CAS empty plus a `sourceNote`.
- Only `PUBLISHED` products are visible publicly; drafts/archived return 404 and stay out of the sitemap. Admin routes are `noindex`.
- Authorisation happens on the server in `requireRole()`, never only in layouts. Only `SUPER_ADMIN` and `SALES_MANAGER` may use admin in this slice. No public sign-up.
- Attachments: PDF, PNG, JPG, DOCX, XLSX, CSV; max 5 files, 10 MB each; extension and sniffed MIME must agree; random storage keys; stored outside `public/`; downloads only via a permission-checked route.
- RFQ rate limit: 5 submissions per hour per IP hash (DB-backed). Honeypot field filled → return success, store nothing.
- Email failures never fail a submission. With no configured recipient the internal notification is skipped, logged and surfaced as an admin warning.
- Secrets only in env; `.env.example` placeholders only; nothing secret is `NEXT_PUBLIC_`.
- No `any` unless unavoidable. No dead links or placeholder `#`. Product list, filters and RFQ work without JavaScript where feasible (search is a GET form).
- Responsive and axe gates from the homepage apply to every new page (no horizontal overflow at 375/768/1280/1536).
- Commit messages carry **no** attribution trailer (owner instruction). Small commits per task.

## Review Focus

- CAS typed in odd forms (`64-17-5`, `64175`, ` 64-17-5 `, letters) → exact CAS match when valid, otherwise treated as text, never an error (Task 2/7).
- Search input with SQL/LIKE metacharacters (`%`, `_`, quotes) and 500-character strings → safe, no crash, no wildcard abuse (Task 7).
- Visitor submits RFQ with a removed/unpublished product in their saved list or an empty list → free-text lines still work, unpublished products are dropped with a clear message (Task 9/10).
- Double-clicking Submit or replaying a request → one enquiry per submission; reference numbers never collide (Task 9).
- A signed-in user with a non-permitted role, or a stale session, calling an admin action directly → rejected on the server (Task 11).
- Attachment named `invoice.pdf.exe`, `../../x`, or a PDF whose bytes are an executable → rejected (Task 5/9).

---

## File Structure

```
docker-compose.yml                    Postgres 16 for dev + test db
prisma/schema.prisma, prisma/migrations/
prisma.config.ts (if required by installed Prisma)
src/lib/db.ts                         Prisma client singleton
src/lib/env.ts                        validated env (Zod), server-only
src/lib/cas.ts                        isValidCas, normalizeCas, formatCas
src/lib/search.ts                     classifyQuery(q)
src/lib/rate-limit.ts                 checkRateLimit(db, key, limit, windowMs)
src/lib/storage/{types,local,index}.ts
src/lib/email/{types,dev,templates,index}.ts
src/lib/auth.ts, src/lib/auth-client.ts, src/lib/permissions.ts (requireRole)
src/features/products/{schema,queries,actions}.ts
src/features/enquiries/{schema,store-client,actions,queries}.ts
src/app/(public)/aroma-chemicals/page.tsx, [slug]/page.tsx, documents route
src/app/(public)/rfq/page.tsx, rfq/confirmation/page.tsx, privacy/page.tsx
src/app/admin/(auth)/login/page.tsx, src/app/admin/(panel)/{products,enquiries}/...
src/app/api/auth/[...all]/route.ts, src/app/api/admin/attachments/[id]/route.ts
scripts/{import-products.ts,seed-admin.ts}
data/legacy-products.json
tests/unit, tests/integration, tests/e2e
```

---

### Task 1: Branching, Postgres, Prisma, env

**Files:** Create `docker-compose.yml`, `src/lib/db.ts`, `src/lib/env.ts`, `tests/unit/env.test.ts`; Modify `.env.example`, `.gitignore` (`storage/`), `package.json` scripts (`db:up`, `db:migrate`, `db:reset`, `test:int`).

**Interfaces:** Produces `db` (PrismaClient singleton), `env` (typed, throws on missing required vars), scripts above. Test DB name `aquila_test`, selected via `DATABASE_URL_TEST`.

- [ ] **Step 1:** Create branch `feat/catalogue-rfq` from the current head (do not touch `main`). Install `prisma`, `@prisma/client` (and the driver adapter the installed Prisma requires), `zod`, `react-hook-form`, `@hookform/resolvers`, `tsx`, `better-auth`. Run `npx prisma init`.
- [ ] **Step 2:** `docker-compose.yml`: `postgres:16`, two databases (`aquila`, `aquila_test`) via an init script, volume, port 5432, dev-only credentials.
- [ ] **Step 3:** Failing test `tests/unit/env.test.ts`: `parseEnv({})` throws naming missing keys; `parseEnv(valid)` returns typed values; no key starting `NEXT_PUBLIC_` appears in the secret schema. Run → FAIL.
- [ ] **Step 4:** Implement `parseEnv(source: Record<string,string|undefined>): Env` and `export const env = parseEnv(process.env)` in `src/lib/env.ts` with Zod (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `STORAGE_DRIVER=local`, `EMAIL_DRIVER=dev`, `RATE_LIMIT_SALT`, optional `ADMIN_EMAIL/ADMIN_PASSWORD`). Run → PASS.
- [ ] **Step 5:** Update `.env.example` with placeholders for every key. Run `npm run db:up` and confirm both databases accept connections. Commit `chore: postgres, prisma and env foundation`.

---

### Task 2: Pure domain logic (CAS, search classification, rate limit)

**Files:** Create `src/lib/cas.ts`, `src/lib/search.ts`, `src/lib/rate-limit.ts`, `tests/unit/cas.test.ts`, `tests/unit/search.test.ts`, `tests/unit/rate-limit.test.ts`.

**Interfaces:**
- `isValidCas(input: string): boolean` — format `\d{2,7}-\d{2}-\d` plus checksum.
- `normalizeCas(input: string): string | null` — digits-only form if the input (trimmed, hyphens optional) is a valid CAS, else `null`.
- `formatCas(digits: string): string` — inserts hyphens.
- `type SearchQuery = { kind: 'cas'; casNormalized: string } | { kind: 'text'; text: string } | { kind: 'empty' }`; `classifyQuery(raw: string | undefined): SearchQuery` — trims, truncates text to 100 chars, escapes nothing (escaping is the query layer's job).
- `checkRateLimit(store: RateLimitStore, key: string, limit: number, windowMs: number, now?: Date): Promise<{ allowed: boolean; remaining: number }>` with `interface RateLimitStore { increment(key: string, windowStart: Date): Promise<number> }` so it unit-tests without a DB.

- [ ] **Step 1:** Failing tests. CAS: `64-17-5` (ethanol) valid, `64175` normalises to `64175`, `64-17-6` invalid, `' 64-17-5 '` valid, `abc` → null, `''` → null. Search: `'64-17-5'`/`'64175'` → cas; `'vanill'` → text; `'  '`/`undefined` → empty; 500-char string → text truncated to 100; `'%_\''` → text. Rate limit: 5 allowed then 6th denied in one window; new window resets; in-memory fake store.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement the three modules. **Step 4:** Run → PASS. **Step 5:** Commit `feat: cas, search-query and rate-limit logic`.

---

### Task 3: Prisma schema, migration, integration harness

**Files:** Create/Modify `prisma/schema.prisma`, `prisma/migrations/*`, `tests/integration/setup.ts`, `tests/integration/schema.test.ts`, `vitest.integration.config.ts`.

**Interfaces:** Produces the models of spec §3 with exactly these names: `User, Session, Account, Verification` (as required by the installed Better Auth), `Category, Product, ProductSpecification, ProductApplication, ProductDocument, Enquiry, EnquiryItem, EnquiryAttachment, EnquiryActivity, SiteSetting, RateLimitHit`; enums `Role, ProductStatus, EnquiryType, EnquiryStatus, DocumentKind, Unit`. Test helper `resetDb(): Promise<void>` truncates all tables.

- [ ] **Step 1:** Failing integration tests (against `DATABASE_URL_TEST`): inserting two products with the same `slug` fails; two products with `code` null both succeed; a `PUBLISHED` product with `verified=false` is rejected by the DB check constraint; deleting a product sets `EnquiryItem.productId` null and keeps the snapshot; `pg_trgm` extension exists.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Write the schema (UUID ids, timestamps, indexes per spec §3: GIN trigram on `Product.name`/`code` added via raw SQL in the migration, btree on `casNormalized`, `status`, `categoryId`; check constraint `status <> 'PUBLISHED' OR (verified AND name <> '' AND slug <> '')`), generate and apply the migration to both databases. **Step 4:** Run → PASS. **Step 5:** Commit `feat: database schema and migrations`.

---

### Task 4: Auth, roles and admin seeding

**Files:** Create `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/permissions.ts`, `src/app/api/auth/[...all]/route.ts`, `scripts/seed-admin.ts`, `tests/integration/permissions.test.ts`.

**Interfaces:**
- `type AdminRole = 'SUPER_ADMIN' | 'SALES_MANAGER'`.
- `requireRole(allowed?: AdminRole[]): Promise<{ userId: string; role: Role }>` — reads the session from request headers; throws/redirects: no session → redirect to `/admin/login`; role not permitted → `notFound`-style 403 (use the installed Next.js documented mechanism). Default allowed = both.
- `can(role: Role, action: 'products.publish' | 'enquiries.view' | 'enquiries.update'): boolean`.
- Seed script creates the first `SUPER_ADMIN` from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, idempotent.

- [ ] **Step 1:** Failing tests: `can` truth table for all six roles (only SUPER_ADMIN/SALES_MANAGER true); `requireRole` with a mocked session of role `CONTENT_EDITOR` rejects, with no session redirects; seed run twice leaves one user.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Configure Better Auth (email+password enabled, sign-up disabled, rate limiting on, HTTP-only cookies, `role` additional user field not settable by clients), mount the route handler, implement `can`/`requireRole` and the seed script following the installed docs. **Step 4:** Run → PASS. **Step 5:** Commit `feat: admin authentication and role gate`.

---

### Task 5: Storage and email interfaces

**Files:** Create `src/lib/storage/{types,local,index}.ts`, `src/lib/email/{types,dev,templates,index}.ts`, `src/features/enquiries/attachment-rules.ts`, `tests/unit/storage.test.ts`, `tests/unit/attachments.test.ts`, `tests/unit/email.test.ts`.

**Interfaces:**
- `interface StorageProvider { put(key: string, data: Uint8Array, meta: { mimeType: string }): Promise<void>; getStream(key: string): Promise<ReadableStream | null>; delete(key: string): Promise<void> }`; `getStorage(): StorageProvider`. Local driver writes under `./storage/uploads`, rejects keys containing `..` or path separators.
- `interface EmailProvider { send(msg: { to: string[]; subject: string; html: string; text: string }): Promise<void> }`; dev driver writes JSON files to `./storage/outbox`.
- `acknowledgementEmail(e: { reference: string; fullName: string; items: {name: string; quantity: string; unit: string}[] }): {subject, html, text}`; `internalNotificationEmail(...)` likewise. HTML output escapes all user-supplied strings.
- `validateAttachment(file: { name: string; size: number; bytes: Uint8Array }): { ok: true; mimeType: string; safeName: string } | { ok: false; reason: string }` — allowed types per Global Constraints; sniffs magic bytes (PDF `%PDF`, PNG, JPEG, ZIP-based DOCX/XLSX, CSV as printable text).

- [ ] **Step 1:** Failing tests: `invoice.pdf.exe` rejected; `../../x.pdf` sanitised to a safe name; PDF named `a.pdf` containing `MZ` bytes rejected; 11 MB rejected; valid PDF/PNG accepted; local storage put→getStream round-trip returns same bytes and refuses key `../x`; email templates escape `<script>` in `fullName` and include the reference.
- [ ] **Step 2–4:** Run FAIL → implement → PASS. **Step 5:** Commit `feat: storage and email providers, attachment validation`.

---

### Task 6: Product schema, import script, legacy data

**Files:** Create `src/features/products/schema.ts`, `scripts/import-products.ts`, `data/legacy-products.json`, `tests/unit/product-schema.test.ts`, `tests/integration/import.test.ts`.

**Interfaces:** `productInputSchema` (Zod): `name` (required), `slug` (derived from name if absent, lowercase kebab), `code?`, `casNumber?` (validated with `isValidCas`; stored with `casNormalized`), `category?` (name), `description?`, `specifications?: {label,value}[]`, `applications?: string[]`, `sourceNote?`. `importProducts(rows: unknown[], db): Promise<{ created: number; updated: number; skipped: { index: number; reason: string }[] }>` — upsert by slug, always `status: DRAFT`, `verified: false`, categories created on demand.

- [ ] **Step 1:** Failing tests: a valid CAS row accepted; `64-17-6` row rejected with reason; slug derived (`Aldehyde C-16 (Strawberry Aldehyde)` → `aldehyde-c-16-strawberry-aldehyde`); integration: importing the same file twice yields created 20 then updated 20 with row count 20; every imported row is DRAFT and unverified.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement schema and importer; build `data/legacy-products.json` from `docs/company-research.md` §7 and the live `/aroma-chemicals` table: names, categories, datasheet filenames as `sourceNote`, CAS only where it passes the checksum **and** is not one of the flagged conflicts (those get CAS empty and a note describing the conflict). `scripts/import-products.ts` is a CLI (`npm run import:products -- <file>`). **Step 4:** Run → PASS. **Step 5:** Commit `feat: product schema and legacy draft import`.

---

### Task 7: Catalogue queries

**Files:** Create `src/features/products/queries.ts`, `tests/integration/catalogue-queries.test.ts`.

**Interfaces:**
- `type CatalogueParams = { q?: string; category?: string; sort?: 'name-asc' | 'name-desc' | 'newest'; page?: number }`.
- `searchProducts(params: CatalogueParams): Promise<{ items: ProductListItem[]; total: number; page: number; pageCount: number; categories: { slug: string; name: string; count: number }[] }>` — PUBLISHED only; page size 24; page clamped to ≥1; unknown sort → default.
- `getPublishedProduct(slug: string): Promise<ProductDetail | null>`; `getRelatedProducts(productId: string, limit: number)`.
- All text matching uses parameterised queries with LIKE metacharacters escaped; trigram similarity or ILIKE on `name` and `code`.

- [ ] **Step 1:** Failing integration tests using `TEST-` fixtures: draft/archived products never returned (also not via CAS or by slug); CAS search with `64-17-5` and `64175` both find the product; text search finds by name fragment and code; `%` and `_` match literally (a query of `%` returns nothing unless a name contains it); 500-char query doesn't throw; category filter and counts only count published; pagination (25 products → page 2 has 1); sort orders correct; out-of-range page returns an empty list with correct `pageCount`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: catalogue search and detail queries`.

---

### Task 8: Catalogue pages

**Files:** Create `src/app/(public)/aroma-chemicals/page.tsx`, `src/app/(public)/aroma-chemicals/[slug]/page.tsx`, `src/app/(public)/aroma-chemicals/documents/[id]/route.ts`, `src/components/catalogue/{search-form,product-card,pagination,add-to-enquiry-button}.tsx`, `src/lib/seo/product-jsonld.ts`, `tests/e2e/catalogue.spec.ts`, `tests/unit/product-jsonld.test.ts`; Modify `src/app/sitemap.ts` (create), `src/content/site.ts` (mark Aroma Chemicals `available: true`), homepage anchors/CTAs → `/aroma-chemicals`.

**Interfaces:** List page reads `searchParams` (`q`, `category`, `sort`, `page`) and uses a GET `<form>`; empty catalogue shows the "being prepared" message with the contact route. `productJsonLd(p: ProductDetail, baseUrl: string): object` renders only fields that exist. Document route streams only if the document's product is PUBLISHED, else 404. `AddToEnquiryButton` is a client component calling the enquiry store (Task 9).

- [ ] **Step 1:** Failing tests: JSON-LD omits `casNumber`/`description` when absent; e2e (seeded fixtures, fake): search by CAS shows the product; detail renders only existing fields; draft slug 404s; list page has no horizontal overflow at 375; axe clean; empty state when nothing published.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement pages, components, `generateMetadata` (title, description, canonical, robots), sitemap including only published products, and the homepage/nav updates. **Step 4:** Run → PASS. **Step 5:** Commit `feat: catalogue list and product pages`.

---

### Task 9: RFQ domain: schema, client list, submit action

**Files:** Create `src/features/enquiries/{schema,store-client,actions,reference}.ts`, `tests/unit/enquiry-schema.test.ts`, `tests/unit/enquiry-store.test.ts`, `tests/integration/rfq-submit.test.ts`.

**Interfaces:**
- `rfqSchema` (Zod): `fullName`, `companyName`, `email` (business email: reject known free-mail domains only as a warning flag, not an error), `phone`, `country`, `businessSegment` (enum), `intendedApplication?`, `additionalRequirements?`, `consent: true`, `website` (honeypot, must be empty to store), `items: { productId?: string; name: string; quantity: number > 0; unit: Unit; notes?: string }[]` (1–25 lines).
- Client store (`store-client.ts`): `getList(): string[]`, `addProduct(id: string): void`, `removeProduct(id: string): void`, `clearList(): void`; localStorage with try/catch and in-memory fallback.
- `submitRfq(formData: FormData): Promise<{ ok: true; reference: string } | { ok: false; errors: Record<string, string[]> | { form: string } }>` (server action): validates, applies honeypot and rate limit (IP from forwarded header, salted hash), validates attachments, drops lines whose `productId` is not PUBLISHED (keeping the name as free text and noting it), creates enquiry/items/attachments/activity in one transaction with a collision-safe `reference` (`AQ-<year>-<6 digits>`), then best-effort sends emails; records email outcome in activity.
- `generateReference(year: number, seq: number): string`.

- [ ] **Step 1:** Failing tests: schema rejects zero/negative quantity, 26 lines, missing consent, bad email; store add/remove/dedupe and survives `localStorage` throwing; integration: two-product submission creates 1 enquiry, 2 items, 1 activity row and returns a reference; honeypot filled → `ok: true` with nothing stored; 6th submission from one IP within an hour → rate-limit error; unpublished product line kept as free text; two concurrent submissions get distinct references; email provider throwing still returns `ok: true`; no recipients configured → skipped and recorded.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: rfq schema, enquiry list and submit action`.

---

### Task 10: RFQ pages and privacy

**Files:** Create `src/app/(public)/rfq/page.tsx`, `src/app/(public)/rfq/confirmation/page.tsx`, `src/app/(public)/privacy/page.tsx`, `src/components/forms/rfq-form.tsx`, `src/components/layout/enquiry-link.tsx`; Modify `src/components/layout/header.tsx`, `src/content/site.ts`, `tests/e2e/rfq.spec.ts`.

**Interfaces:** `RfqForm` (client, React Hook Form + `rfqSchema`) loads product details for the saved IDs through a server action/props (published only), supports add/remove lines, free-text lines, attachment input with client-side type/size hints, honeypot field hidden from users and assistive tech, submit disabled while pending (prevents double submit). `EnquiryLink` shows the count and links to `/rfq`. Confirmation page shows reference and summary only. Privacy page is a short draft flagged in `docs/content-verification.md` for legal review.

- [ ] **Step 1:** Failing e2e (fake fixtures): add two products from the list → header count 2 → `/rfq` shows both lines; submit with an attachment → confirmation shows `AQ-` reference; invalid email shows inline accessible errors; double-click submit creates one enquiry; free-text line with no products works; removed/unpublished saved product is dropped with a visible message; no overflow at 375 and axe clean on `/rfq`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: rfq form, confirmation and privacy pages`.

---

### Task 11: Minimal admin

**Files:** Create `src/app/admin/(auth)/login/page.tsx`, `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/products/page.tsx`, `src/app/admin/(panel)/enquiries/page.tsx`, `src/app/admin/(panel)/enquiries/[id]/page.tsx`, `src/app/api/admin/attachments/[id]/route.ts`, `src/features/products/admin-actions.ts`, `src/features/enquiries/admin-actions.ts`, `src/features/enquiries/queries.ts`, `tests/integration/admin-actions.test.ts`, `tests/e2e/admin.spec.ts`.

**Interfaces:**
- `setProductStatus(productId: string, status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'): Promise<{ ok: true } | { ok: false; error: string }>` — calls `requireRole()` first; publishing enforces `verified`, name, slug (the product list shows a "Mark verified" toggle restricted to SUPER_ADMIN, writing an audit-style activity note in `sourceNote` history).
- `setEnquiryStatus(enquiryId: string, status: EnquiryStatus): Promise<...>` — `requireRole()`, writes an `EnquiryActivity` row with before/after.
- `listEnquiries(filter: { status?: EnquiryStatus; q?: string; page?: number })`, `getEnquiry(id)`.
- Attachment route: `requireRole()`, streams from storage, logs an `attachment.download` activity row, sets `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- All admin pages export `robots: { index: false }`. Enquiry list shows a warning banner when no recipients are configured for any enquiry type.

- [ ] **Step 1:** Failing tests: integration: `setProductStatus` as `CONTENT_EDITOR` rejected, as unauthenticated rejected, publishing an unverified product returns an error and leaves the status unchanged, publishing a verified one succeeds; `setEnquiryStatus` writes one activity row; attachment route returns 401/403 without a role and never exposes the storage key. e2e: unauthenticated `/admin/products` redirects to login; wrong password shows a generic error; sales manager signs in, publishes a verified fixture which then appears in `/aroma-chemicals`; opens an enquiry from Task 10 and changes its status; a `CONTENT_EDITOR` account gets 403 on `/admin`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat: minimal admin for products and enquiries`.

---

### Task 12: Quality gates, docs, hand-off

**Files:** Create `docs/database-design.md`, `tests/e2e/quality-catalogue.spec.ts`; Modify `README.md`, `docs/content-verification.md`, `docs/sitemap.md`, `.env.example`.

- [ ] **Step 1:** Failing e2e: for `/aroma-chemicals`, a product page, `/rfq`, `/admin/login`: no horizontal overflow at 375/768/1280/1536 (all four projects), axe clean, one `h1`, no heading level skips; `robots` meta `noindex` on `/admin/**`; sitemap lists published product URLs and no draft or admin URLs.
- [ ] **Step 2–3:** Run → fix components (not tests) until green.
- [ ] **Step 4:** `docs/database-design.md`: entities, relationships, indexes, constraints, rationale. README: Docker setup, migrate, `seed:admin`, `import:products`, test commands. `content-verification.md`: add privacy page (needs legal review), email recipients (needs client), the drafted legacy products and their conflicts.
- [ ] **Step 5:** Run lint, typecheck, unit, integration, e2e (all four widths) and production build; all pass. Commit `docs: database design, setup and verification updates`.

---

## Self-Review (spec ↔ plan)

- §3 data model → Task 3; §4 catalogue → Tasks 7–8; §5 RFQ → Tasks 9–10 (+5 for attachments/email); §6 admin → Tasks 4, 11; §7 import/storage/email/env/docker → Tasks 1, 5, 6; §8 testing → each task plus Task 12; §9 risks → Task 12 docs.
- Names consistent across tasks (`requireRole`, `can`, `classifyQuery`, `searchProducts`, `submitRfq`, `validateAttachment`, `StorageProvider`, `EmailProvider`, `importProducts`).
- Notable judgement calls for review: Task 11 gives only `SUPER_ADMIN` the "mark verified" toggle (spec requires verified before publish but does not say who sets it); merged branch strategy assumes `feat/catalogue-rfq` is cut from the current head.

## Deviations as built

Recorded after Task 12; the tasks above are left as planned.

- **Order:** Task 9 (RFQ domain) ran before Task 8 (catalogue pages).
- **`acknowledgementEmail` signature:** it is `acknowledgementEmail({ reference, lineCount })`, not the Task 5 signature. It carries no items and no name ("Dear customer,"), so nothing the visitor typed reaches the recipient. `internalNotificationEmail` keeps the full details, including line notes.
- **Product audit:** product status and verification changes are a structured `[admin.audit]` server log line only (`src/features/admin/audit.ts`). There is no audit table, and `sourceNote` is not used as a history. An `AuditLog` table is deferred to the full-admin sub-project.
- **`src/proxy.ts`:**
  - It answers a real 404 for unpublished or unknown product slugs, which a page-level `notFound()` cannot do under Cache Components.
  - It sends signed-out `/admin` page requests a 307 to `/admin/login?next=...`. This checks only that a cookie is present. `requireRole()` stays the authority.
  - Both branches skip router prefetches in the matcher (`missing` headers), because Next.js strips those headers inside the proxy.
- **Idempotency:** the RFQ form sends one client-generated `submissionId` per form instance, stored under a unique index (migration `20261109120000_enquiry_submission_id`). A replay returns the existing reference and sends no second email.
- **Per-recipient acknowledgement cap:** at most 3 acknowledgements per normalised address per day (`rfq-ack:<salted hash>` in `RateLimitHit`). Over the cap the enquiry is stored, sales are notified and an `email.skipped` activity is recorded. This is in addition to the 5-per-hour per-IP limit, which has a 100-per-hour shared fallback when no client IP can be trusted.
- **Cache Components pattern:** with `cacheComponents: true`, the pages that read request data without a `<Suspense>` boundary export `instant = false`. These are the catalogue list, the product page, the RFQ confirmation, the admin login, the admin panel layout and the enquiry list and detail pages. It declares that blocking is intended and opts them out of static-shell validation.
- **Smaller additions:**
  - The product document lookup that returns a storage key lives in a `server-only` module (`src/features/products/document-queries.ts`).
  - The product slug `documents` is reserved.
  - `HEAD` on the admin attachment route answers 405.
  - A missing `NEXT_PUBLIC_SITE_URL` in production logs one warning per process.
  - `E2E_PORT` overrides the e2e port.
