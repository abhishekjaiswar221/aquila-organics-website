# Image credits

Every photograph on the site is registered in `src/content/images.ts`; this file lists where each one came from.
`tests/unit/images.test.ts` fails if a registered photo's source is missing from this list.

Stock photos are **generic imagery**. They are never presented as Aquila's own facilities, people or products, and
the manufacturing slot is reserved for real Aquila photographs. Pexels and Unsplash licences allow free commercial
use without attribution; credits are kept here anyway.

## Stock photos (Pexels)

| Slot | Photographer and photo page | Source | Licence |
|---|---|---|---|
| `hero` | [Alesia Kozik](https://www.pexels.com/photo/glass-bottle-on-a-tray-7797102/) | Pexels | Pexels License |
| `fragrance-fine-fragrance` | [Alesia Kozik](https://www.pexels.com/photo/perfume-bottle-on-a-white-surface-surrounded-by-dried-flowers-7796498/) | Pexels | Pexels License |
| `fragrance-personal-care` | [Ron Lach](https://www.pexels.com/photo/jar-with-soaps-and-body-brush-10574793/) | Pexels | Pexels License |
| `fragrance-air-care` | [Hanna Pad](https://www.pexels.com/photo/close-up-shot-of-diffuser-sticks-8533213/) | Pexels | Pexels License |
| `fragrance-fabric-care` | [Pavel Danilyuk](https://www.pexels.com/photo/a-stack-of-folded-clothes-on-the-table-6461392/) | Pexels | Pexels License |
| `fragrance-home-care` | [Tara Winstead](https://www.pexels.com/photo/fresh-lemons-on-bowl-on-cloth-6489623/) | Pexels | Pexels License |
| `flavour-confectionery` | [alleksana](https://www.pexels.com/photo/close-up-shot-of-dark-chocolates-on-a-white-surface-4113352/) | Pexels | Pexels License |
| `flavour-bakery` | [Gülsüm Çoban](https://www.pexels.com/photo/rustic-bread-and-flour-on-wooden-table-32525228/) | Pexels | Pexels License |
| `flavour-beverages` | [Beyza Şükran DEMİRBAŞ](https://www.pexels.com/photo/refreshing-glass-of-lemonade-with-fresh-lemons-33107433/) | Pexels | Pexels License |
| `flavour-dairy` | [Charlotte May](https://www.pexels.com/photo/bottle-and-glass-of-milk-at-home-5946717/) | Pexels | Pexels License |
| `flavour-savoury` | [Tatyana Novoselova](https://www.pexels.com/photo/a-wooden-bowl-with-whole-peppercorns-beside-other-ingredients-8922293/) | Pexels | Pexels License |

Licence text: https://www.pexels.com/license/ (the Pexels licence label was confirmed on each photo page).

## Photos and logo from the current Aquila website

Taken from https://aquilaorganics.com with the go-ahead given in conversation for the demo.

| Use | Original file |
|---|---|
| Home page, fragrance section (`fragrance-section`) and Fine fragrance gallery: Attars | https://aquilaorganics.com/images/media/fagrance/fine-fragrances/attars.jpg |
| Fine fragrance gallery: Perfumes | https://aquilaorganics.com/images/media/fagrance/fragreance-main.jpg |
| Fine fragrance gallery: Roll-ons | https://aquilaorganics.com/images/media/fagrance/fine-fragrances/roll-ons.jpg |
| Fine fragrance gallery: Deodorants | https://aquilaorganics.com/images/media/fagrance/fine-fragrances/deodorant-spray.jpg |
| Air care gallery: Reed diffusers | https://aquilaorganics.com/images/media/fagrance/air-care/reed-diffuser.jpg |
| Air care gallery: Electric diffusers | https://aquilaorganics.com/images/media/fagrance/air-care/electric-diffuser.jpg |
| Air care gallery: Scented candles | https://aquilaorganics.com/images/media/fagrance/air-care/scented-candles.jpg |
| Personal care gallery: Skin care | https://aquilaorganics.com/images/media/fagrance/personal-care/skin-care.jpg |
| Personal care gallery: Bath care | https://aquilaorganics.com/images/media/fagrance/personal-care/bath-care.jpg |
| Personal care gallery: Hair care | https://aquilaorganics.com/images/media/fagrance/personal-care/hair-care.jpg |
| Incense and bakhoor page (`fragrance-incense-and-bakhoor`) | https://aquilaorganics.com/images/media/fagrance/incense-bakhoor/incense-and-bakhoor-main.jpg |
| Incense gallery: Bakhoor | https://aquilaorganics.com/images/media/fagrance/incense-bakhoor/bakhoor.jpg |
| Incense gallery: Dhoop and incense cones | https://aquilaorganics.com/images/media/fagrance/incense-bakhoor/dhoop.jpg |
| Incense gallery: Scented batti | https://aquilaorganics.com/images/media/fagrance/incense-bakhoor/scented-batti.jpg |
| Header and footer logo | https://aquilaorganics.com/images/logod/hor_logo_new.png |

**Licensing warning, to resolve before launch.** All of the photographs above (not the logo) look like commercial stock
photography, not Aquila's own shoots: they are polished product and lifestyle images of the kind sold by stock
libraries, and the old site gives no credit or licence for them. Some may be licensed to the old site's web agency,
some may be free, and some may have been used without a licence. **Before launch, ask the client or the old site's
developer where these came from, and get written confirmation, or replace them with licensed or free stock
(recorded in the table above) or Aquila's own photographs.** The logo is Aquila's own mark, so it needs only the
client's confirmation of the correct, current version.

Reviewed and deliberately not used from the old site: photos showing a recognisable person (the incense-bundle
display), branded perfume bottles, hands pouring detergent, the pink-flower graphic overlays, business-concept images
on the old "our company" page, certificates, the EcoVadis badge and the leadership portraits (need consent and
confirmation), and the 60-pixel photos of Aquila staff in a laboratory (too small to use; real photographs of the
Ratnagiri and Wada sites are still needed for the manufacturing section).

## Adding or replacing a photo

1. Put the original in `assets/incoming/stock/` or `assets/incoming/old-site/` (originals are not committed).
2. Run `npm run images:prepare`.
3. Register the slot or gallery item, alt text and source in `src/content/images.ts`, and list it here.
