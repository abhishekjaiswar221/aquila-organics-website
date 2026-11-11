# Full admin (sub-project 4): design

Status: draft for review. Date: 2026-11-10. Branch: `feat/full-admin` (to be created from `main`).

## 1. Purpose and intent

Aquila's team should be able to run the catalogue and the admin without a developer. Today the admin can list products, publish/archive them, mark them verified (SUPER_ADMIN only) and manage enquiries. Everything else is a database edit or a code change.

Success looks like:

- A trusted person can create, edit, verify and publish a product, attach its datasheet and SDS, and have it appear on the public site, entirely from the admin.
- A SUPER_ADMIN can add and disable admin users and edit who receives enquiry notifications.
- Every admin change is recorded and visible to the SUPER_ADMIN.
- Nothing unverified can ever be public. This is the standing hard rule and it is enforced in the database (CHECK constraint `product_published_requires_verified`), in the server actions and in the UI.

Out of scope (deferred): editing page copy and certificates in the database (the "content CMS"), careers, blog, email invites, the HR and sales-executive roles, bulk product import UI beyond the review queue.

## 2. Roles and permissions

`AdminAction` grows from three actions to the set below. `can(role, action)` stays the single pure source of truth (`src/lib/access.ts`); every server action and page calls `requireRole` with the roles that action allows. The proxy cookie check remains a redirect convenience only.

| Action | SUPER_ADMIN | ADMINISTRATOR | SALES_MANAGER | CONTENT_EDITOR |
|---|---|---|---|---|
| enquiries.view / enquiries.update | yes | no | yes | no |
| products.edit (create/edit drafts, specs, applications, categories) | yes | yes | yes | yes |
| products.publish (publish, archive) | yes | yes | yes | no |
| products.verify | yes | no | no | no |
| documents.manage (upload, delete) | yes | yes | no | yes |
| settings.edit (notification recipients) | yes | yes | no | no |
| users.manage | yes | no | no | no |
| audit.view | yes | no | no | no |

Decisions encoded here:

- `ADMIN_ROLES` becomes SUPER_ADMIN, ADMINISTRATOR, SALES_MANAGER, CONTENT_EDITOR. SALES_EXECUTIVE and HR_MANAGER stay locked out until their sub-projects.
- SALES_MANAGER keeps publishing as it works today and gains `products.edit` so it can fix a typo. It does not get documents, settings, users or audit.
- A CONTENT_EDITOR sees only the screens its actions allow. Navigation is built from `can()`, and direct URLs to other screens answer `forbidden()` (403).
- Verification stays SUPER_ADMIN only. Publishing a product still requires `verified`.

## 3. Products

### 3.1 Create and edit

New routes under `src/app/admin/(panel)/products/`: `new` and `[id]/edit`. One form component serves both.

Fields: name (required), slug (required, lower-case kebab, unique, auto-suggested from the name), code (optional, unique when set), CAS number (optional, validated and normalised by `src/lib/cas.ts`; `casNormalized` is derived on the server, never taken from the client), category, description, SEO title, SEO description, source note, specifications (ordered label/value rows), applications (a list of names).

Behaviour:

