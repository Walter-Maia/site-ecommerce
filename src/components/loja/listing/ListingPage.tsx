import type { Category, Gender, ProductSort } from "@/lib/types";
import { itemListJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { STATIC_DEMO } from "@/lib/static-demo";
import { listCategories, listProducts } from "@/server/catalog";
import { StaticListingPage } from "@/static/components/StaticListingPage";
import type { Crumb } from "../Breadcrumbs";
import { ProductCard } from "../ProductCard";
import type { FacetConfig } from "./Filters";
import { LISTING_CARD_SIZES, ListingView } from "./ListingView";
import { applyLocalFilters, availableSizes, listingHeading, parseFilters, type ListingFacets, type RawParams } from "./query";

export interface ListingPageProps {
  title: string;
  intro: string;
  basePath: string;
  crumbs: Crumb[];
  searchParams: RawParams;
  /** Recorte fixo da página (ex.: gênero em /feminino, categoria em /categoria/x). */
  fixed: { category?: Category["slug"]; gender?: Gender; onlyNew?: boolean };
  facets: ListingFacets;
  defaultSort?: ProductSort;
  aside?: React.ReactNode;
}

export async function ListingPage({ title, intro, basePath, crumbs, searchParams, fixed, facets, defaultSort = "relevancia", aside }: ListingPageProps) {
  // Demo estática (GitHub Pages): sem searchParams no servidor; a lista completa vai no HTML e o cliente filtra pela URL.
  if (STATIC_DEMO) return <StaticListingPage {...{ title, intro, basePath, crumbs, fixed, facets, defaultSort, aside }} />;

  const categories = await listCategories();
  const f = parseFilters(searchParams, categories, defaultSort);
  const { items: base } = await listProducts({
    category: fixed.category ?? (facets.categories ? f.categoria : undefined),
    gender: fixed.gender ?? (facets.gender ? f.genero : undefined),
    sort: f.ordem,
  });
  const scoped = fixed.onlyNew && !f.colecao ? base.filter((p) => p.isNew) : base;
  const products = applyLocalFilters(scoped, facets.collection ? f : { ...f, colecao: undefined });

  // Categorias oferecidas: só as que têm peça neste recorte.
  const { items: everything } = await listProducts({ gender: fixed.gender, category: fixed.category });
  const catsHere = facets.categories ? categories.filter((c) => everything.some((p) => p.category === c.slug)) : undefined;
  const facetConfig: FacetConfig = { categories: catsHere, gender: facets.gender, collection: facets.collection, sizes: availableSizes(everything) };
  const { heading } = listingHeading(title, crumbs, basePath, f, facets);

  return (
    <ListingView
      title={title}
      intro={intro}
      basePath={basePath}
      crumbs={crumbs}
      filters={f}
      facets={facets}
      facetConfig={facetConfig}
      categories={categories}
      defaultSort={defaultSort}
      count={products.length}
      cards={products.map((p) => ({ id: p.id, node: <ProductCard product={p} sizes={LISTING_CARD_SIZES} /> }))}
      head={<JsonLd data={itemListJsonLd(products, heading)} />}
      aside={aside}
    />
  );
}
