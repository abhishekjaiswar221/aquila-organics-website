# Aquila Organics — Sub-project 2: Data Layer, Catalogue and RFQ

Date: 2026-11-08 · Status: awaiting spec review · Builds on `2026-11-07-foundation-homepage-design.md` (merged work on branch `feat/foundation-homepage`)

## 1. Purpose

Deliver the owner's top commercial priority: a database-backed aroma chemical catalogue searchable by name, product code and CAS number, and a multi-product Request for Quotation that produces a stored, notified enquiry. A minimal secured admin lets the sales team see enquiries and lets the client verify and publish products. Everything else in the admin and CMS remains sub-project 5.

Success: a visitor can find a published product by CAS number, add several products to an enquiry list, submit one RFQ (with attachments), and receive a reference number; sales can sign in, see it, and change its status. No product is publicly visible unless explicitly published.

Numbering note: the earlier spec listed data layer (3) and catalogue/RFQ (4) separately. They are merged here because the catalogue cannot exist without the database. The remaining plan is: (3) public content pages, (4) full admin and CMS, (5) launch.

## 2. Decisions already made

- Local development database: PostgreSQL in Docker (Docker is installed; no local Postgres). Neon is the later target; schema stays portable.
- Prisma ORM; Better Auth with the Prisma adapter, email and password, no public sign-up.
- In scope: product import script, minimal admin (login, product publish/unpublish/archive, enquiry list/detail/status), RFQ with attachments through a storage interface with a local-disk implementation.
- Out of scope: product editing forms, enquiry assignment, internal notes, CSV export, remaining roles' behaviour, product images, blog, careers, CMS, SEO redirects, R2 and Resend integrations (interfaces only).
- No Redis, Elasticsearch or separate API server.
- Commit messages carry no attribution trailer.

## 3. Data model (Prisma, PostgreSQL)

All primary keys are UUIDs; every table has `createdAt` and `updatedAt`.

**Auth** — the tables Better Auth's Prisma adapter requires (`User`, `Session`, `Account`, `Verification`), plus `User.role` enum: `SUPER_ADMIN | ADMINISTRATOR | SALES_MANAGER | SALES_EXECUTIVE | CONTENT_EDITOR | HR_MANAGER`. Only `SUPER_ADMIN` and `SALES_MANAGER` have access in this slice; others are denied. Verify the exact adapter schema against the installed Better Auth version.

**Catalogue**
- `Category` — `name`, `slug` (unique), `sortOrder`.
- `Product` — `name`, `slug` (unique), `code` (optional, unique when set), `casNumber` (optional), `casNormalized` (digits only, indexed), `categoryId`, `description`, `status` enum `DRAFT | PUBLISHED | ARCHIVED` (default DRAFT), `publishedAt`, `seoTitle`, `seoDescription`, `sourceNote` (provenance, e.g. "legacy site, unverified"), `verified` boolean (default false).
- `ProductSpecification` — `productId`, `label`, `value`, `sortOrder`.
- `ProductApplication` — `productId`, `name`.
- `ProductDocument` — `productId`, `kind` enum `DATASHEET | SDS | OTHER`, `title`, `storageKey`, `mimeType`.
- Indexes: `pg_trgm` GIN on `Product.name` and `Product.code`; btree on `casNormalized`, `status`, `categoryId`. Enable the `pg_trgm` extension in a migration.
- Constraints enforced in application code and a DB check: a `PUBLISHED` product requires non-empty `name`, `slug`, `verified = true`. CAS, when present, must pass the CAS checksum.

**Enquiries**
- `Enquiry` — `reference` (unique, human-readable, e.g. `AQ-2026-000123`), `type` enum `FRAGRANCES | AROMA_CHEMICALS | FLAVOURS | GENERAL | CAREERS`, `status` enum `NEW | ASSIGNED | CONTACTED | QUOTATION_SENT | NEGOTIATION | WON | LOST` (default NEW), contact fields (`fullName`, `companyName`, `email`, `phone`, `country`), `businessSegment`, `intendedApplication`, `additionalRequirements`, `consentAt`, `ipHash`, `userAgent`.
- `EnquiryItem` — `enquiryId`, optional `productId` (SET NULL on product delete), `productNameSnapshot`, `casSnapshot`, `quantity` (decimal), `unit` enum (`KG | G | MT | L | ML | OTHER`), `notes`.
- `EnquiryAttachment` — `enquiryId`, `filename`, `mimeType`, `sizeBytes`, `storageKey`.
- `EnquiryActivity` — `enquiryId`, `actorId` (nullable), `action`, `detail` JSON. Append-only; written for creation, status changes, and attachment access.

**System**
- `SiteSetting` — `key` (unique), `value` JSON. Holds `notification.recipients.<enquiryType>`. Empty by default; with no recipient configured the internal notification is skipped and logged, and an admin warning is shown on the enquiries page.
- `RateLimitHit` — `key`, `windowStart`, `count`, unique on (`key`, `windowStart`); used for DB-backed rate limiting.

## 4. Public catalogue

