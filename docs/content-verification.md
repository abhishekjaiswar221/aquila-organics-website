# Content Verification Register

Status key: ✅ verified on live site · 📄 supplied in brief only · ⚠️ conflict · ❓ missing · 🛑 do not publish yet

## A. Conflicts

| # | Topic | Source A | Source B | Action |
|---|---|---|---|---|
| 1 | Company age | Brief: "16+ years", LinkedIn founded 2012 | Homepage "since 2012"; About "10 years"; About ties founder's venture to 2010 | Keep three separate concepts: *company incorporated*, *founder's venture began*, *industry experience*. Ask client. Until then avoid any "since" / "X years" claim |
| 2 | Headquarters | Brief/LinkedIn: Thane | Contact page: head office Navi Mumbai (Rabale); Thane is registered office | Ask which is HQ. Show both as "Registered office" and "Head office" |
| 3 | Employee count | LinkedIn 51–200 | Site: none; brief warns not to use "96 associated members" | Don't publish a number until client confirms |
| 4 | Sales mailbox | `sales@` shown for fragrance enquiries on homepage | Contact page: `sales@` is aroma chemicals; `fragrances@`, `flavors@` exist | Use contact-page mapping, confirm routing |
| 5 | MMCA CAS | Product table: 122-78-1 / 60-12-8 | Product page: 96-34-4 (correct CAS for methyl chloroacetate) | 🛑 Verify SDS before publishing |
| 6 | MMCA identity | Title "Methyl Chloroacetate" | Page text/image alt say "Ethyl chloroacetate" | 🛑 Fix at source |
| 7 | Duplicate CAS | Iso Bornyl Propionate and Hydratropic Alcohol both shown with 1123-85-9 (per fetch) | Hydratropic alcohol is normally a different CAS | 🛑 Check raw page and datasheets |
| 8 | Citronellyl Tiglate CAS | Shown "2563 07 7" (malformed) | | 🛑 Confirm from datasheet |
| 9 | Oudh/Bakhoor/Arabic notes | Brief: key differentiator | Live site: Bakhoor mentioned only as incense type | 📄 Use brief text; ask client for supporting detail/approval |
| 10 | "Toll manufacturing" | Brief: "if confirmed" | Live aroma-chemicals page lists "Contract Research / Toll Manufacturing" | Treat as site-claimed; confirm |
| 11 | Leadership | Brief names only Girish Vaze | Site also lists Gurudeo Hattali, Executive Director | Ask client to confirm whether to show |

## B. Certifications

| Document | Scope/issuer on page | Validity (from filename) | Status |
|---|---|---|---|
| Star-K Kosher | not stated | 08/31/2026 | 🛑 **Expired as of 2026-11-07** unless renewed. Do not show as active |
| Halal India HIP29840120 (+ add-on) | not stated | 2026–27 | Likely active; confirm dates/scope |
| US FDA certificate | not stated | unclear | ❓ Need issue/expiry |
| ISO certificates | not stated which standards | unclear | ❓ Need standard, body, expiry |
| EC certificate | not stated | unclear | ❓ Need explanation |
| Compliance reports (two six-month PDFs) | not stated | Apr 2025–Mar 2026 | ❓ Second period ended 2026-03; ask for the latest |
| EcoVadis | logo only | none | 🛑 No rating, medal or year shown; don't display a badge without proof |

No certificate data model, page or badge exists yet: the homepage certifications strip is `hidden` (`src/content/home-business.ts`) and sub-project 2 added none. When certificates are built (sustainability/certifications sub-project), the model should carry `issuer`, `issuedAt`, `expiresAt` and `scope`, and the UI should hide anything past expiry automatically.

## C. Verified facts (existing site)

✅ Company name; segments and category lists; head-office and registered-office addresses; the two phone numbers and emails; Mon–Sat 09:00–17:00 hours; Girish Vaze and Gurudeo Hattali bios; Zero Liquid Waste, Mumbai Waste Management membership and CSR activities; chemistries list; 20 product rows with datasheets (subject to B-section CAS fixes).

