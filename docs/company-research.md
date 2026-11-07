# Aquila Organics — Company Research

Research date: 2026-11-07. Method: pages fetched live and summarised by a fetch tool, not by a human reading raw HTML. Treat every figure here (especially CAS numbers) as **unverified until checked against the raw page or datasheet**.

## 1. Existing site overview

- Platform: Joomla + SP Page Builder (paths `/media/com_sppagebuilder/`, `/index.php/...`). The same page is reachable with and without `/index.php`.
- Template debris: footer reads `@2021` and `© {2021}`; logo alt text "Aquila Organics Demo Site"; slideshow alt "This is title of the Slideshow addon!"; stray header text "HACKER BY HARDER"; typos ("Oragnics", "exsquisite", "Beverange").
- Most category images are a Joomla placeholder SVG. Homepage counters (Aroma Chemicals / Fine Fragrance / Flavours / Fragrances) show **0**.
- No `sitemap.xml` (404). No brochures/PDFs on the homepage. No newsletter, blog or news section.

## 2. Page inventory

| Old URL | Purpose | Notes |
|---|---|---|
| `/` , `/index.php` | Home | Hero, segment blurbs, inquiry form |
| `/about/our-company` | About | Leadership, locations, channel partners |
| `/about/sustainability` | Sustainability | Text only, no figures or documents |
| `/about/certifications` | "Legal & Regulatory Compliance" | Actually lists the same documents as below |
| `/about/certification` | Certifications | 8 documents, no issuer/date columns |
| `/aroma-chemicals` | Aroma chemicals | 20-row product table, datasheets |
| `/index.php/methyl-chloroacetate`, `/index.php/ethyl-chloroacetate`, `/index.php/aldehyde-c-16` | Product pages | Only some products have pages |
| `/fragrance` | Fragrance overview | |
| `/fine-fragrances`, `/personal-care`, `/air-care`, `/fabric-care`, `/home-care`, `/incense-and-bakhoor` | Fragrance applications | Each also at `/index.php/<slug>` |
| `/flavors` | Flavour overview | US spelling in URL |
| `/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` | Flavour applications | |
| `/careers` | Careers | 1 opening; CV by email |
| `/contactus` | Contact | |

Not accessed: separate Legal/Regulatory content distinct from `/about/certifications`; any page not linked from the main nav; Wayback history.

## 3. Content by area (summaries)

- **Company:** Aquila Organics Pvt Ltd (AOPL). Homepage: "one of the largest manufacturers of Fragrances & Aroma chemicals in India", started 2012, recently expanded into flavours.
- **Segments:** aroma chemicals; fragrances (fine, personal care, air care, fabric care, home care, incense & bakhoor); flavours (confectionery, bakery, beverages, dairy, savoury; shisha and mouth fresheners are mentioned once in one sentence only).
- **Aroma chemicals page:** "manufacturer and exporter … over 10 years"; bulk and specialty-to-order; "Contract Research / Toll Manufacturing"; expertise: process consultation, reactive chromatography, reactive distillation, plug flow, CSTR; 14 listed chemistries (aldol, cyclisation, Diels-Alder, Darzens, etherification, esterification, epoxidation, Friedel-Crafts, Grignard, selective hydrogenation, isomerisation, peroxide-based, distillation, solvent extraction).
- **Incense & Bakhoor:** sub-types Bakhoor, Flora Batti, Incense Cone, Masala Batti, Scented Batti; real photos exist at `/images/media/fagrance/incense-bakhoor/*.jpg`. The brief's "Oudhs, Bakhoors and Arabic notes" differentiator appears on the supplied company text but **not** on the live site.
- **Sustainability:** Zero Liquid Waste policy (liquid waste → solid salts, "DDD" process unexplained); member of Mumbai Waste Management Ltd.; CSR (local employment, water support to a Gram Panchayat, pandemic rations); EcoVadis logo with no rating/year.
- **Careers:** culture paragraph; "International Sales Associate", Tamil Nadu; HR email; form is Name/Email/Subject/Message only, no resume upload.

## 4. People

- Girish Vaze — Managing Director & Chief Perfumer, founder/promoter. M.Sc. Organic Chemistry (Mumbai Univ.), MBA Finance (USA); ~a decade heading the Aroma Ingredients Division at S.H. Kelkar. Only placeholder image on site.
- Gurudeo Hattali (also spelled "Gurudev") — Executive Director. B.Sc. Chemistry, MBA; 15+ years production/R&D/pilot plant; ex-Birla, Ciba-Geigy, Kelkar. Photo exists (`guru-hattali.jpg`). **Not mentioned in the brief.**
- "Over 100 man-years" combined board experience (site claim).
- Named contacts on `/contactus`: Mr. Shalin Kale (Flavours, Fragrances), Mr. Sunil Patil (Aroma Chemicals). Need consent before publishing names.

