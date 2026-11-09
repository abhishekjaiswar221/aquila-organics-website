import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Modules that can return a private storage key must refuse to be bundled
// into a client component: `import "server-only"` makes that a build error.
const SRC = path.resolve(__dirname, "../../src");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

describe("storage keys stay on the server", () => {
  it("the product document query module carries the server-only guard", () => {
    const source = read("features/products/document-queries.ts");
    expect(source).toMatch(/^import "server-only";?\r?\n/);
    expect(source).toMatch(/export async function getPublishedDocumentFile\b/);
  });

  it("the shared catalogue query module (also loaded by the proxy) selects no storage key", () => {
    const source = read("features/products/queries.ts");
    expect(source).not.toMatch(/storageKey/);
  });
});
