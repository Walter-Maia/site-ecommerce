import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage } from "@/components/loja/listing/ListingPage";
import type { RawParams } from "@/components/loja/listing/query";
import { openGraph } from "@/lib/seo/metadata";
import type { CategorySlug } from "@/lib/types";
import { getCategory } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };

/** Títulos de busca: o que a pessoa digita ("camiseta oversized algodão pesado"), não só o nome da seção. */
const SEO_TITLE: Partial<Record<CategorySlug, string>> = {
  camisetas: "Camisetas oversized, skate e manga longa de algodão pesado",
  "regatas-e-tops": "Regatas machão e tops canelados",
  jerseys: "Jerseys de baseball e basquete",
  camisas: "Camisas oxford e flanelas xadrez",
  moletons: "Moletons canguru, zíper, careca e cropped",
  jaquetas: "Jaquetas varsity, workwear e corta-vento",
  alfaiataria: "Alfaiataria streetwear: blazers e calças de pregas",
  bermudas: "Bermudas mesh, cargo e de moletom",
  calcas: "Calças cargo, carpinteiro, jeans baggy e alfaiataria",
  saias: "Saias jeans cintura baixa e midi de cetim",
  vestidos: "Vestidos jersey oversized e slip dress",
  bones: "Bonés e gorros bordados",
  calcados: "Tênis de skate, tênis de quadra e mocassins",
  skate: "Skates completos e a linha Rolê",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Categoria não encontrada", robots: { index: false } };
  return {
    title: SEO_TITLE[category.slug] ?? category.name,
    description: `${category.description} Frete grátis acima de R$ 299 e troca grátis em 30 dias.`,
    alternates: { canonical: `/categoria/${category.slug}` },
    openGraph: openGraph({ url: `/categoria/${category.slug}`, title: `${category.name} | KIM KRISS®`, description: category.description }),
  };
}

export default async function CategoriaPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  return (
    <ListingPage
      title={category.name}
      intro={category.description}
      basePath={`/categoria/${category.slug}`}
      crumbs={[
        { name: "Início", path: "/" },
        { name: category.name, path: `/categoria/${category.slug}` },
      ]}
      searchParams={await searchParams}
      fixed={{ category: category.slug }}
      facets={{ gender: true }}
    />
  );
}
