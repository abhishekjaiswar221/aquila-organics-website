# Aquila Organics: Sub-project 3: Core Business Content Pages

Date: 2026-11-10 · Status: awaiting spec review · Builds on `2026-11-07-foundation-homepage-design.md` and `2026-11-08-data-catalogue-rfq-design.md` (both merged to `main`).

## 1. Purpose

Give the live site the rest of its core public pages so a business visitor can understand what Aquila offers in each segment and reach the right enquiry route: Fragrances, Flavours, About, Innovation, Sustainability (with Compliance and Certifications) and Contact. The content constraint is real: the existing website supplies one or two sentences per application and nothing verified for Innovation or Certifications. Pages are therefore built from templates that render only content that exists, and stay short rather than padded.

Success: every page in §3 renders from verified or brief-supplied content only, passes the responsive, accessibility and SEO gates at four widths, and the Contact forms create correctly typed enquiries through the existing pipeline. No unverified claim appears anywhere.

## 2. Decisions already made

- Scope: core business pages only. **Blog (Resources) and Careers move to the full-admin sub-project**, where editing screens exist.
- Content lives in **typed code modules** with a verification status per block (as on the homepage); the move to database-backed content happens in the full-admin sub-project.
- Contact forms **reuse the enquiry system** (types FRAGRANCES, FLAVOURS, AROMA_CHEMICALS, GENERAL).
- Images stay labelled placeholders until the client confirms ownership of the old site's photos or approves licensed stock. The old site's incense and bakhoor photos and the Hattali portrait are not imported yet.
- Commit messages carry no attribution trailer. No schema migration is required by this sub-project unless §6 finds a need.

## 3. Pages and routes

| Route | Template | Source content |
|---|---|---|
| `/fragrances` | SegmentPage | Fragrance overview text from the live site; the six application names and one-liners |
| `/fragrances/{fine-fragrance, personal-care, air-care, fabric-care, home-care, incense-and-bakhoor}` | ApplicationPage | One-liner per application from the live site; Incense and Bakhoor also carries the Oud, Bakhoor and Arabic-notes statement (brief-supplied, flagged) and the five incense sub-types named on the live site |
| `/flavours` | SegmentPage | Flavour overview text from the live site; five applications; shisha and mouth fresheners line (needs-client-confirmation) |
| `/flavours/{confectionery, bakery, beverages, dairy, savoury}` | ApplicationPage | One-liner per application from the live site |
| `/about` | ContentPage | Company introduction (brief-supplied), Girish Vaze bio, the two production areas, the three business segments, global reach regions (India, Middle East, Africa, APAC) |
| `/innovation` | ContentPage | Only what is verified: the 14 listed chemistries and process expertise, own laboratory and manufacturing wording from the brief. Everything else (R&D headcount, capacities, equipment) is absent until supplied |
| `/sustainability` | ContentPage | Zero liquid waste policy, Mumbai Waste Management membership, CSR items (from the live site) |
| `/sustainability/compliance` | ContentPage | Honest status page: explains which regulatory documents exist as files on the old site and that issuer, scope and validity are awaiting confirmation. No claim of compliance with any named regulation |
| `/sustainability/certifications` | CertificationsPage | Data-driven list (title, issuer, issue date, expiry date, scope, document link). Renders ONLY entries the client has confirmed; entries past their expiry are shown as expired or omitted, never as active. With no confirmed entries it shows a plain "certificates being compiled" message |
| `/contact` | ContactPage | Verified details only (§5) |

Application slugs are fixed in code (`src/content/segments.ts`), validated at the route level (unknown slug returns a real 404 through the existing proxy approach or `notFound()`, as proven on the catalogue).

## 4. Templates and content model

- `SegmentPage`: hero, intro paragraph, grid of application tiles (each links to its page), related CTA.
- `ApplicationPage`: hero with a labelled placeholder image, intro (verified one-liner), optional sections that render only when their data exists (`whatWeProvide`, `typicalProducts`, `specialExpertise`, `relatedApplications`), consultation CTA. Visual treatment follows the domain: editorial for fragrances, warm for flavours.
- `ContentPage`: eyebrow, title, lead, ordered blocks (paragraphs, definition lists, simple tables), optional aside.
- Content modules live in `src/content/` (`segments.ts`, `about.ts`, `innovation.ts`, `sustainability.ts`, `certifications.ts`, `contact.ts`), reusing `Block<T>`, `ContentStatus` and `visibleBlocks`. The existing banned-claims unit guard (no "16+", "since 2010/2012", "N years", etc.) covers every file in `src/content/`, and is extended with the superlatives the register flags (`best agarbatti`, `largest manufacturer`, `state-of-the-art`).
- A `needs-client-confirmation` block renders but is listed by a build-time report script (`npm run content:report`) so open items are visible.
- No fake counters, customer names, capacities, certifications or awards. Hidden blocks never render.

## 5. Contact page and enquiry forms

