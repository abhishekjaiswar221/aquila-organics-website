import "server-only";
import { db } from "@/lib/db";

export type CategoryRow = { id: string; name: string; slug: string; sortOrder: number; productCount: number };

/** Every category in display order (sortOrder, then name) with its product count. */
export async function listCategories(): Promise<CategoryRow[]> {
  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, sortOrder: true, _count: { select: { products: true } } },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}
