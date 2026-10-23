"use client";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { GarmentSlot } from "@/lib/types";
import { pieces, useFitting } from "../context";
import { normalizeText, SLOT_SHORT, slotLabel, UI_SLOTS } from "../slots";
import { Icon } from "../ui/icons";
import { ProductRow } from "./ProductRow";

/** PEÇAS: busca por nome + filtro por parte do corpo + "Só curtidas" (antigas abas Curtidas e Buscar). */
export function PecasPanel() {
  const f = useFitting();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<GarmentSlot | "todos">("todos");
  const [onlyLiked, setOnlyLiked] = useState(false);
  const dq = useDeferredValue(q);

  const { focusSearchSignal, consumeFocusSearch } = f;
  useEffect(() => {
    if (focusSearchSignal === 0) return;
    inputRef.current?.focus({ preventScroll: true });
    consumeFocusSearch();
  }, [focusSearchSignal, consumeFocusSearch]);

  const products = f.data.products;
  // só os filtros com peças no catálogo (o "Skate" aparece quando houver prop)
  const slots = useMemo(() => {
    const present = new Set(products.map((p) => p.garment.slot));
    return UI_SLOTS.filter((s) => present.has(s));
  }, [products]);
  const index = useMemo(
    () => products.map((p) => ({ p, text: normalizeText(`${p.name} ${p.shortName} ${p.colorName} ${slotLabel(p.garment.slot)}`) })),
    [products],
  );
  const results = useMemo(() => {
    const terms = normalizeText(dq).split(/\s+/).filter(Boolean);
    return index
      .filter(
        ({ p, text }) =>
          (slot === "todos" || p.garment.slot === slot) && (!onlyLiked || f.wishlist.has(p.id)) && terms.every((t) => text.includes(t)),
      )
      .map(({ p }) => p);
  }, [index, dq, slot, onlyLiked, f.wishlist]);

  return (
    <div className="pv-stack pv-stack--tight">
      <h3 className="sr-only">Peças</h3>
      <form role="search" className="pv-search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor={inputId} className="sr-only">
          Buscar peça pelo nome
        </label>
        <Icon name="search" size={18} className="pv-search__icon" />
        <input
          ref={inputRef}
          id={inputId}
          className="pv-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar: moletom, jeans, cetim…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <div className="pv-filters">
        <div className="pv-chips" role="group" aria-label="Filtrar por parte do corpo">
          <button type="button" className="pv-chip" aria-pressed={slot === "todos"} onClick={() => setSlot("todos")}>
            Todos
          </button>
          {slots.map((s) => (
            <button key={s} type="button" className="pv-chip" aria-pressed={slot === s} onClick={() => setSlot(s)}>
              {SLOT_SHORT[s]}
            </button>
          ))}
        </div>
        <button type="button" className="pv-chip pv-chip--like" aria-pressed={onlyLiked} onClick={() => setOnlyLiked((v) => !v)}>
          <Icon name="heart" size={15} filled={onlyLiked} />
          Só curtidas
          <span className="pv-chip__n">{f.wishlist.size}</span>
        </button>
      </div>
      <p className="pv-hint" aria-live="polite">
        {results.length === 1 ? "1 peça encontrada" : `${pieces(results.length)} encontradas`}
      </p>
      {results.length ? (
        <ul className="pv-list">
          {results.map((p) => (
            <ProductRow key={p.id} p={p} />
          ))}
        </ul>
      ) : (
        <p className="pv-muted">
          {onlyLiked && !f.wishlist.size
            ? "Nenhuma peça curtida ainda. Toque no coração de uma peça (aqui ou na loja) e ela aparece neste filtro."
            : "Nada com esse nome. Tente outra palavra ou tire o filtro."}
        </p>
      )}
    </div>
  );
}
