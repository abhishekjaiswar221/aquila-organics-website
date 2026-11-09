import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageProvider } from "./types";

// Keys are opaque ids (random tokens). Anything else is refused, so a hostile
// or buggy caller can never address a file outside the uploads root.
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export class LocalStorage implements StorageProvider {
  private readonly root: string;

  constructor(root: string = path.resolve(process.cwd(), "storage", "uploads")) {
    // The root is runtime configuration (STORAGE_LOCAL_ROOT), not a source
    // path: keep the bundler from tracing the whole project for it.
    this.root = path.resolve(/*turbopackIgnore: true*/ root);
  }

  private resolveKey(key: string): string {
    if (
      typeof key !== "string" ||
      key.includes("..") ||
      key.includes("/") ||
      key.includes("\\") ||
      key.includes("\0") ||
      key.includes(":") ||
      !SAFE_KEY.test(key)
    ) {
      throw new Error("Invalid storage key");
    }
    const full = path.resolve(this.root, key);
    // Defence in depth: the resolved path must be a direct child of the root.
    if (path.dirname(full) !== this.root || !full.startsWith(this.root + path.sep)) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(key: string, data: Uint8Array, _meta: { mimeType: string }): Promise<void> {
    void _meta;
    const full = this.resolveKey(key);
    await mkdir(this.root, { recursive: true });
    // "wx": never overwrite an existing object.
    await writeFile(full, data, { flag: "wx" });
  }

  async getStream(key: string): Promise<ReadableStream | null> {
    const full = this.resolveKey(key);
    try {
      const s = await stat(full);
      if (!s.isFile()) return null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    return Readable.toWeb(createReadStream(full)) as unknown as ReadableStream;
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveKey(key);
    try {
      await unlink(full);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
