"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { IconArrow, IconArrowLeft } from "./icons";

interface CarouselProps {
  label: string;
  children: React.ReactNode;
  /** Quantos itens cabem por tela em cada faixa (fração = espiada do próximo). */
  cols?: { base: number; md: number; lg: number };
  gap?: string;
  className?: string;
  tone?: "light" | "dark";
}

/**
 * Carrossel nativo (scroll-snap): arrasta no toque, rola no trackpad, setas no desktop
 * e barra fina de progresso. Sem sequestro de scroll.
 */
export function Carousel({ label, children, cols = { base: 1.55, md: 2.6, lg: 4.25 }, gap = "clamp(10px, 1.4vw, 20px)", className, tone = "light" }: CarouselProps) {
  const track = useRef<HTMLUListElement>(null);
  const [state, setState] = useState({ progress: 0, ratio: 1, start: true, end: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setState({
      progress: max > 0 ? el.scrollLeft / max : 0,
      ratio: el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
      start: el.scrollLeft <= 4,
      end: el.scrollLeft >= max - 4,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };

  const items = Children.toArray(children);
  const dark = tone === "dark";
  const scrollable = state.ratio < 0.999;

  return (
    <div className={clsx("relative", className)}>
      <ul
        ref={track}
        aria-label={label}
        className="rail"
        style={
          {
            columnGap: gap,
            "--g": gap,
            "--c": cols.base,
            "--c-md": cols.md,
            "--c-lg": cols.lg,
          } as React.CSSProperties
        }
      >
        {items.map((child, i) => (
          <li key={i} className="rail-item min-w-0">
            {child}
          </li>
        ))}
      </ul>
      <div className="gutter mt-6 flex items-center gap-6">
        <div className={clsx("relative h-px flex-1", dark ? "bg-white/25" : "bg-line")} aria-hidden="true">
          <div
            className={clsx("absolute left-0 top-[-1px] h-[3px] transition-[width] duration-300", dark ? "bg-white" : "bg-ink")}
            style={{
              width: `${state.ratio * 100}%`,
              transform: `translateX(${(state.progress * (1 - state.ratio) * 100) / Math.max(state.ratio, 0.0001)}%)`,
            }}
          />
        </div>
        {scrollable ? (
          <div className="hidden gap-1 md:flex">
            <button
              type="button"
              className={clsx("icon-btn border transition-colors disabled:opacity-30", dark ? "border-white/40 hover:border-white" : "border-line hover:border-ink")}
              onClick={() => page(-1)}
              disabled={state.start}
              aria-label={`Voltar em ${label}`}
            >
              <IconArrowLeft size={18} />
            </button>
            <button
              type="button"
              className={clsx("icon-btn border transition-colors disabled:opacity-30", dark ? "border-white/40 hover:border-white" : "border-line hover:border-ink")}
              onClick={() => page(1)}
              disabled={state.end}
              aria-label={`Avançar em ${label}`}
            >
              <IconArrow size={18} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
