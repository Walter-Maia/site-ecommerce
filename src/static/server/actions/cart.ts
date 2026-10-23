import { SIZE_ORDER } from "@/components/loja/constants";
import type { ActionResult, CartView, LookItem, Product, Size } from "@/lib/types";
import { cartViewFrom, newId, readCartLines, writeCartLines, type StoredCartLine } from "../../client/storage";
import { catalogById, ID_RE, UUID_RE } from "./catalog-client";

/**
 * Demo estática: CONTRATO de src/server/actions/cart.ts executado no navegador
 * (sem "use server"). Mesmas regras: preço e estoque relidos do catálogo a
 * cada ação, limite de 10 por linha e 30 linhas, look "tudo ou nada".
 */

const MAX_QTY_PER_LINE = 10;
const MAX_CART_LINES = 30;
const SIZES = new Set<string>(SIZE_ORDER);

class CartError extends Error {}

const stockOf = (p: Product, size: Size) => p.sizes.find((s) => s.size === size)?.stock;

/** Atualiza nome/foto/preço das linhas com o catálogo atual e descarta o que saiu da loja. */
function reprice(lines: StoredCartLine[], byId: Map<string, Product>): StoredCartLine[] {
  return lines.flatMap((l) => {
    const p = byId.get(l.productId);
    if (!p || stockOf(p, l.size) === undefined) return [];
    return [{ ...l, slug: p.slug, name: p.name, image: p.images[0]?.src ?? "", unitPrice: p.price }];
  });
}

function addLine(lines: StoredCartLine[], byId: Map<string, Product>, productId: string, size: Size, quantity: number): StoredCartLine[] {
  const p = byId.get(productId);
  const stock = p ? stockOf(p, size) : undefined;
  if (!p || stock === undefined) throw new CartError("Produto ou tamanho inválido.");
  if (stock <= 0) throw new CartError(`${p.name} (tam. ${size}) está esgotado.`);
  const cap = Math.min(MAX_QTY_PER_LINE, stock);
  const existing = lines.find((l) => l.productId === productId && l.size === size);
  if (existing) return lines.map((l) => (l === existing ? { ...l, quantity: Math.min(cap, l.quantity + quantity) } : l));
  if (lines.length >= MAX_CART_LINES) throw new CartError("Seu carrinho atingiu o limite de itens.");
  return [
    ...lines,
    { lineId: newId(), productId, slug: p.slug, name: p.name, image: p.images[0]?.src ?? "", size, quantity: Math.min(cap, quantity), unitPrice: p.price },
  ];
}

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof CartError) return { ok: false, error: err.message };
  console.error("[carrinho]", err);
  return { ok: false, error: "Não foi possível atualizar o carrinho." };
}

function save(lines: StoredCartLine[]): CartView {
  writeCartLines(lines);
  return cartViewFrom(lines);
}

const validSize = (s: unknown): s is Size => typeof s === "string" && SIZES.has(s);

export async function addToCart(input: { productId: string; size: Size; quantity?: number }): Promise<ActionResult<CartView>> {
  const qty = input?.quantity ?? 1;
  if (!ID_RE.test(String(input?.productId)) || !validSize(input?.size) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
    return { ok: false, error: "Produto ou tamanho inválido." };
  }
  try {
    const byId = await catalogById();
    return { ok: true, data: save(addLine(reprice(readCartLines(), byId), byId, input.productId, input.size, qty)) };
  } catch (err) {
    return fail(err);
  }
}

export async function updateCartLine(input: { lineId: string; quantity: number }): Promise<ActionResult<CartView>> {
  if (!UUID_RE.test(String(input?.lineId)) || !Number.isFinite(input?.quantity)) return { ok: false, error: "Item não encontrado." };
  const byId = await catalogById();
  const lines = reprice(readCartLines(), byId);
  const line = lines.find((l) => l.lineId === input.lineId);
  if (!line) return { ok: false, error: "Item não encontrado." };
  const stock = stockOf(byId.get(line.productId)!, line.size) ?? MAX_QTY_PER_LINE;
  const max = Math.max(1, Math.min(MAX_QTY_PER_LINE, stock));
  const qty = Math.max(1, Math.min(max, Math.trunc(input.quantity)));
  return { ok: true, data: save(lines.map((l) => (l === line ? { ...l, quantity: qty } : l))) };
}

export async function removeCartLine(input: { lineId: string }): Promise<ActionResult<CartView>> {
  const lines = readCartLines();
  if (!UUID_RE.test(String(input?.lineId))) return { ok: true, data: cartViewFrom(lines) };
  return { ok: true, data: save(lines.filter((l) => l.lineId !== input.lineId)) };
}

/** Todas as peças de um look do provador de uma vez (tudo ou nada). */
export async function addLookToCart(input: { items: LookItem[] }): Promise<ActionResult<CartView>> {
  const items = Array.isArray(input?.items) ? input.items : [];
  if (items.length < 1 || items.length > 12 || !items.every((it) => ID_RE.test(String(it?.productId)) && validSize(it?.size))) {
    return { ok: false, error: "Look vazio ou inválido." };
  }
  try {
    const byId = await catalogById();
    let lines = reprice(readCartLines(), byId);
    for (const it of items) lines = addLine(lines, byId, it.productId, it.size, 1);
    return { ok: true, data: save(lines) };
  } catch (err) {
    return fail(err);
  }
}
