import { CategoryManager } from "@/components/admin/category-manager";
import { PageHeader } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { listCategories } from "@/features/categories/queries";
import { requireAction } from "@/lib/permissions";

// Per request (session + database), no `use cache`: a change shows at once.
export const instant = false;
export const metadata = adminMetadata("Categories");

export default async function AdminCategoriesPage() {
  await requireAction("products.edit");
  const categories = await listCategories();
  return (
    <>
      <PageHeader title="Categories">
        {categories.length} {categories.length === 1 ? "category" : "categories"}. A category can be deleted only when no
        product uses it.
      </PageHeader>
      <CategoryManager categories={categories} />
    </>
  );
}
