# URL migration

How the old Aquila website's URLs map to the new site. The old site was a Joomla install. The table below is the single source of truth in code (`src/content/redirects.ts`); `next.config.ts` serves it, and `tests/unit/redirects.test.ts` and `tests/e2e/redirects.spec.ts` guard it.

## Rules

- One permanent redirect per old URL, answered as **301** (an explicit `statusCode: 301`, not `permanent: true`, which Next.js answers with 308).
- No chains: no destination is itself an old URL (unit test).
- Every destination is a page that exists on the new site, and no old URL shadows a live page (unit test).
- Query strings are passed through to the destination.
- The old site served each page both at the clean URL and under `/index.php/...`, so every rule also answers its `/index.php/...` variant with the same destination.
- Old URLs ending in a trailing slash take two hops: Next.js applies its own trailing-slash redirect (308) before custom redirects, then our 301. The clean URLs (no trailing slash), which the old site used and search engines hold, are a single hop. Avoiding the extra hop would mean turning off the framework's trailing-slash handling for the whole site, which is not worth it for this rare variant.

## Delivered redirects (sub-project 3: business content pages)

| Old URL | New URL |
|---|---|
| `/fragrance` | `/fragrances` |
| `/flavors` | `/flavours` |
| `/fine-fragrances` | `/fragrances/fine-fragrance` |
| `/personal-care` | `/fragrances/personal-care` |
| `/air-care` | `/fragrances/air-care` |
| `/fabric-care` | `/fragrances/fabric-care` |
| `/home-care` | `/fragrances/home-care` |
| `/incense-and-bakhoor` | `/fragrances/incense-and-bakhoor` |
| `/confectionery` | `/flavours/confectionery` |
| `/bakery` | `/flavours/bakery` |
| `/beverages` | `/flavours/beverages` |
| `/dairy` | `/flavours/dairy` |
| `/savoury` | `/flavours/savoury` |
| `/about/our-company` | `/about` |
| `/about/sustainability` | `/sustainability` |
| `/about/certifications` (Legal and Regulatory Compliance) | `/sustainability/compliance` |
| `/about/certification` | `/sustainability/certifications` |
| `/contactus` | `/contact` |

Each of the 18 also has an `/index.php/...` twin, plus the old home URL `/index.php` itself (37 rules in total).

## Unchanged URLs (no redirect needed)

`/` and `/aroma-chemicals`. The old home URL `/index.php` redirects to `/` (one 301). The old product pages under `/index.php/` (`methyl-chloroacetate`, `ethyl-chloroacetate`, `aldehyde-c-16`) are covered below.

## Still pending

| Old URL | Why | Delivered in |
|---|---|---|
| `/careers` | The new careers pages are in the full-admin sub-project. Until then the old URL answers 404 on the new site. | Full admin and CMS |
| `/index.php/methyl-chloroacetate`, `/index.php/ethyl-chloroacetate`, `/index.php/aldehyde-c-16` | Old product pages. The new catalogue slugs only exist once the client verifies and publishes those products (`/aroma-chemicals/<slug>`), so the mapping cannot be fixed yet. | Launch, after products are published |
| Datasheet and certificate files under `/images/datasheets/` and `/images/certifications/` | Files were never pages; the new site serves product documents through `/aroma-chemicals/documents/<id>` once uploaded. | Launch |
| Search Console check | Compare the old site's indexed URLs with this table before the domain switch. | Launch |