- Routes: `/aroma-chemicals` (list) and `/aroma-chemicals/[slug]` (detail). Server Components; state in URL search params (`q`, `category`, `sort`, `page`).
- Only `PUBLISHED` products are queried; a draft or archived slug returns 404 and is excluded from the sitemap.
- Search `q`: if it normalises to a valid CAS pattern (digits and hyphens), match `casNormalized`; otherwise trigram/ILIKE on `name` and `code`. CAS matches with or without hyphens.
- Sorting: name A–Z (default), name Z–A, newest. Page size 24. "Clear filters" resets to the bare route.
- Empty state while nothing is published: a clear "catalogue being prepared" message with the contact route. No placeholder or fake rows.
- Detail page renders only fields that exist (description, specifications, applications, documents). Documents are served through a route that checks the document belongs to a published product. `Product` JSON-LD, canonical URL, per-product metadata, breadcrumb.
- The homepage "Aroma Chemicals" links (`/#aroma-chemicals` anchors, "Explore aroma chemicals") switch to `/aroma-chemicals` when this slice ships; nav marks the route `available: true`.

## 5. RFQ

- **Enquiry list**: "Add to enquiry" on a product page and list rows. The list is stored in the browser as product IDs only (localStorage, wrapped in try/catch; works in private mode as in-memory). A header link shows the count and opens `/rfq`.
- **Form** at `/rfq`: fields per the brief (full name, company, business email, telephone, country, business segment, products with quantity and unit, intended application, additional requirements, attachments). Multiple product lines; each line is a catalogue product or free text. React Hook Form with a shared Zod schema validated again on the server.
- **Attachments**: PDF, PNG, JPG, DOCX, XLSX, CSV only; max 5 files, 10 MB each; extension and sniffed MIME must agree; filenames are sanitised and stored under random keys.
- **Abuse protection**: hidden honeypot field; per-IP-hash rate limit (default 5 submissions per hour) via `RateLimitHit`; a submission whose honeypot is filled returns success without storing.
- **Server action** creates `Enquiry`, items, attachments and the first `EnquiryActivity` in one transaction, then calls the email interface for (a) acknowledgement to the visitor and (b) internal notification to recipients from `SiteSetting`. Failure to send mail never fails the submission; it is logged and recorded in activity.
- **Confirmation page** shows the reference number and a summary. No admin-only data is exposed.
- **Consent**: required checkbox linking to `/privacy` (a short draft page, flagged for legal review in `docs/content-verification.md`).

## 6. Minimal admin

- Better Auth email and password at `/admin/login`; no sign-up route. The first `SUPER_ADMIN` is created by `npm run seed:admin` from `ADMIN_EMAIL` and `ADMIN_PASSWORD` env variables. Login attempts are rate limited. Session cookies are HTTP-only, secure in production.
- All `/admin/**` pages and every admin server action authorise on the server through one `requireRole()` helper; the layout check is not relied on. Admin routes send `noindex` and are excluded from the sitemap and robots allowance.
- Pages: `/admin/products` (status filter, search, publish/unpublish/archive with the §3 guard and a clear error), `/admin/enquiries` (list with status filter, search, pagination), `/admin/enquiries/[id]` (contact details, items, attachments via a permission-checked download route that logs access, status change that writes an activity row).
- Users who are not signed in get redirected; signed-in users without a permitted role get a 403 page.

## 7. Import, storage and email

- `npm run import:products -- <file.csv|json>`: validates each row with the product Zod schema, upserts by slug, and always creates rows as `DRAFT` with `verified=false`. Rows failing validation are reported and skipped. A checked-in `data/legacy-products.json` holds the 20 legacy rows with a `sourceNote`; the known CAS conflicts (methyl chloroacetate, the duplicate 1123-85-9 pair, Citronellyl Tiglate) are entered with CAS left empty and a note, not guessed.
- `StorageProvider` interface: `put(key, bytes, meta)`, `getReadStream(key)`, `delete(key)`. Local implementation writes under `./storage` (git-ignored, outside `public/`). Selected by `STORAGE_DRIVER`. R2 implementation is a later sub-project.
- `EmailProvider` interface: `send({to, subject, html, text})`. Development implementation writes to `./storage/outbox` and logs. Templates are React/HTML functions with plain-text alternates. Resend implementation is a later sub-project.
- `.env.example` gains placeholders only: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STORAGE_DRIVER`, `EMAIL_DRIVER`, `RATE_LIMIT_SALT`. None are `NEXT_PUBLIC_`.
- `docker-compose.yml` for Postgres; `README` documents setup, migrate, seed and import.

## 8. Testing and acceptance

- Unit: CAS checksum and normalisation; RFQ and product Zod schemas; search-query classification; publish guard; rate limiter; attachment validation (extension vs MIME).
- Integration (real Postgres from Docker, isolated test database): catalogue queries return only published products; CAS search with and without hyphens; RFQ creation with multiple items writes an activity row; an unauthorised admin action is rejected; storage keys never appear in public responses.
- End-to-end (Playwright, seeded test fixtures that are clearly fake and never in the production seed): visitor searches by CAS and opens a product; builds a two-product RFQ with an attachment and sees a reference; admin logs in; publishes a draft and it appears publicly; opens the enquiry and changes its status; a non-admin hits `/admin` and is refused; the honeypot and rate limit behave.
- The same responsive (no horizontal overflow at 375/768/1280/1536) and axe gates used for the homepage apply to list, detail, RFQ and login pages.
- Quality gates before done: lint, typecheck, unit, integration, e2e and production build pass.

## 9. Risks and assumptions

- Legacy product data is unverified and partly self-contradictory; nothing is published until the client confirms.
- Without a Resend account, mail does not leave the machine; the outbox proves content only.
- Local-disk storage does not suit a stateless host; R2 must be wired before production deployment.
- Rate limiting by IP hash depends on a trustworthy forwarded-IP header; deployment documentation must state the proxy configuration.
- Better Auth schema and API details are version-dependent; the plan must read the installed version's docs first, as must Next.js (see `AGENTS.md`).
- The privacy page is a draft and is not legal advice.
