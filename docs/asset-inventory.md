# Asset Inventory

Status after the image pass: the hero, the fragrance section, all 5 flavour tiles and all fragrance and flavour application
pages show free stock photography (Pexels); the incense page and the header and footer logo come from the current Aquila
website. **The manufacturing slot is still a placeholder on purpose** (real Aquila photos only). Credits and sources are in
`docs/image-credits.md`; the registry is `src/content/images.ts`. Stock or generated imagery must never be presented as
Aquila's facilities.

| Slot | Where | Source plan | Status | Needed from client |
|---|---|---|---|---|
| Hero image | Hero | Licensed stock (ingredients, glassware) or client photo | **Stock photo in place** (Pexels) | Aquila lab photo if they want one |
| Fragrance materials | Fragrance applications | Licensed stock (botanicals, oud), or client photo | **Stock photo in place** (Pexels) | Photos if they prefer their own |
| Flavour tiles (5) | Flavours | Licensed stock (food ingredients) | **Stock photos in place** (Pexels) | Approval of stock, or their photos |
| Manufacturing image | Manufacturing | **Real Aquila site photos only** | Placeholder | Photos of the Ratnagiri and Wada sites |
| Logo | Header, footer | Existing `hor_logo_new.png` from the current website | **In use** (PNG converted to WebP; white version via CSS in the footer) | A vector (SVG) or higher-resolution logo, and a decision on the "...Ideas Unlimited" tagline that is part of the file, which differs from the site tagline |
| Incense and bakhoor photos | Incense application page | Existing `/images/media/fagrance/incense-bakhoor/*.jpg` | **Main photo in use**; the 5 sub-type photos are downloaded but not used | Written confirmation of ownership |
| Leadership portraits | Leadership | Client supplied | Not shown | Portrait of Girish Vaze; confirmation on Gurudeo Hattali (existing photo `guru-hattali.jpg`) |
| EcoVadis badge | Sustainability | Client supplied | **Not shown** | Rating, year and permission |
| Certificates | Certifications | Existing PDFs/images under `/images/certifications/` | **Not shown** | Issuers, scope, valid dates (Star-K appears expired) |
| Product datasheets and SDS | Catalogue | 17 PDFs and one SDS on the old site | Not imported | Verification before publishing |
| Application page imagery (6 fragrance, 5 flavour) | `/fragrances/<slug>`, `/flavours/<slug>` | Licensed stock (ingredients, food materials); incense uses the old-site photo | **All 11 in place** | Approval of stock, or their photos |
| About, Innovation and Sustainability imagery | `/about`, `/innovation`, `/sustainability` | None used; these pages are plain and factual | None | Real Aquila site and laboratory photos if the client wants imagery; never stock |
| Contact map | `/contact` | None | Not built | Confirmed coordinates for both offices before adding a map |

Licence rule for stock: free-commercial licence only (for example Unsplash/Pexels), with the licence and source URL recorded here when an image is added.
