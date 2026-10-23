import type { NextConfig } from "next";

/**
 * Cache Components / PPR desligados de propósito: a CSP estrita com nonce
 * (src/proxy.ts) exige renderização dinâmica. Ver docs/ARQUITETURA.md.
 * Cabeçalhos de segurança estáticos ficam em headers(); a CSP fica no proxy.
 */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS só em produção (em dev quebraria http://localhost em outros projetos).
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 640, 828, 1080, 1280, 1600, 1920],
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

/**
 * Demo ESTÁTICA para o GitHub Pages (`npm run build:pages`, STATIC_EXPORT=1).
 * Só é usada pela cópia de build em .pages-build/ (scripts/build-pages.mjs), onde
 * proxy, rotas de API/admin e os módulos de servidor já foram trocados pelas
 * versões de src/static/**. Sem headers() (o Pages não envia cabeçalhos; a CSP
 * vai como <meta>, injetada no HTML pelo script). O modo servidor acima não muda.
 */
const staticExportConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Sem otimizador no Pages: o loader só prefixa o basePath em src locais.
    loader: "custom",
    loaderFile: "./src/static/image-loader.ts",
    // O loader devolve o mesmo arquivo para qualquer largura: uma entrada no srcset basta
    // (com 7 larguras, cada card repetia a mesma URL 7× no HTML e no payload RSC).
    deviceSizes: [1920],
    imageSizes: [384],
  },
  // Raiz = a própria cópia (.pages-build): o Turbopack procura proxy.ts subindo diretórios
  // e não pode enxergar o src/proxy.ts do projeto original.
  turbopack: nextConfig.turbopack,
};

export default process.env.STATIC_EXPORT === "1" ? staticExportConfig : nextConfig;
