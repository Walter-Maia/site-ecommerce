import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regressão: o limite por e-mail do login era consultado com status() antes do
 * scrypt e só incrementado depois da falha. Tentativas em paralelo passavam
 * todas pela checagem (confirmado no servidor: 13–14 senhas avaliadas por
 * janela em vez de 5).
 */

const ctx = vi.hoisted(() => {
  process.env.QUADRA_DB_PATH = ":memory:";
  process.env.SESSION_SECRET = "teste-segredo-com-mais-de-32-caracteres!!";
  const store = new Map<string, string>();
  return {
    store,
    ip: "192.0.2.1",
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
  headers: async () => new Headers({ "x-forwarded-for": ctx.ip }),
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
import { get, run } from "@/server/db/client";

const form = (email: string, password: string) => {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
};

beforeAll(async () => {
  const now = new Date().toISOString();
  run(
    "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'cliente', ?, ?)",
    "u-bf", "Cliente Bruteforce", "alvo@ex.com", await hashPassword("senha-forte-de-teste-1"), now, now,
  );
});
beforeEach(() => ctx.store.clear());

describe("limite por e-mail do login sob concorrência", () => {
  it("12 senhas em paralelo contra a mesma conta: no máximo 5 são avaliadas", async () => {
    ctx.ip = "192.0.2.10";
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => loginAction(undefined, form("alvo@ex.com", `chute-errado-${i}-xx`))),
    );
    const evaluated = results.filter((r) => r?.error === "E-mail ou senha incorretos.").length;
    const limited = results.filter((r) => /Muitas tentativas/.test(r?.error ?? "")).length;
    expect(evaluated).toBeLessThanOrEqual(5);
    expect(evaluated + limited).toBe(12);
    // e a senha certa também fica bloqueada até a janela passar
    const right = await loginAction(undefined, form("alvo@ex.com", "senha-forte-de-teste-1"));
    expect(right?.error).toMatch(/Muitas tentativas/);
    expect(ctx.store.size).toBe(0);
  });

  it("e-mail inexistente sob o mesmo ataque também é limitado (sem diferença que revele a conta)", async () => {
    ctx.ip = "192.0.2.11";
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => loginAction(undefined, form("ninguem@ex.com", `chute-errado-${i}-xx`))),
    );
    expect(results.filter((r) => r?.error === "E-mail ou senha incorretos.").length).toBeLessThanOrEqual(5);
  });

  it("login certo continua funcionando e zera a contagem do e-mail", async () => {
    ctx.ip = "192.0.2.12";
    run("INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) SELECT 'u-ok', name, 'ok@ex.com', password_hash, role, created_at, updated_at FROM users WHERE id = 'u-bf'");
    for (let i = 0; i < 4; i++) await loginAction(undefined, form("ok@ex.com", `errada-${i}-xxxxx`));
    await expect(loginAction(undefined, form("ok@ex.com", "senha-forte-de-teste-1"))).rejects.toThrow("NEXT_REDIRECT:/conta");
    ctx.store.clear();
    // depois do sucesso, a janela recomeça: mais 4 erros ainda não bloqueiam
    for (let i = 0; i < 4; i++) {
      const r = await loginAction(undefined, form("ok@ex.com", `errada-b-${i}-xxxxx`));
      expect(r?.error).toBe("E-mail ou senha incorretos.");
    }
    expect(get<{ n: number }>("SELECT COUNT(*) AS n FROM login_attempts WHERE email = 'ok@ex.com' AND success = 1")!.n).toBe(1);
  });
});
