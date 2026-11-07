# Foundation, Design System & Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Aquila Organics Next.js app, ship the design system, and deliver a reviewable, accessible, responsive homepage containing only verified content.

**Architecture:** One Next.js App Router app, `src/` layout. Copy lives in typed modules in `src/content/`, each block carrying a verification status. Presentation components in `src/components/` take props only. Public routes live in the `(public)` route group. No database, auth or API yet.

**Tech Stack:** Next.js (latest stable via `create-next-app@latest`), TypeScript strict, Tailwind CSS, shadcn/ui, Lucide, `motion` (LazyMotion), Vitest, Playwright + `@axe-core/playwright`, `next/font` (Cormorant Garamond, Manrope, a monospace such as JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-11-07-foundation-homepage-design.md` (research in `docs/company-research.md`, `docs/content-verification.md`).

## Global Constraints

- Tagline exactly: "Where Science Meets Senses."
- Palette: Ivory `#F6F2E9`, Cream `#EEE7DA`, Charcoal `#24231F`, Bronze `#A88958`, Olive `#777B5B`, Warm Grey `#B9B2A5`, White `#FFFFFF`.
- Bronze `#A88958` only for large display text/decoration; small text and links use darkened bronze `#7A5F33` (must pass WCAG AA 4.5:1 on Ivory — enforced by test).
- Fonts: Cormorant Garamond for headlines (≥20px), Manrope body, monospace only for CAS/technical data.
- No fake counters, customer logos, statistics, awards, EcoVadis badge, capacities or certifications. Never use "16+ years", "since 2012" or "since 2010" anywhere in UI.
- Certifications section hidden entirely; expired items never shown as active.
- Toll manufacturing wording is marked `needs-client-confirmation`.
- Footer shows "Registered office" (Thane) and "Head office" (Navi Mumbai) as separate labelled addresses.
- No secrets; `.env.example` placeholders only. No `any` unless unavoidable. No non-functional buttons or placeholder `#` links.
- Respect `prefers-reduced-motion`. No horizontal overflow at 375/768/1280/1536 px.
- Small commits per task; commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Very long words / long company strings in nav and cards → wrap, no clipped text or overflow at 375px (e2e overflow test, Task 9).
- JavaScript disabled or slow → homepage content and nav links still render server-side (Task 9 test with JS disabled).
- Keyboard-only user opens mega menu → Escape closes, focus returns to trigger, Tab order sane (Task 5).
- Reduced-motion user → content visible immediately, not stuck at opacity 0 (Task 8).
- A content block flagged unverified/hidden must not render, even if present in data (Task 3).

---

## File Structure

```
src/app/layout.tsx              root layout, fonts, metadata base
src/app/(public)/layout.tsx     header + footer shell
src/app/(public)/page.tsx       homepage composition only
src/app/globals.css             tokens (CSS vars) + Tailwind theme mapping
src/lib/contrast.ts             WCAG contrast helper (used by test)
src/lib/fonts.ts                next/font definitions
src/content/types.ts            ContentStatus, block types
src/content/site.ts             company, contacts, addresses, nav
src/content/home.ts             homepage copy per section
src/content/index.ts            visibleBlocks() filter
src/components/ui/              Button, Eyebrow, SectionHeader, ImageFrame
src/components/layout/          Header, MegaMenu, MobileDrawer, Footer, SkipLink
src/components/marketing/       one file per homepage section
src/components/motion/          Reveal.tsx (LazyMotion wrapper)
tests/unit/                     vitest
tests/e2e/                      playwright
docs/design-system.md  docs/sitemap.md  docs/asset-inventory.md
```

---

### Task 1: Scaffold and tooling

**Files:** Create via CLI: whole app; Create `.env.example`, `vitest.config.ts`, `playwright.config.ts`, `tests/unit/smoke.test.ts`; Modify `package.json` scripts, `.gitignore`.

**Interfaces:** Produces npm scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`.

- [ ] **Step 1:** In the project root (docs/ and .git already exist) run `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`; accept overwriting only generated files and keep `docs/`.
- [ ] **Step 2:** Install dev deps: `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `@axe-core/playwright`; runtime: `motion`, `lucide-react`. Run `npx shadcn@latest init` (neutral base, CSS variables). Add `typecheck: tsc --noEmit`, `test: vitest run`, `test:e2e: playwright test` scripts. Playwright config: projects for widths 375, 768, 1280, 1536; `webServer` runs `npm run build && npm run start`.
- [ ] **Step 3:** Write `tests/unit/smoke.test.ts` asserting `1 + 1 === 2` as a runner check; run `npm test` → PASS.
- [ ] **Step 4:** Create `.env.example` with `NEXT_PUBLIC_SITE_URL=http://localhost:3000` only. Confirm `.gitignore` excludes `.env*` except the example.
- [ ] **Step 5:** Run `npm run lint && npm run typecheck && npm run build` → all succeed.
- [ ] **Step 6:** Commit `chore: scaffold Next.js app with test tooling`.

---

### Task 2: Design tokens, fonts, contrast guard

**Files:** Create `src/lib/contrast.ts`, `src/lib/fonts.ts`, `tests/unit/contrast.test.ts`; Modify `src/app/globals.css`, `src/app/layout.tsx`.

**Interfaces:** Produces `contrastRatio(fg: string, bg: string): number` (hex in, WCAG ratio out); CSS variables `--ivory --cream --charcoal --bronze --bronze-text --olive --warm-grey --white`; Tailwind theme colours of the same names; font variables `--font-display`, `--font-body`, `--font-mono`.

- [ ] **Step 1:** Write failing tests in `contrast.test.ts`: `contrastRatio('#24231F','#F6F2E9') >= 7`; `contrastRatio('#7A5F33','#F6F2E9') >= 4.5`; `contrastRatio('#A88958','#F6F2E9') < 4.5` (documents why raw bronze is large-text only); `contrastRatio('#FFFFFF','#24231F') >= 7`; olive `#777B5B` on ivory is tested and the test records the actual value (if < 4.5, olive is restricted to large text/decoration in the design-system doc).
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** Implement `contrastRatio` in `src/lib/contrast.ts` using WCAG relative luminance.
- [ ] **Step 4:** Run → PASS. If `#7A5F33` fails 4.5, darken until it passes and update Global Constraints reference in `docs/design-system.md` (Task 10).
- [ ] **Step 5:** Define tokens in `globals.css` (`:root` vars + Tailwind v4 `@theme` or v3 `theme.extend` matching the installed version), body default Ivory background / Charcoal text, type scale (display clamp sizes), 8px spacing rhythm, small radius (`2px`/`4px`), focus-visible outline in `--bronze-text`. Define fonts in `fonts.ts` with `display: 'swap'` and apply variables on `<html>` in `layout.tsx`; set `lang="en"` and `metadataBase` from `NEXT_PUBLIC_SITE_URL`.
- [ ] **Step 6:** Run `npm run build` → succeeds. Commit `feat: design tokens, fonts, contrast guard`.

---

### Task 3: Content modules with verification status

**Files:** Create `src/content/types.ts`, `src/content/site.ts`, `src/content/index.ts`, `tests/unit/content.test.ts`.

**Interfaces:**
- `type ContentStatus = 'verified' | 'brief-supplied' | 'needs-client-confirmation' | 'hidden'`
- `interface Block<T> { id: string; status: ContentStatus; data: T }`
- `visibleBlocks<T>(blocks: Block<T>[]): Block<T>[]` → excludes `'hidden'` only.
- `unflaggedClaims(blocks: Block<unknown>[]): string[]` → ids with status `needs-client-confirmation` (for reporting).
- `site.ts` exports `company`, `contacts` (info/sales/flavors/fragrances/hr emails; the two phone numbers), `addresses` (`registeredOffice` Thane, `headOffice` Navi Mumbai, copied from `docs/company-research.md` §5), `primaryNav`.

- [ ] **Step 1:** Write failing tests: `visibleBlocks` drops hidden blocks and keeps the other three statuses; `unflaggedClaims` returns only needs-client-confirmation ids; `site.ts` addresses contain "Thane" and "Rabale" respectively; **no string anywhere in `src/content/**` matches `/16\+|since 20(10|12)|\d+ years/i`** (reads the files).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement types, helpers and `site.ts` data. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: typed content model with verification status`.

---

### Task 4: UI primitives

**Files:** Create `src/components/ui/{Button,Eyebrow,SectionHeader,ImageFrame}.tsx`, `tests/unit/ui.test.tsx` (add `@testing-library/react`, `jsdom`).

**Interfaces:**
- `Button({ href?: string; variant: 'primary'|'secondary'|'link'; children })` — renders `<a>`/`next/link` when `href`, `<button type="button">` otherwise; a `<button>` without `onClick` is a type error (use a discriminated union).
- `Eyebrow({ children })`, mono small caps label.
- `SectionHeader({ eyebrow?: string; title: string; level?: 2|3; children? })` renders correct heading level.
- `ImageFrame({ src?: string; alt: string; ratio: '4/5'|'3/2'|'16/9'; label?: string })` — no `src` renders neutral block with visible `label` text only when `process.env.NODE_ENV !== 'production'`.

- [ ] **Step 1:** Failing tests: Button with href renders a link role, without renders button; SectionHeader renders h2 by default and h3 when `level=3`; ImageFrame without `src` renders no `<img>` and has accessible name from `alt`.
- [ ] **Step 2–4:** Run FAIL → implement → PASS. **Step 5:** Commit `feat: ui primitives`.

---

### Task 5: Header, mega menu, mobile drawer, footer

**Files:** Create `src/components/layout/{Header,MegaMenu,MobileDrawer,Footer,SkipLink}.tsx`, `src/app/(public)/layout.tsx`, `tests/e2e/navigation.spec.ts`; Modify `src/content/site.ts` for nav tree.

**Interfaces:** Consumes `primaryNav`, `contacts`, `addresses`. Nav tree: Fragrances (6 applications), Aroma Chemicals, Flavours (5 applications), About, Sustainability, Careers, Contact; CTA "Request a consultation" → `/contact`. Header is a server component; only `MegaMenu` and `MobileDrawer` are client components. Links to pages not built yet (everything except `/`) must still resolve: create minimal `not-yet` handling by listing them in `site.ts` with `available: false` and rendering them as non-link text **omitted** from nav until their sub-project ships; sub-project 1 nav therefore shows only Home plus a contact `mailto:`/`tel:` CTA. (No placeholder `#` links.)

- [ ] **Step 1:** Write failing Playwright tests: skip link is first Tab stop and moves focus to `<main>`; the segment menu trigger toggles `aria-expanded`, Escape closes it and returns focus to the trigger; at 375px the drawer opens, traps focus, closes on Escape; footer contains both labelled addresses and `mailto:`/`tel:` links; no horizontal overflow at 375.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement components; use shadcn `Sheet`/`Dialog` primitives for the drawer for focus trapping; mega menu uses disclosure pattern (button + panel), not hover-only.
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat: header, mega menu, drawer, footer`.

---

### Task 6: Homepage — hero through fragrance applications

**Files:** Create `src/content/home.ts` (hero, intro, segments, fragranceApplications blocks), `src/components/marketing/{Hero,Intro,Segments,FragranceApplications}.tsx`, `src/app/(public)/page.tsx`, `tests/e2e/home.spec.ts`.

**Interfaces:** Each section component takes its block `data` as props and returns `null` when given no blocks. `page.tsx` composes sections from `visibleBlocks`. H1 appears once, in `Hero`, containing "Where Science Meets Senses." Copy sources: intro from the brief (edited, meaning unchanged); segment and application names from `docs/company-research.md` §3; Oud/Bakhoor/Arabic emphasis marked `brief-supplied`.

- [ ] **Step 1:** Failing e2e: homepage has exactly one `h1` with the tagline; segment cards link to nothing unbuilt (each is non-link or `mailto`/contact CTA); six fragrance applications present by name; no text matching the banned-claims regex from Task 3.
- [ ] **Step 2–4:** Run FAIL → implement (hero editorial layout with large Cormorant type; segments use three *different* treatments rather than identical cards) → PASS. **Step 5:** Commit `feat: homepage hero, intro, segments, fragrance applications`.

---

### Task 7: Homepage — chemicals, flavours, manufacturing, strengths, leadership, sustainability, reach, CTA

**Files:** Extend `src/content/home.ts`; Create `src/components/marketing/{AromaChemicals,Flavours,Manufacturing,Strengths,Leadership,Sustainability,GlobalReach,CertificationsStrip,EnquiryCta}.tsx`; Modify `page.tsx`, `tests/e2e/home.spec.ts`.

**Interfaces:** `AromaChemicals` shows the 14 chemistries in a mono-label grid (no product names/CAS here). Toll-manufacturing line has status `needs-client-confirmation`. `Manufacturing` names the Ratnagiri (chemical) and Wada, Palghar (fragrance) production areas only. `Leadership` shows Girish Vaze (bio from `company-research.md` §4); Gurudeo Hattali block status `needs-client-confirmation` and excluded from render until promoted. `Sustainability` shows Zero Liquid Waste, Mumbai Waste Management membership, CSR items verbatim in meaning. `GlobalReach` lists India, Middle East, Africa, APAC — no counts. `CertificationsStrip` has block status `hidden`, so it renders nothing. `EnquiryCta` links to `mailto:` sales plus `tel:`, no form.

- [ ] **Step 1:** Failing e2e: all section headings present in order; leadership shows Vaze and **not** Hattali; no certifications heading, EcoVadis text, "Kosher", "Halal" or "FDA" anywhere on the page; exactly 14 chemistry items; no `href="#"`.
- [ ] **Step 2–4:** FAIL → implement (different treatments: factual grid for chemicals, warm photographic frames for flavours, plain editorial for leadership/sustainability) → PASS. **Step 5:** Commit `feat: remaining homepage sections`.

---

### Task 8: Motion

**Files:** Create `src/components/motion/Reveal.tsx`, `tests/e2e/motion.spec.ts`; Modify `Hero.tsx` and section wrappers.

**Interfaces:** `Reveal({ children; delay?: number })` client component using `LazyMotion` + `domAnimation` and `m.div`. Content is server-rendered at full opacity; the animation only runs after hydration and only when `useReducedMotion()` is false.

- [ ] **Step 1:** Failing e2e: with `reducedMotion: 'reduce'`, every `Reveal` content element is visible with opacity 1 immediately after load; with JS disabled all section text is present in the DOM and visible.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Verify the JS bundle for `/` stays reasonable: record First Load JS from `next build` output in the commit message. Commit `feat: reduced-motion-safe scroll reveals`.

---

### Task 9: Responsive, accessibility and quality gates

**Files:** Create `tests/e2e/quality.spec.ts`; screenshot output to `docs/screenshots/` (committed).

- [ ] **Step 1:** Write tests running at 375/768/1280/1536: `document.documentElement.scrollWidth <= innerWidth`; axe scan on `/` returns zero violations; heading levels never skip; every `img` has non-empty alt or is decorative (`alt=""` + `aria-hidden`); long-string stress case: render nav and footer with a 60-character unbroken string via a test-only query param route is **not** allowed — instead assert computed `overflow-wrap` is `break-word`/`anywhere` on text containers.
- [ ] **Step 2:** Run → fix any failures in components (not the tests). **Step 3:** Capture full-page screenshots per width into `docs/screenshots/home-{width}.png`.
- [ ] **Step 4:** Run `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` → all pass. **Step 5:** Commit `test: responsive and accessibility gates, review screenshots`.

---

### Task 10: Documentation

**Files:** Create `docs/design-system.md`, `docs/sitemap.md`, `docs/asset-inventory.md`, `README.md` (replace generated).

- [ ] **Step 1:** `design-system.md`: tokens with measured contrast values from Task 2, type scale, spacing, component list, motion rules, per-domain visual treatments.
- [ ] **Step 2:** `sitemap.md`: new IA from the brief with old URL ↔ new URL mapping from `company-research.md` §2 and the sub-project that delivers each page.
- [ ] **Step 3:** `asset-inventory.md`: each image slot, source (Aquila site / stock / placeholder), licence status, owner, what the client must supply.
- [ ] **Step 4:** `README.md`: setup, scripts, project layout, content-status system, link to docs and specs.
- [ ] **Step 5:** Commit `docs: design system, sitemap, asset inventory, README`. Then list `unflaggedClaims` output in the hand-off message and ask the owner to review the homepage at 375/1280 widths.

---

## Self-Review (spec ↔ plan)

- Spec §4.1 scaffold → Task 1; §4.2 tokens/components/layout/motion → Tasks 2, 4, 5, 8; §4.3 sections 1–16 → Tasks 5–7 (section 14 intentionally hidden); §4.4 content modules → Task 3; §4.5 imagery → Tasks 4, 10; §4.6 docs → Task 10; §6 testing → Tasks 1, 5–9.
- Interface names consistent across tasks (`Block`, `visibleBlocks`, `contrastRatio`, `Reveal`, `ImageFrame`).
- Known judgement call: because later sub-projects add routes, Task 5 omits unbuilt links from the nav rather than using placeholders; the owner will see a short nav on this review pass.
