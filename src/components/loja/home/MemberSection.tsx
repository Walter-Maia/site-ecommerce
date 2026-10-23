import { CASHBACK_PERCENT } from "@/data/site";
import { NewsletterForm } from "../NewsletterForm";

/** Marcações de uma quadra de futsal vista de cima; se desenham ao entrar na tela. */
function CourtLines({ className }: { className?: string }) {
  const p = { className: "cl", pathLength: 1, fill: "none", stroke: "currentColor", strokeWidth: 0.45 };
  return (
    <svg viewBox="0 0 400 200" className={`court-lines ${className ?? ""}`} data-reveal="court" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <rect x="10" y="10" width="380" height="180" {...p} style={{ "--i": 0 } as React.CSSProperties} />
      <path d="M200 10V190" {...p} style={{ "--i": 1 } as React.CSSProperties} />
      <circle cx="200" cy="100" r="30" {...p} style={{ "--i": 2 } as React.CSSProperties} />
      <path d="M10 46A54 54 0 0 1 64 100A54 54 0 0 1 10 154" {...p} style={{ "--i": 3 } as React.CSSProperties} />
      <path d="M390 46A54 54 0 0 0 336 100A54 54 0 0 0 390 154" {...p} style={{ "--i": 3 } as React.CSSProperties} />
      <path d="M10 88H2V112H10M390 88H398V112H390" {...p} style={{ "--i": 4 } as React.CSSProperties} />
      <circle cx="200" cy="100" r="2" fill="currentColor" />
      <circle cx="70" cy="100" r="1.6" fill="currentColor" />
      <circle cx="330" cy="100" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function MemberSection() {
  return (
    <section aria-labelledby="membro-titulo" className="on-dark cv-auto relative isolate overflow-hidden bg-signal text-white [--cv-h:625px] md:[--cv-h:510px]">
      <CourtLines className="absolute inset-0 -z-10 h-full w-full text-white/35" />
      <div className="gutter grid gap-10 py-20 md:grid-cols-12 md:items-end md:py-28">
        <div className="md:col-span-7">
          <p className="mb-4 text-sm text-white">Clube KIM KRISS</p>
          <h2 id="membro-titulo" className="t-display text-[clamp(3.4rem,10vw,9rem)]" data-reveal="lines">
            <span className="rl">
              <span>Seja membro</span>
            </span>
          </h2>
          <ul className="mt-8 grid max-w-xl gap-x-8 gap-y-3 text-[0.98rem] sm:grid-cols-2">
            <li className="border-t border-white/40 pt-3">Aviso antes de cada drop</li>
            <li className="border-t border-white/40 pt-3">{CASHBACK_PERCENT}% de cashback na primeira compra</li>
            <li className="border-t border-white/40 pt-3">Convite para os jogos de rua</li>
            <li className="border-t border-white/40 pt-3">Looks salvos no Provador 3D</li>
          </ul>
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <NewsletterForm tone="dark" cta="Quero entrar" />
          <p className="mt-4 text-xs leading-relaxed text-white">
            Um e-mail por drop, no máximo. Dá para sair da lista a qualquer momento.
          </p>
        </div>
      </div>
    </section>
  );
}
