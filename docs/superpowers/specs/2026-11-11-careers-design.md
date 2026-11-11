# Careers (sub-project 5): design

Status: draft for review. Date: 2026-11-11. Branch: `feat/careers` (to be created from `main`).

## 1. Purpose and intent

Aquila needs a place to publish job openings and receive applications, and an HR inbox to handle them, without a developer. The site launches with **no invented jobs**: the client supplies openings through the admin.

Success looks like:

- A visitor can browse published openings, read one, and apply with a CV; with no openings they can send a general application.
- An HR_MANAGER or SUPER_ADMIN can create, edit, publish and close openings, review applications, download CVs, move an application through a status pipeline, and permanently delete an application and its files.
- Candidate data (CVs, names, emails, phone numbers) is visible only to those two roles, never appears in logs, the audit log or the acknowledgement email, and is removable by a person from the admin.

Decisions already taken with the owner: scope is openings + apply form + HR inbox; access is HR_MANAGER + SUPER_ADMIN only; retention is manual delete plus a visible "retention to be confirmed by Aquila" note (no automatic purge).

Out of scope: automatic purge, interview scheduling, candidate emails beyond the acknowledgement, candidate accounts, multiple CVs, job alerts/RSS, ADMINISTRATOR or SALES roles seeing candidates.

## 2. Data model (migration, created with `--create-only`)

Enums: `EmploymentType` (FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP), `JobStatus` (DRAFT, PUBLISHED, CLOSED), `ApplicationStatus` (NEW, REVIEWING, SHORTLISTED, INTERVIEW, OFFERED, HIRED, REJECTED).

`JobOpening` (`job_opening`): id uuid; `slug` unique; `title`; `location`; `department?`; `employmentType`; `summary` (one or two sentences, used on the list and as meta description); `description` (plain text; blank lines separate paragraphs; no HTML or markdown is interpreted); `status` default DRAFT; `publishedAt?`; `closesOn?` (date); `createdAt`, `updatedAt`. Index on `status`.

`JobApplication` (`job_application`): id uuid; `reference` unique (`CA-YYYY-NNNNNN`, allocated like enquiry references under its own advisory-lock namespace); `submissionId?` unique uuid (idempotency); `jobId?` (relation to `JobOpening`, `onDelete: SetNull`) and `jobTitleSnapshot?` (kept readable if the opening is deleted; "General application" when none); `fullName`; `email`; `phone?`; `country?`; `message?`; `consentAt`; `ipHash?`; `userAgent?`; `status` default NEW; timestamps. Indexes on `(status, createdAt)`, `jobId`, `createdAt`.

`ApplicationFile` (`application_file`): id; `applicationId` (cascade); `filename` (sanitised display name); `mimeType`; `sizeBytes`; `storageKey` unique (private, never sent to a browser).

Candidate fields never go to `AuditLog`. Status changes, deletions and CV downloads are audited with ids, enum values and counts only (new `AuditAction`s: `job.create`, `job.update`, `job.status`, `job.delete`, `application.status`, `application.delete`, `application.cv-download`).

A closed or draft opening is never public. Publishing requires `title`, `slug`, `location`, `summary`, `description` non-empty (validated in the action; no database CHECK is needed because nothing about it is a hard integrity rule like product verification).

## 3. Permissions and roles

`AdminAction` gains `jobs.manage`, `applications.view`, `applications.update` (update covers status change and delete). Matrix, extending spec §2 of the full admin:

| Action | SUPER_ADMIN | HR_MANAGER | everyone else |
|---|---|---|---|
| jobs.manage | yes | yes | no |
| applications.view | yes | yes | no |
| applications.update | yes | yes | no |

- `ADMIN_ROLES` and `AdminRole` gain `HR_MANAGER`; `SALES_EXECUTIVE` stays out. `ROLE_LABELS` gains "HR manager".
- Nav links: Jobs (`/admin/jobs`, `jobs.manage`), Applications (`/admin/applications`, `applications.view`). `adminLinksFor("HR_MANAGER")` is exactly Jobs and Applications.
- The bare `/admin` landing sends each role to its first available page (HR_MANAGER to `/admin/applications`, others as today); `ADMIN_HOME_PATH` after login follows the same rule so an HR user is never sent to a page that answers 403.
- The user-management role allow-list (four admin roles) gains HR_MANAGER, so a SUPER_ADMIN can create HR users.
- ADMINISTRATOR and SALES_MANAGER get 403 on every careers page, action and the CV route. Tests prove it.

## 4. Public site

Routes (all in the public group, content via the existing `Block` model for copy; no job text is hard-coded):

- `/careers`: heading, a short brief-supplied intro (status `needs-client-confirmation`), then published, non-expired openings (title, location, type, summary, link). When there are none: "There are no current openings." plus a link to the general application. `generateMetadata` and breadcrumbs as other pages.
- `/careers/[slug]`: opening detail with an Apply button to `/careers/apply?job=<slug>`. Unknown, draft or closed slugs answer a real 404 (proxy slug check like products, with the same fail-open on a database error). Published openings carry `JobPosting` JSON-LD only when title, description, `publishedAt`, location and a hiring organisation (the site name) are present; `validThrough` only when `closesOn` is set.
- `/careers/apply`: the application form. `?job=<slug>` preselects an opening (unknown or unpublished slug falls back to the general application).
- `/careers/apply/confirmation`: shows only the reference (as the contact confirmation does).

