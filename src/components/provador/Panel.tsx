"use client";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useFitting, type SheetState, type TabId } from "./context";
import { CorpoPanel } from "./panels/CorpoPanel";
import { LooksPanel } from "./panels/LooksPanel";
import { PecasPanel } from "./panels/PecasPanel";
import { VisualPanel } from "./panels/VisualPanel";

const TABS: { id: TabId; label: string }[] = [
  { id: "looks", label: "Looks" },
  { id: "pecas", label: "Peças" },
  { id: "corpo", label: "Corpo" },
  { id: "visual", label: "Visual" },
];

/** Altura visível da gaveta no celular (o resto da folha fica abaixo, deslocada por transform). */
const PEEK_PX = 76;
const SHEET_VAR: Record<SheetState, string> = { peek: `${PEEK_PX}px`, half: "50%", full: "100%" };

/** Painel lateral (desktop/tablet). No celular vira bottom sheet arrastável com as mesmas abas. */
export function Panel() {
  const f = useFitting();
  const { mobile } = f;
  const elRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{ y0: number; v0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const visiblePx = () => {
    const el = elRef.current;
    if (!el) return PEEK_PX;
    const h = el.getBoundingClientRect().height;
    const y = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
    return Math.max(PEEK_PX, h - y);
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!mobile) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, v0: visiblePx(), moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const el = elRef.current;
    if (!d || !el) return;
    const dy = d.y0 - e.clientY;
    if (Math.abs(dy) > 6) d.moved = true;
    const max = el.getBoundingClientRect().height;
    el.style.setProperty("--pv-sheet", `${Math.min(max, Math.max(PEEK_PX, d.v0 + dy))}px`);
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    const el = elRef.current;
    if (!d || !el || !d.moved) return;
    suppressClick.current = true;
    const v = d.v0 + (d.y0 - e.clientY);
    const h = el.getBoundingClientRect().height;
    const stops: [SheetState, number][] = [
      ["peek", PEEK_PX],
      ["half", h * 0.5],
      ["full", h],
    ];
    const next = stops.reduce((best, s) => (Math.abs(s[1] - v) < Math.abs(best[1] - v) ? s : best))[0];
    el.style.setProperty("--pv-sheet", SHEET_VAR[next]);
    f.setSheet(next);
  };
  const onHandleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    f.setSheet(f.sheet === "peek" ? "half" : "peek");
  };

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === f.tab);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = TABS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    f.openTab(TABS[j].id, { expand: true });
    tabRefs.current[TABS[j].id]?.focus();
  };

  return (
    <section
      ref={elRef}
      className="pv-panel"
      aria-labelledby="pv-panel-h"
      data-sheet={mobile ? f.sheet : undefined}
      data-dragging={dragging || undefined}
      style={mobile ? ({ "--pv-sheet": SHEET_VAR[f.sheet] } as CSSProperties) : undefined}
      onKeyDown={(e) => {
        if (mobile && e.key === "Escape" && f.sheet !== "peek") f.setSheet("peek");
      }}
    >
      <h2 id="pv-panel-h" className="sr-only">
        Montar o look
      </h2>
      {mobile ? (
        <button
          type="button"
          className="pv-handle"
          aria-expanded={f.sheet !== "peek"}
          aria-controls="pv-panel-body"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onHandleClick}
        >
          <span className="sr-only">{f.sheet === "peek" ? "Abrir painel" : "Recolher painel"}</span>
        </button>
      ) : null}
      <div role="tablist" aria-label="Montar o look" className="pv-tabs" onKeyDown={onTabKey}>
        {TABS.map((t) => {
          const sel = f.tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`pv-tab-${t.id}`}
              aria-selected={sel}
              aria-controls={`pv-tabpanel-${t.id}`}
              tabIndex={sel ? 0 : -1}
              className="pv-tab"
              onClick={() => f.openTab(t.id, { expand: true })}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div id="pv-panel-body" className="pv-panel__body" data-lenis-prevent>
        {TABS.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`pv-tabpanel-${t.id}`}
            aria-labelledby={`pv-tab-${t.id}`}
            hidden={f.tab !== t.id}
            className="pv-pane"
            tabIndex={0}
          >
            {f.tab === t.id ? <PanelBody id={t.id} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelBody({ id }: { id: TabId }) {
  switch (id) {
    case "looks":
      return <LooksPanel />;
    case "pecas":
      return <PecasPanel />;
    case "corpo":
      return <CorpoPanel />;
    case "visual":
      return <VisualPanel />;
  }
}
