import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { checkPasswordStrength, getDummyHash, hashPassword, verifyPassword } from "@/server/auth/password";

describe("hash de senha (scrypt)", () => {
  it("gera formato versionado com parâmetros N=2^15, r=8, p=1 e sal de 16 bytes", async () => {
    const h = await hashPassword("cavalo-bateria-grampo-9");
    const [alg, n, r, p, salt, key] = h.split("$");
    expect(alg).toBe("scrypt");
    expect(Number(n)).toBe(2 ** 15);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
    expect(Buffer.from(salt, "base64")).toHaveLength(16);
    expect(Buffer.from(key, "base64")).toHaveLength(64);
  });

  it("verifica a senha certa e recusa a errada", async () => {
    const h = await hashPassword("cavalo-bateria-grampo-9");
    expect(await verifyPassword("cavalo-bateria-grampo-9", h)).toBe(true);
    expect(await verifyPassword("cavalo-bateria-grampo-8", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });

  it("usa sal aleatório: mesma senha gera hashes diferentes", async () => {
    const [a, b] = await Promise.all([hashPassword("mesma-senha-forte-1"), hashPassword("mesma-senha-forte-1")]);
    expect(a).not.toBe(b);
  });

  it("normaliza Unicode (NFC × NFD da mesma senha)", async () => {
    const h = await hashPassword("café-com-pão-2026");
    expect(await verifyPassword("café-com-pão-2026", h)).toBe(true);
  });

  it("recusa hashes malformados ou com custo adulterado (sem lançar)", async () => {
    const h = await hashPassword("cavalo-bateria-grampo-9");
    const parts = h.split("$");
    expect(await verifyPassword("x", "texto-qualquer")).toBe(false);
    expect(await verifyPassword("cavalo-bateria-grampo-9", ["scrypt", String(2 ** 20), ...parts.slice(2)].join("$"))).toBe(false);
    expect(await verifyPassword("cavalo-bateria-grampo-9", ["bcrypt", ...parts.slice(1)].join("$"))).toBe(false);
    expect(await verifyPassword("cavalo-bateria-grampo-9", [...parts.slice(0, 5), "AAAA"].join("$"))).toBe(false);
  });

  it("hash fictício (anti-enumeração) nunca confere", async () => {
    const dummy = await getDummyHash();
    expect(await verifyPassword("qualquer-coisa-123", dummy)).toBe(false);
  });
});

describe("política de senha", () => {
  it("exige pelo menos 10 caracteres", () => {
    expect(checkPasswordStrength("Ab1!xyz")).toMatch(/10 caracteres/);
  });
  it("recusa senhas comuns e variações óbvias", () => {
    expect(checkPasswordStrength("1234567890")).toMatch(/comum/);
    expect(checkPasswordStrength("password123")).toMatch(/comum/);
    expect(checkPasswordStrength("Corinthians2026")).toMatch(/comum/);
    expect(checkPasswordStrength("quadra2026!!")).toMatch(/comum/);
  });
  it("recusa pouca variedade", () => {
    expect(checkPasswordStrength("aaaaaaaaaaaa")).toMatch(/variedade/);
  });
  it("recusa senha baseada no e-mail ou no nome", () => {
    expect(checkPasswordStrength("joaosilva-2026", { email: "joaosilva@exemplo.com" })).toMatch(/e-mail/);
    expect(checkPasswordStrength("thaynara123456", { name: "Thaynara Souza" })).toMatch(/nome/);
  });
  it("aceita senha forte", () => {
    expect(checkPasswordStrength("tênis-azul-na-quadra-7")).toBeNull();
    expect(checkPasswordStrength("x".repeat(129))).toMatch(/máximo/);
  });
});