Form fields: full name, email, phone (optional), country (optional), message (optional, 2000 characters), CV (required, one file, PDF or DOCX, up to 10 MB), consent (required), honeypot, idempotency token. Beside the submit button: a notice saying what is collected, that only the HR team sees it, that retention is "to be confirmed by Aquila", and that deletion can be requested via the privacy contact.

SEO and navigation: `/careers` and each published opening join the sitemap (`buildSitemap` gains the openings, like products); the Careers nav and footer entries become available; the navigation tests that pinned Careers as unavailable are updated; redirects are unchanged. The apply and confirmation pages are `noindex`.

## 5. Submission pipeline

A new `submitApplication` Server Action (`src/features/careers/`), built from the existing shared steps in `src/features/enquiries/pipeline.ts` (`guardSubmission`, `checkHoneypot`, `limitByIp`, `existingReference`, file reading and cleanup, `notifyAfterCreate`, email timeout), generalised where they are enquiry-specific:

- Rate limit: its own key prefix (`careers:`), 5 per IP per hour as the enquiry form, with the same shared bucket when no trusted IP exists.
- Idempotency: `submissionId` unique; a replay returns the existing reference.
- File: `validateAttachment` gains an optional allow-list of kinds so careers accepts only PDF and DOCX (the extension and magic-byte checks and the 10 MB cap are unchanged). The object is stored first under an opaque `cv-<random>` key, then the rows are created in one transaction; the object is removed if the transaction fails.
- Email: the acknowledgement has no visitor text and is capped per recipient address (the existing cap); the internal notice goes to the `CAREERS` recipient list. The Settings page enables its Careers row. With no recipients configured, the existing "no recipients" warning applies and the application is still stored.
- Failure never leaves an application without its file or a file without an application.

## 6. Admin

- `/admin/jobs`: list (status filter), create and edit form (all fields, slug auto-suggested and unique, reserved slugs rejected), Publish / Close / Reopen-as-draft, and Delete (only for a DRAFT with no applications). Publishing sets `publishedAt`. Same form pattern, optimistic-concurrency (`updatedAt`) and audit as products.
- `/admin/applications`: list (filter by status and opening, paginated, newest first) and `/admin/applications/[id]`: candidate details, the message, the CV file with a download link, status control, and a Delete button with an explicit confirmation that states the CV is removed too.
- CV download: `/api/admin/applications/[id]/cv`, `applications.view`, 401/403 with no body, `Cache-Control: private, no-store`, `nosniff`, a safe filename, and an `application.cv-download` audit row written before any byte is sent; cross-site requests refused (as the enquiry attachment route does). The storage key never appears in a response.
- Delete removes the rows in one transaction (with its audit row), then the stored object; a storage failure is logged and audited as `{ storageCleanup: "failed" }`.
- Status changes are compare-and-set like enquiry status and audited as `application.status` with `{from,to}`.

## 7. Privacy and content integrity

- The privacy notice's careers section is rewritten from "revised when those forms ship" to what is actually collected (name, email, phone, country, message, CV), who sees it (the HR team and super admins), the processors involved, retention "to be confirmed by Aquila", and how to request deletion. It stays marked draft, needs legal review, and `docs/content-verification.md` is updated.
- All careers page copy carries a content status and passes the banned-claims scan. No job, salary, benefit, headcount or culture claim is invented; the only job content is what an admin enters.

## 8. Error handling

Per-field validation messages; generic failure and rate-limit messages as the other forms; stale-edit, duplicate-slug and publish-requirements messages in the admin; a CV that fails validation rejects the whole submission with a clear message and stores nothing.

## 9. Testing

- Unit: schemas (job and application), permission matrix cells for the three new actions and HR_MANAGER nav, `validateAttachment` allow-list, JobPosting JSON-LD builder, sitemap with openings, content scan for new copy.
- Integration (`aquila_test`): every action for allowed, denied and invalid cases with audit rows; submit pipeline (success, replay, honeypot, rate limit, bad file, cleanup on failure, acknowledgement cap, internal email routing); CV route (401/403, audit before bytes, cross-site refusal, HEAD 405); delete removes rows and object; a draft or closed opening is not returned publicly; role matrix proving ADMINISTRATOR, SALES_MANAGER and CONTENT_EDITOR cannot reach any careers surface.
- E2E at 375/768/1280/1536 with axe: empty state, an opening list and detail, apply with a PDF (confirmation shows only the reference), invalid file message, HR login lands on Applications, HR cannot reach Products (403), status change and delete, SUPER_ADMIN publishing an opening makes it public and closing it returns 404, no horizontal overflow.
- The whole unit, integration and e2e suites are re-run before the final review, and the two database suites never run together.

## 10. Risks and open points

- Retention period and the privacy contact are client inputs; the notice says so.
- Applicant CVs are personal data: the privacy notice still needs legal review before launch.
- No automatic purge: stale applications stay until a person deletes them.
- Live email and R2 storage behave as elsewhere: untested until accounts exist.
