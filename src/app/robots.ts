import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";

/**
 * Áreas privadas, transacionais e de resultado de busca ficam fora do
 * rastreamento. As páginas também têm `noindex` próprio (defesa em dobro);
 * /entrar e /cadastro não são bloqueadas para que o `noindex` delas seja lido.
 */
export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/conta", "/carrinho", "/checkout", "/pedido", "/api/", "/lab", "/busca"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
