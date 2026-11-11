import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import type { StorageProvider } from "./types";

/*
 * Cloudflare R2 through its S3-compatible API. NOT yet exercised against a
 * live R2 account: it is covered by unit tests with a mocked client only.
 */

/** The one method of S3Client this driver uses (lets tests inject a fake). */
export type R2Client = { send(command: unknown): Promise<unknown> };

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; Code?: unknown; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.Code === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}

function toWebStream(body: unknown): ReadableStream {
  if (body && typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function") {
    return (body as { transformToWebStream(): ReadableStream }).transformToWebStream();
  }
  if (body instanceof Readable) return Readable.toWeb(body) as unknown as ReadableStream;
  if (body instanceof ReadableStream) return body;
  throw new Error("Unsupported R2 response body");
}

export class R2Storage implements StorageProvider {
  private readonly client: R2Client;
  private readonly bucket: string;

  constructor({ client, bucket }: { client: R2Client; bucket: string }) {
    this.client = client;
    this.bucket = bucket;
  }

  async put(key: string, data: Uint8Array, meta: { mimeType: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: meta.mimeType }),
    );
  }

  async getStream(key: string): Promise<ReadableStream | null> {
    try {
      const res = (await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))) as {
        Body?: unknown;
      };
      if (!res.Body) return null;
      return toWebStream(res.Body);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }
}
