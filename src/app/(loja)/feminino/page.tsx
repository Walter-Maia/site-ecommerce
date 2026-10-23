import type { Metadata } from "next";
import { openGraph } from "@/lib/seo/metadata";
import { ListingPage } from "@/components/loja/listing/ListingPage";
import type { RawParams } from "@/components/loja/listing/query";

export const metadata: Metadata = {
  title: "Feminino: baby tees, saias, vestidos e alfaiataria",
  description:
    "Baby tees, saias jeans e de cetim, vestidos, tops canelados e alfaiataria wide leg da KIM KRISS, além das peças unissex. Frete grátis acima de R$ 299.",
  alternates: { canonical: "/feminino" },
  openGraph: openGraph({ url: "/feminino", title: "Feminino | KIM KRISS®", description: "Baby tees, saias, vestidos, tops canelados e alfaiataria wide leg." }),
};

export default async function FemininoPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return (
    <ListingPage
      title="Feminino"
      intro="Do baby tee ao slip dress de cetim. Inclui as peças unissex, que vestem bem no corpo feminino."
      basePath="/feminino"
      crumbs={[
        { name: "Início", path: "/" },
        { name: "Feminino", path: "/feminino" },
      ]}
      searchParams={await searchParams}
      fixed={{ gender: "feminino" }}
      facets={{ categories: true }}
    />
  );
}
