import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.QUADRA_DB_PATH = ":memory:";
  process.env.SESSION_SECRET = "teste-segredo-com-mais-de-32-caracteres!!";
});
vi.mock("server-only", () => ({}));

import { SESSION_ABSOLUTE_TTL_S, SESSION_TTL_S } from "@/server/auth/cookie-config";
import { createSession, deleteSession, deleteUserSessions, validateSessionToken } from "@/server/auth/sessions";
import { generateToken, hashIp, hashToken, isWellFormedToken } from "@/server/auth/tokens";
import { all, get, run } from "@/server/db/client";

const DAY = 86_400_000;

beforeAll(() => {
  run(
    "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES ('u1', 'Ana', 'ana@ex.com', 'x', 'cliente', '2026-01-01', '2026-01-01')",
  );
});

describe("token de sessão", () => {
  it("tem 256 bits em base64url (43 chars) e não se repete", () => {
    const tokens = new Set(Array.from({ length: 2000 }, generateToken));
    expect(tokens.size).toBe(2000);
    for (const t of [...tokens].slice(0, 20)) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(t, "base64url")).toHaveLength(32);
    }
  });

  it("no banco fica só o SHA-256 (hex)", () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(createHash("sha256").update(t).digest("hex"));
    const token = createSession("u1");
    const rows = all<{ token_hash: string }>("SELECT token_hash FROM sessions");
    expect(rows.some((r) => r.token_hash === token)).toBe(false);
    expect(rows.some((r) => r.token_hash === hashToken(token))).toBe(true);
  });

  it("rejeita cookies malformados sem consultar o banco", () => {
    for (const bad of [undefined, null, "", "abc", "x".repeat(44), "' OR 1=1 --".padEnd(43, "a")]) {
      expect(isWellFormedToken(bad as string)).toBe(false);
      expect(validateSessionToken(bad as string)).toBeNull();
    }
  });

  it("valida e devolve DTO sem campos sensíveis", () => {
    const token = createSession("u1");
    const user = validateSessionToken(token);
    expect(user).toEqual({ id: "u1", name: "Ana", email: "ana@ex.com", role: "cliente" });
    expect(Object.keys(user!)).not.toContain("password_hash");
  });

  it("expiração deslizante de 7 dias, com teto absoluto", () => {
    const t0 = Date.now();
    const token = createSession("u1", t0);
    const h = hashToken(token);
    // usado no dia 6: desliza para dia 6 + 7
    expect(validateSessionToken(token, t0 + 6 * DAY)).not.toBeNull();
    const exp = Date.parse(get<{ expires_at: string }>("SELECT expires_at FROM sessions WHERE token_hash = ?", h)!.expires_at);
    expect(exp).toBe(t0 + 6 * DAY + SESSION_TTL_S * 1000);
    // ainda válido no dia 12 (sem o deslize teria expirado no dia 7)
    expect(validateSessionToken(token, t0 + 12 * DAY)).not.toBeNull();
    // nunca passa do teto absoluto
    expect(validateSessionToken(token, t0 + SESSION_ABSOLUTE_TTL_S * 1000 + 1)).toBeNull();
    expect(get("SELECT 1 AS x FROM sessions WHERE token_hash = ?", h)).toBeUndefined();
  });

  it("sessão parada por mais de 7 dias expira e é apagada", () => {
    const t0 = Date.now();
    const token = createSession("u1", t0);
    expect(validateSessionToken(token, t0 + SESSION_TTL_S * 1000 + 1)).toBeNull();
    expect(get("SELECT 1 AS x FROM sessions WHERE token_hash = ?", hashToken(token))).toBeUndefined();
  });

  it("logout invalida no servidor; troca de senha derruba todas", () => {
    const a = createSession("u1");
    const b = createSession("u1");
    deleteSession(a);
    expect(validateSessionToken(a)).toBeNull();
    expect(validateSessionToken(b)).not.toBeNull();
    deleteUserSessions("u1");
    expect(validateSessionToken(b)).toBeNull();
  });

  it("IP é pseudonimizado com HMAC (não reversível sem o segredo)", () => {
    expect(hashIp("203.0.113.9")).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
  });
});
