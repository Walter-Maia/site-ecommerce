import "server-only";
import { all, get } from "../db/client";
import type { OrderView } from "../orders";

/** Números do painel. Quem chama DEVE ter passado por requireAdmin(). */
export interface DashboardStats {
  orders: number;
  revenue: number;
  averageTicket: number;
  byStatus: Record<OrderView["status"], number>;
  customers: number;
  newsletter: number;
  last7Days: { day: string; revenue: number; orders: number }[];
  topLiked: { id: string; name: string; slug: string; likes: number }[];
  lowStock: { productId: string; name: string; size: string; stock: number }[];
}

export function getDashboardStats(): DashboardStats {
  const totals = get<{ n: number; revenue: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status <> 'cancelado'",
  ) ?? { n: 0, revenue: 0 };

  const byStatus: DashboardStats["byStatus"] = { "aguardando-pagamento": 0, pago: 0, enviado: 0, cancelado: 0 };
  for (const r of all<{ status: OrderView["status"]; n: number }>("SELECT status, COUNT(*) AS n FROM orders GROUP BY status")) {
    byStatus[r.status] = r.n;
  }

  const since = new Date(Date.now() - 6 * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const daily = all<{ day: string; revenue: number; n: number }>(
    `SELECT substr(created_at, 1, 10) AS day, SUM(total) AS revenue, COUNT(*) AS n
       FROM orders WHERE status <> 'cancelado' AND created_at >= ?
      GROUP BY day`,
    since.toISOString(),
  );
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    const hit = daily.find((d) => d.day === day);
    return { day, revenue: hit?.revenue ?? 0, orders: hit?.n ?? 0 };
  });

  return {
    orders: totals.n,
    revenue: totals.revenue,
    averageTicket: totals.n ? Math.round(totals.revenue / totals.n) : 0,
    byStatus,
    customers: get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'cliente'")?.n ?? 0,
    newsletter: get<{ n: number }>("SELECT COUNT(*) AS n FROM newsletter")?.n ?? 0,
    last7Days,
    topLiked: all<{ id: string; name: string; slug: string; likes: number }>(
      `SELECT p.id, p.name, p.slug, COUNT(*) AS likes
         FROM wishlist w JOIN products p ON p.id = w.product_id
        GROUP BY p.id ORDER BY likes DESC, p.position ASC LIMIT 5`,
    ),
    lowStock: all<{ product_id: string; name: string; size: string; stock: number }>(
      `SELECT s.product_id, p.name, s.size, s.stock
         FROM product_sizes s JOIN products p ON p.id = s.product_id
        WHERE s.stock <= 2 ORDER BY s.stock ASC, p.position ASC LIMIT 8`,
    ).map((r) => ({ productId: r.product_id, name: r.name, size: r.size, stock: r.stock })),
  };
}
