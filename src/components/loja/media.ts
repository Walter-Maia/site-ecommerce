import "server-only";
import { statSync } from "node:fs";
import path from "node:path";

/**
 * As fotos chegam aos poucos em /public/images. Antes de pedir ao otimizador
 * uma imagem que ainda não existe (404 + ícone quebrado), conferimos o disco.
 * Cache curto para não repetir stat a cada card na mesma renderização.
 */
const TTL_MS = 5_000;
const cache = new Map<string, { ok: boolean; at: number }>();
const PUBLIC_DIR = path.join(process.cwd(), "public");

export function imageExists(src: string | undefined | null): boolean {
  if (!src || !src.startsWith("/") || src.includes("..")) return false;
  const now = Date.now();
  const hit = cache.get(src);
  if (hit && now - hit.at < TTL_MS) return hit.ok;
  let ok = false;
  try {
    ok = statSync(path.join(PUBLIC_DIR, src)).size > 0;
  } catch {
    ok = false;
  }
  cache.set(src, { ok, at: now });
  return ok;
}

export const editorial = (name: string) => `/images/editorial/${name}.webp`;
