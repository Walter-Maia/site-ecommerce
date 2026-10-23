"use client";

import Link from "next/link";
import { CASHBACK_PERCENT } from "@/data/site";
import { formatInstallments, formatPrice } from "@/lib/format";
import { CartLinesList, FreeShippingMeter } from "./CartLines";
import { IconReceipt, IconSwap, IconTruck } from "./icons";
import { useStore } from "./StoreProvider";

/** Página /carrinho: mesma fonte de verdade do drawer (StoreProvider). */
export function CartPageView() {
  const { cart } = useStore();

  if (cart.lines.length === 0) {
    return (
      <div className="border-t border-line py-16">
        <p className="font-serif text-3xl tracking-[-0.02em]">Sua sacola está vazia.</p>
        <p className="mt-3 max-w-md text-ink-2">Veja o que acabou de chegar ou monte um look inteiro no Provador 3D e leve tudo de uma vez.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/novidades" className="btn btn-solid">
            Ver novidades
          </Link>
          <Link href="/provador" className="btn">
            Abrir o Provador 3D
          </Link>
        </div>
      </div>
    );
  }

  const cashback = Math.round((cart.subtotal * CASHBACK_PERCENT) / 100);

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <section aria-labelledby="itens-titulo" className="lg:col-span-7">
        <h2 id="itens-titulo" className="sr-only">
          Itens
        </h2>
        <div className="border-y border-line py-4">
          <FreeShippingMeter subtotal={cart.subtotal} />
        </div>
        <CartLinesList lines={cart.lines} className="border-b border-line" />
      </section>

      <aside aria-labelledby="resumo-titulo" className="lg:col-span-5">
        <div className="bg-sand p-6 md:p-8 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <h2 id="resumo-titulo" className="font-serif text-2xl tracking-[-0.02em]">
            Resumo
          </h2>
          <dl className="mt-6 space-y-2 text-[0.95rem]">
            <div className="flex justify-between">
              <dt className="text-ink-2">
                Subtotal (<span className="tabular">{cart.itemCount}</span> {cart.itemCount === 1 ? "item" : "itens"})
              </dt>
              <dd className="tabular">{formatPrice(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Frete</dt>
              <dd className="tabular">{cart.shipping === 0 ? "Grátis" : formatPrice(cart.shipping)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-ink/15 pt-4 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatPrice(cart.total)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-right text-sm text-ink-2">{formatInstallments(cart.total)}</p>
          <p className="mt-4 bg-paper px-3 py-2 text-sm">
            Você ganha <strong className="tabular">{formatPrice(cashback)}</strong> de cashback nesta compra.
          </p>
          <Link href="/checkout" className="btn btn-solid mt-6 w-full">
            Finalizar compra
          </Link>
          <Link href="/novidades" className="link-line mx-auto mt-4 flex min-h-11 w-fit items-center text-sm">
            Continuar comprando
          </Link>
          <ul className="mt-6 space-y-2.5 border-t border-ink/15 pt-5 text-sm text-ink-2">
            <li className="flex items-center gap-3">
              <IconReceipt size={18} /> Nota fiscal em todo pedido
            </li>
            <li className="flex items-center gap-3">
              <IconTruck size={18} /> Rastreio por e-mail
            </li>
            <li className="flex items-center gap-3">
              <IconSwap size={18} /> Primeira troca grátis em 30 dias
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
