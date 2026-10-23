import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Breadcrumbs } from "@/components/loja/Breadcrumbs";
import { POPULAR_SEARCHES } from "@/components/loja/constants";
import { IconSearch } from "@/components/loja/icons";
import { ProductCard } from "@/components/loja/ProductCard";
import { itemListJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { listCategories, listProducts, searchProducts } from "@/server/catalog";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const readQ = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? "").trim().slice(0, 80);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = readQ((await searchParams).q);
  return {
    title: q ? `Busca: ${q}` : "Buscar",
    description: "Busque camisetas, jerseys, moletons, alfaiataria e acessórios da KIM KRISS por nome, cor ou estilo.",
    alternates: { canonical: "/busca" },
    // Páginas de resultado não entram no índice; os links seguem rastreáveis.
    robots: q ? { index: false, follow: true } : undefined,
  };
}

const GRID_SIZES = "(min-width: 1280px) 23vw, (min-width: 768px) 31vw, 48vw";

export default async function BuscaPage({ searchParams }: Props) {
  const q = readQ((await searchParams).q);
  const [results, categories, best] = await Promise.all([
    q ? searchProducts(q, 48) : Promise.resolve([]),
    listCategories(),
    listProducts({ sort: "relevancia", limit: 4 }),
  ]);

  return (
    <main id="conteudo" className="gutter pb-24 pt-5">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Busca", path: "/busca" },
        ]}
      />
      <h1 className="t-display mt-6 text-[clamp(3rem,8vw,6.5rem)]">{q ? "Resultados" : "Buscar"}</h1>

      <Form action="/busca" role="search" className="underline-field mt-8 flex max-w-3xl items-center gap-3 border-b border-ink pb-2">
        <label htmlFor="busca-pagina" className="sr-only">
          O que você procura?
        </label>
        <IconSearch size={24} className="shrink-0" />
        <input
          id="busca-pagina"
          name="q"
          type="search"
          defaultValue={q}
          key={q}
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Camiseta, jersey, moletom…"
          className="min-h-14 w-full min-w-0 bg-transparent font-serif text-[clamp(1.4rem,3.5vw,2.2rem)] tracking-[-0.02em] no-ring outline-none placeholder:text-mute/70"
        />
        <button type="submit" className="btn btn-solid shrink-0 px-5">
          Buscar
        </button>
      </Form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="t-label mr-2 text-mute">Mais buscados</span>
        {POPULAR_SEARCHES.map((s) => (
          <Link
            key={s}
            href={`/busca?q=${encodeURIComponent(s)}`}
            aria-current={s === q ? "page" : undefined}
            className="inline-flex min-h-11 items-center border border-line px-4 text-sm transition-colors hover:border-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
          >
            {s}
          </Link>
        ))}
      </div>

      {q && results.length > 0 ? (
        <section aria-labelledby="resultados-titulo" className="mt-14">
          <JsonLd data={itemListJsonLd(results, `Busca: ${q}`)} />
          <h2 id="resultados-titulo" className="mb-8 text-sm text-ink-2" aria-live="polite">
            <span className="tabular font-semibold text-ink">{results.length}</span> {results.length === 1 ? "resultado" : "resultados"} para “{q}”
          </h2>
          <ul className="grid grid-cols-2 gap-x-2.5 gap-y-10 md:grid-cols-3 md:gap-x-4 xl:grid-cols-4">
            {results.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} sizes={GRID_SIZES} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q && results.length === 0 ? (
        <section aria-labelledby="vazio-titulo" className="mt-14 grid gap-10 border-t border-line pt-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <h2 id="vazio-titulo" className="font-serif text-3xl leading-tight tracking-[-0.02em]" aria-live="polite">
              Nada encontrado para “{q}”.
            </h2>
            <ul className="mt-5 space-y-2 text-[0.95rem] text-ink-2">
              <li>Confira a grafia ou use uma palavra só, como “moletom”.</li>
              <li>Busque pela cor (“preto”, “off-white”) ou pelo estilo (“oversized”, “y2k”).</li>
              <li>Navegue pelas categorias ao lado.</li>
            </ul>
          </div>
          <nav aria-label="Categorias" className="md:col-span-6 md:col-start-7">
            <ul className="grid grid-cols-2 gap-x-6">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/categoria/${c.slug}`} className="link-line inline-flex min-h-11 items-center font-serif text-xl">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      ) : null}

      {!q || results.length === 0 ? (
        <section aria-labelledby="sugestoes-titulo" className="mt-20">
          <h2 id="sugestoes-titulo" className="t-title mb-8">
            {q ? "Talvez você goste" : "Mais vendidos"}
          </h2>
          <ul className="grid grid-cols-2 gap-x-2.5 gap-y-10 md:grid-cols-4 md:gap-x-4">
            {best.items.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} sizes={GRID_SIZES} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
