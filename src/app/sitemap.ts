import type { MetadataRoute } from "next";
import { imageExists } from "@/components/loja/media";
import { absoluteUrl } from "@/lib/seo/jsonld";
import { listCategories, listProducts } from "@/server/catalog";

/**
 * Sitemap gerado a cada requisição: o catálogo vive no SQLite e o admin edita
 * (nada de build com banco). Só páginas indexáveis — sem sacola, checkout,
 * pedido, conta, busca, admin ou lab — e sem URLs com filtro (?ordem=, ?tamanho=).
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ items: products }, categories] = await Promise.all([listProducts({ sort: "novidades" }), listCategories()]);

  // Data mais recente do catálogo (o contrato expõe só createdAt, em AAAA-MM-DD).
  const newest = products.reduce<string | undefined>((max, p) => (!max || p.createdAt > max ? p.createdAt : max), undefined);
  const latestIn = (pred: (p: (typeof products)[number]) => boolean) =>
    products.filter(pred).reduce<string | undefined>((max, p) => (!max || p.createdAt > max ? p.createdAt : max), undefined) ?? newest;

  const page = (path: string, lastModified: string | undefined, changeFrequency: "daily" | "weekly" | "monthly", priority: number) => ({
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  });

  return [
    page("/", newest, "daily", 1),
    page("/novidades", latestIn((p) => p.isNew), "daily", 0.9),
    page("/masculino", latestIn((p) => p.gender !== "feminino"), "weekly", 0.8),
    page("/feminino", latestIn((p) => p.gender !== "masculino"), "weekly", 0.8),
    page("/provador", undefined, "monthly", 0.8),
    page("/ajuda", undefined, "monthly", 0.5),
    ...categories
      .filter((c) => products.some((p) => p.category === c.slug))
      .map((c) => page(`/categoria/${c.slug}`, latestIn((p) => p.category === c.slug), "weekly", 0.7)),
    ...products.map((p) => ({
      ...page(`/produto/${p.slug}`, p.createdAt, "weekly", 0.6),
      images: p.images.filter((i) => imageExists(i.src)).map((i) => absoluteUrl(i.src)),
    })),
  ];
}
