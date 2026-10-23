import type { Metadata } from "next";
import { SITE } from "@/data/site";
import { Suspense } from "react";
import { ProductCard } from "@/components/loja/ProductCard";
import { listCategories, listProducts } from "@/server/catalog";
import { productSearchText } from "@/static/catalog-query";
import { SearchView, StaticSearch, type SearchData } from "@/static/components/StaticSearch";

/**
 * Demo estática: /busca sem servidor. O HTML traz a página "Buscar" (mais
 * vendidos); o `?q=` é lido no navegador e a busca roda no cliente sobre o
 * índice do catálogo, com os cards já renderizados no build.
 */
export const metadata: Metadata = {
  title: "Buscar",
  description: `Busque camisetas, jerseys, moletons, alfaiataria e acessórios da ${SITE.name} por nome, cor ou estilo.`,
  alternates: { canonical: "/busca" },
};

const GRID_SIZES = "(min-width: 1280px) 23vw, (min-width: 768px) 31vw, 48vw";

export default async function BuscaPage() {
  const [{ items }, categories] = await Promise.all([listProducts({ sort: "relevancia" }), listCategories()]);
  const data: SearchData = {
    categories,
    index: items.map((p) => ({ id: p.id, text: productSearchText(p) })),
    cards: Object.fromEntries(items.map((p) => [p.id, <ProductCard key={p.id} product={p} sizes={GRID_SIZES} />])),
    best: items.slice(0, 4).map((p) => p.id),
  };
  return (
    <Suspense fallback={<SearchView q="" results={[]} data={data} />}>
      <StaticSearch data={data} />
    </Suspense>
  );
}
