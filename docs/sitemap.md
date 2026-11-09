# Sitemap and URL Mapping

Target information architecture, with the legacy URL each page replaces and the sub-project that delivers it. Redirect rules are finalised in sub-project 6 (`docs/url-migration.md`). Pages not yet built are not linked from the site.

| New URL | Replaces (old URL) | Delivered in |
|---|---|---|
| `/` | `/`, `/index.php` | 1 (done) |
| `/about` | `/about/our-company` | 2 |
| `/fragrances` | `/fragrance` | 2 |
| `/fragrances/fine-fragrance` | `/fine-fragrances` | 2 |
| `/fragrances/personal-care` | `/personal-care` | 2 |
| `/fragrances/air-care` | `/air-care` | 2 |
| `/fragrances/fabric-care` | `/fabric-care` | 2 |
| `/fragrances/home-care` | `/home-care` | 2 |
| `/fragrances/incense-and-bakhoor` | `/incense-and-bakhoor` | 2 |
| `/aroma-chemicals` | `/aroma-chemicals` | 4 (done: catalogue/RFQ) |
| `/aroma-chemicals/[slug]` | `/index.php/methyl-chloroacetate`, `/index.php/ethyl-chloroacetate`, `/index.php/aldehyde-c-16` | 4 (done: catalogue/RFQ) |
| `/aroma-chemicals/documents/[id]` | product datasheet/SDS links on the old product pages | 4 (done: catalogue/RFQ) |
| `/rfq`, `/rfq/confirmation` | none (new; the old site had a contact form only) | 4 (done: catalogue/RFQ) |
| `/privacy` | none (new) | 4 (done: draft, needs legal review) |
| `/flavours` | `/flavors` | 2 |
| `/flavours/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` | `/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` | 2 |
| `/innovation` | none (new) | 2 |
| `/sustainability` | `/about/sustainability` | 2 |
| `/sustainability/compliance` | `/about/certifications` (Legal and Regulatory Compliance) | 2 |
| `/sustainability/certifications` | `/about/certification` | 2 |
| `/resources`, `/resources/[slug]` | none (new) | 5 |
| `/careers`, `/careers/[slug]` | `/careers` | 5 |
| `/contact` | `/contactus` | 2 and 4 |
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
| `/sitemap.xml` | Lists `/`, `/aroma-chemicals`, every published product and `/privacy` | n/a | n/a |
| `/robots.txt` | Allows `/`, disallows `/admin` and `/api`, names the sitemap | n/a | n/a |

Any other path renders the site 404 page (`noindex`).

Notes: every legacy `/index.php/<slug>` duplicate maps to the same target as its clean URL, with no redirect chains. `/about/certifications` and `/about/certification` are near-duplicates today; they get separate, distinct pages.
