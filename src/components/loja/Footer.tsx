import Link from "next/link";
import { CASHBACK_PERCENT, MAX_INSTALLMENTS, NAV, SITE } from "@/data/site";
import { REPO_URL, STATIC_DEMO } from "@/lib/static-demo";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto bg-sand text-ink">
      <div className="gutter grid gap-12 pb-10 pt-16 md:pt-20 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="font-serif text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.05] tracking-[-0.025em]">
            Avisos de drop, convites para os jogos de rua e {CASHBACK_PERCENT}% de cashback na primeira compra.
          </p>
          <div className="mt-8 max-w-md">
            <NewsletterForm cta="Assinar" />
          </div>
        </div>

        <nav aria-label="Rodapé" className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:col-span-6 lg:col-start-7">
          {NAV.footer.map((group) => (
            <div key={group.title}>
              <h2 className="t-label mb-4 text-mute">{group.title}</h2>
              <ul className="text-[0.95rem]">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="link-line inline-flex min-h-11 items-center">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 md:col-span-1">
            <h2 className="t-label mb-4 text-mute">Compra segura</h2>
            <ul className="space-y-2 text-sm text-ink-2">
              <li>Pix ou cartão em até {MAX_INSTALLMENTS}x sem juros</li>
              <li>Troca grátis em 30 dias</li>
              <li>Nota fiscal em todo pedido</li>
              <li>
                <a href={`mailto:${SITE.email}`} className="link-line inline-flex min-h-11 items-center break-all">
                  {SITE.email}
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="gutter flex items-center gap-5 pb-8 md:gap-10">
        <Logo size="lg" className="size-28 shrink-0 md:size-44" />
        <p aria-hidden="true" className="min-w-0 font-sans text-[clamp(2.6rem,10.5vw,9.5rem)] font-extrabold uppercase italic leading-[0.86] tracking-[-0.03em] [font-stretch:75%]">
          {SITE.name}
          <span className="mt-2 block text-[0.2em] font-bold not-italic tracking-[0.32em] text-signal">Streetwear · desde {SITE.foundingYear}</span>
        </p>
      </div>

      <div className="gutter flex flex-col gap-2 border-t border-line py-6 text-xs text-mute md:flex-row md:items-center md:justify-between">
        <p>
          {SITE.name} — loja de demonstração: os pedidos são simulados e nenhum valor é cobrado.
          {STATIC_DEMO ? (
            <>
              {" "}
              Versão estática (GitHub Pages): sacola, curtidas, looks e pedidos ficam só neste navegador; login e painel admin estão na{" "}
              <a href={REPO_URL} className="underline underline-offset-2 hover:text-ink">
                versão completa com servidor
              </a>
              .
            </>
          ) : null}
        </p>
        <p className="tabular">
          © {year} {SITE.name}{SITE.city ? ` · ${SITE.city}` : ""}
        </p>
      </div>
    </footer>
  );
}
