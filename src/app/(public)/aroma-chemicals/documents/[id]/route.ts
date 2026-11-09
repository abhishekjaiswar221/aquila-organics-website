import {
  contentDispositionAttachment,
  downloadFilename,
  safeDocumentContentType,
} from "@/features/products/document-download";
import { getPublishedDocumentFile } from "@/features/products/queries";
import { getStorage } from "@/lib/storage";

// Request-time by nature (reads params and the database); never cached, so a
// product that is unpublished stops serving its documents at once.

const COMMON_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; sandbox",
} as const;

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { ...COMMON_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(_request: Request, ctx: RouteContext<"/aroma-chemicals/documents/[id]">) {
  const { id } = await ctx.params;
  const doc = await getPublishedDocumentFile(id);
  if (!doc) return notFoundResponse();

  let stream: ReadableStream | null;
  try {
    stream = await getStorage().getStream(doc.storageKey);
  } catch {
    // Invalid stored key or unreadable file: indistinguishable from missing.
    stream = null;
  }
  if (!stream) return notFoundResponse();

  return new Response(stream, {
    status: 200,
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": safeDocumentContentType(doc.mimeType),
      "Content-Disposition": contentDispositionAttachment(downloadFilename(doc.title, doc.id, doc.mimeType)),
    },
  });
}
