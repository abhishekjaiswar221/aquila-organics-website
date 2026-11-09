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

The data model carries `issuer`, `issuedAt`, `expiresAt`, `scope`; the UI hides anything past expiry automatically.

## C. Verified facts (existing site)

✅ Company name; segments and category lists; head-office and registered-office addresses; the two phone numbers and emails; Mon–Sat 09:00–17:00 hours; Girish Vaze and Gurudeo Hattali bios; Zero Liquid Waste, Mumbai Waste Management membership and CSR activities; chemistries list; 20 product rows with datasheets (subject to B-section CAS fixes).

## D. Supplied in brief only (usable, not on the site)

📄 Thane HQ, LinkedIn 2012 / 51–200, markets India/Middle East/Africa/APAC, "16+ years", expertise in Oudhs/Bakhoors/Arabic notes, "state-of-the-art laboratory", customised fragrances for fine fragrance, personal care, cosmetics, air/fabric/home care. "Cosmetics" is not an existing site category.

## E. Claims needing approval before publishing

"One of the largest manufacturers … in India" (superlative); "best agarbatti perfume company in India" (superlative; drop); "state-of-the-art laboratory"; "over 100 man-years"; export presence in named regions; "path-breaking products and technologies"; EcoVadis; Halal/Kosher/FDA marks.

## F. Missing

Capacities, lab description, customers, export volumes, awards, certificate details, product catalogue beyond 20 rows, privacy policy, photography, staff-name consent, employee count, social profile URLs.

## G. Images/documents

Replace: all placeholder category images, "Demo Site" logo alt, Joomla placeholders. Keep subject to client confirmation: logos, Hattali photo, five incense/bakhoor photos, 17 datasheets, MMCA SDS, certificate files. Stock imagery is never to be presented as Aquila facilities.

## H. Sub-project 2: catalogue and RFQ

| # | Item | Status | Action |
|---|---|---|---|
| 1 | Privacy notice (`/privacy`) | 🛑 Draft, not legal advice | Legal review before launch. It describes only what the site does today (RFQ fields, IP-derived hash for rate limiting, user agent, local-storage enquiry list, admin session cookie, hosting and email providers as processors). Retention is stated as "to be confirmed by Aquila"; no named law or certification is claimed. Careers/contact sections must be revised when those forms ship. Requests go to `info@` until the client names a privacy contact |
| 2 | RFQ internal notification recipients | ❓ Client input needed | `SiteSetting` keys `notification.recipients.<FRAGRANCES\|AROMA_CHEMICALS\|FLAVOURS\|GENERAL>` are empty by default, so internal emails are skipped (and logged). Ask which mailboxes receive each enquiry type (see A4 for the current mailbox mapping) |
| 3 | Legacy products (`data/legacy-products.json`) | 🛑 Drafts only | Imported as `DRAFT`, `verified=false`, with a `sourceNote` on each row. Known CAS conflicts (A5–A8: methyl chloroacetate, the duplicate 1123-85-9 pair, Citronellyl Tiglate) are entered with CAS left empty and a note, never guessed. Nothing is published until the client confirms each product against its datasheet/SDS (spec §7) |
| 4 | RFQ confirmation copy | 📄 Neutral wording | Says only that a member of the team will review and respond, and that an acknowledgement follows if an email address was provided. No response time is promised; add one only if the client confirms it |
| 5 | RFQ acknowledgement email content | 📄 Deliberately minimised | The acknowledgement goes to whatever address was typed, so it carries only the greeting name, the reference, the number of product lines and a generic next-steps sentence: no item names, line notes, company or requirements (the internal notification to sales keeps the full details). At most 3 per address per day (README "Email abuse limits"). Any wording change must keep it free of visitor-typed text |
