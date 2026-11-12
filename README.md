# Aquila Organics Website

B2B website for Aquila Organics Private Limited, a manufacturer of fragrances, aroma chemicals and flavours. *Where Science Meets Senses.*

## Status

Built so far:

- **Sub-project 1:** foundation, design system and homepage.
- **Sub-project 2 (data layer, catalogue and RFQ):**
  - PostgreSQL schema and migrations (`docs/database-design.md`).
  - The aroma chemicals catalogue (`/aroma-chemicals`): search by name, product code or CAS number, category filter, sorting, pagination, product pages and document downloads.
  - A multi-product request for quotation (`/rfq`) with attachments, a confirmation page and a draft privacy notice (`/privacy`).
  - A minimal admin (`/admin`) for publishing products and handling enquiries.
- **Sub-project 4 (full admin):** product create and edit (with re-verification), categories and the imported-products review filter, product documents, notification recipients, user management with forced password change, and a database audit log. See "Admin" below.
  - `sitemap.xml` and `robots.txt`.
- **Sub-project 3 (core business content pages):**
  - Fragrances and Flavours: two overviews and eleven application pages (`/fragrances/...`, `/flavours/...`).
  - About, Innovation, Sustainability, Legal and regulatory compliance and Certifications, built only from verified or brief-supplied content. The certifications page lists confirmed certificates only (none yet) and is `noindex` until one exists.
  - A Contact page (`/contact`) with verified details and four message forms (fragrances, flavours, aroma chemicals, general). Each creates an enquiry of the matching type with no product lines, through the same pipeline as the quotation request: honeypot, per-IP and per-address rate limits, duplicate-submission protection, attachments, minimal acknowledgement email. `?type=` and `?application=` preselect a form.
  - Navigation, footer and homepage links point at the real pages. Old-site URLs for these pages redirect once each (`docs/url-migration.md`).
  - Page copy sits in typed modules under `src/content/`; `npm run content:report` lists every block still awaiting client confirmation.

Not built yet:

