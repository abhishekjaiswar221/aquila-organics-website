# Sitemap and URL Mapping

Target information architecture, with the legacy URL each page replaces and the sub-project that delivers it. Redirect rules are finalised in sub-project 6 (`docs/url-migration.md`). Pages not yet built are not linked from the site.

| New URL | Replaces (old URL) | Delivered in |
|---|---|---|
| `/` | `/`, `/index.php` | 1 (done) |
| `/about` | `/about/our-company` | 3 (done) |
| `/fragrances` | `/fragrance` | 3 (done) |
| `/fragrances/fine-fragrance` | `/fine-fragrances` | 3 (done) |
| `/fragrances/personal-care` | `/personal-care` | 3 (done) |
| `/fragrances/air-care` | `/air-care` | 3 (done) |
| `/fragrances/fabric-care` | `/fabric-care` | 3 (done) |
| `/fragrances/home-care` | `/home-care` | 3 (done) |
| `/fragrances/incense-and-bakhoor` | `/incense-and-bakhoor` | 3 (done) |
| `/aroma-chemicals` | `/aroma-chemicals` | 4 (done: catalogue/RFQ) |
| `/aroma-chemicals/[slug]` | `/index.php/methyl-chloroacetate`, `/index.php/ethyl-chloroacetate`, `/index.php/aldehyde-c-16` | 4 (done: catalogue/RFQ) |
| `/aroma-chemicals/documents/[id]` | product datasheet/SDS links on the old product pages | 4 (done: catalogue/RFQ) |
| `/rfq`, `/rfq/confirmation` | none (new; the old site had a contact form only) | 4 (done: catalogue/RFQ) |
| `/privacy` | none (new) | 4 (done: draft, needs legal review) |
| `/flavours` | `/flavors` | 3 (done) |
| `/flavours/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` | `/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` | 3 (done) |
| `/innovation` | none (new) | 3 (done) |
| `/sustainability` | `/about/sustainability` | 3 (done) |
| `/sustainability/compliance` | `/about/certifications` (Legal and Regulatory Compliance) | 3 (done) |
| `/sustainability/certifications` | `/about/certification` | 3 (done) |
| `/resources`, `/resources/[slug]` | none (new) | 5 |
| `/careers`, `/careers/[slug]` | `/careers` | 5 |
| `/contact` | `/contactus` | 3 (done) |
| `/admin/*` | none | minimal admin done in 4 (login, products, enquiries); full admin in 5. Not indexed |

## Routes live now (catalogue/RFQ sub-project)

The data layer, catalogue and RFQ sub-project is called "sub-project 2" in its spec and plan; it delivers the rows marked 4 above. Indexable means it may appear in search results; only the URLs marked "yes" in the sitemap column are listed in `/sitemap.xml`.

| URL | What it is | Indexable | In sitemap |
|---|---|---|---|
| `/` | Homepage | yes | yes |
| `/aroma-chemicals` | Catalogue list, search, category filter, sort, pagination | Bare list only. A search, category filter, non-default sort or any page after the first is `noindex, follow`; every variant's canonical is the bare list | yes (bare URL) |
| `/aroma-chemicals/[slug]` | Product page | yes, published products only. Draft, archived and unknown slugs answer 404 (`src/proxy.ts`) | yes, published products only |
| `/aroma-chemicals/documents/[id]` | Document download (route handler, not a page). Always `Content-Disposition: attachment`, never cached; 404 unless the product is published | not a page | no |
| `/rfq` | Request for quotation form | yes (no noindex) | no |
| `/rfq/confirmation?ref=AQ-YYYY-NNNNNN` | Confirmation (reference and next steps only) | no (`noindex, nofollow`) | no |
| `/privacy` | Privacy notice (draft) | yes | yes |
| `/admin`, `/admin/login`, `/admin/products`, `/admin/enquiries`, `/admin/enquiries/[id]` | Minimal admin. `/admin` goes to `/admin/products`; signed-out requests get a 307 to `/admin/login?next=...` | no: `noindex, nofollow` meta and `X-Robots-Tag` header; disallowed in robots.txt | no |
| `/api/admin/attachments/[id]` | Permission-checked enquiry attachment download (GET only; HEAD answers 405) | no: `X-Robots-Tag: noindex, nofollow`; disallowed in robots.txt | no |
| `/api/auth/*` | Better Auth endpoint (sign-in, sign-out, session) | no; disallowed in robots.txt | no |
| `/sitemap.xml` | Lists `/`, `/aroma-chemicals`, the business pages (see below), every published product and `/privacy` | n/a | n/a |
| `/robots.txt` | Allows `/`, disallows `/admin` and `/api`, names the sitemap | n/a | n/a |

Any other path renders the site 404 page (`noindex`).

## Routes added by sub-project 3 (business content pages)

| URL | What it is | Indexable | In sitemap |
|---|---|---|---|
| `/fragrances`, `/flavours` | Segment overviews (a tile per application) | yes | yes |
| `/fragrances/{fine-fragrance, personal-care, air-care, fabric-care, home-care, incense-and-bakhoor}` | Application pages. Unknown slugs answer a real 404 through `src/proxy.ts` (pure slug check, no database) | yes | yes |
| `/flavours/{confectionery, bakery, beverages, dairy, savoury}` | Application pages, same 404 handling | yes | yes |
| `/about`, `/innovation`, `/sustainability`, `/sustainability/compliance` | Company pages from verified content only. Organization data on `/about` | yes | yes |
| `/sustainability/certifications` | Lists only certificates the client has confirmed; none yet, so it shows a "being compiled" message | **no** (`noindex`) until at least one confirmed certificate exists | only when it is indexable |
| `/contact` | Verified contact details and four enquiry forms (fragrances, flavours, aroma chemicals, general). `?type=` and `?application=` preselect a form | yes | yes |
| `/contact/confirmation?ref=AQ-YYYY-NNNNNN` | Confirmation (reference and next steps only) | no (`noindex, nofollow`) | no |

`/sitemap.xml` now also lists these pages (the certifications page only when indexable). Old-site URLs for these pages redirect once each: see `docs/url-migration.md`.

Notes: every legacy `/index.php/<slug>` duplicate maps to the same target as its clean URL, with no redirect chains. `/about/certifications` and `/about/certification` are near-duplicates today; they get separate, distinct pages.
