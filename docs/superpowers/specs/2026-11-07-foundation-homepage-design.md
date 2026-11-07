# Aquila Organics — Sub-project 1: Foundation, Design System, Homepage

Date: 2026-11-07 · Status: awaiting spec review

## 1. Purpose

Aquila Organics Pvt Ltd is an Indian B2B manufacturer of aroma chemicals, fragrances and (newly) flavours. The goal of the overall project is a lead-generation platform: CAS-searchable catalogue, multi-product RFQ, and manufacturing credibility. This sub-project establishes the technical foundation and the visual language, and delivers one approved homepage. Everything else builds on it.

Success = (a) the project builds, lints and tests clean; (b) the homepage is reviewed and approved on desktop and mobile; (c) no unverified claim appears anywhere in the UI.

## 2. Overall decomposition (each gets its own spec → plan → build)

1. **Foundation + design system + homepage** ← this spec
2. Public content pages (Fragrances, Flavours, application pages, About, Innovation, Sustainability, Certifications, Contact, Resources, Careers)
3. Data layer + auth (Prisma, Postgres, Better Auth, roles; storage and email behind interfaces)
4. Catalogue + RFQ (CAS/name search, filters, product pages, enquiry list, submission). May be moved ahead of #2 at the owner's request
5. Admin + enquiry management + CMS
6. Launch: SEO migration, redirects, security hardening, E2E suite, deployment docs

## 3. Decisions already made

- Tagline: **"Where Science Meets Senses."**
- Fonts: **Cormorant Garamond** (display, ≥20px) + **Manrope** (body) + a monospace face only for CAS numbers and technical data.
- Palette per brief: Ivory `#F6F2E9`, Cream `#EEE7DA`, Charcoal `#24231F`, Bronze `#A88958`, Olive `#777B5B`, Warm Grey `#B9B2A5`, White.
- Imagery: Aquila's own site photos first, then free-licence stock, then labelled placeholders for client supply. Stock is never presented as Aquila facilities.
- Legacy products: imported later as **Draft** only; nothing is published without client verification (sub-project 4).
- No external accounts exist; local Postgres via Docker; storage and email use interfaces with local/stub implementations (relevant from sub-project 3).
- Research done: `docs/company-research.md`, `docs/content-verification.md`.

## 4. Scope of this sub-project

### 4.1 Scaffold
Next.js (current stable, App Router), TypeScript strict, Tailwind, shadcn/ui, Lucide, `motion` (via `LazyMotion` to keep the bundle small), ESLint, Vitest, Playwright. Git repo with small, feature-by-feature commits. `.env.example` with placeholders only. No database, auth or API code yet.

### 4.2 Design system (`docs/design-system.md` + code)
- Tokens as CSS variables mapped into Tailwind: colour, type scale, spacing, radius (restrained, not "rounded everywhere"), shadow, breakpoints.
- Contrast: Bronze `#A88958` fails AA for body-size text on Ivory. Use it for large display text and decoration only; use a darkened bronze (~`#7A5F33`, verified at build time with a contrast check) for small text and links. Olive likewise checked.
- Components: Button, link styles, section header, eyebrow label, image frame with placeholder state, data table style (mono), form field primitives (visual only; real forms come in #4).
- Layout: header with segment mega menu (Fragrances / Aroma Chemicals / Flavours), keyboard-accessible, mobile drawer; footer with registered office, head office, verified contact channels; skip link; focus-visible styles.
- Motion: hero entrance and scroll reveals only; all gated on `prefers-reduced-motion`.
- Distinct treatments per domain: editorial/large-type for fragrance, mono-label/grid for chemicals, warm photographic for flavours, plain factual for sustainability/leadership. Not one card repeated.

### 4.3 Homepage
Sections follow the brief's list of 16, **each rendered only if it has verified content**:

| # | Section | Content rule |
|---|---|---|
| 1 | Contact strip | Verified phones/emails only |
| 2 | Navigation | Per 4.2 |
| 3 | Hero | Tagline + positioning line + two CTAs ("Explore aroma chemicals", "Request a consultation") |
| 4 | Introduction | Brief's company text, edited for language, meaning unchanged |
| 5 | Three segments | Fragrances / Aroma Chemicals / Flavours, with application names as listed on the current site |
| 6 | Fragrance applications | Six categories + Oud/Bakhoor/Arabic-note emphasis (brief-supplied text, flagged for client approval) |
| 7 | Aroma chemicals | The 14 listed chemistries and custom/toll-manufacturing wording as claimed on the current site (toll manufacturing marked "to confirm" in the content module) |
| 8 | Flavours | Five categories + one-line each from the current site |
| 9 | Manufacturing & R&D | Only the two production locations by name/area and the chemistries; no capacities or lab claims beyond the brief's own wording |
| 10 | Strengths | Derived from verified text only (customisation, technical support, turnaround) |
| 11 | Leadership | Girish Vaze (and Gurudeo Hattali if the client confirms); bios from the current site |
| 12 | Sustainability | Zero Liquid Waste policy, Mumbai Waste Management membership, CSR items as stated |
| 13 | Global reach | Region names from the brief (India, Middle East, Africa, APAC); no country counts, no map claims |
| 14 | Certifications & quality | Hidden entirely until client confirms issuers and dates; expired items never shown as active |
| 15 | Enquiry CTA | Links to the contact page (form arrives in #4). No non-functional form shown |
| 16 | Footer | Per 4.2 |

No fake counters, customer logos, stats, EcoVadis badge, or awards.

### 4.4 Content structure
All homepage copy lives in typed modules under `src/content/` (not in components), with a `verified: boolean`/`needsClientInput` marker per block so a build-time check can list unverified blocks. These modules are replaced by database-backed content in sub-project 5.

### 4.5 Imagery
`docs/asset-inventory.md` lists every image slot, its source (Aquila site / stock / placeholder), licence, and replacement owner. Placeholder frames are visibly labelled in development and degrade to tasteful neutral blocks in production. Real Aquila images used only after the client confirms ownership.

### 4.6 Other docs in this slice
`docs/sitemap.md` (new IA ↔ old URLs) and `docs/design-system.md`.

## 5. Out of scope here
Database, auth, admin, RFQ, catalogue pages, blog, careers, SEO redirects, email, storage, deployment.

## 6. Testing and acceptance

- `tsc`, ESLint, Vitest unit tests (content-module checks; contrast-token test) and production `next build` all pass.
- Playwright: homepage loads; mega-menu works by keyboard and mouse; mobile drawer opens/closes; no horizontal overflow at 375, 768, 1280, 1536 px; reduced-motion renders without animation.
- Screenshots at those widths for owner review.
- Accessibility: semantic landmarks, one H1, heading order, focus indicators, alt text; axe check in Playwright.
- Acceptance: owner approves homepage visuals on desktop and mobile; `content-verification.md` shows no unflagged claim in the UI.

## 7. Risks and assumptions

- Site copy was gathered through a summarising fetch tool; wording and CAS data must be re-checked against the originals before being published.
- HQ is unresolved (Thane vs Navi Mumbai); footer shows both labelled as "Registered office" and "Head office" until confirmed.
- "16+ years", 2012 and 2010 are kept separate; the homepage uses none of them.
- Sections 9, 13 and 14 may look sparse until the client supplies more facts. That is intentional.
- Docker/Postgres availability on the dev machine is not needed until sub-project 3.
