import type { Metadata } from "next";
import { openGraph } from "@/lib/seo/metadata";
import Link from "next/link";
import { Breadcrumbs } from "@/components/loja/Breadcrumbs";
import { IconChevron } from "@/components/loja/icons";
import { FAQ, FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD, SITE } from "@/data/site";
import { formatPrice } from "@/lib/format";
import { faqJsonLd, JsonLd } from "@/lib/seo/jsonld";
import { pagePath, withBasePath } from "@/lib/static-demo";
import type { SizeChartRow } from "@/lib/types";
import { getProductBySlug } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Ajuda: como escolher o tamanho, frete e trocas",
  description:
    "Respostas rápidas sobre o Provador 3D, frete, trocas em 30 dias, pagamento em até 6x sem juros, cashback e como escolher o tamanho certo na KIM & KRIS.",
  alternates: { canonical: "/ajuda" },
  openGraph: openGraph({
    url: "/ajuda",
    title: "Ajuda | KIM & KRIS",
    description: "Como escolher o tamanho, frete, trocas em 30 dias, pagamento e cashback na KIM & KRIS.",
  }),
};

const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—");

function MiniTable({ caption, rows, cols }: { caption: string; rows: SizeChartRow[]; cols: { key: keyof SizeChartRow; label: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[300px] border-collapse text-sm">
        <caption className="mb-3 text-left font-serif text-xl">{caption}</caption>
        <thead>
          <tr className="border-b border-ink text-left">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Tamanho
            </th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 text-right font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.size} className="border-b border-line">
              <th scope="row" className="py-2 pr-3 text-left font-semibold">
                {r.size}
              </th>
              {cols.map((c) => (
                <td key={c.key} className="px-3 py-2 text-right">
                  {fmt(r[c.key] as number | undefined)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AjudaPage() {
  const [tee, shoe] = await Promise.all([getProductBySlug("camiseta-oversized-athletic-07-preta"), getProductBySlug("tenis-court-low-branco")]);

  return (
    <main id="conteudo" className="gutter pb-24 pt-5">
      <JsonLd data={faqJsonLd(FAQ)} />
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Ajuda", path: "/ajuda" },
        ]}
      />
      <header className="mt-6 grid gap-6 md:grid-cols-12 md:items-end">
        <h1 className="t-display text-[clamp(3rem,8vw,6.5rem)] md:col-span-7">Ajuda</h1>
        <p className="max-w-md text-[0.98rem] leading-relaxed text-ink-2 md:col-span-4 md:col-start-9 md:justify-self-end">
          Respostas curtas para as dúvidas mais comuns. Não achou? Escreva para{" "}
          <a href={`mailto:${SITE.email}`} className="underline underline-offset-4">
            {SITE.email}
          </a>
          .
        </p>
      </header>

      <nav aria-label="Nesta página" className="mt-10 flex flex-wrap gap-2 border-y border-line py-3">
        {[
          { href: "#perguntas", label: "Perguntas frequentes" },
          { href: "#trocas", label: "Trocas e devoluções" },
          { href: "#medidas", label: "Tabela de medidas" },
          // <a> cru (não Link): na demo estática o basePath entra à mão (no-op no servidor).
          { href: withBasePath(pagePath("/provador#como-funciona")), label: "Provador 3D" },
        ].map((l) => (
          <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center border border-line px-4 text-sm transition-colors hover:border-ink">
            {l.label}
          </a>
        ))}
      </nav>

      <section id="perguntas" aria-labelledby="perguntas-titulo" className="mt-16 grid scroll-mt-28 gap-8 md:grid-cols-12">
        <h2 id="perguntas-titulo" className="t-title md:col-span-4">
          Perguntas frequentes
        </h2>
        <div className="border-b border-line md:col-span-8">
          {FAQ.map((f, i) => (
            <details key={f.id} id={`faq-${f.id}`} className="group border-t border-line" open={i === 0}>
              <summary className="flex min-h-16 items-center justify-between gap-6 py-4">
                <h3 className="font-serif text-[clamp(1.15rem,1.6vw,1.4rem)] leading-snug tracking-[-0.01em]">{f.q}</h3>
                <IconChevron size={20} className="chev shrink-0" />
              </summary>
              <p className="max-w-[62ch] pb-6 pr-8 text-[0.98rem] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="trocas" aria-labelledby="trocas-titulo" className="mt-24 grid scroll-mt-28 gap-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <h2 id="trocas-titulo" className="t-title">
            Trocas e devoluções
          </h2>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-2">{FAQ.find((f) => f.id === "trocas")?.a}</p>
        </div>
        <ol className="grid gap-px bg-line md:col-span-8 md:grid-cols-2">
          {[
            { t: "Peça a troca", d: `Em até 30 dias depois do recebimento, escreva para ${SITE.email} com o número do pedido e o tamanho ou a peça que você quer.` },
            { t: "Embale a peça", d: "Sem uso, com a etiqueta presa e, se possível, na embalagem original. Junte uma cópia da nota fiscal." },
            { t: "Poste sem pagar", d: "Você recebe um código de postagem por e-mail. A primeira troca de cada pedido não tem custo." },
            { t: "Receba a nova peça", d: "Assim que a peça chega e é conferida, enviamos a troca ou devolvemos o valor na mesma forma de pagamento." },
          ].map((s, i) => (
            <li key={s.t} className="bg-paper p-6">
              <p className="t-cond tabular text-sm font-semibold text-mute">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-serif text-xl">{s.t}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="medidas" aria-labelledby="medidas-titulo" className="mt-24 grid scroll-mt-28 gap-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <h2 id="medidas-titulo" className="t-title">
            Tabela de medidas
          </h2>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-ink-2">{FAQ.find((f) => f.id === "medidas")?.a}</p>
          <ul className="mt-6 space-y-3 text-[0.95rem] text-ink-2">
            <li>
              <strong className="text-ink">As medidas são da peça</strong>, não do corpo. Estique uma roupa sua parecida numa mesa e compare.
            </li>
            <li>
              <strong className="text-ink">Tórax, cintura e quadril</strong> são a volta inteira: meça de lado a lado e multiplique por dois.
            </li>
            <li>
              <strong className="text-ink">Cada produto tem a própria tabela</strong>, no link “Tabela de medidas” ao lado dos tamanhos.
            </li>
          </ul>
          <Link href="/provador" className="btn mt-8">
            Testar no Provador 3D
          </Link>
        </div>
        <div className="grid gap-12 md:col-span-7 md:col-start-6">
          {tee ? (
            <div>
              <MiniTable
                caption="Camiseta oversized (cm)"
                rows={tee.sizeChart}
                cols={[
                  { key: "chestCm", label: "Tórax" },
                  { key: "lengthCm", label: "Comprimento" },
                  { key: "sleeveCm", label: "Manga" },
                ]}
              />
              <p className="mt-3 text-sm text-mute">
                Referência:{" "}
                <Link href={`/produto/${tee.slug}`} className="underline underline-offset-4">
                  {tee.name}
                </Link>
                .
              </p>
            </div>
          ) : null}
          {shoe ? (
            <div>
              <MiniTable caption="Calçados (cm)" rows={shoe.sizeChart} cols={[{ key: "footCm", label: "Comprimento do pé" }]} />
              <p className="mt-3 text-sm text-mute">Fique em pé sobre uma folha, marque o calcanhar e a ponta do dedo mais longo e meça.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="frete-titulo" className="mt-24 bg-sand p-8 md:p-12">
        <h2 id="frete-titulo" className="font-serif text-3xl tracking-[-0.02em]">
          Frete em resumo
        </h2>
        <p className="mt-3 max-w-2xl text-ink-2">
          Grátis a partir de {formatPrice(FREE_SHIPPING_THRESHOLD)}. Abaixo disso, {formatPrice(FLAT_SHIPPING)} para qualquer lugar do Brasil, com rastreio por e-mail.
        </p>
      </section>
    </main>
  );
}
