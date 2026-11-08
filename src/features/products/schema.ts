import { z } from "zod";
import { isValidCas } from "@/lib/cas";

/** Lowercase kebab slug, ASCII only; punctuation collapses to single hyphens. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Makes slugs unique within a list: the first keeps its slug, later duplicates
 * get -2, -3 ... Deterministic, and never collides with another slug in the list.
 */
export function assignUniqueSlugs(slugs: readonly string[]): string[] {
  const taken = new Set(slugs);
  const used = new Set<string>();
  return slugs.map((slug) => {
    if (!used.has(slug)) {
      used.add(slug);
      return slug;
    }
    let n = 2;
    while (used.has(`${slug}-${n}`) || taken.has(`${slug}-${n}`)) n += 1;
    const next = `${slug}-${n}`;
    used.add(next);
    return next;
  });
}

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const productInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Name is too long (200 max)"),
    slug: optionalText(200),
    code: optionalText(100),
    casNumber: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .refine(isValidCas, "Invalid CAS number (check the format and check digit)")
        .optional(),
    ),
    category: optionalText(200),
    description: optionalText(10_000),
    specifications: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(200),
          value: z.string().trim().min(1).max(1000),
        }),
      )
      .max(100)
      .optional(),
    applications: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    sourceNote: optionalText(2000),
  })
  .transform((data, ctx) => {
    const slug = slugify(data.slug ?? data.name);
    if (!slug) {
      ctx.issues.push({
        code: "custom",
        message: "Name must contain letters or digits to build a slug",
        path: ["name"],
        input: data.name,
      });
      return z.NEVER;
    }
    return { ...data, slug };
  });

export type ProductInput = z.output<typeof productInputSchema>;