- Verified details only: head office (Navi Mumbai) and registered office (Thane), the two phone numbers, `info@`, `sales@`, `fragrances@`, `flavors@` (as spelled on the live site), `hr@`, hours Monday to Saturday 09:00 to 17:00. Named individuals (Shalin Kale, Sunil Patil) stay hidden until consent is confirmed. No map (coordinates unconfirmed).
- Four forms, one per business segment (Fragrances, Flavours, Aroma Chemicals, General), reachable as tabs or anchored sections and via `/contact?type=<segment>&application=<slug>` (both validated against the fixed lists; unknown values ignored).
- Each form reuses the RFQ pipeline: React Hook Form + Zod, server action, honeypot, per-IP and per-recipient limits, `submissionId` idempotency, attachments through `validateAttachment`, acknowledgement email minimised as today. Fields: name, company, business email, telephone, country, application (pre-selected from the query), message, optional attachments, consent to `/privacy`. The Aroma Chemicals form may include product lines as the RFQ does; the others are message-based.
- The server action sets the enquiry `type` from the form; the segment is never trusted from free client input beyond the enum. The enquiry appears in the existing admin list with its type.
- Notification recipients remain `SiteSetting` driven per enquiry type and empty by default; the admin keeps showing the missing-recipient warning.
- Application pages carry a "Request a consultation" link to `/contact?type=...&application=...`.

## 6. Navigation, redirects and SEO

- `src/content/site.ts`: mark the new routes `available: true`; the header mega menu and the mobile drawer link to real pages (Fragrances and Flavours items link to the application pages); the footer gains Contact, About and Sustainability links.
- Old-URL redirects (single 301 each, no chains) for the pages that now exist: `/fragrance` to `/fragrances`, `/flavors` to `/flavours`, `/fine-fragrances`, `/personal-care`, `/air-care`, `/fabric-care`, `/home-care`, `/incense-and-bakhoor` to their new paths, `/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` likewise, `/about/our-company` to `/about`, `/about/sustainability` to `/sustainability`, `/about/certifications` to `/sustainability/compliance`, `/about/certification` to `/sustainability/certifications`, `/contactus` to `/contact`, plus the `/index.php/...` duplicates of those. Implemented in `next.config.ts` `redirects()` from one table (`src/content/redirects.ts`) with a unit test that no source equals its target and no target is itself a source (no chains). The wider migration document and any remaining legacy URLs stay in the launch sub-project; `docs/url-migration.md` is created here for the rows delivered.
- Per-page `generateMetadata` (title, description, canonical), `BreadcrumbList` JSON-LD on every non-home page, `Organization` JSON-LD on `/about`; sitemap additions for every page above (certifications and compliance included).
- Hidden or empty pages are never indexed: `/sustainability/certifications` is indexable only when it lists at least one confirmed certificate; otherwise `noindex`.

## 7. Testing and acceptance

- Unit: content-module guard (banned claims, statuses), `visibleBlocks` use in every template, redirect table (no chains, no self-redirects, all sources unique), application-slug validators, certifications expiry logic (expired is never shown as active; boundary on the expiry date), contact query-param validation, JSON-LD builders.
- Integration: the contact action creates an enquiry of the correct type for each segment, with the application recorded; rate limits and idempotency inherited (smoke test); recipients empty -> `notification.skipped` as today.
- E2E at all four widths: every route renders with one `h1`, no skipped headings, no horizontal overflow, axe clean; application pages for all 11 slugs; unknown slug 404; each old URL answers one 301 to the right target (maxRedirects 0) and the target answers 200; each Contact form submits and the enquiry appears in the database with the right type; certifications page with no confirmed entries is `noindex` and shows the pending message; `/sitemap.xml` lists the new pages; no text matching the banned claims appears on any page; nav and drawer links resolve (no dead links).
- Quality gates before done: lint, typecheck, unit, integration, e2e and a production build pass; e2e and `test:int` are not run at the same time (shared `aquila_test`).

## 8. Out of scope

Resources/blog, Careers, product editing, page-content editing in the admin, a map, real photography, newsletter, any customer-facing data not on the live site or in the brief, Resend/R2 integration, the email-sends parallelisation and CI database lock (tracked as pre-conditions elsewhere).

## 9. Risks and assumptions

- Pages will be short; this is intentional and documented. A client content pass is the real unlock (capabilities, laboratory description, application detail, photography).
- The "Oud, Bakhoor and Arabic notes" statement is brief-supplied and not on the live site; it stays flagged until approved.
- `flavors@` is spelled as on the live site; the client must confirm the mailbox spelling before it is displayed or used as a recipient.
- HQ (Thane vs Navi Mumbai) remains unresolved; the Contact page shows both labelled as registered office and head office.
- Redirect targets assume the new slugs in §3; any later slug change requires updating the table and its test.
- Next.js 16 specifics (proxy vs redirects, `cacheComponents`, `instant = false` pages) must be read from the installed docs per `AGENTS.md`.