## D. Supplied in brief only (usable, not on the site)

📄 Thane HQ, LinkedIn 2012 / 51–200, markets India/Middle East/Africa/APAC, "16+ years", expertise in Oudhs/Bakhoors/Arabic notes, "state-of-the-art laboratory", customised fragrances for fine fragrance, personal care, cosmetics, air/fabric/home care. "Cosmetics" is not an existing site category.

## E. Claims needing approval before publishing

"One of the largest manufacturers … in India" (superlative); "best agarbatti perfume company in India" (superlative; drop); "state-of-the-art laboratory"; "over 100 man-years"; export presence in named regions; "path-breaking products and technologies"; EcoVadis; Halal/Kosher/FDA marks.

## F. Missing

Capacities, lab description, customers, export volumes, awards, certificate details, product catalogue beyond 20 rows, a reviewed privacy policy (only a draft exists, see H1), photography, staff-name consent, employee count, social profile URLs.

## G. Images/documents

Replace: all placeholder category images, "Demo Site" logo alt, Joomla placeholders. Keep subject to client confirmation: logos, Hattali photo, five incense/bakhoor photos, 17 datasheets, MMCA SDS, certificate files. Stock imagery is never to be presented as Aquila facilities.

## H. Sub-project 2: catalogue and RFQ

| # | Item | Status | Action |
|---|---|---|---|
| 1 | Privacy notice (`/privacy`) | 🛑 Draft, not legal advice | Legal review before launch. It describes only what the site does today (RFQ fields, IP-derived hash for rate limiting, a salted one-way hash of the (normalised) email address used only as the key that caps acknowledgement emails per address, user agent, local-storage enquiry list, admin session cookie, hosting and email providers as processors). Retention is stated as "to be confirmed by Aquila"; no named law or certification is claimed. The careers section now lists what a job application collects (name, email, optional phone, country and message, the CV, the opening applied for, consent time, user agent, IP-derived hash), who sees it (HR team and super admins), the storage and email processors, retention "to be confirmed by Aquila" (applications are kept until HR deletes them; no automatic purge) and deletion on request. Requests go to `info@` until the client names a privacy contact |
| 2 | RFQ internal notification recipients | ❓ Client input needed | `SiteSetting` keys `notification.recipients.<FRAGRANCES\|AROMA_CHEMICALS\|FLAVOURS\|GENERAL>` (a JSON array of addresses) are empty by default, so internal emails are skipped, a `notification.skipped` activity is recorded and the admin enquiry list shows a warning. Ask which mailboxes receive each enquiry type (see A4 for the current mailbox mapping). There is no settings screen yet: the values are set directly in the database |
| 3 | Legacy products (`data/legacy-products.json`) | 🛑 Drafts only | All 20 rows import as `DRAFT`, `verified=false`, with a `sourceNote` on each row (`npm run import:products -- data/legacy-products.json`). The four rows with CAS conflicts (A5–A8: Methyl Chloroacetate (MMCA), the duplicate 1123-85-9 pair Iso Bornyl Propionate and Hydratropic Alcohol, Citronellyl Tiglate) are entered with CAS left empty and a note, never guessed. Datasheets and the MMCA SDS are not imported (no `ProductDocument` rows yet). Nothing is public until a `SUPER_ADMIN` marks a product verified (after the client confirms it against its datasheet/SDS, spec §7) and an admin publishes it; the database refuses to publish an unverified product |
| 4 | RFQ confirmation copy | 📄 Neutral wording | Says only that a member of the team will review and respond, and that "you will normally receive an acknowledgement by email" if an email address was provided ("normally" because the per-address cap in H5 can skip it). It shows the reference and next steps only, no summary of the request. No response time is promised; add one only if the client confirms it |
| 5 | RFQ acknowledgement email content | 📄 Deliberately minimised | The acknowledgement goes to whatever address was typed, so it carries only a constant greeting ("Dear customer,"), the reference, the number of product lines and a generic next-steps sentence: no visitor name, item names, line notes, company or requirements (the internal notification to sales keeps the full details). At most 3 per address per day (README "Email abuse limits"). Any wording change must keep it free of visitor-typed text |
| 6 | Certificates and EcoVadis | 🛑 Still hidden | Sub-project 2 adds no certificate, badge or EcoVadis content anywhere (catalogue, product pages, RFQ, emails). Section B still applies |
| 7 | Product data shown publicly | 📄 Only what is stored | Product pages show only the fields a product actually has (name, code, CAS, category, description, specifications, applications, documents). The JSON-LD carries no prices or offers. `sourceNote` is internal and never rendered |

