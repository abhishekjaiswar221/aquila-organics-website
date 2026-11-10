# Aquila Organics Design System

Positioning: *Where Science Meets Senses.* A warm, light, editorial identity with deliberate dark sections. Fragrance sections feel artistic; chemistry sections feel technical; both share the same palette and type.

Tokens live in `src/app/globals.css`. Contrast is enforced by `tests/unit/contrast.test.ts` and axe in `tests/e2e/quality.spec.ts`.

## Colour

| Token | Hex | Use |
|---|---|---|
| ivory | `#F6F2E9` | Page background |
| cream | `#EEE7DA` | Alternate section background |
| charcoal | `#24231F` | Text, dark sections |
| bronze | `#A88958` | Large display text and decoration only (4.78:1 on charcoal; fails 4.5:1 on ivory) |
| bronze-text | `#7A5F33` | Small text, links, eyebrows (5.35:1 on ivory, 4.86:1 on cream) |
| olive | `#777B5B` | Decoration and large text only (3.94:1 on ivory; white on it is 4.40:1) |
| olive-deep | `#5C6044` | Olive sections with body text (white on it is 6.54:1) |
| warm-grey | `#B9B2A5` | Secondary text on charcoal (7.47:1) |
| white | `#FFFFFF` | Cards, text on dark/olive-deep |

Charcoal on ivory and white/ivory on charcoal are both at least 7:1 (tested). The shadcn semantic tokens (`--primary`, `--muted`, etc.) map onto these. There is no dark mode: the identity is a warm light page with explicit charcoal sections.

## Typography

| Role | Font | Notes |
|---|---|---|
| Display | Cormorant Garamond (400/500/600, italic) | Headlines are always 20px or larger |
| Body | Manrope | |
| Technical | JetBrains Mono | CAS numbers, chemistry labels, eyebrows only |

Classes: `.text-display-xl` (hero), `.text-display-lg` (section titles), `.text-display-md` (card titles). Body line-height 1.65; text blocks capped near 65ch.

## Spacing, shape, layout

8px rhythm. Container `max-w-7xl` with 24px gutters. Section padding 80px mobile, 112px desktop. Radius is restrained (2 to 6px); most blocks are square-edged and ruled with hairlines rather than rounded cards.

Breakpoints: Tailwind defaults. The header switches to the mobile drawer below `lg` (1024px).

## Components

- `ActionButton` (primary / secondary / link; renders a link when given `href`, otherwise a button with a required `onClick`)
- `Eyebrow`, `SectionHeader`, `ImageFrame` (visible "Placeholder: ..." label in development only)
- Layout: `Header` (contact strip, wordmark, segment disclosure menu), `MobileDrawer` (native `<dialog>`), `Footer`, `SkipLink`
- Motion: `Reveal` (see below)
- Page templates (`src/components/pages/`), each taking plain content records and rendering only blocks that exist (hidden blocks never render, empty sections draw nothing):
  - `SegmentPage` (Fragrances and Flavours overviews: lead, a tile per application, segment notes, consultation link)
  - `ApplicationPage` (h1, the verified summary, a labelled placeholder image, optional extra sections, related applications as an unheadinged navigation list, consultation link)
  - `ContentPage` (breadcrumb, h1, lead, ordered sections) and `CertificationsPage` (confirmed certificates only; expired ones under an explicit "Expired certificates" heading, never as current)
  - `PageSections` (paragraphs, lists, quotes), `Breadcrumbs` (labelled nav, last crumb is the current page) and `JsonLd` (shared safe serializer)
- Forms (`src/components/forms/`): `form-fields.tsx` holds the field, attachment, honeypot and consent blocks shared by the RFQ form and the contact forms; `ContactForms` is a WAI-ARIA tablist of four independent forms (own submission token and state each)

## Visual treatments by domain

| Domain | Treatment |
|---|---|
| Fragrances | Large italic display type, numbered ruled list, dark pull-quote for Oudh/Bakhoor expertise |
| Aroma chemicals | White ground, ruled grid, mono labels |
| Flavours | Cream ground, staggered portrait image cards |
| Manufacturing | Charcoal with a definition list of sites |
| Sustainability | Deep olive, three plain columns, no badges |
| Leadership | Narrow single column, no cards |
| Fragrance application pages | Large italic display headline on the ivory ground, image placeholder on the right, dark pull-quote only where a brief-supplied statement exists |
| Flavour application pages | Same layout on the cream ground, upright headline |
| Company pages (About, Innovation, Sustainability, Compliance, Certifications) | Plain factual: breadcrumb, headline, lead, ruled lists; no cards, no decorative imagery |
| Contact | Verified details beside four tabbed forms; no map |

## Motion

- Hero entrance is CSS-only (`.hero-in`), so it works without JavaScript.
- Scroll reveals use `motion` with `LazyMotion` (`domAnimation`). Server HTML is fully visible; only blocks below the fold animate, and only after hydration.
- `prefers-reduced-motion` disables reveals and shortens all CSS animation.

## Content rules

Copy lives in `src/content/`. Each block has a status: `verified`, `brief-supplied`, `needs-client-confirmation`, or `hidden`. Hidden blocks never render. A unit test scans every file under `src/content/` (recursively) and fails the build if it contains "16+", "since 2010/2012", "N years", "best agarbatti", "largest manufacturer" or "state-of-the-art". `npm run content:report` lists every block still awaiting client confirmation. See `docs/content-verification.md`.
