# Full Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Aquila's team create, edit, verify and publish products, manage product documents, notification recipients and admin users, with every change audited, without a developer.

**Architecture:** Extend the existing admin (`src/app/admin/(panel)`, `src/features/*`, `src/components/admin`). `can()` in `src/lib/access.ts` stays the single permission source; a new `requireAction(action)` gate sits in front of every page and server action. Writes that must be atomic (product edit + re-verification + audit) run in one Prisma transaction. Documents reuse `validateAttachment` and the `StorageProvider` interface, which gains an R2 driver.

**Tech Stack:** Next.js 16 App Router (cacheComponents), Prisma 7 + Postgres, Better Auth 1.7.18, Zod, Vitest (unit + integration), Playwright, `@aws-sdk/client-s3` (R2).

**Spec:** `docs/superpowers/specs/2026-11-10-full-admin-design.md`

## Global Constraints

- Branch `feat/full-admin`. One commit per task. **No `Co-Authored-By` or "Generated with" trailers in any commit** (standing user rule).
- Next.js 16 conventions: read `node_modules/next/dist/docs/` before using an unfamiliar API. Admin pages are per request: `export const instant = false;`, no `use cache`.
- Every exported function in a `"use server"` file is a public endpoint: authorise with `requireAction()` first (outside try/catch), then validate untrusted input, return typed results with human messages only.
- A PUBLISHED product must be verified with non-empty name and slug (DB CHECK `product_published_requires_verified` plus `publishBlockReason`). Never weaken it.
- Audit rows and logs never contain passwords, email addresses, names or free text: ids, enum values, field names, counts only.
- CRLF working copies: use the Edit tool for multi-line changes, not scripted string replaces.
- Prisma: `migrate dev` hangs non-interactively; use `npx prisma migrate dev --create-only --name <n>` then `npx prisma migrate deploy` (dev DB `aquila`, test DB `aquila_test`), then `npx prisma generate`.
- `npm run test:int` and `npm run test:e2e` share `aquila_test` and must never run at the same time (a DB lock now refuses the second).
- Accessibility and layout: all new admin pages pass axe, have one `h1`, no horizontal page overflow at 375/768/1280/1536, `noindex` via `adminMetadata()`.
- Max upload per document 10 MB; allow-list PDF, PNG, JPEG, CSV, DOCX, XLSX (existing `validateAttachment`).
- Generated one-time passwords: at least 16 characters from a CSPRNG; `MIN_PASSWORD_LENGTH` is 12.
- Run the whole unit, integration and e2e suites after tasks that change shared output (lesson from earlier rounds).

## Review Focus

1. A CONTENT_EDITOR who types the URL of `/admin/users`, `/admin/audit`, `/admin/settings` or posts a publish/verify action directly: must get 403 / `ok:false`, never data or a state change.
2. Two admins editing the same product: the second save with a stale `updatedAt` must be rejected, not silently overwrite.
3. Editing a published product: it must come back as unpublished and unverified in the same transaction, with an audit row; a failed audit write must not leave it published-but-changed.
4. A disabled user with a still-valid session cookie, and a user flagged `mustChangePassword`, must not reach any admin page or action except change-password and sign-out.
5. The last active SUPER_ADMIN demoting or disabling themselves (or being demoted by a stale tab): must be refused.

---

## File Structure

- `src/lib/access.ts` (modify): roles, `AdminAction` union, permission table, `can`.
- `src/lib/permissions.ts` (modify): `requireAction`, disabled and must-change checks in `requireAdminUser`/`getAdminAccess`.
- `src/lib/auth.ts` (modify): `disabled`, `mustChangePassword` additional fields; session-create hook refusing disabled users.
- `prisma/schema.prisma` + migration (modify/create): `AuditLog`, `User.disabled`, `User.mustChangePassword`.
- `src/features/admin/audit.ts` (rewrite): `recordAudit`, `AuditAction`, `listAudit`.
- `src/features/products/{schema,form-schema,edit-actions,edit-queries}.ts`: product form validation, create/update actions, edit read model.
- `src/features/categories/{schema,actions,queries}.ts`: category CRUD.
- `src/features/products/document-actions.ts`, `src/lib/storage/r2.ts` (+ `index.ts`, `src/lib/env.ts`): documents and R2.
- `src/features/settings/{actions,queries}.ts`: recipients editing.
- `src/features/users/{password,schema,actions,queries}.ts`: user management.
- `src/components/admin/*`: form and panel components; `src/app/admin/(panel)/...` pages.
- `tests/unit`, `tests/integration`, `tests/e2e`: per task.

