import type { Metadata } from "next";
import { openGraph } from "@/lib/seo/metadata";
import { ListingPage } from "@/components/loja/listing/ListingPage";
import type { RawParams } from "@/components/loja/listing/query";

export const metadata: Metadata = {
  title: "Novidades: lançamentos e coleções de streetwear",
  description:
    "Tudo o que acabou de chegar na KIM KRISS: drops Arquibancada, Social Club, Y2K Drop e Inverno 26. Filtre por categoria, tamanho e preço.",
  alternates: { canonical: "/novidades" },
  openGraph: openGraph({
    url: "/novidades",
    title: "Novidades | KIM KRISS®",
    description: "Os lançamentos da KIM KRISS: drops Arquibancada, Social Club, Y2K Drop e Inverno 26.",
  }),
};

export default async function NovidadesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <ListingPage
      title="Novidades"
      intro="Peças recém-chegadas e as coleções da temporada. Escolha uma coleção para ver o drop inteiro."
      basePath="/novidades"
      crumbs={[
        { name: "Início", path: "/" },
        { name: "Novidades", path: "/novidades" },
      ]}
      searchParams={await searchParams}
      fixed={{ onlyNew: true }}
      facets={{ categories: true, collection: true }}
      defaultSort="novidades"
    />
  );
}
