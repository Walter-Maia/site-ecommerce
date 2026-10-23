import type { Metadata } from "next";
import { openGraph } from "@/lib/seo/metadata";
import { ListingPage } from "@/components/loja/listing/ListingPage";
import type { RawParams } from "@/components/loja/listing/query";

export const metadata: Metadata = {
  title: "Masculino: camisetas oversized, jerseys e moletons",
  description:
    "Camisetas oversized de algodão pesado, jerseys de baseball e basquete, bermudas mesh, moletons e alfaiataria masculina e unissex da KIM KRISS. Frete grátis acima de R$ 299.",
  alternates: { canonical: "/masculino" },
  openGraph: openGraph({ url: "/masculino", title: "Masculino | KIM KRISS®", description: "Camisetas oversized, jerseys, moletons e alfaiataria masculina e unissex." }),
};

export default async function MasculinoPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <ListingPage
      title="Masculino"
      intro="Modelagens amplas, algodão pesado e alfaiataria com pegada de rua. Inclui as peças unissex."
      basePath="/masculino"
      crumbs={[
        { name: "Início", path: "/" },
        { name: "Masculino", path: "/masculino" },
      ]}
      searchParams={await searchParams}
      fixed={{ gender: "masculino" }}
      facets={{ categories: true }}
    />
  );
}
