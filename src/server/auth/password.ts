import "server-only";
import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { COMMON_PASSWORDS } from "./common-passwords";

/**
 * Hash de senha com scrypt (memory-hard). Formato armazenado:
 *   scrypt$<N>$<r>$<p>$<sal base64>$<hash base64>
 * Os parâmetros ficam no próprio hash para permitir subir o custo no futuro.
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
/** scrypt exige 128·N·r bytes (32 MiB); o padrão do Node é exatamente 32 MiB e falharia. */
const MAXMEM = 64 * 1024 * 1024;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function encode(salt: Buffer, key: Buffer, n = N, r = R, p = P) {
  return `scrypt$${n}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return encode(salt, key);
}

/** Versão síncrona: só para o seed (fora do caminho de requisição). */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password.normalize("NFKC"), salt, KEY_LEN, { N, r: R, p: P, maxmem: MAXMEM });
  return encode(salt, key);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const cost = Number(n);
  const blockSize = Number(r);
  const parallel = Number(p);
  // Recusa parâmetros fora da faixa esperada (hash adulterado = DoS por custo).
  if (!(cost >= 2 ** 14 && cost <= 2 ** 16 && blockSize === 8 && parallel >= 1 && parallel <= 2)) return false;
  const expected = Buffer.from(keyB64, "base64");
  if (expected.length !== KEY_LEN) return false;
  try {
    const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), KEY_LEN, {
      N: cost,
      r: blockSize,
      p: parallel,
      maxmem: 256 * cost * blockSize * parallel,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Hash de uma senha aleatória, usado quando o e-mail não existe: o servidor
 * gasta o mesmo tempo de scrypt e a resposta não revela se a conta existe.
 */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString("base64url"));
  return dummyHash;
}

/** Regras de força. Devolve a mensagem de erro ou null. */
export function checkPasswordStrength(password: string, ctx: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `Use no máximo ${PASSWORD_MAX} caracteres.`;
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "Essa senha é muito comum. Escolha outra.";
  if (new Set(lower).size < 4) return "Use uma senha com mais variedade de caracteres.";
  // Variações óbvias de senhas comuns ("Senha12345!", "quadra2026").
  const stripped = lower.replace(/[^a-z]/g, "");
  if (stripped.length >= 4 && COMMON_PASSWORDS.has(stripped) && lower.length - stripped.length <= 6) {
    return "Essa senha é muito comum. Escolha outra.";
  }
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "A senha não pode conter seu e-mail.";
  // Nome seguido de sufixo simples (ex.: "mariana123!").
  const first = ctx.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.startsWith(first) && /^[0-9!@#$%&*._-]*$/.test(lower.slice(first.length))) {
    return "A senha não pode ser seu nome.";
  }
  return null;
}
