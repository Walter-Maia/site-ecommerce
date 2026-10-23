import Link from "next/link";
import { PageHeader, Stat, StatusBadge, Table, td, th } from "@/components/admin/ui";
import { ORDER_STATUS_LABEL, formatDateTime } from "@/components/conta/labels";
import { formatPrice } from "@/lib/format";
import { recentAudit } from "@/server/admin/audit";
import { getDashboardStats } from "@/server/admin/dashboard";
import { listOrdersForAdmin } from "@/server/admin/orders";
import { requireAdmin } from "@/server/session";

const dayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

export default async function AdminDashboard() {
  await requireAdmin();
  const stats = getDashboardStats();
  const recent = listOrdersForAdmin({ limit: 6 });
  const audit = recentAudit(8);

  return (
    <>
      <PageHeader eyebrow="Visão geral" title="Painel" />

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receita" value={formatPrice(stats.revenue)} note="Pedidos não cancelados" />
        <Stat label="Pedidos" value={stats.orders} note={`${stats.byStatus["aguardando-pagamento"]} aguardando pagamento`} />
        <Stat label="Ticket médio" value={formatPrice(stats.averageTicket)} />
        <Stat label="Clientes" value={stats.customers} note={`${stats.newsletter} na newsletter`} />
      </section>

      <div className="mt-10 grid gap-10 xl:grid-cols-2">
        <section aria-labelledby="ultimos-7">
          <h2 id="ultimos-7" className="mb-4 font-serif text-2xl">
            Últimos 7 dias
          </h2>
          <Table caption="Pedidos e receita por dia nos últimos 7 dias" wide={false}>
            <thead>
              <tr>
                <th scope="col" className={th}>Dia</th>
                <th scope="col" className={`${th} text-right`}>Pedidos</th>
                <th scope="col" className={`${th} text-right`}>Receita</th>
              </tr>
            </thead>
            <tbody>
              {stats.last7Days.map((d) => (
                <tr key={d.day}>
                  <td className={td}>{dayFmt.format(new Date(`${d.day}T12:00:00Z`))}</td>
                  <td className={`${td} tabular text-right`}>{d.orders}</td>
                  <td className={`${td} tabular text-right`}>{formatPrice(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {(Object.keys(stats.byStatus) as (keyof typeof stats.byStatus)[]).map((s) => (
              <div key={s} className="flex gap-2">
                <dt className="text-mute">{ORDER_STATUS_LABEL[s]}</dt>
                <dd className="tabular font-semibold">{stats.byStatus[s]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="curtidas">
          <h2 id="curtidas" className="mb-4 font-serif text-2xl">
            Peças mais curtidas
          </h2>
          {stats.topLiked.length === 0 ? (
            <p className="text-ink-2">Ninguém curtiu peças ainda.</p>
          ) : (
            <ol className="divide-y divide-line border-y border-line">
              {stats.topLiked.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="flex items-center gap-3">
                    <span className="tabular w-5 text-mute">{i + 1}</span>
                    <Link href={`/admin/produtos/${p.id}`} className="link-line">
                      {p.name}
                    </Link>
                  </span>
                  <span className="tabular text-sm">♥ {p.likes}</span>
                </li>
              ))}
            </ol>
          )}

          <h2 className="mb-4 mt-10 font-serif text-2xl">Estoque baixo</h2>
          {stats.lowStock.length === 0 ? (
            <p className="text-ink-2">Nenhum tamanho com 2 peças ou menos.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line text-sm">
              {stats.lowStock.map((s) => (
                <li key={`${s.productId}-${s.size}`} className="flex items-center justify-between gap-4 py-2.5">
                  <Link href={`/admin/produtos/${s.productId}`} className="link-line">
                    {s.name} · {s.size}
                  </Link>
                  <span className={s.stock === 0 ? "font-semibold text-signal" : "tabular"}>{s.stock === 0 ? "esgotado" : `${s.stock} un.`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="recentes" className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="recentes" className="font-serif text-2xl">
            Pedidos recentes
          </h2>
          <Link href="/admin/pedidos" className="t-label link-line">
            Ver todos
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-ink-2">Nenhum pedido ainda.</p>
        ) : (
          <Table caption="Pedidos recentes">
            <thead>
              <tr>
                <th scope="col" className={th}>Pedido</th>
                <th scope="col" className={th}>Cliente</th>
                <th scope="col" className={th}>Data</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td className={td}>
                    <Link href={`/admin/pedidos/${o.id}`} className="tabular font-semibold underline-offset-4 hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className={td}>{o.customerName}</td>
                  <td className={`${td} text-mute`}>{formatDateTime(o.createdAt)}</td>
                  <td className={td}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className={`${td} tabular text-right`}>{formatPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="auditoria" className="mt-12">
        <h2 id="auditoria" className="mb-4 font-serif text-2xl">
          Auditoria
        </h2>
        {audit.length === 0 ? (
          <p className="text-ink-2">Nenhuma alteração registrada.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2.5">
                <span>
                  <code className="bg-sand px-1.5 py-0.5 text-xs">{a.action}</code>{" "}
                  <span className="text-ink-2">
                    {a.entity} {a.entityId}
                  </span>
                </span>
                <span className="text-mute">
                  {a.actorEmail} · {formatDateTime(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
