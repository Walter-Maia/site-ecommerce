import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/loja/Breadcrumbs";
import { Carousel } from "@/components/loja/Carousel";
import { COLLECTIONS } from "@/components/loja/constants";
import { IconChevron, Stars } from "@/components/loja/icons";
import { imageExists } from "@/components/loja/media";
import { BuyBox } from "@/components/loja/pdp/BuyBox";
import { Gallery } from "@/components/loja/pdp/Gallery";
import { ProductCard } from "@/components/loja/ProductCard";
import { SectionHead } from "@/components/loja/RevealTitle";
import { FAQ, MAX_INSTALLMENTS, SITE } from "@/data/site";
import { formatPrice } from "@/lib/format";
import { openGraph } from "@/lib/seo/metadata";
import { JsonLd, productJsonLd } from "@/lib/seo/jsonld";
import type { Product } from "@/lib/types";
import { getCategory, getProductBySlug, listProducts } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Produto não encontrado", robots: { index: false } };
  // Descrição + preço quando couber (~160 caracteres): responde "quanto custa" direto no resultado.
  const offer = ` ${formatPrice(p.price)} em até ${MAX_INSTALLMENTS}x sem juros.`;
  const desc =
    p.description.length + offer.length <= 165
      ? p.description + offer
      : p.description.length > 155
        ? `${p.description.slice(0, 152).trimEnd()}…`
        : p.description;
  const img = p.images.find((i) => i.kind === "packshot") ?? p.images[0];
  return {
    title: p.name,
    description: desc,
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: openGraph({
      url: `/produto/${p.slug}`,
      title: `${p.name} | ${SITE.name}`,
      description: desc,
      ...(img && imageExists(img.src) ? { images: [{ url: img.src, width: img.width, height: img.height, alt: img.alt }] } : {}),
    }),
  };
}

const FIT: Record<Product["garment"]["silhouette"], string> = {
  oversized: "Modelagem oversized, de ombro caído e corpo amplo. Para um caimento menos largo, escolha um tamanho abaixo do seu habitual.",
  wide: "Modelagem ampla nas pernas. Escolha pela medida da sua cintura.",
  regular: "Modelagem regular: veste no seu tamanho habitual.",
  slim: "Modelagem justa ao corpo. Se estiver entre dois tamanhos, escolha o maior.",
  cropped: "Comprimento curto, acima da cintura. Veste no seu tamanho habitual.",
};

function care(p: Product) {
  if (p.category === "calcados") return "Limpe com pano úmido e sabão neutro. Seque à sombra, longe de fontes de calor, com papel dentro para manter a forma.";
  if (p.category === "bones") return "Lave à mão em água fria com sabão neutro. Não torça e seque à sombra apoiado num pote para manter a copa.";
  if (p.garment.pattern === "satin") return "Lave à mão ou no ciclo delicado, em água fria. Não torça. Passe do avesso em temperatura baixa.";
  return "Lave do avesso em água fria, sem alvejante. Seque à sombra e não passe ferro sobre a estampa ou o bordado.";
}

