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
| `/aroma-chemicals` | `/aroma-chemicals` | 4 |
| `/aroma-chemicals/[slug]` | `/index.php/methyl-chloroacetate`, `/index.php/ethyl-chloroacetate`, `/index.php/aldehyde-c-16` | 4 |
| `/flavours` | `/flavors` | 2 |
| `/flavours/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` | `/confectionery`, `/bakery`, `/beverages`, `/dairy`, `/savoury` | 2 |
| `/innovation` | none (new) | 2 |
| `/sustainability` | `/about/sustainability` | 2 |
| `/sustainability/compliance` | `/about/certifications` (Legal and Regulatory Compliance) | 2 |
| `/sustainability/certifications` | `/about/certification` | 2 |
| `/resources`, `/resources/[slug]` | none (new) | 5 |
| `/careers`, `/careers/[slug]` | `/careers` | 5 |
| `/contact` | `/contactus` | 2 and 4 |
| `/admin/*` | none | 5 (not indexed) |

Notes: every legacy `/index.php/<slug>` duplicate maps to the same target as its clean URL, with no redirect chains. `/about/certifications` and `/about/certification` are near-duplicates today; they get separate, distinct pages.