---

### Task 1: Role matrix and `requireAction`

**Files:**
- Modify: `src/lib/access.ts`, `src/lib/permissions.ts`, `src/components/admin/admin-nav.tsx`, `src/app/admin/(panel)/layout.tsx`, existing admin pages/actions that call `requireRole()` (`products/page.tsx`, `enquiries/*`, `products/admin-actions.ts`, `enquiries/admin-actions.ts`, attachment route `src/app/api/admin/attachments/...`)
- Test: `tests/unit/permissions.test.ts` (extend), `tests/integration/permissions.test.ts` (extend)

**Interfaces:**
- Produces: `type AdminAction = "enquiries.view" | "enquiries.update" | "products.edit" | "products.publish" | "products.verify" | "documents.manage" | "settings.edit" | "users.manage" | "audit.view"`; `ADMIN_ROLES: readonly AdminRole[]` = `["SUPER_ADMIN","ADMINISTRATOR","SALES_MANAGER","CONTENT_EDITOR"]`; `AdminRole` widened accordingly; `can(role, action)` unchanged signature; `requireAction(action: AdminAction): Promise<{ userId: string; role: Role }>` in `permissions.ts` (redirect when signed out, `forbidden()` when role lacks the action); `adminLinksFor(role: Role): { href: string; label: string }[]` in `src/lib/access.ts` (pure, used by the nav).

