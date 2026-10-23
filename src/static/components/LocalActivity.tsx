"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/format";
import { readOrders, readSavedLooks, STATIC_SYNC_EVENT } from "../client/storage";

const subscribe = (cb: () => void) => {
  window.addEventListener(STATIC_SYNC_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(STATIC_SYNC_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Snapshot estável (string) para o useSyncExternalStore; null no HTML do build. */
const snapshot = () => JSON.stringify({ orders: readOrders().slice(0, 5), looks: readSavedLooks().length });

/** /conta na demo estática: o que este navegador já guardou (pedidos simulados e looks). */
export function LocalActivity() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!raw) return null;
  const { orders, looks } = JSON.parse(raw) as { orders: ReturnType<typeof readOrders>; looks: number };

  return (
    <div className="mt-8 border border-line p-6 md:p-8">
      <h2 className="t-label text-mute">Neste navegador</h2>
      {orders.length ? (
        <ul className="mt-3 divide-y divide-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/pedido?id=${encodeURIComponent(o.id)}`} className="flex min-h-12 items-center justify-between gap-4 py-2 text-[0.95rem] hover:underline">
                <span className="tabular font-semibold">{o.number}</span>
                <span className="tabular text-ink-2">{formatPrice(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.95rem] text-ink-2">Nenhum pedido simulado ainda.</p>
      )}
      <p className="mt-4 text-sm text-ink-2">
        {looks ? `${looks} ${looks === 1 ? "look salvo" : "looks salvos"} no ` : "Monte e salve looks no "}
        <Link href="/provador" className="underline underline-offset-4">
          Provador 3D
        </Link>
        .
      </p>
    </div>
  );
}
