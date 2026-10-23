import type { Metadata } from "next";
import { SITE } from "@/data/site";

type OpenGraph = NonNullable<Metadata["openGraph"]>;
type OgImage = { url: string; width: number; height: number; alt: string; type?: string };

/** Imagem padrão de compartilhamento (1200×630). */
export const DEFAULT_OG_IMAGE: OgImage = {
  url: "/images/og/kimekris-og.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Modelos com camiseta oversized Athletic 07, camisa de baseball riscada e jersey de basquete 23 numa arquibancada de concreto em São Paulo",
};

export const PROVADOR_OG_IMAGE: OgImage = {
  url: "/images/og/provador-og.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Modelo com baby tee rosa Y2K e saia jeans sentada numa poltrona inflável azul ao lado de uma TV de tubo",
};

/**
 * O Next mescla `metadata` de forma RASA: uma página que define `openGraph`
 * perde o `siteName`, `locale`, `type` e a imagem do layout. Toda página que
 * personaliza o Open Graph passa por aqui para manter os padrões.
 */
export function openGraph(og: Partial<Extract<OpenGraph, { type?: "website" }>> = {}): OpenGraph {
  return {
    type: "website",
    locale: SITE.locale,
    siteName: `${SITE.name}`,
    images: [DEFAULT_OG_IMAGE],
    ...og,
  };
}
