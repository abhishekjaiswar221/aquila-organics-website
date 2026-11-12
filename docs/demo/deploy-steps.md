# Private demo deployment (Vercel + Neon)

These steps need accounts that only you can create. Nothing here has been run against live accounts yet: treat the
first deploy as a dry run and expect to adjust.

## What the demo can and cannot do

| Feature | In a Vercel demo |
|---|---|
| Public pages, catalogue search, RFQ and application forms, admin | Works |
| Emails | **Logged only.** There is no real email driver yet (`EMAIL_DRIVER` supports `dev` only). Confirmation pages still appear; no one receives mail |
| File uploads (RFQ attachments, CVs, product documents) | **Local storage does not persist on Vercel.** Either skip showing uploads, or set up Cloudflare R2 (`STORAGE_DRIVER=r2`). The R2 driver is built but has only been tested against a mock, never a live account |

## 1. Database (Neon)

1. Create a Neon project and copy the pooled connection string.
2. From your machine, point `DATABASE_URL` at it and run `npx prisma migrate deploy`.

## 2. Hosting (Vercel)

1. Import the repository (push it to GitHub first; it is not pushed yet).
2. Set these environment variables (Production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string |
| `BETTER_AUTH_SECRET` | a random string of at least 32 characters |
| `BETTER_AUTH_URL` | the deployment URL, for example `https://your-demo.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | the same URL |
| `STORAGE_DRIVER` | `local` (uploads will not persist) or `r2` plus its four `R2_*` variables |
| `EMAIL_DRIVER` | `dev` |
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
