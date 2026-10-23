import "server-only";
import type { CartLine, CartView, ProductImage, Size } from "@/lib/types";
import { all } from "./db/client";
import { computeTotals } from "./pricing";
import { getOwner, ownerColumn, type Owner } from "./session";
import { parseJson } from "./util";

export interface CartRow {
  line_id: string;
  product_id: string;
  size: Size;
  quantity: number;
  slug: string;
  name: string;
  images: string;
  price: number;
  stock: number | null;
}

/** Linhas do carrinho com preço/estoque ATUAIS do banco. `ownerColumn` vem de lista fechada. */
export function cartRows(owner: Owner): CartRow[] {
  return all<CartRow>(
    `SELECT c.id AS line_id, c.product_id, c.size, c.quantity, p.slug, p.name, p.images, p.price, ps.stock
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       LEFT JOIN product_sizes ps ON ps.product_id = c.product_id AND ps.size = c.size
      WHERE c.${ownerColumn(owner)} = ?
      ORDER BY c.created_at ASC, c.id ASC`,
    owner.id,
  );
}

export function buildCartView(rows: CartRow[]): CartView {
  const lines: CartLine[] = rows.map((r) => ({
    lineId: r.line_id,
    productId: r.product_id,
    slug: r.slug,
    name: r.name,
    image: parseJson<ProductImage[]>(r.images, [])[0]?.src ?? "",
    size: r.size,
    quantity: r.quantity,
    unitPrice: r.price,
    lineTotal: r.price * r.quantity,
  }));
  const t = computeTotals(lines);
  return { lines, itemCount: t.itemCount, subtotal: t.subtotal, shipping: t.shipping, total: t.total };
}

export function cartViewFor(owner: Owner | null): CartView {
  return owner ? buildCartView(cartRows(owner)) : buildCartView([]);
}

/** CONTRATO. Carrinho do visitante (convidado via cookie ou usuário logado). */
export async function getCart(): Promise<CartView> {
  return cartViewFor(await getOwner());
}
