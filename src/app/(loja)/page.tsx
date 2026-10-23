import type { Metadata } from "next";
import { openGraph } from "@/lib/seo/metadata";
import ProvadorTeaser from "@/components/provador/ProvadorTeaser";
import { Carousel } from "@/components/loja/Carousel";
import { CategoryShowcase } from "@/components/loja/home/CategoryShowcase";
import { DetailCards, type DetailCard } from "@/components/loja/home/DetailCards";
import { EditorialBanner } from "@/components/loja/home/EditorialBanner";
import { Hero } from "@/components/loja/home/Hero";
import { LookGrid } from "@/components/loja/home/LookGrid";
import { MemberSection } from "@/components/loja/home/MemberSection";
import { ProvadorBubble } from "@/components/loja/home/ProvadorBubble";
import { ProductCard } from "@/components/loja/ProductCard";
import { SectionHead } from "@/components/loja/RevealTitle";
import { SITE } from "@/data/site";
import { getProductBySlug, listCategories, listProducts } from "@/server/catalog";
import type { CategorySlug, Product } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} — Streetwear e skate de São Paulo com Provador 3D` },
  description:
    "Camisetas oversized de algodão pesado, jerseys, flanelas, calças cargo, tênis de skate e alfaiataria da KIM & KRIS. Veja o caimento no Provador 3D antes de comprar. Frete grátis acima de R$ 299.",
  alternates: { canonical: "/" },
  openGraph: openGraph({
    url: "/",
    title: `${SITE.name} — Streetwear e skate de São Paulo`,
    description: "Coleções Arquibancada, Rolê (skate), Social Club e Y2K Drop. Monte o look no Provador 3D e veja o caimento antes de comprar.",
  }),
};

const LOOKS: { image: string; slug: string }[] = [
  { image: "grade-01", slug: "camiseta-oversized-sao-paulo-script-off-white" },
  { image: "grade-02", slug: "jaqueta-varsity-bordo-creme" },
  { image: "grade-03", slug: "vestido-jersey-oversized-07-preto" },
  { image: "grade-04", slug: "moletom-canguru-athletic-club-preto" },
];

const DETAILS: (Omit<DetailCard, "href"> & { slug: string })[] = [
  { image: "detalhe-01", slug: "jaqueta-varsity-bordo-creme", title: "SP em chenille", text: "Letras em chenille, mangas em PU e forro matelassê.", alt: "Mãos fechando a jaqueta varsity bordô com o SP em chenille no peito" },
  { image: "detalhe-02", slug: "camisa-baseball-pinstripe-preta", title: "Riscas de giz", text: "Script bordado, o 16 em appliqué e viés contrastante.", alt: "Detalhe da camisa de baseball preta riscada com o número 16 na arquibancada" },
  { image: "detalhe-03", slug: "saia-midi-cetim-champagne", title: "Cetim em movimento", text: "Midi enviesada em cetim, com cós elástico embutido.", alt: "Saia midi de cetim champagne em movimento sobre calçada de pedra portuguesa" },
  { image: "detalhe-04", slug: "camisa-basquete-mesh-23-vermelha", title: "Mesh que respira", text: "Mesh 100% poliéster com viés duplo branco e preto.", alt: "Close do tecido mesh vermelho da camisa de basquete 23 na quadra" },
  { image: "detalhe-05", slug: "bone-dad-hat-domingo-preto", title: "Script bordado", text: "Sarja de algodão lavada e Domingo bordado em script.", alt: "Boné dad hat preto com Domingo bordado em script" },
  { image: "detalhe-06", slug: "tenis-court-low-branco", title: "Feito para a quadra", text: "Couro e camurça sobre sola de borracha vulcanizada.", alt: "Tênis Court Low branco e calça de moletom cinza sobre o asfalto da quadra" },
];

const FEATURED_CATEGORIES: { slug: CategorySlug; alt: string }[] = [
  { slug: "camisetas", alt: "" },
  { slug: "jerseys", alt: "" },
  { slug: "moletons", alt: "" },
  { slug: "alfaiataria", alt: "" },
  { slug: "skate", alt: "" },
  { slug: "calcados", alt: "" },
];

function ProductRail({ id, lines, href, products, kicker }: { id: string; lines: string[]; href: string; products: Product[]; kicker?: string }) {
  return (
    <section aria-labelledby={id} className="cv-auto py-20 [--cv-h:510px] md:py-28 md:[--cv-h:680px]">
      <SectionHead id={id} lines={lines} href={href} kicker={kicker} />
      <Carousel label={lines.join(" ")}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} sizes="(min-width: 1100px) 23vw, (min-width: 768px) 38vw, 62vw" />
        ))}
      </Carousel>
    </section>
  );
}

export default async function HomePage() {
  const [best, newest, categories, lookProducts, detailProducts] = await Promise.all([
    listProducts({ sort: "relevancia", limit: 10 }),
    listProducts({ sort: "novidades" }),
    listCategories(),
    Promise.all(LOOKS.map((l) => getProductBySlug(l.slug))),
    Promise.all(DETAILS.map((d) => getProductBySlug(d.slug))),
  ]);

  const looks = LOOKS.flatMap((l, i) => (lookProducts[i] ? [{ image: l.image, product: lookProducts[i]! }] : []));
  const details: DetailCard[] = DETAILS.map((d, i) => ({ ...d, href: detailProducts[i] ? `/produto/${d.slug}` : "/novidades" }));
  const novidades = newest.items.filter((p) => p.isNew).slice(0, 10);
  const role = newest.items.filter((p) => p.collection === "Rolê");
  const featured = FEATURED_CATEGORIES.flatMap((f) => {
    const c = categories.find((x) => x.slug === f.slug);
    return c ? [{ ...c, alt: f.alt }] : [];
  });

  return (
    <main id="conteudo">
      <Hero />
      <ProductRail id="mais-vendidos" lines={["Mais vendidos"]} href="/novidades?ordem=relevancia" products={best.items} kicker="O que mais sai da loja" />
      <LookGrid looks={looks} />
      <EditorialBanner
        id="social-club-titulo"
        image="banner-social-club"
        alt="Editorial Social Club: casal em blazer oversized, calça de pregas e slip dress de cetim numa sala de madeira com vista para o Copan"
        kicker="Coleção Social Club"
        title="Social Club"
        text="Alfaiataria com atitude de rua: blazer oversized, calça de pregas e cetim para a noite paulistana."
        cta={{ href: "/categoria/alfaiataria", label: "Ver alfaiataria" }}
        imgClassName="object-[60%_50%] md:object-center"
      />
      <ProductRail id="novidades-titulo" lines={["Novidades"]} href="/novidades" products={novidades} kicker="Acabou de chegar" />
      <ProvadorTeaser />
      <EditorialBanner
        id="y2k-titulo"
        layout="split"
        image="banner-y2k-drop"
        alt="Editorial Y2K Drop: modelo com baby tee rosa Y2K e saia jeans cintura baixa sentada numa poltrona inflável azul ao lado de uma TV de tubo"
        kicker={
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2 bg-y2k-magenta" />
            <span className="font-pixel text-[0.6rem] leading-none tracking-wider">NOVO DROP</span>
          </span>
        }
        title="Y2K Drop"
        text="Baby tee rosa chiclete, saia jeans de cintura baixa e moletom cropped. Os anos 2000 pelo olhar da quadra."
        cta={{ href: "/novidades?colecao=y2k-drop", label: "Ver o drop" }}
        imgClassName="md:object-[80%_50%]"
      />
      <EditorialBanner
        id="role-titulo"
        image="banner-skate"
        alt="Editorial Rolê: skatista com flanela xadrez, camiseta Skate Club e calça cargo oliva pisando no tail do skate São Paulo, ao lado de um amigo de jaqueta workwear e gorro sentado na borda de granito de uma praça de skate no centro de São Paulo"
        kicker="Nova linha · skate"
        title="Rolê"
        text={"Flanela, cargo, workwear e tênis vulcanizado: roupa que aguenta a pista e fica bem na rua. Com skate completo São Paulo 8,25\"."}
        cta={{ href: "/novidades?colecao=role", label: "Ver a linha Rolê" }}
        imgClassName="object-[62%_50%] md:object-center"
      />
      <ProductRail id="role-produtos" lines={["Linha Rolê"]} href="/novidades?colecao=role" products={role} kicker="Skate e streetwear" />
      <CategoryShowcase categories={featured} />
      <MemberSection />
      <DetailCards cards={details} />
      <ProvadorBubble />
    </main>
  );
}
