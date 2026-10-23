import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";

/** Token opaco de 256 bits em base64url (43 caracteres). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Rejeita cookies malformados antes de tocar no banco. */
export function isWellFormedToken(value: string | undefined | null): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

/** No banco fica só o SHA-256 do token: vazamento do banco não entrega sessões. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ───────────── segredo do servidor (SESSION_SECRET) ───────────── */

const g = globalThis as unknown as { __qdEphemeralSecret?: string; __qdSecretWarned?: boolean };

export function getServerSecret(): string {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 32) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres).");
  }
  if (!g.__qdSecretWarned) {
    g.__qdSecretWarned = true;
    console.warn("[kimekris] SESSION_SECRET ausente: usando segredo efêmero (rode `npm run db:seed`).");
  }
  g.__qdEphemeralSecret ??= randomBytes(32).toString("base64url");
  return g.__qdEphemeralSecret;
}

/** Pseudonimiza IPs (LGPD): guarda HMAC truncado, não o IP. */
export function hashIp(ip: string): string {
  return createHmac("sha256", getServerSecret()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}
