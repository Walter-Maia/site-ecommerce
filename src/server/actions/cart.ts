"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult, CartView, LookItem, Size } from "@/lib/types";
import { cartViewFor } from "../cart";
import { get, run, transaction } from "../db/client";
import { MAX_CART_LINES, MAX_QTY_PER_LINE } from "../pricing";
import { getOwner, ownerColumn, type Owner } from "../session";
import { newId, nowIso } from "../util";
import { idSchema, lookItemSchema, sizeSchema } from "../validation";

/** CONTRATO de mutações do carrinho. Preço SEMPRE recalculado no servidor. */

class CartError extends Error {}

const addSchema = z.object({
  productId: idSchema,
  size: sizeSchema,
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE).optional(),
});
const updateSchema = z.object({ lineId: z.uuid(), quantity: z.number().finite() });
const removeSchema = z.object({ lineId: z.uuid() });
const lookSchema = z.object({ items: z.array(lookItemSchema).min(1).max(12) });

/** Adiciona/soma uma linha (síncrono: roda dentro de transação). */
function addLine(owner: Owner, productId: string, size: Size, quantity: number) {
  const variant = get<{ stock: number; name: string }>(
    "SELECT ps.stock, p.name FROM product_sizes ps JOIN products p ON p.id = ps.product_id WHERE ps.product_id = ? AND ps.size = ?",
    productId,
    size,
  );
  if (!variant) throw new CartError("Produto ou tamanho inválido.");
  if (variant.stock <= 0) throw new CartError(`${variant.name} (tam. ${size}) está esgotado.`);

  const col = ownerColumn(owner);
  const now = nowIso();
  const existing = get<{ id: string; quantity: number }>(
    `SELECT id, quantity FROM cart_items WHERE ${col} = ? AND product_id = ? AND size = ?`,
    owner.id,
    productId,
    size,
  );
  const cap = Math.min(MAX_QTY_PER_LINE, variant.stock);
  if (existing) {
    run("UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?", Math.min(cap, existing.quantity + quantity), now, existing.id);
    return;
  }
  const lines = get<{ n: number }>(`SELECT COUNT(*) AS n FROM cart_items WHERE ${col} = ?`, owner.id)?.n ?? 0;
  if (lines >= MAX_CART_LINES) throw new CartError("Seu carrinho atingiu o limite de itens.");
  run(
    `INSERT INTO cart_items (id, ${col}, product_id, size, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    owner.id,
    productId,
    size,
    Math.min(cap, quantity),
    now,
    now,
  );
}

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof CartError) return { ok: false, error: err.message };
  console.error("[carrinho]", err);
  return { ok: false, error: "Não foi possível atualizar o carrinho." };
}

export async function addToCart(input: { productId: string; size: Size; quantity?: number }): Promise<ActionResult<CartView>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Produto ou tamanho inválido." };
  const owner = (await getOwner({ create: true }))!;
  try {
    transaction(() => addLine(owner, parsed.data.productId, parsed.data.size, parsed.data.quantity ?? 1));
  } catch (err) {
    return fail(err);
  }
  refresh();
  return { ok: true, data: cartViewFor(owner) };
}

export async function updateCartLine(input: { lineId: string; quantity: number }): Promise<ActionResult<CartView>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Item não encontrado." };
  const owner = await getOwner();
  if (!owner) return { ok: false, error: "Item não encontrado." };
  const col = ownerColumn(owner);
  const line = get<{ id: string; stock: number | null }>(
    `SELECT c.id, ps.stock FROM cart_items c
       LEFT JOIN product_sizes ps ON ps.product_id = c.product_id AND ps.size = c.size
      WHERE c.id = ? AND c.${col} = ?`,
    parsed.data.lineId,
    owner.id,
  );
  if (!line) return { ok: false, error: "Item não encontrado." };
  const max = Math.max(1, Math.min(MAX_QTY_PER_LINE, line.stock ?? MAX_QTY_PER_LINE));
  const qty = Math.max(1, Math.min(max, Math.trunc(parsed.data.quantity)));
  run(`UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ? AND ${col} = ?`, qty, nowIso(), line.id, owner.id);
  refresh();
  return { ok: true, data: cartViewFor(owner) };
}

export async function removeCartLine(input: { lineId: string }): Promise<ActionResult<CartView>> {
  const parsed = removeSchema.safeParse(input);
  const owner = await getOwner();
  if (!parsed.success || !owner) return { ok: true, data: cartViewFor(owner) };
  run(`DELETE FROM cart_items WHERE id = ? AND ${ownerColumn(owner)} = ?`, parsed.data.lineId, owner.id);
  refresh();
  return { ok: true, data: cartViewFor(owner) };
}

/** Adiciona todas as peças de um look do provador de uma vez (tudo ou nada). */
export async function addLookToCart(input: { items: LookItem[] }): Promise<ActionResult<CartView>> {
  const parsed = lookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Look vazio ou inválido." };
  const owner = (await getOwner({ create: true }))!;
  try {
    transaction(() => {
      for (const it of parsed.data.items) addLine(owner, it.productId, it.size, 1);
    });
  } catch (err) {
    return fail(err);
  }
  refresh();
  return { ok: true, data: cartViewFor(owner) };
}
