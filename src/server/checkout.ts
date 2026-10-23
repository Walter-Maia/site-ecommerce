import "server-only";
import { randomInt } from "node:crypto";
import { cartRows } from "./cart";
import { get, run, transaction } from "./db/client";
import { computeTotals } from "./pricing";
import { ownerColumn, type Owner } from "./session";
import { newId, nowIso, parseJson } from "./util";
import type { CheckoutInput } from "./validation";
import type { ProductImage } from "@/lib/types";

/** Erro de negócio com mensagem segura para o cliente. */
export class CheckoutError extends Error {}

function uniqueOrderNumber(): string {
  for (let i = 0; i < 20; i++) {
    const n = `QD-${randomInt(100000, 1000000)}`;
    if (!get<{ id: string }>("SELECT id FROM orders WHERE number = ?", n)) return n;
  }
  throw new Error("sem número de pedido disponível");
}

/**
 * Cria o pedido numa transação: relê carrinho, preços e estoque do banco,
 * baixa estoque com guarda (stock >= qtd), grava pedido/itens e limpa o
 * carrinho. Nada vem do cliente além do endereço/método já validados.
 */
export function placeOrder(owner: Owner, data: CheckoutInput): { id: string; number: string } {
  return transaction(() => {
    const rows = cartRows(owner);
    if (rows.length === 0) throw new CheckoutError("Seu carrinho está vazio.");

    for (const r of rows) {
      const stock = r.stock ?? 0;
      if (stock < r.quantity) {
        throw new CheckoutError(
          stock === 0
            ? `${r.name} (tam. ${r.size}) esgotou. Remova do carrinho para continuar.`
            : `${r.name} (tam. ${r.size}): só ${stock} em estoque. Ajuste a quantidade.`,
        );
      }
    }

    const totals = computeTotals(rows.map((r) => ({ unitPrice: r.price, quantity: r.quantity })));
    const id = newId();
    const number = uniqueOrderNumber();
    const now = nowIso();
    // Pagamento SIMULADO: cartão "aprovado" na hora; Pix fica aguardando.
    const status = data.paymentMethod === "cartao" ? "pago" : "aguardando-pagamento";

    run(
      `INSERT INTO orders (id, number, user_id, visitor_id, status, payment_method, customer_name, email, cpf, cep,
         street, number_addr, complement, district, city, state, subtotal, shipping, total, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      number,
      owner.kind === "user" ? owner.id : null,
      owner.kind === "visitor" ? owner.id : null,
      status,
      data.paymentMethod,
      data.name,
      data.email,
      data.cpf ?? null,
      data.cep,
      data.street,
      data.number,
      data.complement ?? null,
      data.district,
      data.city,
      data.state,
      totals.subtotal,
      totals.shipping,
      totals.total,
      now,
      now,
    );

    for (const r of rows) {
      run(
        `INSERT INTO order_items (order_id, product_id, slug, name, image, size, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        r.product_id,
        r.slug,
        r.name,
        parseJson<ProductImage[]>(r.images, [])[0]?.src ?? "",
        r.size,
        r.quantity,
        r.price,
        r.price * r.quantity,
      );
      const dec = run(
        "UPDATE product_sizes SET stock = stock - ? WHERE product_id = ? AND size = ? AND stock >= ?",
        r.quantity,
        r.product_id,
        r.size,
        r.quantity,
      );
      if (dec.changes !== 1) throw new CheckoutError(`${r.name} (tam. ${r.size}) acabou de esgotar.`);
    }

    run(`DELETE FROM cart_items WHERE ${ownerColumn(owner)} = ?`, owner.id);
    return { id, number };
  });
}
