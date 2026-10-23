"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side: "right" | "top" | "full" | "bottom";
  /** id do título visível que nomeia o painel. */
  labelledBy: string;
  className?: string;
  panelClassName?: string;
  /** Seletor que recebe o foco ao fechar se o gatilho original sumiu do DOM. */
  fallbackFocus?: string;
  children: React.ReactNode;
}

const EXIT_MS = 420;

/**
 * Painel sobre <dialog> nativo: foco preso, Esc fecha, fundo inerte.
 * A transição de saída roda antes de dialog.close().
 */
export function Sheet({ open, onClose, side, labelledBy, className, panelClassName, fallbackFocus, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<"open" | "closed">("closed");
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      if (!dlg.open) {
        restoreFocus.current = document.activeElement as HTMLElement | null;
        dlg.showModal();
      }
      raf = requestAnimationFrame(() => requestAnimationFrame(() => setState("open")));
    } else if (dlg.open) {
      raf = requestAnimationFrame(() => setState("closed"));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      timer = setTimeout(() => {
        dlg.close();
        const back = restoreFocus.current;
        if (back && back.isConnected && back !== document.body) back.focus();
        else if (fallbackFocus) document.querySelector<HTMLElement>(fallbackFocus)?.focus();
      }, reduce ? 0 : EXIT_MS);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [open, fallbackFocus]);

  return (
    <dialog
      ref={ref}
      className={clsx("sheet", className)}
      data-side={side}
      data-state={state}
      aria-labelledby={labelledBy}
      data-lenis-prevent
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className={clsx("sheet-panel", panelClassName)}>{children}</div>
    </dialog>
  );
}
