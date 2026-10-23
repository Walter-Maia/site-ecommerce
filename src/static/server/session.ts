import { notFound, redirect } from "next/navigation";
import type { User } from "@/lib/types";

/**
 * Demo estática: CONTRATO de src/server/session.ts sem cookies nem sessão.
 * Não há login no GitHub Pages: ninguém está autenticado e não existe dono
 * no servidor (sacola, curtidas, looks e pedidos ficam no localStorage).
 */
export async function getCurrentUser(): Promise<User | null> {
  return null;
}

export async function requireUser(nextPath = "/conta"): Promise<User> {
  redirect(`/entrar?next=${encodeURIComponent(safeNextPath(nextPath) ?? "/conta")}`);
}

export async function requireAdmin(): Promise<User> {
  notFound();
}

export type Owner = { kind: "user"; id: string } | { kind: "visitor"; id: string };

export async function getOwner(opts: { create?: boolean } = {}): Promise<Owner | null> {
  void opts;
  return null;
}

export function ownerColumn(owner: Owner): "user_id" | "visitor_id" {
  return owner.kind === "user" ? "user_id" : "visitor_id";
}

/** Igual a src/server/session.ts (função pura). */
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, "http://kimekris.local");
    if (url.origin !== "http://kimekris.local") return null;
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
    return path;
  } catch {
    return null;
  }
}
