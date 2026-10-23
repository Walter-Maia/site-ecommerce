import { Suspense } from "react";
import type { Crumb } from "@/components/loja/Breadcrumbs";
import type { FacetConfig } from "@/components/loja/listing/Filters";
import { LISTING_CARD_SIZES, ListingView } from "@/components/loja/listing/ListingView";
import { availableSizes, listingHeading, parseFilters, type ListingFacets } from "@/components/loja/listing/query";
import { ProductCard } from "@/components/loja/ProductCard";
import { itemListJsonLd, JsonLd } from "@/lib/seo/jsonld";
import type { ProductSort } from "@/lib/types";
import { listCategories, listProducts, productPosition } from "../server/catalog";
import { computeListing, type ListingItem, type ListingScope } from "../listing";
import { StaticListing } from "./StaticListing";

/**
 * Listagem na demo estática (Server Component, roda no build). Entrega no HTML
 * TODOS os cards do recorte (ex.: tudo de /feminino) já renderizados e a visão
 * padrão (sem filtros) como fallback do <Suspense>; no navegador, StaticListing
 * lê a URL (useSearchParams) e filtra/ordena os mesmos cards. Mesmas URLs
 * compartilháveis (?categoria=…&ordem=…) e mesmo visual da versão com servidor.
 */
export async function StaticListingPage({
  title,
  intro,
  basePath,
  crumbs,
  fixed,
  facets,
  defaultSort,
  aside,
}: {
  title: string;
  intro: string;
  basePath: string;
  crumbs: Crumb[];
  fixed: ListingScope;
  facets: ListingFacets;
  defaultSort: ProductSort;
  aside?: React.ReactNode;
}) {
  const categories = await listCategories();
  const { items: everything } = await listProducts({ gender: fixed.gender, category: fixed.category });
  const byId = new Map(everything.map((p) => [p.id, p]));
  const items: ListingItem[] = everything.map((p) => ({
    id: p.id,
    category: p.category,
    gender: p.gender,
    collection: p.collection,
    price: p.price,
    sizes: p.sizes,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    reviewCount: p.reviewCount,
    createdAt: p.createdAt,
    position: productPosition(p.id),
  }));
  const catsHere = facets.categories ? categories.filter((c) => everything.some((p) => p.category === c.slug)) : undefined;
  const facetConfig: FacetConfig = { categories: catsHere, gender: facets.gender, collection: facets.collection, sizes: availableSizes(everything) };
  const cards = Object.fromEntries(everything.map((p) => [p.id, <ProductCard key={p.id} product={p} sizes={LISTING_CARD_SIZES} />]));

  const initialFilters = parseFilters({}, categories, defaultSort);
  const initial = computeListing(items, initialFilters, fixed, facets);
  const view = { title, intro, basePath, crumbs, facets, facetConfig, categories, defaultSort, aside };

  return (
    <>
      {/* Fora do Suspense: o ItemList da visão padrão continua no DOM depois da hidratação. */}
      <JsonLd data={itemListJsonLd(initial.map((i) => byId.get(i.id)!), listingHeading(title, crumbs, basePath, initialFilters, facets).heading)} />
      <Suspense
        fallback={<ListingView {...view} filters={initialFilters} count={initial.length} cards={initial.map((i) => ({ id: i.id, node: cards[i.id] }))} />}
      >
        <StaticListing {...view} fixed={fixed} items={items} cards={cards} />
      </Suspense>
    </>
  );
}
