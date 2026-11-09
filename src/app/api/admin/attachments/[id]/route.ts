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

export async function GET(request: Request, ctx: RouteContext<"/api/admin/attachments/[id]">) {
  const access = await getAdminAccess(request.headers);
  if (access.kind === "redirect") return empty(401);
  if (access.kind === "forbidden") return empty(403);

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
