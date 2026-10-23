import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regressão: open redirect via ?next= com segmentos "." / ".." que, depois de
 * normalizados pelo parser de URL, viram "//host" (protocol-relative).
 * Ex.: /entrar?next=/.//evil.example levava um usuário logado para http://evil.example.
 */

const ctx = vi.hoisted(() => {
  process.env.QUADRA_DB_PATH = ":memory:";
  process.env.SESSION_SECRET = "teste-segredo-com-mais-de-32-caracteres!!";
  const store = new Map<string, string>();
  return {
    store,
    jar: {
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      has: (name: string) => store.has(name),
      set: (name: string, value: string) => {
        if (value === "") store.delete(name);
        else store.set(name, value);
      },
      delete: (name: string) => store.delete(name),
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ctx.jar,
  headers: async () => new Headers({ "x-forwarded-for": "192.0.2.10" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));

import { loginAction } from "@/server/actions/auth";
import { hashPassword } from "@/server/auth/password";
import { run } from "@/server/db/client";
import { safeNextPath } from "@/server/session";

const BYPASSES = [
  "/.//evil.example",
  "/..//evil.example",
  "/a/..//evil.example",
  "/%2e//evil.example",
  "/%2E%2E//evil.example",
  "/././/evil.example/x?y=1",
  "/x/../..//evil.example",
];

describe("safeNextPath", () => {
  it.each(BYPASSES)("recusa %s (normaliza para //host)", (raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "evil.example", "/\tevil"])(
    "recusa %s",
    (raw) => {
      expect(safeNextPath(raw)).toBeNull();
    },
  );

  it("nenhum resultado aceito começa com // ou /\\", () => {
    for (const raw of [...BYPASSES, "/conta", "/a/./b", "/a/../b", "/%2F%2Fevil.example"]) {
      const out = safeNextPath(raw);
      if (out !== null) {
        expect(out.startsWith("/")).toBe(true);
        expect(out.startsWith("//")).toBe(false);
        expect(out.startsWith("/\\")).toBe(false);
      }
    }
  });

  it("continua aceitando caminhos internos legítimos", () => {
    expect(safeNextPath("/conta")).toBe("/conta");
    expect(safeNextPath("/admin/pedidos?status=pago")).toBe("/admin/pedidos?status=pago");
    expect(safeNextPath("/a/./b/../c")).toBe("/a/c");
    // barra codificada continua sendo caminho, não host
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});

describe("loginAction com ?next= malicioso", () => {
  beforeAll(async () => {
    const now = new Date().toISOString();
    run(
      "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'cliente', ?, ?)",
      "u-redir", "Cliente Redirect", "redir@ex.com", await hashPassword("senha-forte-de-teste-1"), now, now,
    );
  });
  beforeEach(() => ctx.store.clear());

  it.each(BYPASSES)("next=%s cai no padrão /conta", async (next) => {
    const fd = new FormData();
    fd.set("email", "redir@ex.com");
    fd.set("password", "senha-forte-de-teste-1");
    fd.set("next", next);
    await expect(loginAction(undefined, fd)).rejects.toThrow(/^NEXT_REDIRECT:\/conta$/);
  });
});
