import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader, linkCls } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { createProduct } from "@/features/products/edit-actions";
import { listCategoryOptions } from "@/features/products/edit-queries";
import { requireAction } from "@/lib/permissions";

// Per request (session + database), no `use cache`.
export const instant = false;
export const metadata = adminMetadata("New product");

export default async function NewProductPage() {
  await requireAction("products.edit");
  const categories = await listCategoryOptions();
  return (
    <>
      <PageHeader title="New product">
        <Link href="/admin/products" className={linkCls}>
          Back to products
        </Link>
      </PageHeader>
      <ProductForm action={createProduct} categories={categories} />
    </>
  );
}