## 5. Locations (from `/about/our-company`)

| Role | Address |
|---|---|
| Head office per Contact page | W-353, TTC Industrial Area, Rabale MIDC, Navi Mumbai 400701 |
| Registered office | Office 101-104, Sunrise Business Park, Plot B-68, Road 16, Wagle Industrial Estate, Thane (W) 400604 |
| Chemical production | Plot G-17, Lote Parshuram MIDC, Khed, Ratnagiri, MH 415722 |
| Fragrance production | Survey 404/2/A, Chinchghar Kudus, Wada, Palghar, MH 421312 |
| Delhi office | 3/8 Asaf Ali Road, New Delhi 110002 |
| Lucknow office | D-307, Vibhuti Khand, Gomti Nagar, Lucknow 226010 |
| Channel partners | Vinayaka Chemicals (Salem), Chemixil Corporation (Bangalore) |

Contact page lists no manufacturing sites and no map. Hours: Mon–Sat 09:00–17:00 (About page only).

## 6. Contact channels on the live site

- info@ (general), sales@ (aroma chemicals; the fragrance page labels it "sales inquiries"), flavors@, fragrances@, hr@ — all @aquilaorganics.com.
- +91 98193 43989 (aroma chemicals / general), +91 82912 31180 (fragrances & flavours).
- Existing inquiry form: Name, Email, Phone, Message → "Get a quote". Careers form uses a "3 + 4" maths captcha.

## 7. Product data found (20 rows — **unverified**)

18 aroma chemicals + 2 chloroacetates (MMCA, ECA). Datasheet PDFs exist at `/images/datasheets/aquila---NN-*.pdf` for 17 of them; MMCA has an SDS (`MMCA-SDS.pdf`). Full list is held for the content-verification step; it will seed the catalogue only after the client confirms. Anomalies are logged in `content-verification.md`.

## 8. Certification documents (all at `/images/certifications/`)

EC letter; compliance reports Apr–Sep 2025 and Oct 2025–Mar 2026; ISO certificates (combined PDF); Halal India 2026–27 (ref HIP29840120) + add-on products; Star-K Kosher (filename date 08/31/2026); US FDA certificate. Issuer, scope, and validity are **not stated on the page**; inferred from filenames only.

## 9. Assets worth keeping

Logo (`/images/logod/hor_logo_new.png`, `logo-transp.png`), EcoVadis badge (only with proof of rating), Hattali photo, 5 incense/bakhoor photos. Everything else is placeholder. Image licensing/ownership must be confirmed with the client.

## 10. Reference sites — what to take

| Site | Takeaway for Aquila |
|---|---|
| Keva (keva.co.in) | Heritage timeline, offerings grouped in "Our Offerings / Our Company", downloads area (brochures/flyers), global-presence list by facility type |
| Privi (privi.com) | Plain code + image catalogue; Production Capability grouped (infrastructure, safety, quality, R&D, certifications). Its catalogue lacks specs — Aquila can beat it with CAS, specs, SDS |
| Eternis | "Aroma molecules as the start of the magic" ingredient narrative; sustainability backed by linked documents |
| SKFF | Two-door entry (Flavours / Fragrances) with application lists |
| ISAK | Editorial rhythm, short poetic fragments, large category tiles, scent-family chips — borrow tone and pacing, not retail features |
| Ariana Grande Fragrances, Fragrantica | **Not fetched in this pass.** Fragrantica is used only for olfactory-family vocabulary |

## 11. SEO / migration considerations

- Old URLs to preserve or 301: all in §2, plus the `/index.php/` duplicates (collapse to one canonical).
- Search intent already on page: "Best Agarbatti Perfume Company in India", "Fragrances Manufacturers & Suppliers in Mumbai", "Food Flavour Manufacturer & Supplier". Preserve intent in new titles.
- `/about/certifications` (Legal & Regulatory) and `/about/certification` (Certifications) are near-duplicates and need distinct new homes.
- No sitemap.xml exists; Search Console data from the client would show which URLs actually rank.

## 12. Missing information (needs client)

Employee count; founding year; manufacturing capacities; R&D facility description; customer references; export countries; EcoVadis score/year; certificate scopes and issuers; product catalogue beyond the 20 rows; full-resolution photography; privacy policy; consent to publish staff names.
