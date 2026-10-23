"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { CASHBACK_PERCENT } from "@/data/site";
import { discountPercent, formatInstallments, formatPrice } from "@/lib/format";
import type { Product, Size } from "@/lib/types";
import { IconCube, IconReceipt, IconRuler, IconSwap, IconTruck, Stars } from "../icons";
import { DiscountBadge } from "../Price";
import { useStore } from "../StoreProvider";
import { WishlistButton } from "../WishlistButton";
import { SizeChartSheet } from "./SizeChart";

type BuyProduct = Pick<Product, "id" | "slug" | "name" | "price" | "compareAtPrice" | "colorName" | "colorHex" | "sizes" | "sizeChart" | "rating" | "reviewCount" | "collection">;

export function BuyBox({ product: p, collectionHref }: { product: BuyProduct; collectionHref?: string }) {
  const { add } = useStore();
  const sizesId = useId();
  const [size, setSize] = useState<Size | null>(() => (p.sizes.length === 1 && p.sizes[0].stock > 0 ? p.sizes[0].size : null));
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");
  const [error, setError] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const addBtn = useRef<HTMLButtonElement>(null);
  const sizesRef = useRef<HTMLFieldSetElement>(null);

  const off = discountPercent(p.price, p.compareAtPrice);
  const cashback = Math.round((p.price * CASHBACK_PERCENT) / 100);
  const soldOut = p.sizes.every((s) => s.stock <= 0);
  const chosen = p.sizes.find((s) => s.size === size);
  const showSizes = !(p.sizes.length === 1 && p.sizes[0].size === "U");

  // Barra fixa no celular quando o botão principal sai da tela.
  useEffect(() => {
    const el = addBtn.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBarVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const submit = async () => {
    if (!size) {
      setError("Escolha um tamanho para continuar.");
      sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      sizesRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
      return;
    }
    setError(null);
    setStatus("adding");
    const res = await add(p.id, size);
    if (res.ok) {
      setStatus("added");
      setTimeout(() => setStatus("idle"), 2200);
    } else {
      setStatus("idle");
      setError(res.error ?? "Não foi possível adicionar agora.");
    }
  };

  const label = soldOut ? "Esgotado" : status === "adding" ? "Adicionando…" : status === "added" ? "Adicionado à sacola" : "Adicionar ao carrinho";

  return (
    <div>
      {collectionHref ? (
        <Link href={collectionHref} className="link-line relative text-sm text-mute after:absolute after:inset-x-0 after:-inset-y-[15px] after:content-[''] hover:text-ink">
          Coleção {p.collection}
        </Link>
      ) : null}
      <h1 className="mt-3 font-serif text-[clamp(2rem,3.2vw,2.75rem)] leading-[1.04] tracking-[-0.025em] text-balance">{p.name}</h1>

      {p.reviewCount > 0 ? (
        <a href="#avaliacoes" className="mt-3 inline-flex min-h-8 items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <Stars value={p.rating} size={12} />
          <span className="tabular">
            {p.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} ({p.reviewCount} avaliações)
          </span>
        </a>
      ) : null}

      <div className="mt-6">
        <p className="tabular flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[1.75rem] font-medium tracking-[-0.01em]">
            <span className="sr-only">Preço: </span>
            {formatPrice(p.price)}
          </span>
          {off && p.compareAtPrice ? (
            <>
              <s className="text-mute">
                <span className="sr-only">Preço anterior: </span>
                {formatPrice(p.compareAtPrice)}
              </s>
              <DiscountBadge off={off} />
            </>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-ink-2">{formatInstallments(p.price)} ou à vista no Pix</p>
        <p className="mt-2 inline-flex items-center gap-2 bg-sand px-2.5 py-1.5 text-sm">
          Ganhe <strong className="tabular font-semibold">{formatPrice(cashback)}</strong> em cashback
        </p>
      </div>

      <p className="mt-7 flex items-center gap-2.5 text-sm">
        <span aria-hidden="true" className="size-4 rounded-full ring-1 ring-ink/25" style={{ background: p.colorHex }} />
        <span className="text-mute">Cor:</span> {p.colorName}
      </p>

      {showSizes ? (
        <fieldset ref={sizesRef} className="mt-6" aria-describedby={error ? `${sizesId}-erro` : undefined}>
          <legend className="sr-only">Tamanho</legend>
          <div className="mb-3 flex items-center justify-between">
            <span className="t-label" aria-hidden="true">
              Tamanho{size ? `: ${size}` : ""}
            </span>
            <button type="button" onClick={() => setChartOpen(true)} className="link-line inline-flex min-h-11 items-center gap-1.5 text-sm" aria-haspopup="dialog">
              <IconRuler size={18} /> Tabela de medidas
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
            {p.sizes.map((s) => {
              const out = s.stock <= 0;
              const id = `${sizesId}-${s.size}`;
              return (
                <div key={s.size}>
                  <input
                    type="radio"
                    name="tamanho"
                    id={id}
                    value={s.size}
                    disabled={out}
                    checked={size === s.size}
                    onChange={() => {
                      setSize(s.size);
                      setError(null);
                    }}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={id}
                    className={clsx(
                      "tabular grid min-h-12 place-items-center border text-sm transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                      out
                        ? "cursor-not-allowed border-line bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),var(--line)_50%,transparent_calc(50%+0.5px))] text-mute line-through"
                        : "cursor-pointer border-line hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper",
                    )}
                  >
                    {s.size}
                    {out ? <span className="sr-only"> (esgotado)</span> : null}
                  </label>
                </div>
              );
            })}
          </div>
          {chosen && chosen.stock > 0 && chosen.stock <= 3 ? (
            <p className="mt-3 text-sm text-signal">Últimas {chosen.stock} unidades no {chosen.size}.</p>
          ) : null}
        </fieldset>
      ) : (
        <p className="mt-6 text-sm text-ink-2">Tamanho único, com ajuste.</p>
      )}

      <p id={`${sizesId}-erro`} role="alert" className="mt-3 min-h-5 text-sm text-signal">
        {error}
      </p>

      <div className="mt-2 grid gap-2.5">
        <button ref={addBtn} type="button" onClick={submit} disabled={soldOut || status === "adding"} className="btn btn-solid w-full" aria-live="polite">
          {label}
        </button>
        <div className="flex gap-2.5">
          <Link href={`/provador?add=${encodeURIComponent(p.slug)}`} className="btn flex-1 px-4">
            <IconCube size={18} /> Provar no Provador 3D
          </Link>
          <WishlistButton productId={p.id} productName={p.name} variant="boxed" />
        </div>
      </div>

      <ul className="mt-7 space-y-3 border-t border-line pt-6 text-sm text-ink-2">
        <li className="flex items-center gap-3">
          <IconReceipt size={20} /> Produto original com Nota Fiscal
        </li>
        <li className="flex items-center gap-3">
          <IconTruck size={20} /> Frete grátis acima de R$ 299
        </li>
        <li className="flex items-center gap-3">
          <IconSwap size={20} /> Primeira troca grátis em até 30 dias
        </li>
      </ul>

      <SizeChartSheet open={chartOpen} onClose={() => setChartOpen(false)} rows={p.sizeChart} productName={p.name} slug={p.slug} selected={size} />

      {/* Barra fixa de compra (celular). Sem backdrop-blur: com 95% de opacidade o desfoque mal aparece e,
          fixo sobre a página, obrigava a GPU a refazer o blur a cada quadro de rolagem. */}
      <div
        className={clsx(
          "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-500 ease-(--ease-out) md:hidden",
          barVisible ? "translate-y-0" : "translate-y-full",
        )}
        aria-hidden={!barVisible}
        inert={!barVisible}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-[0.98rem]">{p.name}</p>
            <p className="tabular text-sm">
              {formatPrice(p.price)}
              {size ? <span className="text-mute"> · {size}</span> : null}
            </p>
          </div>
          <button type="button" onClick={submit} disabled={soldOut || status === "adding"} className="btn btn-solid shrink-0 px-5">
            {soldOut ? "Esgotado" : status === "added" ? "Adicionado" : size ? "Adicionar" : "Escolher tamanho"}
          </button>
        </div>
      </div>
    </div>
  );
}
