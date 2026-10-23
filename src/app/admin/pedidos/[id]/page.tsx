import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusForm } from "@/components/admin/OrderStatusForm";
import { PageHeader, StatusBadge, Table, td, th } from "@/components/admin/ui";
import { PAYMENT_LABEL, formatDateTime } from "@/components/conta/labels";
import { formatPrice } from "@/lib/format";
import { getOrderForAdmin } from "@/server/admin/orders";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Pedido" };

export default async function AdminPedido({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = getOrderForAdmin(id);
  if (!order) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Pedidos"
        title={order.number}
        actions={
          <Link href="/admin/pedidos" className="btn">
            Voltar
          </Link>
        }
      >
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-mute">
          <StatusBadge status={order.status} /> Criado em {formatDateTime(order.createdAt)} · atualizado em {formatDateTime(order.updatedAt)}
        </p>
      </PageHeader>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          <Table caption={`Itens do pedido ${order.number}`} wide={false}>
            <thead>
              <tr>
                <th scope="col" className={th}>Peça</th>
                <th scope="col" className={th}>Tam.</th>
                <th scope="col" className={`${th} text-right`}>Qtd.</th>
                <th scope="col" className={`${th} text-right`}>Unitário</th>
                <th scope="col" className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={`${l.slug}-${l.size}-${i}`}>
                  <td className={td}>{l.name}</td>
                  <td className={td}>{l.size}</td>
                  <td className={`${td} tabular text-right`}>{l.quantity}</td>
                  <td className={`${td} tabular text-right`}>{formatPrice(l.unitPrice)}</td>
                  <td className={`${td} tabular text-right`}>{formatPrice(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr>
                <td colSpan={4} className={`${td} text-right text-mute`}>Subtotal</td>
                <td className={`${td} tabular text-right`}>{formatPrice(order.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={4} className={`${td} text-right text-mute`}>Frete</td>
                <td className={`${td} tabular text-right`}>{order.shipping === 0 ? "Grátis" : formatPrice(order.shipping)}</td>
              </tr>
              <tr>
                <td colSpan={4} className={`${td} text-right font-semibold`}>Total</td>
                <td className={`${td} tabular text-right font-semibold`}>{formatPrice(order.total)}</td>
              </tr>
            </tfoot>
          </Table>

          <section aria-labelledby="cliente" className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 id="cliente" className="font-serif text-xl">
                Cliente
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="t-label text-mute">Nome</dt>
                  <dd>{order.customerName}</dd>
                </div>
                <div>
                  <dt className="t-label text-mute">E-mail</dt>
                  <dd className="break-all">{order.email}</dd>
                </div>
                <div>
                  <dt className="t-label text-mute">CPF</dt>
                  <dd>{order.cpfMasked ?? "Não informado"}</dd>
                </div>
                <div>
                  <dt className="t-label text-mute">Conta</dt>
                  <dd>{order.isGuest ? "Convidado (sem conta)" : "Cliente cadastrado"}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h2 className="font-serif text-xl">Entrega e pagamento</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="t-label text-mute">Endereço</dt>
                  <dd>{order.shippingAddress}</dd>
                </div>
                <div>
                  <dt className="t-label text-mute">Pagamento</dt>
                  <dd>{PAYMENT_LABEL[order.paymentMethod]} (simulado)</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="border border-line p-5">
            <OrderStatusForm id={order.id} status={order.status} />
          </div>
        </aside>
      </div>
    </>
  );
}
