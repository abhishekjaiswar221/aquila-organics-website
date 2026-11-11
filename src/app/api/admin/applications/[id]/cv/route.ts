import { recordAudit } from "@/features/admin/audit";
import { getApplicationCv } from "@/features/careers/application-queries";
import {
  contentDispositionAttachment,
  downloadFilename,
  safeDocumentContentType,
} from "@/features/products/document-download";
import { getAdminAccess, rolesFor } from "@/lib/permissions";
import { getStorage } from "@/lib/storage";

/*
 * Permission-checked CV download (applications.view). Request-time only, never
 * cached. A route handler cannot redirect to a page, so the access decision is
 * answered here as 401 (no valid session) or 403 (role not allowed), both with
 * no body. Every successful download is recorded as an `application.cv-download`
 * audit row (ids only) before any byte is sent; if that row cannot be written,
 * nothing is served. The storage key opens the stream and never appears in the
 * response.
 */

const ERROR_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function empty(status: 401 | 403): Response {
  return new Response(null, { status, headers: ERROR_HEADERS });
}

function plain(status: 404 | 503, text: string): Response {
  return new Response(text, { status, headers: { ...ERROR_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

async function authorise(request: Request): Promise<Response | { userId: string; role: string }> {
  const access = await getAdminAccess(request.headers, rolesFor("applications.view"));
  if (access.kind === "redirect") return empty(401);
  if (access.kind === "forbidden") return empty(403);
  return { userId: access.userId, role: access.role };
}

/*
 * Without this export Next.js answers HEAD by running GET, which would open the
 * file and record a download nobody made. HEAD gets the same auth answers as
 * GET, then 405 for a permitted user: no lookup, no stream, no audit row.
 */
export async function HEAD(request: Request): Promise<Response> {
  const auth = await authorise(request);
  if (auth instanceof Response) return auth;
  return new Response(null, { status: 405, headers: { ...ERROR_HEADERS, Allow: "GET" } });
}

export async function GET(request: Request, ctx: RouteContext<"/api/admin/applications/[id]/cv">) {
  const auth = await authorise(request);
  if (auth instanceof Response) return auth;

  // A download triggered from another site is refused; header-less clients and
  // same-origin/user-typed requests still work.
  if (request.headers.get("sec-fetch-site") === "cross-site") return empty(403);

  const { id } = await ctx.params;
  const cv = await getApplicationCv(id);
  if (!cv) return plain(404, "Not found");

  let stream: ReadableStream | null;
  try {
    stream = await getStorage().getStream(cv.storageKey);
  } catch {
    stream = null;
  }
  if (!stream) return plain(404, "Not found");

  try {
    await recordAudit({
      actorId: auth.userId,
      actorRole: auth.role,
      action: "application.cv-download",
      entityType: "application",
      entityId: cv.applicationId,
      outcome: "ok",
      detail: { files: 1 },
    });
  } catch (err) {
    await stream.cancel().catch(() => {});
    console.error("[admin] could not record a CV download:", err instanceof Error ? err.name : typeof err);
    return plain(503, "The download could not be recorded. Try again.");
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": safeDocumentContentType(cv.mimeType),
      "Content-Disposition": contentDispositionAttachment(downloadFilename(cv.filename, cv.fileId, cv.mimeType)),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
