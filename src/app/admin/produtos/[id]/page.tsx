import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { getProductForAdmin } from "@/server/admin/products";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Editar produto" };

export default async function AdminProduto({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const product = getProductForAdmin(id);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Produtos"
        title={product.name}
        actions={
          <>
            <Link href="/admin/produtos" className="btn">
              Voltar
            </Link>
            <Link href={`/produto/${product.slug}`} className="btn" target="_blank" rel="noopener">
              Ver na loja
            </Link>
          </>
        }
      >
        <p className="mt-2 text-sm text-mute">
          {product.id} · {product.collection} · preço atual {formatPrice(product.price)}
        </p>
      </PageHeader>
      <div className="max-w-3xl">
        <ProductForm
          product={{
            id: product.id,
            price: product.price,
            compareAtPrice: product.compareAtPrice ?? null,
            isNew: product.isNew,
            isFeatured: product.isFeatured,
            sizes: product.sizes,
          }}
        />
      </div>
    </>
  );
}
