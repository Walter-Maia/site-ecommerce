import "server-only";
import { cookies } from "next/headers";
import { get, run } from "../db/client";
import { newId } from "../util";
import { VISITOR_COOKIE, VISITOR_TTL_S, cookieOptions } from "./cookie-config";
import { generateToken, hashToken, isWellFormedToken } from "./tokens";

/**
 * Visitante convidado: cookie httpOnly com token aleatório de 256 bits; o banco
 * guarda só o hash. `create: true` só pode ser usado em Server Actions/Route
 * Handlers (onde é permitido gravar cookies).
 */
const iso = (ms: number) => new Date(ms).toISOString();
const SLIDE_THROTTLE_MS = 24 * 60 * 60 * 1000;

export async function getVisitorId(opts: { create?: boolean } = {}): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(VISITOR_COOKIE)?.value;
  const now = Date.now();
  if (isWellFormedToken(token)) {
    const row = get<{ id: string; expires_at: string; last_seen_at: string }>(
      "SELECT id, expires_at, last_seen_at FROM visitors WHERE token_hash = ?",
      hashToken(token),
    );
    if (row && Date.parse(row.expires_at) > now) {
      if (opts.create && now - Date.parse(row.last_seen_at) > SLIDE_THROTTLE_MS) {
        run(
          "UPDATE visitors SET last_seen_at = ?, expires_at = ? WHERE id = ?",
          iso(now),
          iso(now + VISITOR_TTL_S * 1000),
          row.id,
        );
        jar.set(VISITOR_COOKIE, token, cookieOptions(VISITOR_TTL_S));
      }
      return row.id;
    }
  }
  if (!opts.create) return null;

  const id = newId();
  const fresh = generateToken();
  run(
    "INSERT INTO visitors (id, token_hash, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    id,
    hashToken(fresh),
    iso(now),
    iso(now),
    iso(now + VISITOR_TTL_S * 1000),
  );
  jar.set(VISITOR_COOKIE, fresh, cookieOptions(VISITOR_TTL_S));
  return id;
}

/** Descarta o visitante atual (logout): o próximo convidado nesse navegador começa do zero. */
export async function discardVisitor() {
  const jar = await cookies();
  const token = jar.get(VISITOR_COOKIE)?.value;
  if (isWellFormedToken(token)) run("DELETE FROM visitors WHERE token_hash = ?", hashToken(token));
  // set com maxAge 0 (e não delete()) para manter Secure/Path exigidos pelo prefixo __Host-.
  jar.set(VISITOR_COOKIE, "", cookieOptions(0));
}
