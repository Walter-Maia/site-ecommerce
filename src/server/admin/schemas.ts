import "server-only";
import { z } from "zod";
import { BODY_LIMITS } from "@/lib/types";
import { ORDER_STATUSES } from "../orders";
import { HAIR_STYLES, hexSchema, text } from "../validation";

/** Validação dos formulários do admin (FormData → dados tipados). */

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === "1", z.boolean());
const intField = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : NaN),
    z.number(msg).int(msg).min(min, msg).max(max, msg),
  );

export const mannequinSchema = z.object({
  name: text(1, 24, "Informe o nome (até 24 caracteres)."),
  body: z.enum(["feminino", "masculino"], "Escolha o corpo."),
  skinTone: hexSchema,
  hairStyle: z.enum(HAIR_STYLES, "Escolha o cabelo."),
  hairColor: hexSchema,
  style: z.enum(["formal", "informal"], "Escolha o estilo."),
  heightCm: intField(
    BODY_LIMITS.heightCm.min,
    BODY_LIMITS.heightCm.max,
    `Altura entre ${BODY_LIMITS.heightCm.min} e ${BODY_LIMITS.heightCm.max} cm.`,
  ),
  weightKg: intField(
    BODY_LIMITS.weightKg.min,
    BODY_LIMITS.weightKg.max,
    `Peso entre ${BODY_LIMITS.weightKg.min} e ${BODY_LIMITS.weightKg.max} kg.`,
  ),
  active: checkbox,
  sortOrder: intField(0, 999, "Ordem entre 0 e 999."),
});
export type MannequinInput = z.infer<typeof mannequinSchema>;

export const MANNEQUIN_FIELDS = [
  "name", "body", "skinTone", "hairStyle", "hairColor", "style", "heightCm", "weightKg", "active", "sortOrder",
] as const;

/** "1.299,90" | "189,90" | "189.90" | "189" → centavos. */
export function parseBRL(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/R\$|\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

const MAX_PRICE = 10_000_000; // R$ 100.000,00

export const productUpdateSchema = z
  .object({
    price: z.preprocess(parseBRL, z.number("Preço inválido.").int().min(100, "Preço mínimo R$ 1,00.").max(MAX_PRICE, "Preço alto demais.")),
    compareAtPrice: z.preprocess(
      parseBRL,
      z.number("Preço \"de\" inválido.").int().min(100).max(MAX_PRICE, "Preço alto demais.").nullable(),
    ),
    isNew: checkbox,
    isFeatured: checkbox,
  })
  .refine((d) => d.compareAtPrice === null || d.compareAtPrice > d.price, {
    path: ["compareAtPrice"],
    message: "O preço \"de\" deve ser maior que o preço atual (ou deixe vazio).",
  });
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const stockSchema = intField(0, 9999, "Estoque entre 0 e 9999.");

export const orderStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["aguardando-pagamento", "pago", "enviado", "cancelado"], "Status inválido.").refine((s) => ORDER_STATUSES.includes(s)),
});
