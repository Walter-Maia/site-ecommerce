import { listProducts } from "@/server/catalog";

/** Demo estática: a PDP original, pré-gerada para todos os produtos do catálogo. */
export { default, generateMetadata } from "@/app/(loja)/produto/[slug]/page";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listProducts()).items.map((p) => ({ slug: p.slug }));
}
