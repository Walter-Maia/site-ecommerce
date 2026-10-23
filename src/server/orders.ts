import "server-only";
import { all, get } from "./db/client";
import { getVisitorId } from "./auth/visitor";
import { getCurrentUser } from "./session";

export interface OrderView {
  id: string;
  number: string; // ex.: "QD-104233"
  status: "pago" | "aguardando-pagamento" | "enviado" | "cancelado";
  paymentMethod: "pix" | "cartao";
  createdAt: string;
  customerName: string;
  email: string;
  shippingAddress: string;
  lines: { name: string; slug: string; image: string; size: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  shipping: number;
  total: number;
}

export interface OrderRow {
  id: string;
  number: string;
  user_id: string | null;
  visitor_id: string | null;
  status: OrderView["status"];
  payment_method: OrderView["paymentMethod"];
  customer_name: string;
  email: string;
  cep: string;
  street: string;
  number_addr: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  subtotal: number;
  shipping: number;
  total: number;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  name: string;
  slug: string;
  image: string;
  size: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export const ORDER_STATUSES: OrderView["status"][] = ["aguardando-pagamento", "pago", "enviado", "cancelado"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOrderId = (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id);

export function formatAddress(o: Pick<OrderRow, "street" | "number_addr" | "complement" | "district" | "city" | "state" | "cep">) {
  const cep = `${o.cep.slice(0, 5)}-${o.cep.slice(5)}`;
  const comp = o.complement ? `, ${o.complement}` : "";
  return `${o.street}, ${o.number_addr}${comp} — ${o.district}, ${o.city}/${o.state} — CEP ${cep}`;
}

export function toOrderView(o: OrderRow): OrderView {
  const items = all<OrderItemRow>(
    "SELECT name, slug, image, size, quantity, unit_price, line_total FROM order_items WHERE order_id = ? ORDER BY id",
    o.id,
  );
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentMethod: o.payment_method,
    createdAt: o.created_at,
    customerName: o.customer_name,
    email: o.email,
    shippingAddress: formatAddress(o),
    lines: items.map((i) => ({
      name: i.name,
      slug: i.slug,
      image: i.image,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      lineTotal: i.line_total,
    })),
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
  };
}

/**
 * CONTRATO. Retorna o pedido apenas se pertencer ao visitante atual
 * (usuário logado ou sessão de convidado que o criou). Caso contrário, null.
 * Pedido feito logado só é visível para a conta (não para o cookie de convidado).
 */
export async function getOrderForCurrentVisitor(id: string): Promise<OrderView | null> {
  if (!isOrderId(id)) return null;
  const user = await getCurrentUser();
  const visitorId = await getVisitorId();
  if (!user && !visitorId) return null;
  const row = get<OrderRow>(
    `SELECT * FROM orders
      WHERE id = ?
        AND ((user_id IS NOT NULL AND user_id = ?)
          OR (user_id IS NULL AND visitor_id IS NOT NULL AND visitor_id = ?))`,
    id,
    user?.id ?? null,
    visitorId ?? null,
  );
  return row ? toOrderView(row) : null;
}

export interface OrderSummary {
  id: string;
  number: string;
  status: OrderView["status"];
  total: number;
  itemCount: number;
  createdAt: string;
}

/** Pedidos da conta logada (para /conta). */
export async function listMyOrders(): Promise<OrderSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return all<{ id: string; number: string; status: OrderView["status"]; total: number; item_count: number; created_at: string }>(
    `SELECT o.id, o.number, o.status, o.total, o.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS item_count
       FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50`,
    user.id,
  ).map((r) => ({ id: r.id, number: r.number, status: r.status, total: r.total, itemCount: r.item_count, createdAt: r.created_at }));
}
