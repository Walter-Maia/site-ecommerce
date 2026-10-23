import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { User } from "@/lib/types";
import { SESSION_COOKIE } from "./auth/cookie-config";
import { validateSessionToken } from "./auth/sessions";
import { getVisitorId } from "./auth/visitor";

/**
 * CONTRATO. Usuário autenticado (DTO sem hash/token) ou null.
 * Memorizado por requisição com React.cache.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  return validateSessionToken(jar.get(SESSION_COOKIE)?.value);
});

/** Exige login. Use em TODA página/ação de conta (o proxy é só otimista). */
export async function requireUser(nextPath = "/conta"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(safeNextPath(nextPath) ?? "/conta")}`);
  return user;
}

/**
 * Exige admin. Não logado → /entrar; logado sem permissão → 404 (não revela
 * que a área existe). Use em TODA página e ação do admin.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fadmin");
  if (user.role !== "admin") notFound();
  return user;
}

/** Dono dos dados do visitante: a conta (se logado) ou o convidado do cookie. */
export type Owner = { kind: "user"; id: string } | { kind: "visitor"; id: string };

export async function getOwner(opts: { create?: boolean } = {}): Promise<Owner | null> {
  const user = await getCurrentUser();
  if (user) return { kind: "user", id: user.id };
  const visitorId = await getVisitorId(opts);
  return visitorId ? { kind: "visitor", id: visitorId } : null;
}

/** Coluna de dono (lista fechada: nunca vem do cliente). */
export function ownerColumn(owner: Owner): "user_id" | "visitor_id" {
  return owner.kind === "user" ? "user_id" : "visitor_id";
}

/** Aceita só caminhos internos ("/x"), bloqueando open redirect ("//evil", "/\\evil", esquemas). */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, "http://kimekris.local");
    if (url.origin !== "http://kimekris.local") return null;
    const path = url.pathname + url.search;
    // A normalização de "." e ".." pode gerar "//host" ("/.//evil.com" → "//evil.com"),
    // que o navegador trata como URL de outro site. Checa de novo DEPOIS de normalizar.
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
    return path;
  } catch {
    return null;
  }
}
