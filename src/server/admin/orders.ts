import "server-only";
import { all, get, run, transaction } from "../db/client";
import { isOrderId, toOrderView, type OrderRow, type OrderView } from "../orders";
import { nowIso } from "../util";

/** Pedidos no admin. Quem chama DEVE ter passado por requireAdmin(). */

export interface AdminOrderSummary {
  id: string;
  number: string;
  status: OrderView["status"];
  paymentMethod: OrderView["paymentMethod"];
  customerName: string;
  email: string;
  total: number;
  itemCount: number;
  createdAt: string;
  isGuest: boolean;
}

export function listOrdersForAdmin(opts: { status?: OrderView["status"]; limit?: number } = {}): AdminOrderSummary[] {
  return all<{
    id: string; number: string; status: OrderView["status"]; payment_method: OrderView["paymentMethod"];
    customer_name: string; email: string; total: number; item_count: number; created_at: string; user_id: string | null;
  }>(
    `SELECT o.id, o.number, o.status, o.payment_method, o.customer_name, o.email, o.total, o.created_at, o.user_id,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS item_count
       FROM orders o
      WHERE (? IS NULL OR o.status = ?)
      ORDER BY o.created_at DESC
      LIMIT ?`,
    opts.status ?? null,
    opts.status ?? null,
    Math.min(500, Math.max(1, opts.limit ?? 200)),
  ).map((r) => ({
    id: r.id, number: r.number, status: r.status, paymentMethod: r.payment_method, customerName: r.customer_name,
    email: r.email, total: r.total, itemCount: r.item_count, createdAt: r.created_at, isGuest: r.user_id === null,
  }));
}

export function getOrderForAdmin(id: string): (OrderView & { cpfMasked: string | null; isGuest: boolean; updatedAt: string }) | null {
  if (!isOrderId(id)) return null;
  const row = get<OrderRow & { cpf: string | null }>("SELECT * FROM orders WHERE id = ?", id);
  if (!row) return null;
  return {
    ...toOrderView(row),
    // Minimização: o admin vê só os 3 últimos dígitos do CPF.
    cpfMasked: row.cpf ? `***.***.*${row.cpf.slice(8, 9)}-${row.cpf.slice(9)}` : null,
    isGuest: row.user_id === null,
    updatedAt: row.updated_at,
  };
}

export class OrderStatusError extends Error {}

/** Muda o status. Cancelar devolve o estoque; pedido cancelado é final. */
export function updateOrderStatus(id: string, status: OrderView["status"]): { from: OrderView["status"]; to: OrderView["status"] } {
  return transaction(() => {
    const row = get<{ status: OrderView["status"] }>("SELECT status FROM orders WHERE id = ?", id);
    if (!row) throw new OrderStatusError("Pedido não encontrado.");
    if (row.status === status) return { from: row.status, to: status };
    if (row.status === "cancelado") throw new OrderStatusError("Pedido cancelado não pode mudar de status.");
    if (status === "cancelado") {
      const items = all<{ product_id: string | null; size: string; quantity: number }>(
        "SELECT product_id, size, quantity FROM order_items WHERE order_id = ?",
        id,
      );
      for (const it of items) {
        if (!it.product_id) continue;
        run("UPDATE product_sizes SET stock = stock + ? WHERE product_id = ? AND size = ?", it.quantity, it.product_id, it.size);
      }
    }
    run("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", status, nowIso(), id);
    return { from: row.status, to: status };
  });
}
