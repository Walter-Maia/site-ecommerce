import "server-only";
import { z } from "zod";
import { BODY_LIMITS } from "@/lib/types";

/** Esquemas zod compartilhados. Toda entrada do cliente passa por aqui. */

export const SIZES = ["PP", "P", "M", "G", "GG", "XGG", "37", "38", "39", "40", "41", "42", "43", "44", "U"] as const;
export const HAIR_STYLES = [
  "raspado", "curto", "cacheado-curto", "black-power", "trancas", "maria-chiquinha", "coque", "rabo-de-cavalo", "longo-liso",
] as const;
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/** Texto livre de uma linha: sem caracteres de controle. */
export const text = (min: number, max: number, msg: string) =>
  z
    .string(msg)
    .trim()
    .min(min, msg)
    .max(max, `Use no máximo ${max} caracteres.`)
    .refine((s) => !CONTROL_RE.test(s), "Caracteres inválidos.");

export const emailSchema = z
  .string("Informe um e-mail válido.")
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("Informe um e-mail válido."));

export const idSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const sizeSchema = z.enum(SIZES);
export const hexSchema = z.string().trim().regex(HEX_RE, "Cor inválida (use #RRGGBB).");

export const lookItemSchema = z.object({ productId: idSchema, size: sizeSchema });

export const lookBodySchema = z.object({
  mannequinId: idSchema,
  heightCm: z.number().int().min(BODY_LIMITS.heightCm.min).max(BODY_LIMITS.heightCm.max),
  weightKg: z.number().int().min(BODY_LIMITS.weightKg.min).max(BODY_LIMITS.weightKg.max),
  skinTone: hexSchema,
  hairColor: hexSchema,
  hairStyle: z.enum(HAIR_STYLES),
  style: z.enum(["formal", "informal"]),
});

export const saveLookSchema = z.object({
  name: z
    .string()
    .trim()
    .max(40)
    .refine((s) => !CONTROL_RE.test(s))
    .transform((s) => s || "Meu look"),
  body: lookBodySchema,
  items: z.array(lookItemSchema).max(12),
});

/* ───────────── checkout ───────────── */

export function isValidCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .refine((s) => !CONTROL_RE.test(s), "Caracteres inválidos.")
    .optional()
    .transform((s) => (s ? s : undefined));

export const checkoutSchema = z.object({
  name: text(3, 80, "Informe seu nome completo."),
  email: emailSchema,
  cpf: z
    .string()
    .optional()
    .transform((s) => (s ? s.replace(/\D/g, "") : undefined))
    .refine((s) => s === undefined || isValidCpf(s), "CPF inválido."),
  cep: z
    .string("Informe o CEP.")
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().length(8, "O CEP deve ter 8 dígitos.")),
  street: text(2, 120, "Informe a rua."),
  number: text(1, 10, "Informe o número."),
  complement: optionalText(60),
  district: text(2, 60, "Informe o bairro."),
  city: text(2, 60, "Informe a cidade."),
  state: z
    .string("Selecione o estado.")
    .trim()
    .toUpperCase()
    .pipe(z.enum(UFS, "Selecione o estado.")),
  paymentMethod: z.enum(["pix", "cartao"], "Escolha a forma de pagamento."),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

const CHECKOUT_FIELDS = [
  "name", "email", "cpf", "cep", "street", "number", "complement", "district", "city", "state", "paymentMethod",
] as const;

/** Lê SOMENTE os campos esperados (dados de cartão nunca são lidos, nem se vierem). */
export function checkoutFromForm(fd: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of CHECKOUT_FIELDS) {
    const v = fd.get(k);
    out[k] = typeof v === "string" ? v : undefined;
  }
  return out;
}

/** Primeiro erro de cada campo, no formato de FormState.fieldErrors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
