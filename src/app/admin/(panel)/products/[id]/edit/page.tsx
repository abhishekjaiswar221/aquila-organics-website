import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { Badge, PageHeader, linkCls } from "@/components/admin/ui";
import { adminMetadata } from "@/features/admin/metadata";
import { updateProduct } from "@/features/products/edit-actions";
import { getProductForEdit, listCategoryOptions } from "@/features/products/edit-queries";
import { requireAction } from "@/lib/permissions";

// Per request (session + database), no `use cache`.
export const instant = false;
export const metadata = adminMetadata("Edit product");

const STATUS_LABELS = { DRAFT: "Draft", PUBLISHED: "Published", ARCHIVED: "Archived" } as const;

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]/edit">) {
  await requireAction("products.edit");
  const { id } = await params;
  const product = await getProductForEdit(id);
  if (!product) notFound();
  const categories = await listCategoryOptions();
  return (
    <>
      <PageHeader title="Edit product">
        <Link href="/admin/products" className={linkCls}>
          Back to products
        </Link>
      </PageHeader>
      <p className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span>{product.name}</span>
        <Badge value={product.status}>{STATUS_LABELS[product.status]}</Badge>
        <span className="text-muted-foreground">{product.verified ? "Verified" : "Not verified"}</span>
      </p>
      <ProductForm action={updateProduct} categories={categories} product={product} />
    </>
  );
}
