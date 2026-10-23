import type { Metadata } from "next";
import clsx from "clsx";
import Link from "next/link";
import { PageHeader, StatusBadge, Table, td, th } from "@/components/admin/ui";
import { ORDER_STATUS_LABEL, PAYMENT_LABEL, formatDateTime } from "@/components/conta/labels";
import { formatPrice } from "@/lib/format";
import { listOrdersForAdmin } from "@/server/admin/orders";
import { ORDER_STATUSES } from "@/server/orders";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Pedidos" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPedidos({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === sp.status);
  const orders = listOrdersForAdmin({ status });

  const filters = [{ value: undefined, label: "Todos" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))];

  return (
    <>
      <PageHeader eyebrow="Vendas" title="Pedidos">
        <p className="mt-2 text-sm text-mute">Pagamento simulado: nenhum dado de cartão é recebido pelo servidor.</p>
      </PageHeader>

      <nav aria-label="Filtrar por status" className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {filters.map((f) => {
          const active = f.value === status;
          return (
            <Link
              key={f.label}
              href={f.value ? `/admin/pedidos?status=${f.value}` : "/admin/pedidos"}
              aria-current={active ? "page" : undefined}
              className={clsx("whitespace-nowrap border px-3 py-2 text-sm", active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <p className="text-ink-2">Nenhum pedido {status ? `com status “${ORDER_STATUS_LABEL[status]}”` : "ainda"}.</p>
      ) : (
        <Table caption="Lista de pedidos">
          <thead>
            <tr>
              <th scope="col" className={th}>Pedido</th>
              <th scope="col" className={th}>Cliente</th>
              <th scope="col" className={th}>Data</th>
              <th scope="col" className={th}>Pagamento</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={`${th} text-right`}>Peças</th>
              <th scope="col" className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className={td}>
                  <Link href={`/admin/pedidos/${o.id}`} className="tabular font-semibold underline-offset-4 hover:underline">
                    {o.number}
                  </Link>
                </td>
                <td className={td}>
                  <p>{o.customerName}</p>
                  <p className="text-xs text-mute">
                    {o.email}
                    {o.isGuest ? " · convidado" : ""}
                  </p>
                </td>
                <td className={`${td} text-mute`}>{formatDateTime(o.createdAt)}</td>
                <td className={td}>{PAYMENT_LABEL[o.paymentMethod]}</td>
                <td className={td}>
                  <StatusBadge status={o.status} />
                </td>
                <td className={`${td} tabular text-right`}>{o.itemCount}</td>
                <td className={`${td} tabular text-right`}>{formatPrice(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
