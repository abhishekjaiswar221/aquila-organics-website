import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { R2Storage } from "@/lib/storage/r2";

function make(send: (c: unknown) => Promise<unknown>) {
  const client = { send: vi.fn(send) };
  return { client, storage: new R2Storage({ client, bucket: "test-bucket" }) };
}

const notFound = () => Object.assign(new Error("nope"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });

describe("R2Storage", () => {
  it("put sends Bucket, Key, Body and ContentType", async () => {
    const { client, storage } = make(async () => ({}));
    const data = new Uint8Array([1, 2, 3]);
    await storage.put("doc-abc", data, { mimeType: "application/pdf" });
    const cmd = client.send.mock.calls[0][0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: "test-bucket", Key: "doc-abc", ContentType: "application/pdf", Body: data });
  });

  it("getStream returns a web stream of the body", async () => {
    const { client, storage } = make(async () => ({
      Body: { transformToWebStream: () => new Response("hello").body },
    }));
    const stream = await storage.getStream("doc-abc");
    expect(await new Response(stream).text()).toBe("hello");
    const cmd = client.send.mock.calls[0][0] as GetObjectCommand;
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: "test-bucket", Key: "doc-abc" });
  });

  it("getStream returns null for NoSuchKey and rethrows other errors", async () => {
    expect(await make(async () => Promise.reject(notFound())).storage.getStream("k")).toBeNull();
    const boom = Object.assign(new Error("denied"), { name: "AccessDenied", $metadata: { httpStatusCode: 403 } });
    await expect(make(async () => Promise.reject(boom)).storage.getStream("k")).rejects.toBe(boom);
  });

  it("delete ignores NoSuchKey and rethrows others", async () => {
    const { client, storage } = make(async () => Promise.reject(notFound()));
    await expect(storage.delete("k")).resolves.toBeUndefined();
    expect(client.send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    const boom = Object.assign(new Error("denied"), { name: "AccessDenied" });
    await expect(make(async () => Promise.reject(boom)).storage.delete("k")).rejects.toBe(boom);
  });
});
