import "server-only";
import type { User } from "@/lib/types";
import { get, run } from "../db/client";
import { SESSION_ABSOLUTE_TTL_S, SESSION_TTL_S } from "./cookie-config";
import { generateToken, hashToken, isWellFormedToken } from "./tokens";

/** Camada de banco das sessões. O token só existe no cookie; o banco guarda o SHA-256. */

const iso = (ms: number) => new Date(ms).toISOString();
/** Só regrava a expiração se passou mais de 1 h desde o último deslize (evita escrita por requisição). */
const SLIDE_THROTTLE_MS = 60 * 60 * 1000;

export function createSession(userId: string, now = Date.now()): string {
  const token = generateToken();
  run(
    `INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at, absolute_expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    hashToken(token),
    userId,
    iso(now),
    iso(now),
    iso(now + SESSION_TTL_S * 1000),
    iso(now + SESSION_ABSOLUTE_TTL_S * 1000),
  );
  return token;
}

interface SessionJoin {
  token_hash: string;
  expires_at: string;
  absolute_expires_at: string;
  last_seen_at: string;
  id: string;
  name: string;
  email: string;
  role: User["role"];
}

/** Valida o token e desliza a expiração. Devolve um DTO sem campos sensíveis. */
export function validateSessionToken(token: string | undefined | null, now = Date.now()): User | null {
  if (!isWellFormedToken(token)) return null;
  const row = get<SessionJoin>(
    `SELECT s.token_hash, s.expires_at, s.absolute_expires_at, s.last_seen_at, u.id, u.name, u.email, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    hashToken(token),
  );
  if (!row) return null;
  const expires = Date.parse(row.expires_at);
  const absolute = Date.parse(row.absolute_expires_at);
  if (!(expires > now) || !(absolute > now)) {
    run("DELETE FROM sessions WHERE token_hash = ?", row.token_hash);
    return null;
  }
  if (now - Date.parse(row.last_seen_at) > SLIDE_THROTTLE_MS) {
    run(
      "UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?",
      iso(now),
      iso(Math.min(now + SESSION_TTL_S * 1000, absolute)),
      row.token_hash,
    );
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export function deleteSession(token: string | undefined | null) {
  if (!isWellFormedToken(token)) return;
  run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
}

export function deleteUserSessions(userId: string) {
  run("DELETE FROM sessions WHERE user_id = ?", userId);
}

/** Limpeza periódica (chamada por amostragem no login). Tentativas de login: retenção de 90 dias. */
export function purgeExpiredSessions(now = Date.now()) {
  run("DELETE FROM sessions WHERE expires_at <= ? OR absolute_expires_at <= ?", iso(now), iso(now));
  run("DELETE FROM visitors WHERE expires_at <= ?", iso(now));
  run("DELETE FROM login_attempts WHERE created_at <= ?", iso(now - 90 * 24 * 60 * 60 * 1000));
}