function splitDetail(d: string) {
  const [k, ...rest] = d.split(":");
  return rest.length ? { k: k.trim(), v: rest.join(":").trim() } : { k: "Detalhe", v: d };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();

  const [category, sameCategory, sameCollection] = await Promise.all([
    getCategory(p.category),
    listProducts({ category: p.category, limit: 12 }),
    listProducts({ limit: 40 }),
  ]);
  const related = [
    ...sameCategory.items.filter((x) => x.id !== p.id),
    ...sameCollection.items.filter((x) => x.collection === p.collection && x.id !== p.id && x.category !== p.category),
  ].slice(0, 10);

  const images = p.images.filter((i) => imageExists(i.src)).map((i) => ({ src: i.src, alt: i.alt }));
  const details = p.details.map(splitDetail);
  const material = details.find((d) => /tecido|cabedal|corpo/i.test(d.k))?.v ?? details[0]?.v;
  const col = COLLECTIONS.find((c) => c.name === p.collection);
  const frete = FAQ.find((f) => f.id === "frete")?.a ?? "";
  const trocas = FAQ.find((f) => f.id === "trocas")?.a ?? "";

  return (
    <main id="conteudo" className="pb-24">
      <JsonLd data={productJsonLd(p)} />
      <div className="gutter pb-5 pt-5">
        <Breadcrumbs
          items={[
            { name: "Início", path: "/" },
            ...(category ? [{ name: category.name, path: `/categoria/${category.slug}` }] : []),
            { name: p.name, path: `/produto/${p.slug}` },
          ]}
        />
      </div>

      <div className="gutter grid gap-8 md:grid-cols-12 lg:gap-12">
        <div className="md:col-span-6 lg:col-span-7">
          <Gallery images={images} fallbackLabel={p.shortName} />
        </div>
        <div className="md:col-span-6 lg:col-span-5">
          <div className="md:sticky md:top-[calc(var(--header-h)+1.5rem)]">
            <BuyBox
              product={{
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                compareAtPrice: p.compareAtPrice,
                colorName: p.colorName,
                colorHex: p.colorHex,
                sizes: p.sizes,
                sizeChart: p.sizeChart,
                rating: p.rating,
                reviewCount: p.reviewCount,
                collection: p.collection,
              }}
              collectionHref={col ? `/novidades?colecao=${col.slug}` : undefined}
            />
          </div>
        </div>
      </div>

      {/* Descrição + características */}
      <section aria-labelledby="sobre-titulo" className="gutter mt-20 grid gap-10 border-t border-line pt-12 md:grid-cols-12 md:pt-16">
        <div className="md:col-span-6">
          <h2 id="sobre-titulo" className="t-label text-mute">
            Sobre a peça
          </h2>
          <p className="mt-4 max-w-[52ch] font-serif text-[clamp(1.35rem,2vw,1.75rem)] leading-[1.3] tracking-[-0.01em]">{p.description}</p>
        </div>
        <div className="md:col-span-5 md:col-start-8">
          <h2 className="t-label text-mute">Características</h2>
          <dl className="mt-4 divide-y divide-line border-y border-line text-[0.95rem]">
            {details.map((d) => (
              <div key={d.k + d.v} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3">
                <dt className="text-mute">{d.k}</dt>
                <dd>{d.v}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3">
              <dt className="text-mute">Cor</dt>
              <dd>{p.colorName}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3">
              <dt className="text-mute">Referência</dt>
              <dd className="tabular">{p.id.toUpperCase()}</dd>
            </div>
          </dl>

          <div className="mt-8 border-b border-line">
            {[
              { t: "Envio e trocas", c: `${frete} ${trocas}` },
              { t: "Cuidados com a peça", c: care(p) },
              { t: "Pagamento", c: FAQ.find((f) => f.id === "pagamento")?.a ?? "" },
            ].map((a) => (
              <details key={a.t} className="border-t border-line">
                <summary className="flex min-h-14 items-center justify-between gap-4 text-[0.95rem] font-medium">
                  {a.t}
                  <IconChevron size={18} className="chev shrink-0" />
                </summary>
                <p className="pb-5 pr-8 text-[0.95rem] leading-relaxed text-ink-2">{a.c}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Acerte na escolha */}
      <section aria-labelledby="escolha-titulo" className="mt-20 bg-sand py-16 md:mt-28 md:py-20">
        <div className="gutter">
          <h2 id="escolha-titulo" className="t-title">
            Acerte na escolha.
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            <div className="border-t border-ink pt-5">
              <h3 className="font-serif text-2xl tracking-[-0.015em]">Tamanho</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{FIT[p.garment.silhouette]}</p>
              <Link href={`/provador?add=${encodeURIComponent(p.slug)}`} className="link-line mt-4 inline-flex min-h-11 items-center text-sm font-medium">
                Ver o caimento no Provador 3D
              </Link>
            </div>
            <div className="border-t border-ink pt-5">
              <h3 className="font-serif text-2xl tracking-[-0.015em]">Material</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{material}. {care(p).split(".")[0]}.</p>
            </div>
            <div className="border-t border-ink pt-5">
              <h3 className="font-serif text-2xl tracking-[-0.015em]">Entrega</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{frete}</p>
              <Link href="/ajuda#trocas" className="link-line mt-4 inline-flex min-h-11 items-center text-sm font-medium">
                Trocas e devoluções
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Avaliações */}
      <section id="avaliacoes" aria-labelledby="avaliacoes-titulo" className="gutter mt-20 grid scroll-mt-24 gap-8 md:mt-28 md:grid-cols-12">
        <div className="md:col-span-4">
          <h2 id="avaliacoes-titulo" className="t-title">
            Avaliações
          </h2>
        </div>
        <div className="md:col-span-7 md:col-start-6">
          {p.reviewCount > 0 ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-line pb-8">
              <p className="t-display tabular text-[clamp(4rem,9vw,7rem)]">{p.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}</p>
              <div className="pb-3">
                <Stars value={p.rating} size={18} />
                <p className="mt-2 text-sm text-ink-2">
                  Média de <span className="tabular">{p.reviewCount}</span> avaliações de quem comprou
                </p>
              </div>
            </div>
          ) : (
            <p className="text-ink-2">Esta peça ainda não tem avaliações.</p>
          )}
          <p className="mt-6 max-w-[56ch] text-sm leading-relaxed text-mute">
            As avaliações são liberadas após a entrega do pedido. Loja de demonstração: a nota e a contagem fazem parte do catálogo fictício.
          </p>
        </div>
      </section>

      {related.length ? (
        <section aria-labelledby="relacionados-titulo" className="mt-24 md:mt-32">
          <SectionHead id="relacionados-titulo" lines={["Combina com"]} href={category ? `/categoria/${category.slug}` : "/novidades"} hrefLabel={category ? `Ver ${category.name.toLowerCase()}` : "Ver tudo"} />
          <Carousel label="Peças relacionadas">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} sizes="(min-width: 1100px) 23vw, (min-width: 768px) 38vw, 62vw" />
            ))}
          </Carousel>
        </section>
      ) : null}
    </main>
  );
}
