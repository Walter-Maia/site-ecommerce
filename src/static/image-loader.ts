/**
 * Loader do next/image SÓ para o export estático (next.config.ts → images.loaderFile).
 * O GitHub Pages não tem otimizador: a foto é servida como está, mas com o basePath
 * na frente (com basePath o next/image NÃO prefixa `src` sozinho). Vale também para
 * `getImageProps` (<picture> do ArtPhoto) e para os preloads do LCP.
 * Sem "use client": o getImageProps roda em Server Component e precisa chamar o loader.
 */
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export default function staticImageLoader({ src }: { src: string; width: number; quality?: number }): string {
  if (!BASE || !src.startsWith("/") || src.startsWith("//")) return src;
  if (src.startsWith(`${BASE}/`)) return src;
  return `${BASE}${src}`;
}
