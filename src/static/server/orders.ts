/**
 * Demo estática: CONTRATO de src/server/orders.ts. Pedidos são gravados no
 * localStorage pelo checkout simulado e lidos no cliente em /pedido/?id=…
 */
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

export interface OrderSummary {
  id: string;
  number: string;
  status: OrderView["status"];
  total: number;
  itemCount: number;
  createdAt: string;
}

export const ORDER_STATUSES: OrderView["status"][] = ["aguardando-pagamento", "pago", "enviado", "cancelado"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOrderId = (id: unknown): id is string => typeof id === "string" && UUID_RE.test(id);

export async function getOrderForCurrentVisitor(id: string): Promise<OrderView | null> {
  void id;
  return null;
}

export async function listMyOrders(): Promise<OrderSummary[]> {
  return [];
}
