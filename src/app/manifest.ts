import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE.name}® — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/images/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/images/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/images/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novidades", url: "/novidades" },
      { name: "Provador 3D", url: "/provador" },
      { name: "Sacola", url: "/carrinho" },
    ],
  };
}
