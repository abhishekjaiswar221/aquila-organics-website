# Private demo deployment (Vercel + Neon)

These steps need accounts that only you can create. They have now been run once against live accounts (Vercel Hobby,
Neon, Cloudflare R2): see "Production status" at the end for what that deploy showed.

## What the demo can and cannot do

| Feature | In a Vercel demo |
|---|---|
| Public pages, catalogue search, RFQ and application forms, admin | Works |
| Emails | **Logged only.** There is no real email driver yet (`EMAIL_DRIVER` supports `dev` only). Confirmation pages still appear; no one receives mail |
| File uploads (RFQ attachments, CVs, product documents) | **Local storage does not persist on Vercel.** Either skip showing uploads, or set up Cloudflare R2 (`STORAGE_DRIVER=r2`). The R2 driver is built; a live RFQ with a CSV attachment was accepted on the deployed site, but the object in the bucket has not been checked yet. **Vercel rejects request bodies over about 4.5 MB**, while the forms allow 10 MB per file |

## 1. Database (Neon)

1. Create a Neon project and copy both connection strings: the pooled one (host contains `-pooler`) for the app, and the direct one for migrations.
2. From your machine, point `DATABASE_URL` at the **direct** string and run `npx prisma migrate deploy`.

## 2. Hosting (Vercel)

1. Import the repository from GitHub (`abhishekjaiswar221/aquila-organics-website`; already pushed, and Vercel deploys `main`).
2. Set these environment variables (Production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon **pooled** connection string |
| `AUTH_IP_HEADER` | `x-forwarded-for` (Vercel overwrites it with the client IP; see README "Deployment: reverse proxy and client IP") |
| `BETTER_AUTH_SECRET` | a random string of at least 32 characters |
| `BETTER_AUTH_URL` | the deployment URL, for example `https://your-demo.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | the same URL |
| `STORAGE_DRIVER` | `local` (uploads will not persist) or `r2` plus its four `R2_*` variables |
| `EMAIL_DRIVER` | `dev` (**required, exactly `dev`**: a missing or malformed value fails the build with `Invalid environment: EMAIL_DRIVER`. Set it for Production, no quotes or spaces, then redeploy) |
| `RATE_LIMIT_SALT` | a random string of at least 8 characters |
| `DEMO_NOINDEX` | `1` (keeps the demo out of search engines: robots.txt disallows everything and every page sends `noindex`) |

3. Deploy. Keep the project private (Vercel deployment protection) and share the link only with the prospect.

## 3. Load the demo data

With the production variables in your shell (or a local `.env`), run once:

```
npm run seed:admin               # creates the first super admin (uses ADMIN_EMAIL and ADMIN_PASSWORD)
npm run demo:seed -- --with-job  # 17 sample products and one sample opening
```

`demo:seed` refuses to run on a database that already holds real products; do not use `--force` on a real database.
Create the HR manager from Admin > Users when you need one.

## 4. After the pitch

- Remove the sample data: `npm run demo:reset` (removes only the sample products and the sample opening).
- A deployment that becomes real must drop `DEMO_NOINDEX` and use real email and storage accounts.

## Production status (2026-11-21)

Live at https://aquilaorganics.vercel.app/ (Vercel Hobby, deployed from `main`; Neon Postgres; Cloudflare R2 with an
account API token scoped to one private bucket; `EMAIL_DRIVER=dev`; `DEMO_NOINDEX=1`). The first two builds failed on
`EMAIL_DRIVER` (see the variable table); the third succeeded.

**Checked on the live site with Playwright**

- All 22 public routes return 200; `/robots.txt` and `/sitemap.xml` load; unknown URLs return 404.
- No console errors, all images load, no horizontal overflow at 375px.
- RFQ form: empty submit shows an error on every required field; a valid submit and a submit with a CSV attachment both reach the confirmation page.
- Contact form: a valid submit reaches the confirmation page.
- Admin sign-in rejects a wrong password with 401 and "Incorrect email or password."
- Every response carries `noindex, nofollow`.

**Not checked yet**

- The admin after sign-in (products, enquiries, attachment downloads), the careers application and CV upload, and that the attachment object exists in the R2 bucket.
- Product pages and "add to enquiry": the catalogue is empty (`demo:seed` has not been run).
- The deployment answered without a Vercel sign-in, so deployment protection is off. `noindex` keeps it out of search, but the link is open to anyone who has it.

**Platform decision (2026-11-21)**

Vercel for the app, Neon for Postgres, Cloudflare R2 for files. Alternatives considered: Render, Railway or Fly.io (app and Postgres
together), and a VPS with Docker or Coolify (the only option that can keep `STORAGE_DRIVER=local`). MongoDB Atlas is not an option
(the app uses Postgres and Prisma). Release step: `prisma migrate deploy` against the direct Neon string, then `npm run seed:admin` once.
Behind a proxy, set `AUTH_IP_HEADER` and `AUTH_TRUSTED_PROXIES` (README "Deployment: reverse proxy and client IP").

File storage: R2 chosen over Neon Object Storage (S3-compatible but still in beta, and it would need a new driver because the
R2 driver hardcodes the `r2.cloudflarestorage.com` endpoint) and over Cloudinary (not S3-compatible, so a new driver; private
files need signed URLs and non-image files go in as `raw` resources). R2 credentials use an Account API token (not a User token,
which stops working if that person's access changes) with Object Read and Write on the one bucket.

**Open items before real use**

| Item | Detail |
|---|---|
| Real email driver | Only `dev` exists (confirmed 2026-11-21): `EMAIL_DRIVER` is `z.literal("dev")` in `src/lib/env.ts` and `src/lib/email/` holds only `dev.ts`. Pick a provider (Resend, Postmark or SES; not chosen yet; Resend suggested). Needs a new driver implementing `src/lib/email/types.ts`, a new case in `src/lib/email/index.ts`, a widened env check, an API key and a verified sender domain. Not started |
| Notifications reach nobody | With `EMAIL_DRIVER=dev`, RFQ, contact and careers submissions are saved and shown on the confirmation page, but no email is sent to staff or the customer. Staff only see them by opening the admin. Treat this as a launch blocker until the email driver exists and notification recipients are set |
| Admin seed and sample data | Not recorded whether `npm run seed:admin` has been run against the production database, so admin sign-in is unconfirmed. `demo:seed` has not been run (empty catalogue). Run `seed:admin` if needed, sign in, then decide whether to load sample data or real products |
| Deployment protection off | The site answers without a Vercel sign-in. `noindex` keeps it out of search, but anyone with the link can use it and submit forms. Turn on Vercel deployment protection, or accept the open link knowingly |
| R2 live check | Upload, download and delete have not been verified against the live bucket; confirm the RFQ attachment object exists before relying on it |
| Upload size | Lower the form limits to about 4 MB, or upload straight to R2 with presigned URLs |
| Security headers | No HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame protection or CSP on the home page response |
| Admin sign-in limiter | Counts live in memory per instance, so it is only loosely enforced on Vercel; move it into the database like the RFQ limiter |
| Rate-limit rows | `RateLimitHit` rows are never pruned |
| Env error message | `Invalid environment: <KEY>` does not say what is wrong with the value |
| Test data | Enquiries `AQ-2026-000001` to `AQ-2026-000003` are test submissions (names start with "TEST"); delete them in the admin |
| Hosting plan | Vercel Hobby is for non-commercial use; a real business launch needs a paid plan |
| Domain | Attach the real domain, then update `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` and redeploy (the first is inlined at build time) |

**Proposed fix order (not yet approved):** email driver, upload limit, env error message, security headers, then the
admin sign-in limiter. Work on a feature branch per fix.
