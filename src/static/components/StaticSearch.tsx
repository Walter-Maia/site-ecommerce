"use client";

import Form from "next/form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Breadcrumbs } from "@/components/loja/Breadcrumbs";
import { POPULAR_SEARCHES } from "@/components/loja/constants";
import { IconSearch } from "@/components/loja/icons";
import { SITE } from "@/data/site";
import type { Category } from "@/lib/types";
import { matchesTerms, searchTerms } from "../catalog-query";

/**
 * /busca na demo estática. Mesma marcação de src/app/(loja)/busca/page.tsx,
 * mas o `?q=` é lido no navegador e a busca roda sobre o índice do catálogo
 * (mesmo texto e mesmas regras do SQLite: termos sem acento, até 6, todos
 * presentes, até 48 resultados por relevância). Os cards vêm prontos do build.
 */

export interface SearchData {
  categories: Category[];
  /** Na ordem de relevância. */
  index: { id: string; text: string }[];
  cards: Record<string, React.ReactNode>;
  best: string[];
}

const readQ = (v: string | null) => (v ?? "").trim().slice(0, 80);

export function SearchView({ q, results, data }: { q: string; results: string[]; data: SearchData }) {
  const { categories, cards, best } = data;
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
          <h2 id="resultados-titulo" className="mb-8 text-sm text-ink-2" aria-live="polite">
            <span className="tabular font-semibold text-ink">{results.length}</span> {results.length === 1 ? "resultado" : "resultados"} para “{q}”
          </h2>
          <ul className="grid grid-cols-2 gap-x-2.5 gap-y-10 md:grid-cols-3 md:gap-x-4 xl:grid-cols-4">
            {results.map((id) => (
              <li key={id}>{cards[id]}</li>
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
            {best.map((id) => (
              <li key={id}>{cards[id]}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export function StaticSearch({ data }: { data: SearchData }) {
  const q = readQ(useSearchParams().get("q"));
  const results = useMemo(() => {
    const terms = searchTerms(q);
    return q ? data.index.filter((p) => matchesTerms(p.text, terms)).slice(0, 48).map((p) => p.id) : [];
  }, [q, data.index]);

  // O título do servidor ("Busca: …") não existe no HTML estático: ajusta no cliente. O Next
  // reaplica o <title> do metadata depois da hidratação, então o ajuste se mantém enquanto a busca
  // estiver na tela (só escreve se mudou: sem laço).
  useEffect(() => {
    const title = `${q ? `Busca: ${q}` : "Buscar"} | ${SITE.name}`;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, [q]);

  return <SearchView q={q} results={results} data={data} />;
}
