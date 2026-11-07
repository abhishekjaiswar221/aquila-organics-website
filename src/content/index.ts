import type { Block } from "./types";

/** Blocks marked "hidden" never render, even though their data exists. */
export function visibleBlocks<T>(blocks: Block<T>[]): Block<T>[] {
  return blocks.filter((b) => b.status !== "hidden");
}

/** Ids of blocks that still need the client's confirmation before launch. */
export function unflaggedClaims(blocks: Block<unknown>[]): string[] {
  return blocks.filter((b) => b.status === "needs-client-confirmation").map((b) => b.id);
}

export type { Block, ContentStatus } from "./types";
