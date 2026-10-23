"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { FREE_SHIPPING_THRESHOLD } from "@/data/site";
import { formatPrice } from "@/lib/format";
import type { CartLine } from "@/lib/types";
import { IconMinus, IconPlus } from "./icons";
import { useStore } from "./StoreProvider";

/** Barra fina de progresso até o frete grátis. */
export function FreeShippingMeter({ subtotal }: { subtotal: number }) {
  const missing = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const pct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  return (
    <div>
      <p className="text-sm" aria-live="polite">
        {missing > 0 ? (
          <>
            Faltam <strong className="font-semibold tabular">{formatPrice(missing)}</strong> para o frete grátis.
          </>
        ) : (
          <>Seu frete é grátis.</>
        )}
      </p>
      <div className="mt-2.5 h-[3px] w-full bg-line" aria-hidden="true">
        <div
          className="h-full origin-left bg-ink transition-transform duration-700 ease-(--ease-out)"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
}

/** Miniatura com fallback: a foto pode ainda não existir em /public. */
function Thumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="media aspect-[4/5] w-20 shrink-0 sm:w-24">
      {!broken && <Image src={src} alt={alt} fill sizes="96px" className="object-cover" onError={() => setBroken(true)} />}
    </div>
  );
}

export function CartLineItem({ line, onNavigate }: { line: CartLine; onNavigate?: () => void }) {
  const { setQuantity, remove } = useStore();
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/produto/${line.slug}`} onClick={onNavigate} tabIndex={-1} aria-hidden="true">
        <Thumb src={line.image} alt="" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/produto/${line.slug}`} onClick={onNavigate} className="font-serif text-[1.02rem] leading-snug hover:underline">
            {line.name}
          </Link>
          <p className="tabular shrink-0 text-sm font-medium">{formatPrice(line.lineTotal)}</p>
        </div>
        <p className="mt-1 text-sm text-mute">
          Tamanho {line.size}
          {line.quantity > 1 && <span className="tabular"> · {formatPrice(line.unitPrice)} cada</span>}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center border border-line" role="group" aria-label={`Quantidade de ${line.name}`}>
            <button
              type="button"
              className="icon-btn disabled:opacity-30"
              onClick={() => setQuantity(line.lineId, line.quantity - 1)}
              disabled={line.quantity <= 1}
              aria-label="Diminuir quantidade"
            >
              <IconMinus size={16} />
            </button>
            <output className="tabular w-7 text-center text-sm" aria-live="polite">
              {line.quantity}
            </output>
            <button
              type="button"
              className="icon-btn disabled:opacity-30"
              onClick={() => setQuantity(line.lineId, line.quantity + 1)}
              disabled={line.quantity >= 10}
              aria-label="Aumentar quantidade"
            >
              <IconPlus size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => remove(line.lineId)}
            className="link-line inline-flex min-h-11 items-center text-sm text-mute hover:text-ink"
          >
            Remover<span className="sr-only"> {line.name}</span>
          </button>
        </div>
      </div>
    </li>
  );
}

export function CartLinesList({ lines, onNavigate, className }: { lines: CartLine[]; onNavigate?: () => void; className?: string }) {
  return (
    <ul className={clsx("divide-y divide-line", className)}>
      {lines.map((l) => (
        <CartLineItem key={l.lineId} line={l} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}
