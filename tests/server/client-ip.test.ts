import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regressão: o IP do rate limit não pode vir de cabeçalhos que o cliente forja
 * quando a infraestrutura declara de onde vem o IP real.
 */

const ctx = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => ctx.headers }));

const { getClientIp } = await import("@/server/auth/request");

afterEach(() => {
  delete process.env.TRUSTED_IP_HEADER;
  delete process.env.TRUSTED_PROXY_HOPS;
});

describe("getClientIp", () => {
  it("com TRUSTED_IP_HEADER ignora X-Forwarded-For e X-Real-IP forjados", async () => {
    process.env.TRUSTED_IP_HEADER = "cf-connecting-ip";
    ctx.headers = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" });
    expect(await getClientIp()).toBe("203.0.113.7");
  });

  it("com TRUSTED_PROXY_HOPS usa a entrada que o proxy confiável anexou", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    ctx.headers = new Headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" });
    expect(await getClientIp()).toBe("198.51.100.4");
  });

  it("nunca confia em X-Real-IP enviado pelo cliente", async () => {
    ctx.headers = new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "198.51.100.9" });
    expect(await getClientIp()).toBe("198.51.100.9");
  });

  it("sem cabeçalhos devolve 'desconhecido'", async () => {
    ctx.headers = new Headers();
    expect(await getClientIp()).toBe("desconhecido");
  });
});
