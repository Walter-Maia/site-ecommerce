import { applyLocalFilters, type ListingFacets, type ListingFilters } from "@/components/loja/listing/query";
import type { Category, Gender, Product } from "@/lib/types";
import { compareProducts, matchesGender } from "./catalog-query";

/**
 * Listagem da demo estática: o mesmo resultado que a ListingPage calcula no
 * servidor (listProducts + filtros locais), mas sobre a lista do recorte já
 * entregue no HTML. Roda no build (estado inicial) e no navegador (URL).
 */

/** O mínimo de cada peça para filtrar/ordenar no cliente (os cards vão prontos). */
export type ListingItem = Pick<Product, "id" | "category" | "gender" | "collection" | "price" | "sizes" | "isNew" | "isFeatured" | "reviewCount" | "createdAt"> & {
  position: number;
};

export interface ListingScope {
  category?: Category["slug"];
  gender?: Gender;
  onlyNew?: boolean;
}

export function computeListing(items: ListingItem[], f: ListingFilters, fixed: ListingScope, facets: ListingFacets): ListingItem[] {
  const category = fixed.category ?? (facets.categories ? f.categoria : undefined);
  const gender = fixed.gender ?? (facets.gender ? f.genero : undefined);
  const base = items.filter((p) => (!category || p.category === category) && matchesGender(p.gender, gender)).sort(compareProducts(f.ordem));
  const scoped = fixed.onlyNew && !f.colecao ? base.filter((p) => p.isNew) : base;
  return applyLocalFilters(scoped, facets.collection ? f : { ...f, colecao: undefined });
}
