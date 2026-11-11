import { slugify } from "@/features/products/schema";

export const CATEGORY_NAME_MAX = 100;

export type CategoryNameResult = { ok: true; name: string; slug: string } | { ok: false; error: string };

/** A category name from untrusted input: control characters stripped, whitespace collapsed, slug derived. */
export function parseCategoryName(value: unknown): CategoryNameResult {
  if (typeof value !== "string") return { ok: false, error: "Enter a category name." };
  const name = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name === "") return { ok: false, error: "Enter a category name." };
  if (name.length > CATEGORY_NAME_MAX) return { ok: false, error: `Use ${CATEGORY_NAME_MAX} characters or fewer.` };
  const slug = slugify(name);
  if (!slug) return { ok: false, error: "Use at least one letter or number." };
  return { ok: true, name, slug };
}

export const CATEGORY_INTENTS = ["create", "rename", "move", "delete"] as const;
export type CategoryIntent = (typeof CATEGORY_INTENTS)[number];

export function parseCategoryIntent(value: unknown): CategoryIntent | null {
  return typeof value === "string" && (CATEGORY_INTENTS as readonly string[]).includes(value)
    ? (value as CategoryIntent)
    : null;
}

export function parseMoveDirection(value: unknown): "up" | "down" | null {
  return value === "up" || value === "down" ? value : null;
}
