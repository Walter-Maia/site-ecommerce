import type { Metadata } from "next";
import Link from "next/link";
import { DeleteLookButton } from "@/components/conta/DeleteLookButton";
import { ORDER_STATUS_LABEL, formatDate, formatDateTime } from "@/components/conta/labels";
import { formatPrice } from "@/lib/format";
import { logoutAction } from "@/server/actions/auth";
import { listSavedLooks } from "@/server/looks";
import { listMyOrders } from "@/server/orders";
import { requireUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

export default async function ContaPage() {
  const user = await requireUser("/conta");
  const [orders, looks] = await Promise.all([listMyOrders(), listSavedLooks()]);
  const firstName = user.name.split(/\s+/)[0];

  return (
    <div className="gutter mx-auto w-full max-w-6xl py-12 sm:py-16">
      <div className="flex flex-col gap-6 border-b border-line pb-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="t-label text-mute">Minha conta</p>
          <h1 className="t-title mt-3">Olá, {firstName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user.role === "admin" ? (
            <Link href="/admin" className="btn">
              Painel admin
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className="btn">
              Sair
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-12 py-10 lg:grid-cols-[1fr_2fr]">
        <section aria-labelledby="dados">
          <h2 id="dados" className="font-serif text-2xl">
            Seus dados
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="t-label text-mute">Nome</dt>
              <dd className="mt-1 text-base">{user.name}</dd>
            </div>
            <div>
              <dt className="t-label text-mute">E-mail</dt>
              <dd className="mt-1 break-all text-base">{user.email}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="pedidos">
          <h2 id="pedidos" className="font-serif text-2xl">
            Pedidos
          </h2>
          {orders.length === 0 ? (
            <p className="mt-5 text-ink-2">
              Você ainda não fez pedidos.{" "}
              <Link href="/novidades" className="underline underline-offset-4">
                Ver novidades
              </Link>
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
                  <div>
                    <p className="font-semibold tabular">{o.number}</p>
                    <p className="text-sm text-mute">
                      {formatDateTime(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? "peça" : "peças"}
                    </p>
                  </div>
                  <div className="flex items-center gap-5">
                    <span className="t-label border border-line px-2 py-1">{ORDER_STATUS_LABEL[o.status]}</span>
                    <span className="tabular">{formatPrice(o.total)}</span>
                    <Link href={`/pedido/${o.id}`} className="t-label link-line">
                      Ver pedido
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="looks" className="border-t border-line pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="looks" className="font-serif text-2xl">
            Looks salvos
          </h2>
          <Link href="/provador" className="t-label link-line">
            Abrir o Provador 3D
          </Link>
        </div>
        {looks.length === 0 ? (
          <p className="mt-5 text-ink-2">Monte um look no Provador 3D e salve para ver aqui.</p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {looks.map((l) => (
              <li key={l.id} className="flex flex-col justify-between gap-6 border border-line p-5">
                <div>
                  <p className="font-serif text-xl">{l.name}</p>
                  <p className="mt-1 text-sm text-mute">
                    {l.items.length} {l.items.length === 1 ? "peça" : "peças"} · {l.body.heightCm} cm · {l.body.weightKg} kg ·{" "}
                    {formatDate(l.createdAt)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/provador?look=${encodeURIComponent(l.id)}`} className="btn btn-solid">
                    Abrir no provador
                  </Link>
                  <DeleteLookButton id={l.id} name={l.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
