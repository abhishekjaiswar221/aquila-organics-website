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

### Deployment: reverse proxy and client IP

The admin sign-in endpoint allows 5 attempts per minute for each client IP. That IP is read from `x-forwarded-for`, or from the header named in `AUTH_IP_HEADER`, such as `cf-connecting-ip`. If neither `AUTH_IP_HEADER` nor `AUTH_TRUSTED_PROXIES` is set, the header is trusted only when it holds exactly one address. Your proxy must therefore **overwrite** that header with the real client IP, not append to it. If your proxy appends instead, list its addresses or CIDRs in `AUTH_TRUSTED_PROXIES` (comma-separated).

The risks of getting this wrong:

- If the app can be reached without going through such a proxy, a client can send a different fake header on every request and guess passwords without limit.
- If an appending proxy is not listed, every client whose header holds several addresses shares one bucket. About five requests a minute can then lock every admin out.

The limiter stores its counts in memory in each server process. That is fine for a single instance. Running several instances needs a shared store.

The RFQ form (`/rfq`) has its own limiter, using the same header rules:

- **Storage.** Counts live in the database (`RateLimitHit`), so they are shared by every instance. The key is a salted hash of the IP (`RATE_LIMIT_SALT`), never the raw address.
- **Per-visitor limit.** 5 submissions per hour for each client IP that can be resolved.
- **Shared fallback.** When no trustworthy IP can be resolved, every such request shares one bucket of 100 submissions per hour. The causes:
  - no proxy sets the header;
  - the header holds several addresses and no `AUTH_TRUSTED_PROXIES` are listed;
  - an appending proxy is not listed.

  One busy source can then use up the bucket for everyone, so configure the header. In production, the server logs one warning per process when this happens and neither `AUTH_IP_HEADER` nor `AUTH_TRUSTED_PROXIES` is set.
- **What counts.** Submissions with invalid fields do not count, and neither do honeypot hits or replays of an already-stored submission (same `submissionId`).
- **Not pruned yet.** Old `RateLimitHit` rows are not cleaned up. Delete rows with an old `windowStart` periodically until a cleanup job exists.

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
