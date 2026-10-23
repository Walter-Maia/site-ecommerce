import Link from "next/link";
import type { Category, Gender, ProductSort } from "@/lib/types";
import { itemListJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { listCategories, listProducts } from "@/server/catalog";
import { Breadcrumbs, type Crumb } from "../Breadcrumbs";
import { PRICE_RANGES } from "../constants";
import { IconClose } from "../icons";
import { ProductCard } from "../ProductCard";
import { FilterForm, SortForm, type FacetConfig } from "./Filters";
import { applyLocalFilters, availableSizes, collectionName, hrefWith, parseFilters, type RawParams } from "./query";

interface ListingPageProps {
  title: string;
  intro: string;
  basePath: string;
  crumbs: Crumb[];
  searchParams: RawParams;
  /** Recorte fixo da página (ex.: gênero em /feminino, categoria em /categoria/x). */
  fixed: { category?: Category["slug"]; gender?: Gender; onlyNew?: boolean };
  facets: { categories?: boolean; gender?: boolean; collection?: boolean };
  defaultSort?: ProductSort;
  aside?: React.ReactNode;
}

export async function ListingPage({ title, intro, basePath, crumbs, searchParams, fixed, facets, defaultSort = "relevancia", aside }: ListingPageProps) {
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

  const active: { label: string; href: string }[] = [];
  if (facets.categories && f.categoria) active.push({ label: categories.find((c) => c.slug === f.categoria)!.name, href: hrefWith(basePath, f, { categoria: undefined }, defaultSort) });
  if (facets.collection && f.colecao) active.push({ label: collectionName(f.colecao)!, href: hrefWith(basePath, f, { colecao: undefined }, defaultSort) });
  if (facets.gender && f.genero) active.push({ label: f.genero === "feminino" ? "Feminino" : "Masculino", href: hrefWith(basePath, f, { genero: undefined }, defaultSort) });
  for (const s of f.tamanho) active.push({ label: `Tamanho ${s}`, href: hrefWith(basePath, f, { tamanho: f.tamanho.filter((x) => x !== s) }, defaultSort) });
  if (f.preco) active.push({ label: PRICE_RANGES.find((p) => p.value === f.preco)!.label, href: hrefWith(basePath, f, { preco: undefined }, defaultSort) });

  const key = JSON.stringify(f);
  // Com coleção escolhida, a página assume o nome da coleção.
  const colName = facets.collection ? collectionName(f.colecao) : undefined;
  const heading = colName ?? title;
  const trail = colName ? [...crumbs, { name: colName, path: `${basePath}?colecao=${f.colecao}` }] : crumbs;

  return (
    <main id="conteudo" className="pb-24">
      <JsonLd data={itemListJsonLd(products, heading)} />
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
              <span className="tabular font-semibold text-ink">{products.length}</span> {products.length === 1 ? "produto" : "produtos"}
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

          {products.length ? (
            <ul className="grid grid-cols-2 gap-x-2.5 gap-y-10 md:grid-cols-3 md:gap-x-4 2xl:grid-cols-4">
              {products.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 26vw, (min-width: 768px) 31vw, 48vw" />
                </li>
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