- Zod schema in `src/features/products/schema.ts` (extended), shared by client hints and server actions; the server is the authority. Text is cleaned with the existing helpers and length-capped.
- A new product is always created as DRAFT and unverified, whatever the client sends.
- Slug changes on a published product are allowed but audited, and create no redirect (noted as a known limitation in the spec's risks).
- Saving specifications and applications is replace-all inside one transaction (delete then insert, with `sortOrder`).
- **Re-verification rule.** If a PUBLISHED product's public fields change (name, slug, code, CAS, category, description, SEO fields, specifications, applications), the same transaction sets `verified = false` and `status = DRAFT`, clears `publishedAt`, and writes an audit entry with `effect: "unpublished for re-verification"`. The form warns before saving. Edits that touch only the source note do not trigger it. DRAFT and ARCHIVED products edit freely.
- Optimistic concurrency: the form carries `updatedAt`; a stale save is rejected with a clear message instead of overwriting.

### 3.2 Import review queue

`/admin/products?status=DRAFT` already lists drafts. Add a filter "Imported, awaiting review" (products whose `sourceNote` marks the legacy import) and a per-row "Review" link to the edit form. No new data model. The existing verify and publish buttons stay on the list and on the edit page.

### 3.3 Categories

A small screen `/admin/categories`: list, create, rename, reorder (`sortOrder`), delete only when no product uses it. Gated by `products.edit`.

## 4. Documents and storage

- Product edit page gets a Documents panel: upload (kind DATASHEET, SDS or OTHER, title) and delete.
- Upload validation reuses the extension + magic-byte checks in `src/features/enquiries/` (moved to a shared module, behaviour unchanged) with a per-file size cap of 10 MB and an allow-list of PDF, PNG, JPEG, CSV, DOCX and XLSX, matching the download route's content types. Storage key is an opaque random key; the filename the visitor sees comes from `title` through the existing `downloadFilename`.
- Documents of PUBLISHED products remain publicly downloadable through the existing route. No new visibility rules. Draft products' documents are not served (existing behaviour).
- Delete removes the database row, then the stored object; a storage failure is logged and audited but does not resurrect the row.
- **R2 driver.** `StorageProvider` gets an `r2` implementation using the S3-compatible API (`@aws-sdk/client-s3`), selected by `STORAGE_DRIVER=r2` with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` added to `src/lib/env.ts` and required only when selected. It is covered by unit tests against a mocked client. It cannot be verified live until a Cloudflare R2 account exists; this is called out in the README and the handover notes.

## 5. Settings, users and audit

### 5.1 Notification recipients

`/admin/settings` edits the `notification.recipients.<EnquiryType>` `SiteSetting` rows for FRAGRANCES, AROMA_CHEMICALS, FLAVOURS, GENERAL (CAREERS is shown but marked "used when careers ships"). Input is a list of emails validated with the existing recipients parser in `src/features/enquiries/recipients.ts`; an empty list is allowed and makes the existing "no recipients configured" warning accurate. Gated by `settings.edit`.

### 5.2 Users (SUPER_ADMIN only)

`/admin/users`: list, create, change role, disable, re-enable, reset password.

- Sign-up stays disabled. Users are created server-side through Better Auth's server API (not the public sign-up route).
- Create: name, email, role (from the four admin roles). The server generates a strong random password (at least 16 characters from a CSPRNG), creates the user, and returns it once to the SUPER_ADMIN to hand over. It is never stored in plain text, logged or put in the audit log.
- A new `mustChangePassword` flag on the user (migration). While it is set, the admin shell redirects every request to a change-password page; the flag clears when the password changes. Reset password sets a new generated password and the flag again.
- Disable: a `disabled` flag (migration). A disabled user cannot sign in and existing sessions stop working (sessions are deleted at disable time and `requireRole` rejects disabled users on every request).
- Guards: cannot disable or demote yourself; cannot remove or demote the last active SUPER_ADMIN; role values are checked against the allow-list server-side.

### 5.3 Audit log

New `AuditLog` model (migration): `id`, `at`, `actorId` (nullable, set null if the user is deleted), `actorRole`, `action` (string enum-like, e.g. `product.create`), `entityType`, `entityId`, `outcome` (`ok` | `denied` | `rejected`), `changedFields` (string array of field names), `detail` (small JSON: enum transitions and counts only).

- A single `recordAudit()` helper (`src/features/admin/audit.ts`) writes the row, and replaces the current console line. It never receives or stores personal data, passwords, email addresses or free text. Audit writes happen in the same transaction as the change they describe where one exists; denied and rejected attempts are written best-effort.
- `/admin/audit` (SUPER_ADMIN): newest first, paginated, filter by action, entity type, actor and date. Read-only.
- Existing product status and verification actions are migrated to the new helper.

## 6. Architecture notes

- Each feature keeps the existing layout: `src/features/<area>/{schema,queries,actions}.ts` and UI in `src/components/admin/`, reusing the admin `ui.tsx` primitives and `search-params` helpers.
- Server actions follow the current pattern: every exported function is a public endpoint, validates input, calls `requireRole` first, and returns a typed result. Forms use `useActionState` with `method="post"` fallbacks as the contact forms do.
- New migrations (created with `--create-only`, then `migrate deploy`): `AuditLog`; `User.disabled`, `User.mustChangePassword`. Role enum is unchanged (CONTENT_EDITOR exists).
- No changes to public pages, content modules or the redirect table.

## 7. Error handling

Validation errors come back per field. Stale-edit, duplicate slug/code and last-SUPER_ADMIN guard errors are explicit messages. Storage failures never leave an orphaned row (upload writes the object first, then the row, and deletes the object if the row fails). Audit failure on a successful change is logged loudly but does not undo the change, except inside the transaction paths listed in 5.3.

## 8. Testing

- Unit: role matrix (every role by every action), product schema, CAS/slug handling, password generator (length, charset, uniqueness), recipients editing, R2 driver against a mocked client, audit field filtering.
- Integration (`aquila_test`): every action for allowed, denied and rejected cases and its audit row; re-verification rule; stale-edit rejection; last-SUPER_ADMIN guard; disabled-user sign-in refusal and session invalidation; upload failure cleanup; migrations apply cleanly.
- E2E at 375/768/1280/1536 plus axe: create then publish a product end to end, edit-unpublishes warning, document upload and public download, settings edit, user create then first-login password change, a CONTENT_EDITOR cannot reach restricted pages (403) or see publish and verify controls, audit viewer filters.
- The whole unit, integration and e2e suites are re-run before the final review (lesson from earlier rounds). The two database suites never run at the same time (enforced by the test database lock).

## 9. Risks and open points

- R2 cannot be exercised live until the account exists.
- Changing a published product's slug breaks its old URL (no redirect is created). Accepted for now; noted in the admin form.
- Disabling users relies on Better Auth session deletion plus a per-request check; the integration test must prove an existing session is rejected.
- Email invites, content CMS, careers/blog roles and a bulk import UI are deliberately deferred.
