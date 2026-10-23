"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { formatPrice } from "@/lib/format";
import { FIT_LABEL_UI } from "@/lib/provador/outfit";
import type { GarmentSlot } from "@/lib/types";
import { pieces, useFitting, type WornView } from "./context";
import { outerWithoutBase, slotLabel } from "./slots";
import { FitBadge, fitTone } from "./ui/FitBadge";
import { Icon } from "./ui/icons";
import { ProductThumb } from "./ui/ProductThumb";

type Pop =
  | { kind: "item"; slot: GarmentSlot }
  | { kind: "save" }
  | { kind: "msg"; tone: "ok" | "error"; msg: string; link?: "cart" | "looks" }
  | null;

/**
 * Resumo fixo no rodapé do painel: peças vestidas (toque para ajustar tamanho ou remover),
 * total, caimento do look, Salvar e Comprar look. Os detalhes abrem num balão acima do resumo.
 */
export function LookSummary() {
  const f = useFitting();
  const { worn } = f;
  const [pop, setPop] = useState<Pop>(null);
  const [buying, startBuy] = useTransition();
  const sectionRef = useRef<HTMLElement>(null);
  const pieceRefs = useRef<Partial<Record<GarmentSlot, HTMLButtonElement | null>>>({});
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const total = worn.reduce((s, w) => s + w.product.price, 0);
  const compare = worn.reduce((s, w) => s + Math.max(w.product.price, w.product.compareAtPrice ?? 0), 0);
  const fitting = worn.filter((w) => w.fits);
  const openItem = pop?.kind === "item" ? worn.find((w) => w.slot === pop.slot) : undefined;

  // Mensagens somem sozinhas (já foram anunciadas pelo role=status).
  useEffect(() => {
    if (pop?.kind !== "msg" || pop.tone === "error") return;
    const t = window.setTimeout(() => setPop((p) => (p?.kind === "msg" ? null : p)), 8000);
    return () => window.clearTimeout(t);
  }, [pop]);

  const close = (focus?: HTMLElement | null) => {
    setPop(null);
    focus?.focus();
  };

  const buy = () =>
    startBuy(async () => {
      setPop(null);
      const res = await f.buyLook();
      setPop(
        res.ok
          ? { kind: "msg", tone: "ok", msg: `Look na sacola: ${res.data.itemCount} ${res.data.itemCount === 1 ? "item" : "itens"} · ${formatPrice(res.data.total)}.`, link: "cart" }
          : { kind: "msg", tone: "error", msg: res.error },
      );
    });

  return (
    <section
      ref={sectionRef}
      className="pv-summary"
      aria-labelledby="pv-sum-h"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && pop) {
          e.stopPropagation();
          const back = pop.kind === "item" ? pieceRefs.current[pop.slot] : pop.kind === "save" ? saveBtnRef.current : null;
          close(back);
        }
      }}
    >
      {openItem ? (
        <ItemDetail
          w={openItem}
          onClose={() => close(pieceRefs.current[openItem.slot])}
          onRemoved={() => close(sectionRef.current)}
        />
      ) : pop?.kind === "save" ? (
        <SaveForm onDone={(msg) => setPop(msg)} onClose={() => close(saveBtnRef.current)} />
      ) : pop?.kind === "msg" ? (
        <div className="pv-pop pv-pop--msg" data-tone={pop.tone} role={pop.tone === "error" ? "alert" : "status"}>
          <p>
            {pop.msg}{" "}
            {pop.link === "cart" ? <Link href="/carrinho">Ver sacola</Link> : null}
            {pop.link === "looks" ? (
              <button type="button" className="pv-link" onClick={() => f.openTab("looks", { expand: true })}>
                Ver em Meus looks
              </button>
            ) : null}
          </p>
          <button type="button" className="pv-iconbtn pv-iconbtn--plain" aria-label="Fechar aviso" onClick={() => close(sectionRef.current)}>
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}

      <h2 id="pv-sum-h" className="sr-only">
        Resumo do look
      </h2>
      <div className="pv-sum__head">
        <p className="pv-sum__label">
          Seu look <span>· {pieces(worn.length)}</span>
        </p>
        {worn.length ? (
          <button
            type="button"
            className="pv-link"
            onClick={() => {
              setPop(null);
              f.dispatch({ type: "clear" });
              f.announce("Look limpo.");
            }}
          >
            Limpar
          </button>
        ) : null}
        <p className="pv-sum__fit" aria-live="polite" aria-atomic="true">
          Caimento <b>{fitting.length ? `${f.lookFit}%` : "—"}</b>
        </p>
      </div>

      {worn.length ? (
        <ul className="pv-sum__items" aria-label="Peças vestidas">
          {worn.map((w) => {
            const open = openItem?.slot === w.slot;
            return (
              <li key={w.slot}>
                <button
                  ref={(el) => {
                    pieceRefs.current[w.slot] = el;
                  }}
                  type="button"
                  className="pv-piece"
                  aria-expanded={open}
                  aria-controls={open ? "pv-detail" : undefined}
                  onClick={() => setPop(open ? null : { kind: "item", slot: w.slot })}
                >
                  <ProductThumb p={w.product} sizes="48px" className="pv-piece__img" />
                  <span className="pv-piece__size">{w.size}</span>
                  {w.fits ? <span className="pv-piece__dot" data-tone={fitTone(w.fit)} aria-hidden="true" /> : null}
                  <span className="sr-only">
                    {" "}
                    · {w.product.name}
                    {w.fits ? `, caimento ${FIT_LABEL_UI[w.fit.label].text.toLowerCase()}` : ""}. Ajustar ou remover
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pv-sum__empty">
          Nenhuma peça vestida.{" "}
          <button type="button" className="pv-link" onClick={() => f.openTab("looks", { expand: true })}>
            Escolha um look
          </button>{" "}
          ou{" "}
          <button type="button" className="pv-link" onClick={() => f.openTab("pecas", { expand: true, focusSearch: true })}>
            busque peças
          </button>
          .
        </p>
      )}
      {outerWithoutBase(f.state.outfit) ? <p className="pv-sum__tip">A sobreposição está sem nada por baixo: vista uma parte de cima.</p> : null}

      <div className="pv-sum__foot">
        <p className="pv-sum__total">
          <span className="pv-sum__totallabel">Total</span>
          {compare > total ? (
            <s>
              <span className="sr-only">de </span>
              {formatPrice(compare)}
            </s>
          ) : null}
          <strong>
            {compare > total ? <span className="sr-only">por </span> : null}
            {formatPrice(total)}
          </strong>
        </p>
        <div className="pv-sum__actions">
          <button
            ref={saveBtnRef}
            type="button"
            className="pv-btn"
            aria-expanded={pop?.kind === "save"}
            aria-controls={pop?.kind === "save" ? "pv-save" : undefined}
            disabled={!worn.length}
            onClick={() => setPop(pop?.kind === "save" ? null : { kind: "save" })}
          >
            <Icon name="bookmark" size={16} />
            Salvar
          </button>
          <button type="button" className="pv-btn pv-btn--solid" disabled={!worn.length || buying} onClick={buy}>
            {buying ? "Adicionando…" : "Comprar look"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ItemDetail({ w, onClose, onRemoved }: { w: WornView; onClose: () => void; onRemoved: () => void }) {
  const f = useFitting();
  const p = w.product;
  return (
    <div id="pv-detail" className="pv-pop" role="group" aria-label={`Ajustar ${p.name}`}>
      <div className="pv-detail__top">
        <ProductThumb p={p} sizes="56px" className="pv-thumb pv-thumb--lg" />
        <div className="pv-detail__info">
          <span className="pv-label">{slotLabel(w.slot)}</span>
          <Link href={`/produto/${p.slug}`} className="pv-detail__name">
            {p.name}
          </Link>
          <span className="pv-price">{formatPrice(p.price)}</span>
        </div>
        <button type="button" className="pv-iconbtn pv-iconbtn--plain" aria-label="Fechar detalhes" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>

      {p.sizes.length > 1 ? (
        <fieldset className="pv-fieldset">
          <legend className="pv-label">
            Tamanho{w.fits ? <> · recomendado {w.recommended}</> : null}
          </legend>
          <div className="pv-chips pv-chips--wrap">
            {p.sizes.map((s) => (
              <label key={s.size} className="pv-chip pv-chip--size" title={s.stock > 0 ? `${s.stock} em estoque` : "Esgotado"}>
                <input
                  type="radio"
                  name={`pv-size-${w.slot}`}
                  value={s.size}
                  checked={w.size === s.size}
                  disabled={s.stock <= 0}
                  onChange={() => f.dispatch({ type: "size", slot: w.slot, size: s.size })}
                />
                {s.size}
                {w.fits && s.size === w.recommended ? (
                  <span className="pv-rec">
                    <span aria-hidden="true">REC</span>
                    <span className="sr-only"> (recomendado)</span>
                  </span>
                ) : null}
                {s.stock <= 0 ? <span className="sr-only"> (esgotado)</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {w.fits ? (
        <div className="pv-detail__fit" aria-live="polite">
          <FitBadge fit={w.fit} />
          {w.fit.notes.length ? (
            <ul className="pv-notes">
              {w.fit.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="pv-hint">Vai na mão do manequim: não tem tabela de caimento.</p>
      )}

      <button
        type="button"
        className="pv-link pv-link--danger"
        onClick={() => {
          f.removeSlot(w.slot);
          onRemoved();
        }}
      >
        Remover do look
      </button>
    </div>
  );
}

function SaveForm({ onDone, onClose }: { onDone: (p: Pop) => void; onClose: () => void }) {
  const f = useFitting();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const fallback = `Meu look ${String(f.looks.filter((l) => l.kind === "saved").length + 1).padStart(2, "0")}`;

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <form
      id="pv-save"
      className="pv-pop"
      aria-label="Salvar look"
      onSubmit={(e) => {
        e.preventDefault();
        startSave(async () => {
          setError(null);
          const res = await f.saveCurrentLook(name || fallback);
          if (res.ok) onDone({ kind: "msg", tone: "ok", msg: `“${res.data.name}” salvo.`, link: "looks" });
          else setError(res.error);
        });
      }}
    >
      <div className="pv-detail__top">
        <label htmlFor={id} className="pv-label">
          Nome do look
        </label>
        <button type="button" className="pv-iconbtn pv-iconbtn--plain" aria-label="Fechar" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="pv-saveform">
        <input
          ref={inputRef}
          id={id}
          className="pv-input"
          type="text"
          maxLength={40}
          autoComplete="off"
          placeholder={fallback}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button type="submit" className="pv-btn pv-btn--solid" disabled={saving}>
          {saving ? "Salvando…" : "Salvar look"}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="pv-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