- **Admin extras.** Not built: invitation emails (a super admin hands over a one-time password), a content CMS for page copy, deleting products or users, and audit-log retention or export.
- **Storage and email.** Both use local development drivers only (`STORAGE_DRIVER=local`, `EMAIL_DRIVER=dev`):
  - Uploaded files go to `./storage/uploads`.
  - "Sent" emails are written as JSON files to `./storage/outbox`, and nothing leaves the machine.
  - A Cloudflare R2 storage driver exists (`STORAGE_DRIVER=r2` with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`, all required only for that driver; the server refuses to start without them). **It has only been tested against a mocked client and has not been exercised against a live R2 account.** Verify upload, download and delete against a real bucket before relying on it.
  - There is no Resend integration yet. Do not enable a real email provider before reading "Email abuse limits" below.
- **Content.** No product is published: the 20 legacy products import as unverified drafts. The privacy notice needs legal review. See `docs/content-verification.md` for the full list.

Careers, the resources blog and the full admin and content management are later sub-projects (see `docs/sitemap.md`). Until the careers pages exist, the old `/careers` URL answers 404 (`docs/url-migration.md`).

## Stack

Next.js 16 (App Router, `cacheComponents`), TypeScript, Tailwind CSS 4, shadcn/ui, Lucide and `motion`, with PostgreSQL 16 through Prisma 7, Better Auth (email and password), Zod and React Hook Form. Tests use Vitest, Playwright and axe.

> This Next.js version has breaking changes from older releases. Read the relevant guide in `node_modules/next/dist/docs/` before changing routing, proxy, caching or metadata code (see `AGENTS.md`).

## Developer setup

### Prerequisites

- Node.js 20.9 or later (the minimum for Next.js 16), and npm.
- Docker Desktop (or another Docker engine with Compose), for PostgreSQL.
- Chromium for Playwright, installed once with `npx playwright install chromium`.

### 1. Install

```bash
npm install          # also runs `prisma generate` (postinstall)
```

### 2. Start PostgreSQL

```bash
npm run db:up        # docker compose up -d --wait
```

This starts the container `aquila-postgres` on port 5432. On first start it creates two databases: `aquila` for development and `aquila_test` for the integration and e2e suites. The credentials in `docker-compose.yml` are local development placeholders.

### 3. Environment

```bash
cp .env.example .env
```

The Prisma CLI, the scripts and the test configs read `.env`. Next.js reads it as well. `.env.example` holds placeholders only. Never commit `.env`. `npm run build` needs the server variables below (`BETTER_AUTH_*`, `STORAGE_DRIVER`, `EMAIL_DRIVER`, `RATE_LIMIT_SALT`, `DATABASE_URL`) because it prerenders pages that read them.

| Variables | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public base URL for canonical links, JSON-LD, the sitemap and robots.txt. It is inlined at build time, so rebuild after changing it. If it is unset in production, the site falls back to `http://localhost:3000` and logs one warning per process (`next start` once; `next build` once per build worker). The build does not fail, so set it for every production build |
| `DATABASE_URL`, `DATABASE_URL_TEST` | Development and test databases. The test URL must name a different database (the e2e suite also requires a name ending in `_test`) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Session signing secret (at least 32 random characters, e.g. `openssl rand -base64 32`) and the site's own URL |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_ROOT` | `local` (default root `./storage/uploads`, optional) or `r2`. With `r2`, also set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (not yet tested against a live account) |
| `EMAIL_DRIVER` | `dev` is the only driver |
| `RATE_LIMIT_SALT` | Salt for the hashed IP and email keys used by the rate limits |
| `AUTH_IP_HEADER`, `AUTH_TRUSTED_PROXIES` | Optional. How the client IP is read behind a proxy (see "Deployment" below) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Optional. Used only by `npm run seed:admin` |
| `E2E_PORT` | Optional. Port for the e2e server (integer 1-65535, default 3100). Read from the shell environment first, then `.env`; the shell wins (see "Running the tests") |

`NEXT_PUBLIC_SITE_URL` is the only `NEXT_PUBLIC_` variable and holds no secret. Everything else is server-only (`src/lib/env.ts`) and must never be renamed to `NEXT_PUBLIC_`.

### 4. Migrations

```bash
npx prisma migrate deploy
```

This applies every migration in `prisma/migrations/` to the development database. To create a new migration, use `npx prisma migrate dev --create-only --name <change>`, review the SQL, then run `migrate deploy`. Plain `migrate dev` (`npm run db:migrate`) can hang in a non-interactive shell. The test database is migrated automatically by the test suites. Details: `docs/database-design.md`, "Migration workflow".

### 5. First admin

```bash
npm run seed:admin
```

This creates the first `SUPER_ADMIN` from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, read from the environment or `.env`. The password must be at least 12 characters. The script is idempotent: an existing user with that email is promoted to `SUPER_ADMIN` and keeps their password. Add `-- --reset-password` to change the password, which also signs out their sessions. There is no public sign-up; further users are added by a super admin in `/admin/users` (see "User onboarding").

### 6. Legacy products

```bash
npm run import:products -- data/legacy-products.json
```

This imports the 20 products from the old site, every one as `DRAFT` and `verified = false`, with a `sourceNote`. Re-running is safe:

- Rows are matched by slug.
- Existing products keep their status and verified flag.
- Verified products are skipped and never overwritten.
- A blank CAS never clears a stored one.

The four rows with conflicting or malformed CAS numbers are imported with CAS left empty and a note: Methyl Chloroacetate (MMCA), Hydratropic Alcohol, Iso Bornyl Propionate and Citronellyl Tiglate. Nothing appears on the public site until a `SUPER_ADMIN` marks a product verified and an admin publishes it. The script also accepts a CSV file (header `name,slug,code,casNumber,category,description,sourceNote`).

### 7. Run

```bash
npm run dev          # http://localhost:3000
```

### Admin sign-in

1. Open `/admin`. Signed out, you are redirected to `/admin/login?next=...`.
2. Sign in with the seeded account. You return to the page you asked for, or to `/admin/products` by default.
3. Sign out from the admin header.

Four roles may use the admin (below). Any other role gets a 403 page. Sign-in is limited to 5 attempts per minute per client IP. Every page, action and download checks the session and role on the server (`requireAction()` in `src/lib/permissions.ts`). The proxy's redirect of signed-out requests is only a convenience. A disabled user cannot sign in and an existing session stops working at once; a user holding a one-time password can reach only the change-password page and sign-out.

### Roles

`can(role, action)` in `src/lib/access.ts` is the single permission table; the navigation shows only what a role may open.

| Action | Super admin | Administrator | Sales manager | Content editor | HR manager |
|---|---|---|---|---|---|
| Enquiries: view and update | yes | no | yes | no | no |
| Products and categories: create and edit | yes | yes | yes | yes | no |
| Products: publish, unpublish, archive | yes | yes | yes | no | no |
| Products: mark verified | yes | no | no | no | no |
| Product documents: upload and delete | yes | yes | no | yes | no |
| Settings (notification recipients) | yes | yes | no | no | no |
| Users | yes | no | no | no | no |
| Audit log | yes | no | no | no | no |
| Careers: job openings, applications, CV download | yes | no | no | no | yes |

`SALES_EXECUTIVE` exists in the schema but has no admin access. An HR manager signs in to `/admin/applications` (the bare `/admin` page sends each role to its own first page) and sees only Jobs and Applications in the navigation; every other admin page answers 403. Editing a published product's public fields (anything but the internal source note) unpublishes it and clears its verified flag in the same transaction, so a super admin must verify it again before it can go live. Two people editing the same product: the second save is refused ("This product was changed by someone else").

### User onboarding

A super admin opens `/admin/users`, enters a name, email and role, and presses Create user. The page then shows a generated one-time password (20 characters, from a CSPRNG) **once**: "Shown once. Copy it now." It lives only in that page's state and is never stored, logged or audited. Hand it to the person over a secure channel. At first sign-in they are sent to `/admin/change-password` and cannot open anything else until they choose their own password (at least 12 characters); their other sessions are signed out. "Reset password" issues a new one-time password and signs the user out everywhere. "Disable" signs a user out immediately and blocks sign-in until they are enabled again. Refused: disabling or demoting yourself, and removing the last active super admin.

### Audit log

Every admin change (product create, update, status, verification and re-verification; categories; documents; recipients; user changes; enquiry status) writes a row to `audit_log` inside the same transaction as the change, so a failed audit write rolls the change back. Rows hold the actor, role, action, entity type and id, outcome (`ok`, `denied`, `rejected`), changed field names and a few ids or counts. They never hold passwords, email addresses, names or free text. A super admin reads it at `/admin/audit` (filter by action, entity type and date; 50 rows per page; times are UTC). Not covered: changing your own password (`changeOwnPassword` is not audited), and rows are never pruned.

### Careers

Public pages: `/careers` (published openings, or an empty state with a general-application link), `/careers/<slug>`, `/careers/apply` (`?job=<slug>` preselects a currently published opening; anything else is a general application) and `/careers/apply/confirmation` (shows the reference only). Apply and confirmation are `noindex`; `/careers` and published openings are in the sitemap.

**Roles.** Only the HR manager and the super admin can open Jobs and Applications, download CVs or delete applications. Administrator, sales manager and content editor get a 403 page (and an empty 403 from the CV route); signed-out requests get the login redirect (401 from the CV route). Create an HR user at `/admin/users` (role "HR manager"); they must change the one-time password at first sign-in.

**Publishing an opening.** In `/admin/jobs` choose New opening, fill title, location, summary and description (plain text; a blank line starts a paragraph) and save: it is a draft and is not public. Press Publish on the list to put it on the site at once; Close (or its closing date passing) removes it again and its URL answers a real 404. Only a draft with no applications can be deleted. No job content is invented by the site: only what HR enters appears.

**Applications.** A candidate sends name, email, optional telephone, country and message, and one CV (PDF or DOCX, up to 10 MB, content checked). HR reviews them at `/admin/applications` (filter by status or opening), changes the status (New, Reviewing, Shortlisted, Interview, Offered, Hired, Rejected) and downloads the CV from the detail page (every download is audited). Candidate data never goes into the audit log, logs or the acknowledgement email. Notification recipients for new applications are the "Careers applications" row in Settings.

**Deleting an application** is a two-step action on its detail page ("Delete application", then "Yes, delete application and CV"). It removes the application, its file rows and the stored CV, and writes one audit row (ids and a file count only). It cannot be undone. There is no automatic purge.

**Retention** of applications is to be confirmed by Aquila; the form and the privacy notice say so. Live email delivery and the Cloudflare R2 driver are untested against real services for careers (as for the other forms).

### Storage and Cloudflare R2

Uploaded product documents and enquiry attachments go through one storage interface. `STORAGE_DRIVER=local` (default) writes to `./storage/uploads`. For Cloudflare R2 set `STORAGE_DRIVER=r2` plus `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`; the server refuses to start if any is missing. Create a private bucket (no public access, files are served through the app) and an API token limited to that bucket with object read and write. **The R2 driver is untested against a live account.** It is covered only by unit tests with a mocked S3 client. Before relying on it, upload, download and delete a document against a real bucket (a staging bucket first). Existing local files are not migrated when the driver changes.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm test` | Unit tests (Vitest, jsdom). No database needed |
| `npm run test:int` | Integration tests (Vitest, Node) against `aquila_test`. Runs `prisma migrate deploy` on it first, and truncates its tables |
| `npm run test:e2e` | Playwright at 375, 768, 1280 and 1536px, plus a `catalogue-write` project. Builds the app and serves it on port 3100 against `aquila_test` |
| `npm run db:up` | Starts the Docker PostgreSQL container |
| `npm run db:migrate` / `db:reset` / `db:generate` | `prisma migrate dev` (interactive), `prisma migrate reset --force` (wipes the **development** database), `prisma generate` |
| `npm run seed:admin` | Creates the first `SUPER_ADMIN` (see above) |
| `npm run import:products -- <file>` | Imports products as unverified drafts (see above) |
| `npm run content:report` | Lists every content block still awaiting client confirmation or taken from the brief only |

### Running the tests

Order used for a full check: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:int`, `npm run test:e2e`.

**Never run `npm run test:int` and `npm run test:e2e` at the same time.** Both use the `aquila_test` database, and each truncates and reseeds it. Running them together corrupts both runs. Neither suite ever touches `aquila`: both refuse to start unless `DATABASE_URL_TEST` points at a separate database.

About the e2e suite:

- **Seeding.** The global setup (`tests/e2e/support/global-setup.ts`) migrates and reseeds `aquila_test` with the fake fixtures in `tests/e2e/support/fixtures.ts`. Every fixture is prefixed `TEST-`: products, categories, admin accounts with test-only passwords, and document files under `./storage/e2e/uploads`. Tests that need their own enquiries or drafts create and delete them through `tests/e2e/support/admin.ts` and `rfq-db.ts`.
- **Port.** It always builds and starts its own server (`npm run build && npm run start -- -p 3100`) and never reuses a running one. Port 3100 must be free. If another project's server holds it, do not stop that server and do not change the default in the repo. Choose another port instead: for one run, `E2E_PORT=3110 npm run test:e2e` (PowerShell: `$env:E2E_PORT=3110; npm run test:e2e`); to keep it, set `E2E_PORT=3110` in `.env`. A value in the shell environment beats the one in `.env`.
- **The build it leaves behind.** The run rebuilds `.next` with `NEXT_PUBLIC_SITE_URL=http://localhost:<port>` and the test database settings baked in. After an e2e run, run `npm run build` again before using `npm run start` for anything else.
- **Write tests.** Tests tagged `@catalogue-write` publish products, which changes catalogue counts. They run once, in the `catalogue-write` project, after all four width projects have finished.

## Deployment: reverse proxy and client IP

The admin sign-in endpoint allows 5 attempts per minute for each client IP. That IP is read from `x-forwarded-for`, or from the header named in `AUTH_IP_HEADER`, such as `cf-connecting-ip`. If neither `AUTH_IP_HEADER` nor `AUTH_TRUSTED_PROXIES` is set, the header is trusted only when it holds exactly one address. Your proxy must therefore **overwrite** that header with the real client IP, not append to it. If your proxy appends instead, list its addresses or CIDRs in `AUTH_TRUSTED_PROXIES` (comma-separated).

The risks of getting this wrong:

- If the app can be reached without going through such a proxy, a client can send a different fake header on every request and guess passwords without limit.
- If an appending proxy is not listed, every client whose header holds several addresses shares one bucket. About five requests a minute can then lock every admin out.

The limiter stores its counts in memory in each server process. That is fine for a single instance. Running several instances needs a shared store.

The RFQ form (`/rfq`) has its own limiter, using the same header rules:

- **Storage.** Counts live in the database (`RateLimitHit`), so they are shared by every instance. The key is a salted hash of the IP (`RATE_LIMIT_SALT`), never the raw address.
- **Per-visitor limit.** 5 submissions per hour for each client IP that can be resolved.
- **Shared fallback.** When no trustworthy IP can be resolved, every such request shares one bucket of 100 submissions per hour. The causes:
  - no proxy sets the header;
  - the header holds several addresses and no `AUTH_TRUSTED_PROXIES` are listed;
  - an appending proxy is not listed.

  One busy source can then use up the bucket for everyone, so configure the header. In production, the server logs one warning per process when this happens and neither `AUTH_IP_HEADER` nor `AUTH_TRUSTED_PROXIES` is set.
- **What counts.** Submissions with invalid fields do not count, and neither do honeypot hits or replays of an already-stored submission (same `submissionId`).
- **Not pruned yet.** Old `RateLimitHit` rows are not cleaned up. Delete rows with an old `windowStart` periodically until a cleanup job exists.

Also set `NEXT_PUBLIC_SITE_URL` (and `BETTER_AUTH_URL`) to the public origin before building for production (see "Environment").

### Email abuse limits

The RFQ acknowledgement email goes to whatever address the visitor types, so with a real email provider the form could otherwise be used to send mail to a third party. Two safeguards:

- **Per-recipient cap.** At most `RFQ_ACK_LIMIT` (3) acknowledgements per address per `RFQ_ACK_WINDOW_MS` (24 hours; a fixed window aligned to UTC midnight), in `src/features/enquiries/submit.ts`. The count is kept in `RateLimitHit` under `rfq-ack:<salted SHA-256 of the normalised address>` (salt: `RATE_LIMIT_SALT`), never the raw or normalised address. Normalising (`src/lib/email-normalise.ts`) trims, lowercases and strips a `+tag` for every domain, and for Gmail also removes dots and treats `googlemail.com` as `gmail.com`, so variants of one inbox share one quota. The email itself is always sent to the address exactly as typed. This cap is independent of the per-IP submission limit. Over the cap, the enquiry is still stored and the internal notification still goes to sales; only the acknowledgement is skipped, and an `email.skipped` activity (`{ reason: "recipient limit" }`) is recorded. A failed send uses one unit, like a successful one. Replays and honeypot hits use none. The trade-off is that anyone can use up an address's 3 acknowledgements for the day by submitting enquiries with it, so the real owner may then get no acknowledgement; their enquiry is still stored and sales are still notified.
- **Minimal content.** The acknowledgement contains only a constant greeting ("Dear customer,"), the reference and the number of product lines. It carries nothing the visitor typed, not even their name, so it cannot carry someone else's text to a victim. The internal notification keeps the full details.

## Layout

```
src/app/(public)/      public routes: homepage, catalogue, RFQ, privacy, fragrances, flavours, about, innovation, sustainability, contact
src/app/admin/         admin login and panel (products, enquiries)
src/app/api/           Better Auth endpoint, admin attachment downloads
src/proxy.ts           product and application 404s, and the signed-out admin redirect
src/components/        ui/, layout/, marketing/, pages/ (templates), motion/, catalogue/, forms/, admin/
src/content/           typed page copy with verification status
src/features/          products, enquiries and admin: queries, actions, validation
src/lib/               auth, permissions, db, env, storage, email, rate limits, SEO helpers
prisma/                schema and migrations
scripts/               seed-admin, import-products
data/                  legacy product data (imported as drafts)
tests/unit, tests/integration, tests/e2e
docs/                  research, verification, design system, database, sitemap, assets, specs, plans
```

## Content integrity

Page copy lives in `src/content/`. Every block carries a status (`verified`, `brief-supplied`, `needs-client-confirmation`, `hidden`), and hidden blocks never render. Do not add product names, CAS numbers, certifications, capacities, statistics or founding/age claims unless the client has confirmed them; `docs/content-verification.md` lists what is still open. Products reach the public catalogue only when they are verified and published; the database enforces this (`docs/database-design.md`).

## Documentation

- `docs/company-research.md`, `docs/content-verification.md`
- `docs/design-system.md`, `docs/sitemap.md`, `docs/url-migration.md`, `docs/asset-inventory.md`
- `docs/database-design.md`
- `docs/superpowers/specs/` and `docs/superpowers/plans/`
- `docs/screenshots/` review captures (homepage at four widths; catalogue, RFQ and admin at 375 and 1280)
