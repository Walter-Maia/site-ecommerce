"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useStore } from "@/components/loja/StoreProvider";
import { CASHBACK_PERCENT } from "@/data/site";
import { formatPrice } from "@/lib/format";
import { readCartView, readOrder } from "../client/storage";
import type { OrderView } from "../server/orders";

/**
 * /pedido/?id=<id> na demo estática: o pedido criado pelo checkout simulado é
 * lido do localStorage deste navegador. Mesma marcação de
 * src/app/(loja)/pedido/[id]/page.tsx (versão com servidor).
 */

const STATUS: Record<OrderView["status"], string> = {
  pago: "Pagamento aprovado",
  "aguardando-pagamento": "Aguardando pagamento",
  enviado: "Enviado",
  cancelado: "Cancelado",
};

/** QR "de mentira", determinístico a partir do número do pedido (é só ilustração). */
function FakeQr({ seed }: { seed: string }) {
  const n = 21;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cells: string[] = [];
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      h = (h * 1103515245 + 12345) >>> 0;
      if ((h >>> 16) & 1) cells.push(`M${x} ${y}h1v1h-1z`);
    }
  const ring = (x: number, y: number) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`;
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="size-40 bg-white" role="img" aria-label="QR Code ilustrativo do Pix (simulado)">
      <path d={`${ring(0, 0)}${ring(n - 7, 0)}${ring(0, n - 7)}${cells.join("")}`} fill="var(--ink)" fillRule="evenodd" />
    </svg>
  );
}

export function StaticOrder() {
  const id = useSearchParams().get("id") ?? "";
  // Só renderiza no navegador (useSearchParams no export estático = renderização no cliente).
  const order = useMemo(() => (typeof window === "undefined" || !id ? null : readOrder(id)), [id]);
  const { syncCart } = useStore();
  useEffect(() => {
    syncCart(readCartView());
  }, [syncCart]);

  if (!order) {
    return (
      <main id="conteudo" className="gutter grid min-h-[60svh] content-center py-24">
        <p className="t-cond tabular text-sm font-semibold text-mute">Pedido</p>
        <h1 className="t-display mt-3 max-w-3xl text-[clamp(2.6rem,7vw,5.5rem)]">Pedido não encontrado.</h1>
        <p className="mt-5 max-w-md text-ink-2">
          Nesta demonstração estática os pedidos ficam guardados só no navegador em que foram feitos. Abra o link no mesmo navegador ou faça um
          novo pedido (o pagamento é simulado).
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/novidades" className="btn btn-solid">
            Ver novidades
          </Link>
          <Link href="/carrinho" className="btn">
            Ir para a sacola
          </Link>
        </div>
      </main>
    );
  }

  const date = new Date(order.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  const cashback = Math.round((order.subtotal * CASHBACK_PERCENT) / 100);
  const firstName = order.customerName.split(" ")[0];

  return (
    <main id="conteudo" className="gutter pb-24 pt-10">
      <p className="text-sm text-mute">
        Pedido <span className="tabular font-semibold text-ink">{order.number}</span> · {date}
      </p>
      <h1 className="t-display mt-4 max-w-4xl text-[clamp(2.6rem,7vw,5.5rem)]">Valeu, {firstName}. Pedido recebido.</h1>
      <p className="mt-5 max-w-xl text-ink-2">
        Numa loja real, a confirmação iria para <strong className="text-ink">{order.email}</strong>. Nesta demonstração estática nada é enviado:
        o pedido fica salvo só neste navegador.
      </p>

      <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <section aria-labelledby="itens-pedido" className="lg:col-span-7">
          <h2 id="itens-pedido" className="t-label border-b border-line pb-3 text-mute">
            Itens
          </h2>
          <ul className="divide-y divide-line">
            {order.lines.map((l, i) => (
              <li key={`${l.slug}-${l.size}-${i}`} className="flex gap-4 py-5">
                <div className="media relative aspect-[4/5] w-20 shrink-0">
                  {l.image ? <Image src={l.image} alt="" fill sizes="80px" className="object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/produto/${l.slug}`} className="font-serif text-[1.05rem] hover:underline">
                    {l.name}
                  </Link>
                  <p className="mt-1 text-sm text-mute">
                    Tamanho {l.size} · <span className="tabular">{l.quantity}</span> × <span className="tabular">{formatPrice(l.unitPrice)}</span>
                  </p>
                </div>
                <p className="tabular text-sm font-medium">{formatPrice(l.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t border-line pt-4 text-[0.95rem]">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="tabular">{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Frete</dt>
              <dd className="tabular">{order.shipping === 0 ? "Grátis" : formatPrice(order.shipping)}</dd>
            </div>
            <div className="flex justify-between pt-2 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="space-y-6 lg:col-span-5">
          <div className="bg-sand p-6 md:p-8">
            <h2 className="t-label text-mute">Status</h2>
            <p className="mt-2 font-serif text-2xl">{STATUS[order.status]}</p>
            {order.paymentMethod === "pix" && order.status === "aguardando-pagamento" ? (
              <div className="mt-5 flex flex-wrap items-center gap-5">
                <FakeQr seed={order.number} />
                <p className="max-w-[24ch] text-sm text-ink-2">QR Code ilustrativo. Pagamento simulado: nenhum valor é cobrado.</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-2">{order.paymentMethod === "pix" ? "Pix" : "Cartão de crédito"} · pagamento simulado, nenhum valor foi cobrado.</p>
            )}
          </div>
          <div className="border border-line p-6 md:p-8">
            <h2 className="t-label text-mute">Entrega</h2>
            <p className="mt-2 text-[0.95rem] leading-relaxed">
              {order.customerName}
              <br />
              {order.shippingAddress}
            </p>
          </div>
          <p className="text-sm text-ink-2">
            <span className="tabular font-semibold text-ink">{formatPrice(cashback)}</span> de cashback entrariam na sua conta depois da entrega.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/novidades" className="btn btn-solid">
              Continuar comprando
            </Link>
            <Link href="/ajuda#trocas" className="btn">
              Trocas e devoluções
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