- [ ] **Step 1: Write failing unit tests** in `tests/unit/permissions.test.ts`: a table-driven test asserting every cell of the spec §2 matrix (`can(role, action)` for the four admin roles × nine actions, expected values copied from the spec table); `can("HR_MANAGER", a)` and `can("SALES_EXECUTIVE", a)` are false for every action; `can("CONTENT_EDITOR", "products.publish")` is false; `can("SALES_MANAGER", "products.edit")` is true; `adminLinksFor("CONTENT_EDITOR")` contains Products and Categories only (plus nothing for Enquiries/Users/Audit/Settings); `adminLinksFor("SUPER_ADMIN")` contains Products, Categories, Enquiries, Settings, Users, Audit log.
- [ ] **Step 2: Run** `npx vitest run tests/unit/permissions.test.ts`. Expected: FAIL (unknown actions).
- [ ] **Step 3: Implement** the matrix and `adminLinksFor` in `access.ts` (the permission table is the only place roles are listed per action; `decideAccess` unchanged but checks membership in the action's roles). Implement `requireAction` in `permissions.ts` on top of `getAdminAccess(headers, rolesFor(action))`. Keep `requireRole` as a thin wrapper only if still used; prefer deleting it and migrating callers.
- [ ] **Step 4: Migrate callers.** Every admin page, server action and the attachment route calls `requireAction(<action>)` with the action it needs (`products.publish` for status changes, `products.verify` for `setProductVerified`, `enquiries.view`/`enquiries.update` as today, `products.edit` for the products list page). The `AdminNav` becomes a server-provided prop list from `adminLinksFor(role)` (layout passes it; the nav stays a client component for `usePathname`). Add the new role labels to the layout's `ROLE_LABELS` ("Administrator", "Content editor").
- [ ] **Step 5: Integration tests** in `tests/integration/permissions.test.ts`: for each of the four roles, a user created via `createCredentialUser` and a real session; the matrix holds through `getAdminAccess` for a sample of actions (CONTENT_EDITOR gets `forbidden` for `products.publish`, `SALES_MANAGER` for `users.manage`).
- [ ] **Step 6: Run** `npx tsc --noEmit && npx vitest run && npm run test:int`. Expected: all pass (existing admin tests updated for the renamed gate).
- [ ] **Step 7: Commit** `git commit -m "feat: admin role matrix and requireAction gate"`.

---

### Task 2: Migration, auth fields and disabled-user enforcement

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/permissions.ts`, `src/lib/admin-seed.ts` (only if types change)
- Create: `prisma/migrations/<ts>_audit_log_user_flags/migration.sql` (via `--create-only`)
- Test: `tests/integration/schema.test.ts` (extend), `tests/integration/disabled-user.test.ts` (create)

**Interfaces:**
- Produces: Prisma `AuditLog { id uuid, at DateTime @default(now()), actorId String? (uuid, relation to User onDelete SetNull), actorRole String, action String, entityType String, entityId String?, outcome String, changedFields String[] @default([]), detail Json? }` mapped `audit_log`, indexes on `at`, `(action)`, `(entityType, entityId)`; `User.disabled Boolean @default(false)`, `User.mustChangePassword Boolean @default(false)`. Better Auth user type gains `disabled: boolean`, `mustChangePassword: boolean` (`input: false`). `requireAdminUser()` returns `{ userId, role, email, mustChangePassword }` and redirects to `/admin/change-password` when the flag is set (except on that page's own route group), `forbidden()`s a disabled user and never reads past it.

- [ ] **Step 1: Failing integration tests** (`disabled-user.test.ts`): (a) `auth.api.signInEmail` for a user with `disabled=true` and the right password rejects and creates no session row; (b) a user disabled *after* signing in: `getAdminAccess` with that session's headers returns `forbidden`; (c) `mustChangePassword=true` makes `requireAdminUser` redirect (assert via the pure decision helper `decideAccess`/new `adminGate(user)` returning `{ kind: "change-password" }`). Add to `schema.test.ts`: AuditLog table exists, `actorId` is set null when the user is deleted.
- [ ] **Step 2: Run** `npm run test:int`. Expected: FAIL.
- [ ] **Step 3: Edit the schema,** run `npx prisma migrate dev --create-only --name audit_log_user_flags`, review the SQL, `npx prisma migrate deploy` (dev and, via the test global setup, test), `npx prisma generate`.
- [ ] **Step 4: Implement** the additional fields in `createAuth` (`disabled`, `mustChangePassword`, both `input: false`) and a `databaseHooks.session.create.before` that returns `false` for a disabled user (look the user up by `session.userId`). Add a pure `adminGate(user: { disabled: boolean; mustChangePassword: boolean }): "ok" | "disabled" | "change-password"` in `access.ts` and use it in `requireAdminUser`/`getAdminAccess` (the latter returns `forbidden` for disabled, and for `change-password` returns `forbidden` too since actions must not run).
- [ ] **Step 5: Run** the integration suite and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat: audit log table and user disable/must-change flags"`.

---

### Task 3: Audit helper, product-action migration and audit viewer

**Files:**
- Rewrite: `src/features/admin/audit.ts`
- Modify: `src/features/products/admin-actions.ts`, `src/features/enquiries/admin-actions.ts` (enquiry status changes also audited)
- Create: `src/app/admin/(panel)/audit/page.tsx`, `src/features/admin/audit-queries.ts`
- Test: `tests/unit/audit.test.ts`, `tests/integration/audit.test.ts`

**Interfaces:**
- Produces: `type AuditAction = "product.create" | "product.update" | "product.status" | "product.verified" | "product.reverify" | "category.create" | "category.update" | "category.delete" | "document.upload" | "document.delete" | "settings.recipients" | "user.create" | "user.role" | "user.disable" | "user.enable" | "user.reset-password" | "enquiry.status"`; `recordAudit(input: { actorId: string | null; actorRole: string; action: AuditAction; entityType: string; entityId?: string; outcome: "ok" | "denied" | "rejected"; changedFields?: string[]; detail?: Record<string, string | number | boolean> }, tx?: Prisma.TransactionClient): Promise<void>`; `listAudit(filter: { action?: AuditAction; entityType?: string; actorId?: string; from?: Date; to?: Date; page: number }): Promise<{ rows: AuditRow[]; total: number }>` (page size 50).

- [ ] **Step 1: Failing unit test** `audit.test.ts`: `sanitiseAuditDetail` drops any key whose name matches `/email|password|name|note|text|message/i` and any value longer than 80 characters or non-primitive; `changedFields` are de-duplicated and capped at 30.
- [ ] **Step 2: Failing integration test:** `recordAudit` inside a transaction that then throws leaves no row; `setProductStatus` publish writes `product.status` with `detail { from: "DRAFT", to: "PUBLISHED" }`; a rejected publish (unverified) writes outcome `rejected`; `setProductVerified` writes `product.verified`; the old console `auditLog` no longer exists.
- [ ] **Step 3: Implement** `recordAudit` (uses `tx ?? db`), the sanitiser, and replace the `auditLog(...)` calls in both action files with `recordAudit`, passing the transaction where the change itself runs in one.
- [ ] **Step 4: Viewer page** `/admin/audit` (`requireAction("audit.view")`): filter form (action select, entity type, date range), table with time, role, action, entity, outcome, changed fields; pagination via `Pagination` from `components/admin/ui`; `adminMetadata("Audit log")`.
- [ ] **Step 5: Run** unit + integration suites. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat: database audit log and viewer"`.

---

### Task 4: Product create and edit

**Files:**
- Create: `src/features/products/form-schema.ts`, `src/features/products/edit-actions.ts`, `src/features/products/edit-queries.ts`, `src/components/admin/product-form.tsx`, `src/app/admin/(panel)/products/new/page.tsx`, `src/app/admin/(panel)/products/[id]/edit/page.tsx`
- Modify: `src/features/products/schema.ts` (reuse `slugify`, `isReservedSlug`), `src/app/admin/(panel)/products/page.tsx` (New product link, Edit link per row)
- Test: `tests/unit/product-form-schema.test.ts`, `tests/integration/product-edit.test.ts`

**Interfaces:**
- Produces: `parseProductForm(formData: FormData): { ok: true; data: ProductFormData } | { ok: false; fieldErrors: Record<string, string> }` (name, slug, code, casNumber, categoryId (uuid or empty), description, seoTitle, seoDescription, sourceNote, specifications `[{label,value}]`, applications `string[]`; `casNormalized` is never read from the form); `createProduct(prev: ProductFormState, formData: FormData): Promise<ProductFormState>` (`products.edit`; redirects to the edit page on success); `updateProduct(prev, formData)` (`products.edit`; reads hidden `id` and `updatedAt`); `PUBLIC_PRODUCT_FIELDS: readonly string[]` (everything except `sourceNote`); `getProductForEdit(id: string): Promise<ProductEditModel | null>`.

- [ ] **Step 1: Failing unit tests** (`product-form-schema.test.ts`): empty name rejected; slug auto-built from the name when blank; slug `documents` rejected as reserved; invalid CAS (`"64-17-4"`) rejected with the CAS message, valid `"64-17-5"` accepted and `casNormalized` computed server-side as `"64175"`; more than 100 specification rows rejected; spec rows with a blank label are rejected; unknown form keys (including `status`, `verified`, `casNormalized`) are ignored.
- [ ] **Step 2: Failing integration tests** (`product-edit.test.ts`), real DB and a `SALES_MANAGER`/`CONTENT_EDITOR` actor:
  - `createProduct` always stores `status DRAFT`, `verified false`, even when the form posts `status=PUBLISHED&verified=true`.
  - duplicate slug and duplicate code return a field error, no row written.
  - `updateProduct` on a DRAFT writes the change and audits `product.update` with `changedFields`.
  - `updateProduct` on a PUBLISHED product whose `description` changes: afterwards `status DRAFT`, `verified false`, `publishedAt null`, and an audit row `product.reverify`; the same edit changing only `sourceNote` leaves it PUBLISHED and verified.
  - the re-verification and the audit write are atomic: when the audit insert is forced to fail, the product row is unchanged (still PUBLISHED).
  - a stale `updatedAt` returns `{ ok:false, message: "This product was changed by someone else. Reload and try again." }` and writes nothing.
  - specs and applications are replaced in order (`sortOrder`), in one transaction.
  - a `SALES_MANAGER`/`ADMINISTRATOR`/`SUPER_ADMIN`/`CONTENT_EDITOR` can edit; an HR_MANAGER session is refused.
- [ ] **Step 3: Run** unit and integration suites. Expected: FAIL.
- [ ] **Step 4: Implement** the form schema (Zod, reusing `isValidCas`, `slugify`, `isReservedSlug`, `normalizeUuid`), the two actions (transaction: load row `FOR UPDATE`-style via `updateMany` with `updatedAt` match, then replace children, then `recordAudit(tx)`), the read model, the form component (`useActionState`, `method="post"`, per-field error display, a visible warning above the Save button when editing a PUBLISHED product: "Saving will unpublish this product until it is verified again."), and the two pages (`requireAction("products.edit")`, `notFound()` on a bad id). Product list gets a "New product" button and an Edit link per row.
- [ ] **Step 5: Run** all unit and integration tests, `npx tsc --noEmit`, `npx eslint src tests`. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat: admin product create and edit with re-verification"`.

---

### Task 5: Categories and the import review queue

**Files:**
- Create: `src/features/categories/{schema,actions,queries}.ts`, `src/app/admin/(panel)/categories/page.tsx`, `src/components/admin/category-manager.tsx`
- Modify: `src/features/products/admin-queries.ts` (`listAdminProducts` gains `imported?: boolean`), `src/app/admin/(panel)/products/page.tsx` ("Imported, awaiting review" filter and a Review link)
- Test: `tests/unit/category-schema.test.ts`, `tests/integration/categories.test.ts`, `tests/integration/catalogue-queries.test.ts` (extend)

**Interfaces:**
- Produces: `createCategory(prev, formData)`, `renameCategory(prev, formData)`, `moveCategory(prev, formData)` (swap `sortOrder` with the neighbour), `deleteCategory(prev, formData)` (refuses with "N products use this category" when used); all `products.edit`, all audited (`category.create|update|delete`); `listCategories(): Promise<{ id; name; slug; sortOrder; productCount }[]`; `isImportedNote(note: string | null): boolean` (true for the legacy-import marker written by `scripts/import-products.ts`; read that script to get the exact marker).

- [ ] **Step 1: Failing tests:** category name required, trimmed, max 100, unique slug generated; deleting a used category is refused and nothing changes; renaming keeps the slug stable; the `imported` filter returns exactly the DRAFT products whose `sourceNote` matches the import marker and excludes hand-created ones.
- [ ] **Step 2: Run** unit and integration suites. Expected: FAIL.
- [ ] **Step 3: Implement** the schema, actions, queries, the manager page and the list filter.
- [ ] **Step 4: Run** suites. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: category management and import review filter"`.

---

### Task 6: Documents and the R2 driver

**Files:**
- Create: `src/features/products/document-actions.ts`, `src/components/admin/product-documents.tsx`, `src/lib/storage/r2.ts`
- Modify: `src/lib/storage/index.ts`, `src/lib/env.ts` (`STORAGE_DRIVER` becomes `"local" | "r2"`; `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` required only when `r2`), the edit page (Documents panel), `package.json` (`@aws-sdk/client-s3`), `.env.example` if present, `README.md` (storage section)
- Test: `tests/unit/storage-r2.test.ts`, `tests/unit/env.test.ts` (extend), `tests/integration/document-admin.test.ts`

**Interfaces:**
- Produces: `uploadProductDocument(prev, formData): Promise<DocumentFormState>` (`documents.manage`; fields `productId`, `kind` (`DATASHEET|SDS|OTHER`), `title` (1-200), `file`); `deleteProductDocument(prev, formData)` (`documents.manage`); `class R2Storage implements StorageProvider` constructed with `{ client, bucket }` (client injectable for tests).

- [ ] **Step 1: Failing unit tests** (`storage-r2`): `put` sends `PutObjectCommand` with Bucket, Key and ContentType; `getStream` returns `null` for a `NoSuchKey` error and rethrows others; `delete` ignores `NoSuchKey`; `env` parse accepts `STORAGE_DRIVER=r2` only with all four R2 variables, and rejects it when one is missing (error names the key, not the value).
- [ ] **Step 2: Failing integration tests:** upload of a valid PDF stores the object (local driver) and a row, audited `document.upload` with `detail { kind }`; a file named `.pdf` with exe bytes, an empty file, a file over 10 MB and a wrong kind value are rejected with nothing stored; if the row insert fails the stored object is removed; delete removes row and object, and a storage failure is audited but the row stays deleted; `SALES_MANAGER` is refused (`documents.manage`); a document of a DRAFT product is still not downloadable publicly (`getPublishedDocumentFile` null).
- [ ] **Step 3: Run** suites. Expected: FAIL.
- [ ] **Step 4: Implement** R2 (S3 client with `endpoint: https://<account>.r2.cloudflarestorage.com`, `region: "auto"`), the factory branch, env schema, actions (object key `doc-<base64url 32 bytes>` as `rfq-` keys are made; validation by `validateAttachment`) and the panel.
- [ ] **Step 5: Run** suites, `npx tsc --noEmit`. Expected: PASS. Note in README that R2 is untested live.
- [ ] **Step 6: Commit** `git commit -m "feat: product documents admin and R2 storage driver"`.

---

### Task 7: Notification recipients settings

**Files:**
- Create: `src/features/settings/{actions,queries}.ts`, `src/app/admin/(panel)/settings/page.tsx`, `src/components/admin/recipients-form.tsx`
- Modify: `src/features/enquiries/recipients.ts` (add `parseRecipientsInput`)
- Test: `tests/unit/recipients-input.test.ts`, `tests/integration/settings.test.ts`

**Interfaces:**
- Produces: `parseRecipientsInput(raw: string): { ok: true; emails: string[] } | { ok: false; error: string }` (split on commas, semicolons and newlines; trim; lower-case; de-duplicate; every entry must be a valid email; at most `MAX_RECIPIENTS`; an empty string is valid and yields `[]`); `saveRecipients(prev, formData)` (`settings.edit`; fields `type` ∈ FRAGRANCES, AROMA_CHEMICALS, FLAVOURS, GENERAL; `recipients`); `getAllRecipients(): Promise<Record<EnquiryType, string[]>>`.

- [ ] **Step 1: Failing tests:** `"a@x.com, A@X.com\nb@x.com"` → two emails; `"nope"` → error naming the bad entry count not the entry; 21 addresses → error; empty → `[]`; `saveRecipients` stores the array under `recipientsKey(type)`, audits `settings.recipients` with `detail { type, count }` (no addresses); `type=CAREERS` and an unknown type are refused; ADMINISTRATOR and SUPER_ADMIN allowed, SALES_MANAGER and CONTENT_EDITOR refused; a subsequent enquiry's internal email goes to the new list (reuse the contact-submit test helpers).
- [ ] **Step 2: Run** suites. Expected: FAIL.
- [ ] **Step 3: Implement** parser, action, query and page (CAREERS shown disabled with "used when careers ships").
- [ ] **Step 4: Run** suites. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: notification recipients settings"`.

---

### Task 8: User management and forced password change

**Files:**
- Create: `src/features/users/{password,schema,actions,queries}.ts`, `src/app/admin/(panel)/users/page.tsx`, `src/app/admin/(auth)/change-password/page.tsx` (outside the panel layout so the gate cannot loop), `src/components/admin/{user-manager,change-password-form}.tsx`
- Modify: `src/lib/permissions.ts` (redirect target for `change-password`), `src/proxy.ts` only if the new route needs the cookie rule (it should, as an `/admin/*` path)
- Test: `tests/unit/user-password.test.ts`, `tests/integration/users.test.ts`

**Interfaces:**
- Produces: `generatePassword(): string` (CSPRNG via `crypto.randomInt`, 20 characters, guaranteed upper, lower, digit and symbol, no ambiguous characters `0O1lI`); `createAdminUser(prev, formData): Promise<UserFormState>` where a success state carries `{ ok: true; email: string; password: string }` for the one-time display (`users.manage`; fields `name`, `email`, `role` ∈ the four admin roles); `changeUserRole`, `setUserDisabled`, `resetUserPassword` (all `users.manage`, all audited as `user.*` with `entityId` only); `changeOwnPassword(prev, formData)` (any signed-in admin: `currentPassword`, `newPassword` ≥ `MIN_PASSWORD_LENGTH` and different from the current, uses `auth.api.changePassword` with `revokeOtherSessions: true`, then clears `mustChangePassword`).

- [ ] **Step 1: Failing unit tests:** `generatePassword()` is 20 characters, always contains each class, never contains `0 O 1 l I`, and 1,000 calls are all distinct.
- [ ] **Step 2: Failing integration tests:**
  - `createAdminUser` creates a user with a credential account (the returned password signs in), `mustChangePassword=true`, the chosen role; a duplicate email returns a field error; a role outside the four (for example `HR_MANAGER`, `SUPER_ADMIN` is allowed) is refused; the audit row has no email or password anywhere in `detail`.
  - first sign-in: the gate reports `change-password`; `changeOwnPassword` with a wrong current password fails, with a correct one clears the flag and revokes other sessions.
  - `setUserDisabled(true)` deletes the user's sessions and the next `getAdminAccess` is `forbidden`; re-enable allows sign-in again.
  - guards: disabling or demoting yourself is refused; disabling or demoting the last active SUPER_ADMIN is refused, including when the request comes from another SUPER_ADMIN session that has just been disabled; a stale role value outside the allow-list is refused.
  - `resetUserPassword` returns a new one-time password, sets `mustChangePassword` and revokes sessions; non-SUPER_ADMIN roles are refused for every action.
- [ ] **Step 3: Run** suites. Expected: FAIL.
- [ ] **Step 4: Implement** using `createCredentialUser` from `src/lib/admin-seed.ts` (extend it with `mustChangePassword`) and `ctx.password.hash` for resets; the last-SUPER_ADMIN check runs inside the same transaction as the change (count active SUPER_ADMINs `FOR UPDATE`-safe via a serialisable check: update then recount, roll back if zero). The one-time password is only ever in the action result and the page's React state; the success panel warns "Shown once. Copy it now." and the state clears on navigation.
- [ ] **Step 5: Run** suites, `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** `git commit -m "feat: admin user management and forced password change"`.

---

### Task 9: End-to-end coverage, docs and final verification

**Files:**
- Create: `tests/e2e/admin-products.spec.ts`, `tests/e2e/admin-users.spec.ts`, `tests/e2e/admin-settings-audit.spec.ts`
- Modify: `tests/e2e/support/{admin,fixtures,seed}.ts` (add ADMINISTRATOR and CONTENT_EDITOR fixtures if missing, helpers to read audit rows and a product by slug), `README.md`, `docs/database-design.md`, this plan (a "Deviations as built" note)

- [ ] **Step 1: Write the e2e specs** (all at the four widths unless marked `@catalogue-write`, which runs once after the width projects):
  - CONTENT_EDITOR creates a product with two specs and an application, sees no Publish or Verify controls, and typing `/admin/users`, `/admin/audit` and `/admin/settings` shows the 403 page.
  - SUPER_ADMIN verifies and publishes it (`@catalogue-write`): it appears at `/aroma-chemicals/<slug>` and in the sitemap; editing its description unpublishes it and the public URL then answers 404; the edit form shows the unpublish warning.
  - A stale edit in a second browser context shows the "changed by someone else" message.
  - Document upload (PDF fixture) appears on the public page of a published product and downloads; an executable renamed `.pdf` is rejected with a visible message.
  - Settings: recipients saved and shown after reload.
  - Users: create a user, copy the one-time password, sign in as them in a fresh context, be forced to change password, then land in the admin; disable them and the next request redirects to login.
  - Audit viewer lists those actions and the action filter narrows the list.
  - Every new page: axe clean, one `h1`, no horizontal overflow, `noindex`.
- [ ] **Step 2: Docs:** README sections for roles, user onboarding (one-time password), audit log, R2 setup and its untested status; `docs/database-design.md` gains `AuditLog` and the two user flags.
- [ ] **Step 3: Full verification:** `npx tsc --noEmit`, `npx eslint src tests`, `npx vitest run`, `npm run test:int`, then (never concurrently) `npm run test:e2e`. Expected: all green; report exact counts.
- [ ] **Step 4: Commit** `git commit -m "test: end-to-end coverage and docs for the full admin"`.
- [ ] **Step 5: Final review** by a fresh reviewer over the whole branch (spec compliance, security of every action, the five Review Focus lines), then fix what it finds before merging.

---

## Deviations as built

Recorded after Task 9; the tasks above are the plan as written, this is what was built instead.

- **Applications got `sortOrder`.** `ProductApplication.sortOrder` was added by a migration so the product form can keep the order rows were entered in.
- **No `method="post"` on the product form.** The form uses a Server Action (`action={formAction}`); React sets the method itself, so the attribute from Task 4 was dropped.
- **An update with no changes writes nothing.** `updateProduct` returns "No changes to save." and creates no audit row and no `updatedAt` change.
- **Stale or malformed `updatedAt` counts as stale.** A missing, unparsable or older value returns the "changed by someone else" message.
- **`changeOwnPassword` bypasses `requireAction` and is not audited.** It must work for a user who is only allowed to change their password (and any role), so it checks the session itself and writes no audit row.
- **`recordAuditBestEffort` added.** Denied and rejected attempts are audited outside a transaction; a failed audit insert is logged and does not change the answer. Successful changes still audit inside their transaction.
- **`DOCUMENT_KINDS` is not exported** from `document-actions.ts`: a `"use server"` file may export only async functions. For the same reason `STALE_PRODUCT_ERROR` moved from `edit-actions.ts` to `form-schema.ts` in Task 9 (the production build failed on it; nothing but the build catches this).
- **R2 only tested against a mock.** No live bucket has been used.
- **Nav links were added by each task** (Categories, Settings, Users, Audit log) in `ADMIN_LINKS` in `access.ts`, not all in Task 1.
- **`STORAGE_DRIVER` is an enum with a `superRefine`** in `src/lib/env.ts` that requires the four R2 variables only for `r2`.
- **Task 9 fixes found by running the admin in a browser:**
  - The production build failed: `STALE_PRODUCT_ERROR` was exported from the `"use server"` file `edit-actions.ts`. It moved to `form-schema.ts`.
  - The product list showed Publish, Unpublish, Archive and Restore buttons to a content editor (the server action refused them, but the controls should not render); `ProductActions` now takes `canPublish`.
  - The admin nav overflowed the page by 124px at 375px for roles with six links; the list now wraps.
  - After a forced password change the user was sent back to the change-password page: the router had cached "/admin/products redirects to /admin/change-password" from the sign-in landing, so `redirect()` from the action bounced. `changeOwnPassword` now returns `{ ok: true }` and the form does a full navigation to `/admin/products`. It also no longer asks Better Auth to `revokeOtherSessions` (that replaces the current session cookie as well); other sessions are deleted in the same transaction as clearing the flag, keeping the current one.

## Self-review notes

- Spec coverage: §2 roles (Task 1), §3.1-3.3 products, import queue, categories (Tasks 4-5), §4 documents and R2 (Task 6), §5.1 settings (Task 7), §5.2 users (Tasks 2 and 8), §5.3 audit (Tasks 2-3), §7 error handling (Tasks 4, 6, 8), §8 testing (every task plus Task 9).
- Type consistency: `AdminAction`, `requireAction`, `recordAudit`, `AuditAction`, `ProductFormState` and `UserFormState` are defined once (Tasks 1, 3, 4, 8) and reused by name.
- Known deliberate simplifications: slug changes create no redirect; no email invites; the content CMS is out of scope.
