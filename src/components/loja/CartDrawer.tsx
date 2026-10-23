"use client";

import Link from "next/link";
import { formatInstallments, formatPrice } from "@/lib/format";
import { CASHBACK_PERCENT } from "@/data/site";
import { CartLinesList, FreeShippingMeter } from "./CartLines";
import { Sheet } from "./Sheet";
import { IconClose } from "./icons";
import { useStore } from "./StoreProvider";

export function CartDrawer() {
  const { panel, closePanel, cart } = useStore();
  const empty = cart.lines.length === 0;
  return (
    <Sheet open={panel === "cart"} onClose={closePanel} side="right" labelledBy="sacola-titulo" fallbackFocus=".site-header button[aria-haspopup][aria-label^='Sacola']">
      <div className="flex h-(--header-h) shrink-0 items-center justify-between border-b border-line pl-6 pr-3.5">
        <h2 id="sacola-titulo" className="font-serif text-2xl tracking-[-0.02em]">
          Sacola <span className="tabular text-base text-mute">({cart.itemCount})</span>
        </h2>
        <button type="button" className="icon-btn" onClick={closePanel} aria-label="Fechar sacola">
          <IconClose />
        </button>
      </div>

      {empty ? (
        <div className="flex flex-1 flex-col justify-center px-6 pb-16">
          <p className="font-serif text-3xl leading-tight tracking-[-0.02em]">Sua sacola está vazia.</p>
          <p className="mt-3 max-w-xs text-sm text-mute">
            Comece pelas novidades ou monte um look inteiro no Provador 3D e leve tudo de uma vez.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/novidades" onClick={closePanel} className="btn btn-solid">
              Ver novidades
            </Link>
            <Link href="/provador" onClick={closePanel} className="btn">
              Abrir o Provador 3D
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-line px-6 py-4">
            <FreeShippingMeter subtotal={cart.subtotal} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6" data-lenis-prevent>
            <CartLinesList lines={cart.lines} onNavigate={closePanel} />
          </div>
          <div className="border-t border-line px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-mute">Subtotal</dt>
                <dd className="tabular">{formatPrice(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Frete</dt>
                <dd className="tabular">{cart.shipping === 0 ? "Grátis" : formatPrice(cart.shipping)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular">{formatPrice(cart.total)}</dd>
              </div>
            </dl>
            <p className="mt-1 text-right text-xs text-mute">
              {formatInstallments(cart.total)} · {CASHBACK_PERCENT}% de cashback
            </p>
            <div className="mt-5 grid gap-2.5">
              <Link href="/checkout" onClick={closePanel} className="btn btn-solid w-full">
                Finalizar compra
              </Link>
              <Link href="/carrinho" onClick={closePanel} className="btn w-full">
                Ver sacola completa
              </Link>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
