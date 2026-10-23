"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ListingView, type ListingViewProps } from "@/components/loja/listing/ListingView";
import { parseFilters, type RawParams } from "@/components/loja/listing/query";
import { computeListing, type ListingItem, type ListingScope } from "../listing";

type Props = Omit<ListingViewProps, "filters" | "count" | "cards" | "head"> & {
  fixed: ListingScope;
  items: ListingItem[];
  /** Cards renderizados no build, por id do produto. */
  cards: Record<string, React.ReactNode>;
};

function toRawParams(sp: URLSearchParams): RawParams {
  const raw: RawParams = {};
  for (const key of new Set(sp.keys())) {
    const all = sp.getAll(key);
    raw[key] = all.length > 1 ? all : all[0];
  }
  return raw;
}

/** Filtros/ordenação da listagem lidos da URL no navegador (demo estática). */
export function StaticListing({ fixed, items, cards, ...view }: Props) {
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(toRawParams(sp), view.categories, view.defaultSort), [sp, view.categories, view.defaultSort]);
  const list = useMemo(() => computeListing(items, filters, fixed, view.facets), [items, filters, fixed, view.facets]);
  return <ListingView {...view} filters={filters} count={list.length} cards={list.map((i) => ({ id: i.id, node: cards[i.id] }))} />;
}
