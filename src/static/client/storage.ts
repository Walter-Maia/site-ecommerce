import { FLAT_SHIPPING, FREE_SHIPPING_THRESHOLD } from "@/data/site";
import type { CartLine, CartView, SavedLook } from "@/lib/types";
import type { OrderView } from "../server/orders";

/**
 * Persistência da demo estática no navegador (localStorage). Substitui o
 * SQLite + cookie de visitante da versão com servidor: sacola, curtidas,
 * looks salvos e pedidos ficam SÓ neste navegador. Toda leitura/escrita
 * em try/catch (modo privado, cota cheia, storage bloqueado) e toda leitura
 * é validada: dado corrompido vira lista vazia, nunca exceção.
 */

const PREFIX = "kk-demo:v1:";
const KEYS = {
  cart: `${PREFIX}cart`,
  wishlist: `${PREFIX}wishlist`,
  looks: `${PREFIX}looks`,
  orders: `${PREFIX}orders`,
} as const;

/** Disparado após qualquer mudança (o StoreProvider relê sacola e curtidas). */
export const STATIC_SYNC_EVENT = "kk-demo:sync";

export const isDemoStorageKey = (key: string | null) => key === null || key.startsWith(PREFIX);

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function notifySync(): void {
  try {
    window.dispatchEvent(new Event(STATIC_SYNC_EVENT));
  } catch {
    /* fora do navegador */
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* contexto inseguro */
  }
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ───────────── Sacola ───────────── */

/** Linha guardada: o preço é recalculado do catálogo a cada ação (src/static/server/actions/cart.ts). */
export type StoredCartLine = Omit<CartLine, "lineTotal">;

function toLine(v: unknown): StoredCartLine | null {
  if (!isObj(v)) return null;
  const { lineId, productId, slug, name, image, size, quantity, unitPrice } = v;
  if (!isStr(lineId, 64) || !isStr(productId, 64) || !isStr(slug, 120) || !isStr(name) || typeof image !== "string" || !isStr(size, 4)) return null;
  if (!isInt(quantity, 1, 10) || !isInt(unitPrice, 0, 10_000_000)) return null;
  return { lineId, productId, slug, name, image, size: size as StoredCartLine["size"], quantity, unitPrice };
}

export function readCartLines(): StoredCartLine[] {
  const raw = read(KEYS.cart);
  return Array.isArray(raw) ? raw.map(toLine).filter((l): l is StoredCartLine => l !== null).slice(0, 30) : [];
}

export function writeCartLines(lines: StoredCartLine[]): void {
  write(KEYS.cart, lines);
  notifySync();
}

/** Mesmas regras de src/server/pricing.ts (frete grátis acima do limite). */
export function cartViewFrom(lines: StoredCartLine[]): CartView {
  const full: CartLine[] = lines.map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity }));
  const subtotal = full.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = full.reduce((s, l) => s + l.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  return { lines: full, itemCount, subtotal, shipping, total: subtotal + shipping };
}

export function readCartView(): CartView {
  return cartViewFrom(readCartLines());
}

/* ───────────── Curtidas ───────────── */

export function readWishlist(): string[] {
  const raw = read(KEYS.wishlist);
  return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => isStr(id, 64)))].slice(0, 200) : [];
}

export function writeWishlist(ids: string[]): void {
  write(KEYS.wishlist, ids);
  notifySync();
}

/* ───────────── Looks salvos ───────────── */

function toLook(v: unknown): SavedLook | null {
  if (!isObj(v) || !isStr(v.id, 64) || typeof v.name !== "string" || !isStr(v.createdAt, 40) || !isObj(v.body) || !Array.isArray(v.items)) return null;
  const items = v.items.filter((it): it is SavedLook["items"][number] => isObj(it) && isStr(it.productId, 64) && isStr(it.size, 4));
  return { id: v.id, name: v.name.slice(0, 40) || "Meu look", body: v.body as unknown as SavedLook["body"], items, createdAt: v.createdAt };
}

/** Do mais novo para o mais antigo (como listSavedLooks no servidor). */
export function readSavedLooks(): SavedLook[] {
  const raw = read(KEYS.looks);
  const list = Array.isArray(raw) ? raw.map(toLook).filter((l): l is SavedLook => l !== null) : [];
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)).slice(0, 50);
}

export function writeSavedLooks(looks: SavedLook[]): boolean {
  const ok = write(KEYS.looks, looks);
  notifySync();
  return ok;
}

/* ───────────── Pedidos ───────────── */

function toOrder(v: unknown): OrderView | null {
  if (!isObj(v) || !isStr(v.id, 64) || !isStr(v.number, 20) || !Array.isArray(v.lines)) return null;
  return v as unknown as OrderView;
}

export function readOrders(): OrderView[] {
  const raw = read(KEYS.orders);
  return Array.isArray(raw) ? raw.map(toOrder).filter((o): o is OrderView => o !== null) : [];
}

export function readOrder(id: string): OrderView | null {
  return readOrders().find((o) => o.id === id) ?? null;
}

/** Guarda os 20 pedidos mais recentes deste navegador. */
export function saveOrder(order: OrderView): boolean {
  return write(KEYS.orders, [order, ...readOrders().filter((o) => o.id !== order.id)].slice(0, 20));
}
