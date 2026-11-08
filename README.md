# Aquila Organics Website

B2B website for Aquila Organics Private Limited, a manufacturer of fragrances, aroma chemicals and flavours. *Where Science Meets Senses.*

This repository currently contains sub-project 1: the foundation, design system and homepage. The catalogue, RFQ, admin, database and remaining public pages are separate sub-projects (see `docs/sitemap.md` and the spec).

## Stack

Next.js (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Lucide, `motion`, Vitest, Playwright and axe.

## Getting started

```bash
npm install
cp .env.example .env.local   # placeholders only; no secrets are needed yet
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run seed:admin` | Creates the first `SUPER_ADMIN` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (read from the environment or `.env`; password at least 12 characters). Idempotent: re-running leaves an existing user's password alone; add `-- --reset-password` to change it |
| `npm run test:e2e` | Playwright at 375, 768, 1280 and 1536px (builds and serves on port 3100) |

Playwright needs a browser once: `npx playwright install chromium`.

## Layout

```
src/app/(public)/      public routes and shell
src/components/        ui/, layout/, marketing/, motion/
src/content/           typed page copy with verification status
src/lib/               utilities (fonts, contrast)
tests/unit, tests/e2e
docs/                  research, verification, design system, sitemap, assets, specs, plans
```

## Content integrity

Page copy lives in `src/content/`. Every block carries a status (`verified`, `brief-supplied`, `needs-client-confirmation`, `hidden`), and hidden blocks never render. Do not add product names, CAS numbers, certifications, capacities, statistics or founding/age claims unless the client has confirmed them; `docs/content-verification.md` lists what is still open.

## Documentation

- `docs/company-research.md`, `docs/content-verification.md`
- `docs/design-system.md`, `docs/sitemap.md`, `docs/asset-inventory.md`
- `docs/superpowers/specs/` and `docs/superpowers/plans/`
- `docs/screenshots/` homepage captures at four widths
