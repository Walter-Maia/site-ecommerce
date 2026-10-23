import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";
import { pagePath, withBasePath } from "@/lib/static-demo";

/** URLs do manifest não passam pelo basePath do Next: na demo estática, prefixo manual (no-op no servidor). */
const page = (path: string) => withBasePath(pagePath(path));

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: page("/"),
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    lang: "pt-BR",
    dir: "ltr",
    start_url: page("/"),
    scope: page("/"),
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: withBasePath("/images/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: withBasePath("/images/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: withBasePath("/images/icons/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novidades", url: page("/novidades") },
      { name: "Provador 3D", url: page("/provador") },
      { name: "Sacola", url: page("/carrinho") },
    ],
  };
}