## I. Sub-project 3: business content pages

Run `npm run content:report` to list the blocks below from the code (it prints every block still marked `needs-client-confirmation` or `brief-supplied`).

| # | Item | Status | Action |
|---|---|---|---|
| 1 | Oud, Bakhoor and Arabic fragrance notes (`/fragrances/incense-and-bakhoor`, homepage) | 📄 Brief only, not on the live site | Client to approve the statement and supply supporting detail |
| 2 | Shisha and mouth-fresheners flavours line (`/flavours`, homepage) | ❓ Appears once on the live site | Client to confirm they want it shown |
| 3 | Toll manufacturing (`/innovation`, homepage) | ❓ Listed as "Contract Research / Toll Manufacturing" on the live site | Client to confirm |
| 4 | Company introduction, industries served and regions (`/about`, homepage) | 📄 Brief-supplied | Client to approve the wording; "cosmetics" is not an existing site category |
| 5 | `flavors@` mailbox | ❓ Spelled "flavors@" on the live site | Client to confirm the spelling before it is relied on. It is shown only inside the Flavours contact form |
| 6 | Named contacts (Shalin Kale, Sunil Patil) and the second director (Gurudeo Hattali) | 🛑 Hidden | Never rendered. Consent (contacts) and confirmation (director) needed before showing |
| 7 | Compliance page (`/sustainability/compliance`) | 📄 Describes documents as awaiting confirmation | Names no regulation and claims no compliance. Client to say what each file covers, who issued it and how long it is valid |
| 8 | Certifications page (`/sustainability/certifications`) | 🛑 Empty by design, `noindex` | Add an entry to `src/content/certifications.ts` (status `verified`) only after issuer, dates and scope are confirmed. Expired entries are never shown as current |
| 9 | Contact hours ("Monday to Saturday, 09:00 to 17:00") | ❓ No time zone stated | Client to confirm and say whether to show IST |
| 10 | Application pages | 📄 Short by design | Each has one verified sentence. Capabilities, typical uses and imagery need client input; nothing is invented |
| 11 | Contact enquiries | 📄 Message-only | Create enquiries of the matching type with no product lines. Internal recipients per type are still empty (see H2). The acknowledgement carries no visitor text (see H5) |

## J. Sub-project 5: careers

| # | Item | Status | Action |
|---|---|---|---|
| 1 | Careers page introduction (`/careers`) | ❓ Needs client confirmation | Brief-supplied framing only (`src/content/careers.ts`, block `careers-intro`). Client to confirm or replace the wording. No job, salary, benefit, headcount or culture claim is made anywhere |
| 2 | Job openings | ❓ Client input needed | None are hard-coded. The site launches with the empty state ("There are no current openings." and a link to the general application); HR or a super admin enters openings in the admin. Only published, non-expired openings are public, in the sitemap and in `JobPosting` structured data |
| 3 | Application form notice | 🛑 Draft, needs legal review | Beside the submit button: what is collected, that only the HR team sees it, retention "to be confirmed by Aquila", and deletion on request via the privacy notice. Retention period and a named privacy contact (currently `info@`) are client inputs |
| 4 | Careers recipients | ❓ Client input needed | `SiteSetting` key `notification.recipients.CAREERS` is empty until the client names the HR mailbox(es). Without it applications are still stored and shown in the admin inbox |
| 5 | Candidate data | 🛑 Personal data | CVs and details are visible only to HR_MANAGER and SUPER_ADMIN, never in logs, the audit log or the acknowledgement email. There is no automatic purge: a person deletes an application (and its CV) in the admin |
