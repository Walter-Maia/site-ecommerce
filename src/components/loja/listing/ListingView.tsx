import Link from "next/link";
import type { Category, ProductSort } from "@/lib/types";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs";
import { IconClose } from "../icons";
import { FilterForm, SortForm, type FacetConfig } from "./Filters";
import { activeFilters, listingHeading, type ListingFacets, type ListingFilters } from "./query";

/** `sizes` dos cards da grade de listagem. */
export const LISTING_CARD_SIZES = "(min-width: 1536px) 20vw, (min-width: 1024px) 26vw, (min-width: 768px) 31vw, 48vw";

export interface ListingViewProps {
  title: string;
  intro: string;
  basePath: string;
  crumbs: Crumb[];
  filters: ListingFilters;
  facets: ListingFacets;
  facetConfig: FacetConfig;
  categories: Category[];
  defaultSort: ProductSort;
  /** Total exibido no contador (= cards.length). */
  count: number;
  /** Cards já renderizados, na ordem final. */
  cards: { id: string; node: React.ReactNode }[];
  /** Conteúdo no topo do <main> (ex.: JSON-LD da lista). */
  head?: React.ReactNode;
  aside?: React.ReactNode;
}

/**
 * Marcação da listagem (sem dados): usada pela ListingPage (servidor, filtros na URL
 * lidos no servidor) e, na demo estática, pela StaticListing (filtros lidos no cliente).
 */
export function ListingView({ title, intro, basePath, crumbs, filters: f, facets, facetConfig, categories, defaultSort, count, cards, head, aside }: ListingViewProps) {
  const active = activeFilters(basePath, f, facets, categories, defaultSort);
  const key = JSON.stringify(f);
  const { colName, heading, trail } = listingHeading(title, crumbs, basePath, f, facets);

  return (
    <main id="conteudo" className="pb-24">
      {head}
      <header className="gutter grid gap-6 pb-8 pt-6 md:grid-cols-12 md:items-end md:pb-12 md:pt-8">
        <div className="md:col-span-7">
          <Breadcrumbs items={trail} />
          {colName ? <p className="mt-6 text-sm text-mute">Coleção</p> : null}
          <h1 className={`t-display text-[clamp(3rem,8vw,6.5rem)] ${colName ? "mt-2" : "mt-6"}`} data-reveal="lines">
            <span className="rl">
              <span>{heading}</span>
            </span>
          </h1>
        </div>
        <p className="max-w-md text-[0.98rem] leading-relaxed text-ink-2 md:col-span-4 md:col-start-9 md:justify-self-end">{intro}</p>
      </header>

      {aside}

      <div className="gutter lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <aside aria-label="Filtros" className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100svh-var(--header-h)-3rem)] overflow-y-auto pb-6 no-scrollbar" data-lenis-prevent>
            <FilterForm key={key} basePath={basePath} filters={f} facets={facetConfig} idPrefix="d" defaultSort={defaultSort} />
          </div>
        </aside>

        <section aria-labelledby="resultado-titulo">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line py-3 lg:border-t-0 lg:pt-0">
            <h2 id="resultado-titulo" className="text-sm text-ink-2" aria-live="polite">
              <span className="tabular font-semibold text-ink">{count}</span> {count === 1 ? "produto" : "produtos"}
            </h2>
            <SortForm key={`s-${key}`} basePath={basePath} filters={f} facets={facetConfig} idPrefix="s" />
          </div>

          <details className="group mb-4 border-y border-line lg:hidden">
            <summary className="flex min-h-12 items-center justify-between">
              <span className="t-label">
                Filtrar{active.length ? <span className="tabular"> ({active.length})</span> : null}
              </span>
              <span aria-hidden="true" className="text-xl leading-none group-open:rotate-45 transition-transform">
                +
              </span>
            </summary>
            <div className="pb-6">
              <FilterForm key={`m-${key}`} basePath={basePath} filters={f} facets={facetConfig} idPrefix="m" defaultSort={defaultSort} />
            </div>
          </details>

          {active.length ? (
            <ul className="mb-6 flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
              {active.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} scroll={false} className="inline-flex min-h-10 items-center gap-2 bg-sand pl-3.5 pr-2.5 text-sm transition-colors hover:bg-line">
                    {a.label}
                    <IconClose size={14} />
                    <span className="sr-only">(remover filtro)</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href={basePath} scroll={false} className="link-line ml-2 inline-flex min-h-10 items-center text-sm text-mute hover:text-ink">
                  Limpar tudo
                </Link>
              </li>
            </ul>
          ) : null}

          {cards.length ? (
            <ul className="grid grid-cols-2 gap-x-2.5 gap-y-10 md:grid-cols-3 md:gap-x-4 2xl:grid-cols-4">
              {cards.map((c) => (
                <li key={c.id}>{c.node}</li>
              ))}
            </ul>
          ) : (
            <div className="border-t border-line py-16">
              <p className="font-serif text-3xl tracking-[-0.02em]">Nenhuma peça com esses filtros.</p>
              <p className="mt-3 max-w-md text-ink-2">Tire um filtro ou veja tudo o que chegou na loja.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={basePath} className="btn btn-solid">
                  Limpar filtros
                </Link>
                <Link href="/novidades" className="btn">
                  Ver novidades
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
