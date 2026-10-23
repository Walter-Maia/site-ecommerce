/**
 * Variante de DEMONSTRAÇÃO ESTÁTICA (GitHub Pages, `npm run build:pages`).
 *
 * Só vale quando o build roda com NEXT_PUBLIC_STATIC_DEMO=1 (ver scripts/build-pages.mjs).
 * No modo servidor (padrão: `npm run dev`, `npm run build`) tudo aqui é no-op:
 * STATIC_DEMO = false, BASE_PATH = "" e os helpers devolvem o caminho intacto.
 */
export const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

/** Subcaminho da publicação (ex.: "/site-ecommerce"), sem barra final. */
export const BASE_PATH = STATIC_DEMO ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") : "";

/** Código completo (versão com servidor: login, admin, SQLite). */
export const REPO_URL = "https://github.com/Walter-Maia/site-ecommerce";

const HAS_EXTENSION = /\/[^/]*\.[a-z0-9]+$/i;

/**
 * No export estático (`trailingSlash: true`) cada página vive em /rota/ (index.html);
 * arquivos com extensão (.webp, .txt, .xml) não ganham barra. Fora da demo, no-op.
 */
export function pagePath(path: string): string {
  if (!STATIC_DEMO || !path.startsWith("/")) return path;
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  const rest = cut === -1 ? "" : path.slice(cut);
  if (pathname.endsWith("/") || HAS_EXTENSION.test(pathname)) return path;
  return `${pathname}/${rest}`;
}

/**
 * Prefixa o basePath em URLs internas que o Next NÃO trata sozinho
 * (manifest, `location.assign`, `<a>` cru). `Link`, `next/form`, `useRouter`
 * e `next/image` (via loader) já aplicam o basePath. Fora da demo, no-op.
 */
export function withBasePath(path: string): string {
  if (!BASE_PATH || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return BASE_PATH + path;
}
