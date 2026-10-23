import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { IconSearch } from "@/components/loja/icons";
import { Logo } from "@/components/loja/Logo";
import { POPULAR_SEARCHES } from "@/components/loja/constants";
import { CATEGORIES, NAV, SITE } from "@/data/site";

/**
 * 404 global (URLs que não casam com nenhuma rota). Fica fora do layout da
 * loja, então traz um cabeçalho enxuto próprio. O Next injeta
 * <meta name="robots" content="noindex"> em toda resposta 404.
 */
export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "Essa página não existe. Busque uma peça ou volte para as novidades da KIM & KRIS.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-paper text-ink">
      <a href="#conteudo" className="sr-only-focusable fixed left-3 top-3 z-50 bg-ink px-4 py-3 text-sm text-paper">
        Pular para o conteúdo
      </a>
      <header className="border-b border-line">
        <div className="gutter flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={`${SITE.name}, voltar para a página inicial`} className="inline-flex min-h-11 items-center">
            <Logo title="" className="size-11" />
          </Link>
          <nav aria-label="Principal">
            <ul className="flex items-center gap-1 text-sm">
              {NAV.primary.map((l) => (
                <li key={l.href} className="hidden sm:block">
                  <Link href={l.href} className="link-line inline-flex min-h-11 items-center px-2">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="sm:hidden">
                <Link href="/novidades" className="link-line inline-flex min-h-11 items-center px-2">
                  Loja
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="gutter flex-1 pb-24 pt-14 md:pt-20">
        <p className="t-cond tabular text-sm font-semibold text-mute">Erro 404</p>
        <h1 className="t-display mt-3 max-w-3xl text-[clamp(3rem,8vw,6.5rem)]">Bola fora.</h1>
        <p className="mt-5 max-w-md text-ink-2">
          Essa página não existe ou a peça saiu da loja. Busque pelo nome, cor ou estilo, ou siga por um dos caminhos abaixo.
        </p>

        <Form action="/busca" role="search" className="underline-field mt-10 flex max-w-2xl items-center gap-3 border-b border-ink pb-2">
          <label htmlFor="busca-404" className="sr-only">
            O que você procura?
          </label>
          <IconSearch size={22} className="shrink-0" />
          <input
            id="busca-404"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Camiseta, jersey, moletom…"
            className="min-h-12 w-full min-w-0 bg-transparent font-serif text-[clamp(1.25rem,3vw,1.8rem)] tracking-[-0.02em] no-ring outline-none placeholder:text-mute"
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
              className="inline-flex min-h-11 items-center border border-line px-4 text-sm transition-colors hover:border-ink"
            >
              {s}
            </Link>
          ))}
        </div>

        <div className="mt-16 grid gap-12 border-t border-line pt-10 md:grid-cols-12">
          <nav aria-labelledby="nf-categorias" className="md:col-span-7">
            <h2 id="nf-categorias" className="t-label mb-4 text-mute">
              Categorias
            </h2>
            <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/categoria/${c.slug}`} className="link-line inline-flex min-h-11 items-center font-serif text-lg">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="md:col-span-4 md:col-start-9">
            <h2 className="t-label mb-4 text-mute">Atalhos</h2>
            <div className="flex flex-col items-start gap-3">
              <Link href="/novidades" className="btn btn-solid">
                Ver novidades
              </Link>
              <Link href="/provador" className="btn">
                Abrir o Provador 3D
              </Link>
              <Link href="/ajuda" className="link-line inline-flex min-h-11 items-center text-sm">
                Ajuda e perguntas frequentes
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <p className="gutter py-6 text-xs text-mute">
          {SITE.name} — loja de demonstração. Nenhum pagamento é cobrado.
        </p>
      </footer>
    </div>
  );
}
