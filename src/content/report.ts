import type { ContentStatus } from "./types";

export interface OpenBlock {
  module: string;
  id: string;
  status: Extract<ContentStatus, "needs-client-confirmation" | "brief-supplied">;
}

const OPEN: ReadonlySet<string> = new Set(["needs-client-confirmation", "brief-supplied"]);

function isBlock(value: unknown): value is { id: string; status: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.status === "string" && "data" in v;
}

function walk(value: unknown, moduleName: string, out: OpenBlock[]): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, moduleName, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if (isBlock(value)) {
    if (OPEN.has(value.status)) out.push({ module: moduleName, id: value.id, status: value.status as OpenBlock["status"] });
    walk((value as { data?: unknown }).data, moduleName, out);
    return;
  }
  for (const child of Object.values(value)) walk(child, moduleName, out);
}

/**
 * Finds every content block that still needs the client's confirmation or came
 * from the brief only (not from the live site). Hidden and verified blocks are skipped.
 */
export function collectOpenBlocks(modules: Record<string, unknown>): OpenBlock[] {
  const out: OpenBlock[] = [];
  for (const [name, mod] of Object.entries(modules)) walk(mod, name, out);
  return out;
}
