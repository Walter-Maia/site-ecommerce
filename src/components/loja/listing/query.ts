import type { Category, CategorySlug, Gender, Product, ProductSort, Size } from "@/lib/types";
import type { Crumb } from "../Breadcrumbs";
import { COLLECTIONS, PRICE_RANGES, SIZE_ORDER, SORTS } from "../constants";

export type RawParams = Record<string, string | string[] | undefined>;

export interface ListingFilters {
  categoria?: CategorySlug;
  genero?: Exclude<Gender, "unissex">;
  colecao?: (typeof COLLECTIONS)[number]["slug"];
  tamanho: Size[];
  preco?: (typeof PRICE_RANGES)[number]["value"];
  ordem: ProductSort;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** Lê e valida searchParams: valores desconhecidos são ignorados. */
export function parseFilters(raw: RawParams, categories: Category[], defaultSort: ProductSort = "relevancia"): ListingFilters {
  const categoria = first(raw.categoria);
  const genero = first(raw.genero);
  const colecao = first(raw.colecao);
  const preco = first(raw.preco);
  const ordem = first(raw.ordem);
  const sizes = new Set<string>(SIZE_ORDER);
  return {
    categoria: categories.some((c) => c.slug === categoria) ? (categoria as CategorySlug) : undefined,
    genero: genero === "feminino" || genero === "masculino" ? genero : undefined,
    colecao: COLLECTIONS.find((c) => c.slug === colecao)?.slug,
    tamanho: all(raw.tamanho).filter((s): s is Size => sizes.has(s)).slice(0, 12),
    preco: PRICE_RANGES.find((p) => p.value === preco)?.value,
    ordem: (SORTS.find((s) => s.value === ordem)?.value ?? defaultSort) as ProductSort,
  };
}

export const collectionName = (slug?: string) => COLLECTIONS.find((c) => c.slug === slug)?.name;

/** Filtros que o contrato não cobre (coleção, tamanho com estoque, faixa de preço). */
export function applyLocalFilters<P extends Pick<Product, "collection" | "price" | "sizes">>(items: P[], f: ListingFilters): P[] {
  const range = PRICE_RANGES.find((p) => p.value === f.preco);
  const colName = collectionName(f.colecao);
  return items.filter((p) => {
    if (colName && p.collection !== colName) return false;
    if (range && (p.price < range.min || p.price >= range.max)) return false;
    if (f.tamanho.length && !p.sizes.some((s) => s.stock > 0 && f.tamanho.includes(s.size))) return false;
    return true;
  });
}

/** Tamanhos presentes num conjunto de produtos, na ordem da grade. */
export function availableSizes(items: Pick<Product, "sizes">[]): Size[] {
  const present = new Set(items.flatMap((p) => p.sizes.map((s) => s.size)));
  return SIZE_ORDER.filter((s) => present.has(s)) as Size[];
}

/** Monta a URL da listagem com um filtro trocado (ou removido com `undefined`). */
export function hrefWith(basePath: string, f: ListingFilters, patch: Partial<Record<keyof ListingFilters, string | string[] | undefined>>, defaultSort: ProductSort = "relevancia") {
  const merged: Record<string, string | string[] | undefined> = {
    categoria: f.categoria,
    genero: f.genero,
    colecao: f.colecao,
    tamanho: f.tamanho,
    preco: f.preco,
    ordem: f.ordem === defaultSort ? undefined : f.ordem,
    ...patch,
  };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    for (const val of all(v)) qs.append(k, val);
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Facetas que cada listagem oferece (ex.: /novidades tem categoria e coleção). */
export interface ListingFacets {
  categories?: boolean;
  gender?: boolean;
  collection?: boolean;
}

/** Chips de "Filtros ativos", cada um com o link que o remove. */
export function activeFilters(basePath: string, f: ListingFilters, facets: ListingFacets, categories: Category[], defaultSort: ProductSort) {
  const active: { label: string; href: string }[] = [];
  if (facets.categories && f.categoria) active.push({ label: categories.find((c) => c.slug === f.categoria)!.name, href: hrefWith(basePath, f, { categoria: undefined }, defaultSort) });
  if (facets.collection && f.colecao) active.push({ label: collectionName(f.colecao)!, href: hrefWith(basePath, f, { colecao: undefined }, defaultSort) });
  if (facets.gender && f.genero) active.push({ label: f.genero === "feminino" ? "Feminino" : "Masculino", href: hrefWith(basePath, f, { genero: undefined }, defaultSort) });
  for (const s of f.tamanho) active.push({ label: `Tamanho ${s}`, href: hrefWith(basePath, f, { tamanho: f.tamanho.filter((x) => x !== s) }, defaultSort) });
  if (f.preco) active.push({ label: PRICE_RANGES.find((p) => p.value === f.preco)!.label, href: hrefWith(basePath, f, { preco: undefined }, defaultSort) });
  return active;
}

/** Com coleção escolhida, a página assume o nome da coleção (título e trilha). */
export function listingHeading(title: string, crumbs: Crumb[], basePath: string, f: ListingFilters, facets: ListingFacets) {
  const colName = facets.collection ? collectionName(f.colecao) : undefined;
  return {
    colName,
    heading: colName ?? title,
    trail: colName ? [...crumbs, { name: colName, path: `${basePath}?colecao=${f.colecao}` }] : crumbs,
  };
}
