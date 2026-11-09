import { attachmentDownloadHeaders } from "@/features/enquiries/attachment-download";
import { getAttachmentFile } from "@/features/enquiries/queries";
import { db } from "@/lib/db";
import { getAdminAccess } from "@/lib/permissions";
import { getStorage } from "@/lib/storage";

/*
 * Permission-checked enquiry attachment download. Request-time only, never
 * cached. A route handler cannot redirect to a page, so the requireRole()
 * decision (shared getAdminAccess) is answered here as 401 (no valid session)
 * or 403 (role not allowed), both with no body. Every successful download is
 * recorded as an `attachment.downloaded` activity before any byte is sent; if
 * that record cannot be written, nothing is served. The storage key is used
 * to open the stream and never appears in the response.
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

/** The requireRole() decision: a 401/403 response, or the permitted user. */
async function authorise(request: Request): Promise<Response | { userId: string }> {
  const access = await getAdminAccess(request.headers);
  if (access.kind === "redirect") return empty(401);
  if (access.kind === "forbidden") return empty(403);
  return { userId: access.userId };
}

/*
 * Without this export Next.js answers HEAD by running GET, which would open
 * the file and record a download nobody made. HEAD gets exactly the same auth
 * answers as GET (401/403 first, so a signed-out probe learns nothing), then
 * 405 for a permitted user. No database lookup, no stream, no activity row.
 */
export async function HEAD(request: Request): Promise<Response> {
  const auth = await authorise(request);
  if (auth instanceof Response) return auth;
  return new Response(null, { status: 405, headers: { ...ERROR_HEADERS, Allow: "GET" } });
}

export async function GET(request: Request, ctx: RouteContext<"/api/admin/attachments/[id]">) {
  const auth = await authorise(request);
  if (auth instanceof Response) return auth;
  const access = auth;

  // Browsers send Sec-Fetch-Site; a download triggered from another site
  // (a link or embed on a third-party page) is refused. Requests without the
  // header (non-browser clients) and same-origin/user-typed ones still work.
  if (request.headers.get("sec-fetch-site") === "cross-site") return empty(403);

  const { id } = await ctx.params;
  const file = await getAttachmentFile(id);
  if (!file) return plain(404, "Not found");

  let stream: ReadableStream | null;
  try {
    stream = await getStorage().getStream(file.storageKey);
  } catch {
    // Invalid stored key or unreadable file: indistinguishable from missing.
    stream = null;
  }
  if (!stream) return plain(404, "Not found");

  try {
    await db.enquiryActivity.create({
      data: {
        enquiryId: file.enquiryId,
        actorId: access.userId,
        action: "attachment.downloaded",
        detail: { attachmentId: file.id },
      },
    });
  } catch (err) {
    await stream.cancel().catch(() => {});
    console.error("[admin] could not record an attachment download:", err instanceof Error ? err.name : typeof err);
    return plain(503, "The download could not be recorded. Try again.");
  }

  return new Response(stream, { status: 200, headers: attachmentDownloadHeaders(file) });
}
