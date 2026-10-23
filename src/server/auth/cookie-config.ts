/**
 * Nomes e opções de cookies. Sem "server-only" porque o proxy também importa
 * (não há segredo aqui). Em produção usa o prefixo __Host- (exige Secure,
 * Path=/ e nenhum Domain: o cookie não vaza para subdomínios).
 */
const isProd = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = isProd ? "__Host-qd_session" : "qd_session";
export const VISITOR_COOKIE = isProd ? "__Host-qd_visitor" : "qd_visitor";

/** Sessão: expiração deslizante de 7 dias, teto absoluto de 30 dias. */
export const SESSION_TTL_S = 7 * 24 * 60 * 60;
export const SESSION_ABSOLUTE_TTL_S = 30 * 24 * 60 * 60;
/** Convidado (carrinho/curtidas/looks sem conta). */
export const VISITOR_TTL_S = 60 * 24 * 60 * 60;

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: isProd, path: "/", maxAge };
}
