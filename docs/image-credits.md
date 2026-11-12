# Image credits

Every photograph on the site is registered in `src/content/images.ts`; this file lists where each one came from.
`tests/unit/images.test.ts` fails if a registered stock photo is missing from this list.

Stock photos are **generic imagery**. They are never presented as Aquila's own facilities, people or products, and
the manufacturing slot is reserved for real Aquila photographs. Pexels and Unsplash licences allow free commercial
use without attribution; credits are kept here anyway.

## Stock photos (Pexels)

| Slot | Photographer and photo page | Source | Licence |
|---|---|---|---|
| `hero` | [Tara Winstead](https://www.pexels.com/photo/bown-bottles-used-for-herbal-oils-6694216/) | Pexels | Pexels License |
| `fragrance-section` | [Christina & Peter](https://www.pexels.com/photo/ingredients-in-bowl-25676797/) | Pexels | Pexels License |
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

Taken from https://aquilaorganics.com with the owner's go-ahead given in conversation for the demo. **Before launch,
get the client's written confirmation that Aquila owns these files and may reuse them.** The incense photograph in
particular looks like professional or stock photography, so ownership should be checked rather than assumed.

| Use | Original file |
|---|---|
| Incense and bakhoor application page (`fragrance-incense-and-bakhoor`) | https://aquilaorganics.com/images/media/fagrance/incense-bakhoor/incense-and-bakhoor-main.jpg |
| Header and footer logo | https://aquilaorganics.com/images/logod/hor_logo_new.png |

Not used: the other five incense and bakhoor photos from the old site (bakhoor, dhoop, flora batti, masala batti,
scented batti). They are kept out of the build until a gallery needs them and their ownership is confirmed.

## Adding or replacing a photo

1. Put the original in `assets/incoming/stock/` or `assets/incoming/old-site/` (originals are not committed).
2. Run `npm run images:prepare`.
3. Register the slot, alt text and source in `src/content/images.ts`, and list it here.
