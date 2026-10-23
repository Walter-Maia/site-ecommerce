import CategoriaPage from "@/app/(loja)/categoria/[slug]/page";
import { listCategories } from "@/server/catalog";

/**
 * Demo estática: página original de categoria, pré-gerada para cada categoria
 * (no export não há rota dinâmica sob demanda) e sem searchParams no servidor.
 */
export { generateMetadata } from "@/app/(loja)/categoria/[slug]/page";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listCategories()).map((c) => ({ slug: c.slug }));
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <CategoriaPage params={params} searchParams={Promise.resolve({})} />;
}
