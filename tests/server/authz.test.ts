import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => {
  process.env.QUADRA_DB_PATH = ":memory:";
  process.env.SESSION_SECRET = "teste-segredo-com-mais-de-32-caracteres!!";
  const store = new Map<string, string>();
  return {
    store,
    ip: "198.51.100.7",
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

import { loginAction, registerAction } from "@/server/actions/auth";
import {
  createMannequinAction,
  deleteMannequinAction,
  updateMannequinAction,
  updateOrderStatusAction,
  updateProductAction,
} from "@/server/admin/actions";
import { SESSION_COOKIE } from "@/server/auth/cookie-config";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/sessions";
import { get, run } from "@/server/db/client";

const now = new Date().toISOString();

function mannequinForm(extra: Record<string, string> = {}) {
  const fd = new FormData();
  const base = {
    id: "m-mia", name: "MIA HACK", body: "feminino", skinTone: "#B57A55", hairStyle: "coque", hairColor: "#141010",
    style: "formal", heightCm: "170", weightKg: "60", active: "on", sortOrder: "1", ...extra,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

const auditCount = () => get<{ n: number }>("SELECT COUNT(*) AS n FROM audit_log")!.n;
const miaName = () => get<{ name: string }>("SELECT name FROM mannequins WHERE id = 'm-mia'")!.name;

beforeAll(async () => {
  const hash = await hashPassword("senha-forte-de-teste-1");
  for (const [id, email, role] of [
    ["u-cli", "cliente@ex.com", "cliente"],
    ["u-adm", "chefe@ex.com", "admin"],
  ]) {
    run(
      "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, `Usuário ${id}`, email, hash, role, now, now,
    );
  }
});

beforeEach(() => ctx.store.clear());

const loginAs = (userId: string) => ctx.store.set(SESSION_COOKIE, createSession(userId));

describe("autorização das ações de admin", () => {
  const attempts: [string, () => Promise<unknown>][] = [
    ["updateMannequinAction", () => updateMannequinAction(undefined, mannequinForm())],
    ["createMannequinAction", () => createMannequinAction(undefined, mannequinForm())],
    ["deleteMannequinAction", () => deleteMannequinAction(undefined, mannequinForm({ id: "m-x" }))],
    ["updateProductAction", () => updateProductAction(undefined, (() => { const f = new FormData(); f.set("id", "p01"); f.set("price", "1,00"); return f; })())],
    ["updateOrderStatusAction", () => updateOrderStatusAction(undefined, (() => { const f = new FormData(); f.set("id", crypto.randomUUID()); f.set("status", "cancelado"); return f; })())],
  ];

  it.each(attempts)("%s: anônimo é mandado para /entrar e nada muda", async (_n, call) => {
    const before = auditCount();
    await expect(call()).rejects.toThrow(/NEXT_REDIRECT:\/entrar/);
    expect(miaName()).toBe("MIA");
    expect(auditCount()).toBe(before);
  });

  it.each(attempts)("%s: cliente logado recebe 404 e nada muda", async (_n, call) => {
    loginAs("u-cli");
    const before = auditCount();
    const price = get<{ price: number }>("SELECT price FROM products WHERE id = 'p01'")!.price;
    await expect(call()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(miaName()).toBe("MIA");
    expect(get<{ price: number }>("SELECT price FROM products WHERE id = 'p01'")!.price).toBe(price);
    expect(auditCount()).toBe(before);
  });

  it("cookie de sessão forjado não vale nada", async () => {
    ctx.store.set(SESSION_COOKIE, "A".repeat(43));
    await expect(updateMannequinAction(undefined, mannequinForm())).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("admin consegue editar e a mudança vai para o audit_log", async () => {
    loginAs("u-adm");
    const before = auditCount();
    const res = await updateMannequinAction(undefined, mannequinForm({ name: "MIA 2" }));
    expect(res).toEqual({ success: true });
    expect(miaName()).toBe("MIA 2");
    expect(auditCount()).toBe(before + 1);
    const log = get<{ actor_email: string; action: string; entity_id: string; ip_hash: string }>(
      "SELECT actor_email, action, entity_id, ip_hash FROM audit_log ORDER BY id DESC LIMIT 1",
    )!;
    expect(log).toMatchObject({ actor_email: "chefe@ex.com", action: "mannequin.update", entity_id: "m-mia" });
    expect(log.ip_hash).not.toContain(ctx.ip);
  });

  it("admin: validação recusa hex inválido e altura fora dos limites", async () => {
    loginAs("u-adm");
    const res = await updateMannequinAction(undefined, mannequinForm({ skinTone: "red;}", heightCm: "300" }));
    expect(res?.fieldErrors?.skinTone).toBeDefined();
    expect(res?.fieldErrors?.heightCm).toBeDefined();
  });
});

describe("login e cadastro", () => {
  const form = (o: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(o)) fd.set(k, v);
    return fd;
  };

  it("mensagem genérica para e-mail inexistente e para senha errada", async () => {
    ctx.ip = "203.0.113.1";
    const a = await loginAction(undefined, form({ email: "naoexiste@ex.com", password: "qualquer-coisa-1" }));
    const b = await loginAction(undefined, form({ email: "cliente@ex.com", password: "senha-errada-123" }));
    expect(a).toEqual({ error: "E-mail ou senha incorretos." });
    expect(b).toEqual(a);
    expect(ctx.store.has(SESSION_COOKIE)).toBe(false);
  });

  it("login certo cria sessão nova (rotação) e redireciona só para caminho interno", async () => {
    ctx.ip = "203.0.113.2";
    ctx.store.set(SESSION_COOKIE, "velho-token-invalido");
    await expect(
      loginAction(undefined, form({ email: "CLIENTE@ex.com", password: "senha-forte-de-teste-1", next: "//evil.example" })),
    ).rejects.toThrow("NEXT_REDIRECT:/conta");
    const token = ctx.store.get(SESSION_COOKIE)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("bloqueia força bruta por e-mail após 5 falhas (mesmo com a senha certa)", async () => {
    ctx.ip = "203.0.113.3";
    for (let i = 0; i < 5; i++) {
      await loginAction(undefined, form({ email: "chefe@ex.com", password: `errada-${i}-xxxxx` }));
    }
    const res = await loginAction(undefined, form({ email: "chefe@ex.com", password: "senha-forte-de-teste-1" }));
    expect(res?.error).toMatch(/Muitas tentativas/);
    const failures = get<{ n: number }>("SELECT COUNT(*) AS n FROM login_attempts WHERE email = 'chefe@ex.com' AND success = 0")!.n;
    expect(failures).toBeGreaterThanOrEqual(6);
  });

  it("cadastro não revela se o e-mail já existe", async () => {
    ctx.ip = "203.0.113.4";
    await expect(registerAction(undefined, form({ name: "Bia", email: "bia@ex.com", password: "tênis-azul-na-quadra-7" }))).rejects.toThrow("NEXT_REDIRECT:/entrar?cadastro=ok");
    await expect(registerAction(undefined, form({ name: "Outra", email: "cliente@ex.com", password: "tênis-azul-na-quadra-8" }))).rejects.toThrow("NEXT_REDIRECT:/entrar?cadastro=ok");
    // a conta existente não foi alterada
    expect(get<{ name: string }>("SELECT name FROM users WHERE email = 'cliente@ex.com'")!.name).toBe("Usuário u-cli");
  });

  it("cadastro recusa senha fraca com erro no campo", async () => {
    ctx.ip = "203.0.113.5";
    const res = await registerAction(undefined, form({ name: "Caio", email: "caio@ex.com", password: "12345678910" }));
    expect(res?.fieldErrors?.password).toBeDefined();
    expect(get("SELECT 1 AS x FROM users WHERE email = 'caio@ex.com'")).toBeUndefined();
  });
});
