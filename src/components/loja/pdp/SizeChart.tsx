"use client";

import Link from "next/link";
import type { Size, SizeChartRow } from "@/lib/types";
import { Sheet } from "../Sheet";
import { IconClose, IconCube } from "../icons";

type Field = Exclude<keyof SizeChartRow, "size">;

const FIELDS: { key: Field; label: string; how: string }[] = [
  { key: "chestCm", label: "Tórax", how: "Peça estendida: meça de axila a axila e multiplique por dois." },
  { key: "waistCm", label: "Cintura", how: "Meça o cós de ponta a ponta, sem esticar, e multiplique por dois." },
  { key: "hipCm", label: "Quadril", how: "Na parte mais larga, de lado a lado, multiplicado por dois." },
  { key: "lengthCm", label: "Comprimento", how: "Do ponto mais alto do ombro (ou do cós) até a barra." },
  { key: "sleeveCm", label: "Manga", how: "Da costura do ombro até o fim da manga." },
  { key: "inseamCm", label: "Entrepernas", how: "Do gancho até a barra, pela costura interna." },
  { key: "footCm", label: "Pé", how: "Fique em pé sobre uma folha, marque o calcanhar e o dedo mais longo e meça a distância." },
  { key: "headCm", label: "Cabeça", how: "Passe a fita na altura da testa, um dedo acima das orelhas." },
];

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Desenho técnico simples: camiseta (tops) ou calça (partes de baixo). */
function Diagram({ kind }: { kind: "top" | "bottom" }) {
  const line = { stroke: "currentColor", strokeWidth: 1.2, fill: "none" } as const;
  const measure = { stroke: "var(--signal)", strokeWidth: 1.4, markerEnd: "url(#seta)", markerStart: "url(#seta)" } as const;
  return (
    <svg viewBox="0 0 220 180" className="h-auto w-full max-w-[240px] text-ink" aria-hidden="true">
      <defs>
        <marker id="seta" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0L6 3L0 6z" fill="var(--signal)" />
        </marker>
      </defs>
      {kind === "top" ? (
        <>
          <path d="M80 20 Q110 34 140 20 L190 40 L178 78 L160 72 L160 165 L60 165 L60 72 L42 78 L30 40 Z" {...line} />
          <line x1="64" y1="82" x2="156" y2="82" {...measure} />
          <line x1="110" y1="28" x2="110" y2="160" {...measure} />
          <line x1="146" y1="24" x2="184" y2="42" {...measure} />
          <text x="66" y="77" fontSize="10" fill="currentColor">A</text>
          <text x="114" y="130" fontSize="10" fill="currentColor">B</text>
          <text x="170" y="28" fontSize="10" fill="currentColor">C</text>
        </>
      ) : (
        <>
          <path d="M60 15 L160 15 L172 170 L122 170 L110 70 L98 170 L48 170 Z" {...line} />
          <line x1="62" y1="24" x2="158" y2="24" {...measure} />
          <line x1="180" y1="15" x2="180" y2="170" {...measure} />
          <line x1="104" y1="76" x2="96" y2="165" {...measure} />
          <text x="104" y="40" fontSize="10" fill="currentColor">A</text>
          <text x="186" y="96" fontSize="10" fill="currentColor">B</text>
          <text x="84" y="128" fontSize="10" fill="currentColor">C</text>
        </>
      )}
    </svg>
  );
}

export function SizeChartSheet({
  open,
  onClose,
  rows,
  productName,
  slug,
  selected,
}: {
  open: boolean;
  onClose: () => void;
  rows: SizeChartRow[];
  productName: string;
  slug: string;
  selected: Size | null;
}) {
  const cols = FIELDS.filter((f) => rows.some((r) => typeof r[f.key] === "number"));
  const isTop = cols.some((c) => c.key === "chestCm");
  const isBottom = !isTop && cols.some((c) => c.key === "waistCm");
  const legend = isTop ? ["A: tórax", "B: comprimento", "C: manga"] : ["A: cintura", "B: comprimento", "C: entrepernas"];

  return (
    <Sheet open={open} onClose={onClose} side="bottom" labelledBy="medidas-titulo">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line py-4 pl-6 pr-3.5">
        <div>
          <h2 id="medidas-titulo" className="font-serif text-2xl tracking-[-0.02em]">
            Tabela de medidas
          </h2>
          <p className="mt-1 text-sm text-mute">{productName} · medidas da peça, em cm</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar tabela de medidas">
          <IconClose />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-8 pt-5" data-lenis-prevent>
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="tabular w-full min-w-[320px] border-collapse text-sm">
            <caption className="sr-only">Medidas de {productName} por tamanho, em centímetros</caption>
            <thead>
              <tr className="border-b border-ink text-left">
                <th scope="col" className="py-2.5 pr-3 font-semibold">
                  Tamanho
                </th>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className="px-3 py-2.5 text-right font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.size} className={selected === r.size ? "bg-sand" : "border-b border-line"}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                    {r.size}
                    {selected === r.size ? <span className="sr-only"> (selecionado)</span> : null}
                  </th>
                  {cols.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-right">
                      {typeof r[c.key] === "number" ? fmt(r[c.key] as number) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section aria-labelledby="como-medir" className="mt-8">
          <h3 id="como-medir" className="t-label">
            Como medir
          </h3>
          <div className="mt-4 grid gap-6 sm:grid-cols-[200px_1fr] sm:items-start">
            {isTop || isBottom ? (
              <figure>
                <Diagram kind={isTop ? "top" : "bottom"} />
                <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                  {legend.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </figcaption>
              </figure>
            ) : null}
            <dl className="space-y-3 text-sm">
              {cols.map((c) => (
                <div key={c.key}>
                  <dt className="font-semibold">{c.label}</dt>
                  <dd className="text-ink-2">{c.how}</dd>
                </div>
              ))}
              <div>
                <dt className="font-semibold">Dica</dt>
                <dd className="text-ink-2">Compare com uma peça parecida que você já usa e gosta do caimento. Entre dois tamanhos, escolha o maior para um caimento mais solto.</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="mt-8 bg-sand p-5">
          <p className="font-serif text-xl leading-snug">Prefere ver no corpo?</p>
          <p className="mt-1 text-sm text-ink-2">Informe altura e peso no Provador 3D e compare o caimento de cada tamanho.</p>
          <Link href={`/provador?add=${encodeURIComponent(slug)}`} className="btn mt-4">
            <IconCube size={18} /> Provar no Provador 3D
          </Link>
        </div>
      </div>
    </Sheet>
  );
}
