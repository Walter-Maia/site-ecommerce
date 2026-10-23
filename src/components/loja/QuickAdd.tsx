"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import type { ProductVariantStock, Size } from "@/lib/types";
import { IconBag, IconClose } from "./icons";
import { useStore } from "./StoreProvider";

/** Botão circular de sacola sobre a foto: escolhe o tamanho ali mesmo e adiciona. */
export function QuickAdd({ productId, productName, sizes, className }: { productId: string; productName: string; sizes: ProductVariantStock[]; className?: string }) {
  const { add } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Size | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = async (size: Size) => {
    setBusy(size);
    setError(null);
    const res = await add(productId, size);
    setBusy(null);
    if (res.ok) setOpen(false);
    else setError(res.error ?? "Não foi possível adicionar.");
  };

  const single = sizes.length === 1 ? sizes[0] : null;

  return (
    <div ref={root} className={clsx("absolute bottom-3 right-3 z-10 flex flex-col items-end", className)}>
      {open && !single ? (
        <div
          id={panelId}
          role="group"
          aria-label={`Tamanhos de ${productName}`}
          className="mb-2 w-[min(15rem,calc(100vw-3rem))] bg-paper p-3 text-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]"
        >
          <p className="t-label mb-2.5 text-mute">Escolha o tamanho</p>
          <div className="grid grid-cols-3 gap-1.5">
            {sizes.map((s) => {
              const out = s.stock <= 0;
              return (
                <button
                  key={s.size}
                  type="button"
                  disabled={out || busy !== null}
                  onClick={() => choose(s.size)}
                  aria-label={out ? `${s.size}, esgotado` : `Adicionar tamanho ${s.size}`}
                  className={clsx(
                    "tabular min-h-11 border text-sm transition-colors",
                    out ? "cursor-not-allowed border-line text-mute line-through" : "border-line hover:border-ink hover:bg-ink hover:text-paper",
                    busy === s.size && "bg-ink text-paper",
                  )}
                >
                  {busy === s.size ? "…" : s.size}
                </button>
              );
            })}
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-signal">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => (single ? choose(single.size) : setOpen((o) => !o))}
        aria-expanded={single ? undefined : open}
        aria-controls={single ? undefined : panelId}
        aria-label={`Compra rápida: ${productName}`}
        disabled={busy !== null && single !== null}
        className="grid size-12 place-items-center rounded-full bg-paper text-ink shadow-[0_6px_20px_-8px_rgb(0_0_0/0.4)] transition-transform duration-200 ease-(--ease-out) hover:scale-105 active:scale-95"
      >
        {open && !single ? <IconClose size={18} /> : <IconBag size={20} />}
      </button>
    </div>
  );
}
