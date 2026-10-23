import clsx from "clsx";
import type { ReactNode } from "react";
import { ORDER_STATUS_LABEL } from "@/components/conta/labels";

/** Peças visuais do admin (server components). */

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: string; title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="t-label text-mute">{eyebrow}</p> : null}
        <h1 className="mt-2 font-serif text-4xl tracking-tight">{title}</h1>
        {children}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="border border-line p-5">
      <p className="t-label text-mute">{label}</p>
      <p className="tabular mt-3 font-serif text-3xl">{value}</p>
      {note ? <p className="mt-1 text-xs text-mute">{note}</p> : null}
    </div>
  );
}

// Só tokens da marca (globals.css): sem cores fora da paleta.
const STATUS_TONE = {
  "aguardando-pagamento": "border-signal text-signal bg-paper",
  pago: "border-ink bg-ink text-paper",
  enviado: "border-ink text-ink bg-paper",
  cancelado: "border-line text-mute bg-sand line-through",
} as const;

export function StatusBadge({ status }: { status: keyof typeof ORDER_STATUS_LABEL }) {
  return (
    <span className={clsx("t-label inline-block whitespace-nowrap border px-2 py-1", STATUS_TONE[status])}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function Swatch({ hex, label }: { hex: string; label: string }) {
  return <span className="inline-block size-5 border border-line align-middle" style={{ background: hex }} title={`${label} ${hex}`} aria-label={`${label} ${hex}`} role="img" />;
}

export function Table({ children, caption, wide = true }: { children: ReactNode; caption: string; wide?: boolean }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className={clsx("w-full border-collapse text-left text-sm", wide && "min-w-[640px]")}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const th = "t-label bg-sand px-4 py-3 font-semibold text-ink-2";
export const td = "border-t border-line px-4 py-3 align-middle";
