// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStorage } from "@/lib/storage/local";

async function readAll(stream: ReadableStream): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

describe("LocalStorage", () => {
  let dir: string;
  let storage: LocalStorage;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "aquila-storage-"));
    storage = new LocalStorage(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips bytes", async () => {
    const data = new Uint8Array([1, 2, 3, 250, 0, 9]);
    await storage.put("abc123", data, { mimeType: "application/pdf" });
    const stream = await storage.getStream("abc123");
    expect(stream).not.toBeNull();
    expect(await readAll(stream!)).toEqual(data);
  });

  it("returns null for a missing key", async () => {
    expect(await storage.getStream("missing")).toBeNull();
  });

  it("deletes, and delete of a missing key is a no-op", async () => {
    await storage.put("k1", new Uint8Array([1]), { mimeType: "x" });
    await storage.delete("k1");
    expect(await storage.getStream("k1")).toBeNull();
    await expect(storage.delete("k1")).resolves.toBeUndefined();
    expect(await readdir(dir)).toEqual([]);
  });

  const bad = [
    "../x",
    "..",
    "a/../b",
    "a/b",
    "a\\b",
    "..\\x",
    "a\u0000b",
    "/etc/passwd",
    "\\windows\\system32",
    "C:\\x",
    "C:x",
    "",
  ];
  for (const key of bad) {
    it(`refuses key ${JSON.stringify(key)}`, async () => {
      await expect(
        storage.put(key, new Uint8Array([1]), { mimeType: "x" }),
      ).rejects.toThrow();
      await expect(storage.getStream(key)).rejects.toThrow();
      await expect(storage.delete(key)).rejects.toThrow();
    });
  }

  it("writes nothing outside the root", async () => {
    await expect(
      storage.put("../escape", new Uint8Array([1]), { mimeType: "x" }),
    ).rejects.toThrow();
    expect(await readdir(path.dirname(dir))).not.toContain("escape");
  });
});
