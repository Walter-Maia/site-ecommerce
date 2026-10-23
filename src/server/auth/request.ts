import "server-only";
import { headers } from "next/headers";

/**
 * IP do cliente para rate limit. Cabeçalhos de IP são forjáveis pelo cliente,
 * então só confiamos no que a infraestrutura declarada grava:
 * - TRUSTED_IP_HEADER: cabeçalho único sobrescrito pelo proxy/CDN
 *   (ex.: "cf-connecting-ip", "x-vercel-forwarded-for", "x-real-ip" do nginx);
 * - TRUSTED_PROXY_HOPS: nº de proxies confiáveis que ANEXAM ao X-Forwarded-For;
 *   usa a entrada da direita menos N-1 (a primeira que nenhum cliente controla).
 * Sem configuração (dev local), cai no último item do X-Forwarded-For — que é
 * forjável; os limites por e-mail e globais continuam valendo nesse caso.
 */
const MAX = 64;
let warned = false;

export async function getClientIp(): Promise<string> {
  const h = await headers();

  const trustedHeader = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trustedHeader) {
    const v = h.get(trustedHeader)?.split(",")[0]?.trim();
    return v ? v.slice(0, MAX) : "desconhecido";
  }

  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  if (Number.isInteger(hops) && hops > 0) {
    const v = chain[Math.max(0, chain.length - hops)];
    return v ? v.slice(0, MAX) : "desconhecido";
  }

  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn("[segurança] Defina TRUSTED_IP_HEADER ou TRUSTED_PROXY_HOPS: o IP usado no rate limit é forjável sem proxy confiável.");
  }
  const last = chain.at(-1);
  return last ? last.slice(0, MAX) : "desconhecido";
}
