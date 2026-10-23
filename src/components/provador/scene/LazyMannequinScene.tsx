"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MannequinSceneProps, SceneTheme } from "@/lib/provador/contract";

/** Ponto de entrada para a UI: carrega three.js só no cliente e sob demanda. */
const MannequinScene = dynamic(() => import("./MannequinScene"), { ssr: false, loading: () => null });

const POSTER_BG: Record<SceneTheme, string> = {
  y2k: "transparent",
  boutique: "linear-gradient(#f3ece1, #e7ddcd)",
  neutral: "#f1efea",
};

/** Sem evento de scroll por esse tempo = página parada. */
const CALM_MS = 140;

/**
 * Só monta o WebGL perto da tela (meia viewport de folga), com a página parada e o navegador ocioso:
 * avaliar o three.js, criar o contexto e compilar os shaders custa de dezenas a centenas de ms de main
 * thread — no meio de uma rolagem isso vira um tranco, e quem passou direto pelo teaser nem paga.
 * Página parada com o palco na tela (ex.: /provador recém-aberto) monta em ~CALM_MS.
 */
function useCalmMount(ref: React.RefObject<HTMLElement | null>): boolean {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (go) return;
    // Safari antigo não tem requestIdleCallback
    const hasIdle = "requestIdleCallback" in window;
    const ric = (cb: () => void) => (hasIdle ? window.requestIdleCallback(cb, { timeout: 1000 }) : window.setTimeout(cb, 1));
    const cic = (h: number) => (hasIdle ? window.cancelIdleCallback(h) : window.clearTimeout(h));
    let timer = 0;
    let idle = 0;
    let near = false;
    let calm = false;
    const check = () => {
      if (near && calm) setGo(true);
    };
    const arm = () => {
      calm = false;
      window.clearTimeout(timer);
      cic(idle);
      timer = window.setTimeout(() => {
        idle = ric(() => {
          calm = true;
          check();
        });
      }, CALM_MS);
    };
    const el = ref.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              near = e.isIntersecting;
              check();
            },
            { rootMargin: "50% 0px" },
          )
        : null;
    if (io && el) io.observe(el);
    else near = true;
    arm();
    document.addEventListener("scroll", arm, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      cic(idle);
      io?.disconnect();
      document.removeEventListener("scroll", arm, { capture: true });
    };
  }, [go, ref]);
  return go;
}

/**
 * Pôster no estilo do provador enquanto o 3D carrega: mesma caixa do canvas
 * (sem layout shift), silhueta de manequim e piso em grade; some ao primeiro quadro.
 */
function Poster({ theme, hidden }: { theme: SceneTheme; hidden: boolean }) {
  const y2k = theme === "y2k";
  const ink = y2k ? "rgba(79,229,255,0.55)" : "rgba(60,48,36,0.22)";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: POSTER_BG[theme],
        opacity: hidden ? 0 : 1,
        transition: "opacity 420ms ease-out",
        pointerEvents: "none",
      }}
    >
      {/* piso em perspectiva */}
      <div
        style={{
          position: "absolute",
          left: "-50%",
          right: "-50%",
          bottom: "-10%",
          height: "48%",
          transform: "perspective(320px) rotateX(62deg)",
          transformOrigin: "50% 100%",
          backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
          backgroundSize: "38px 38px",
          maskImage: "linear-gradient(to top, black 30%, transparent 95%)",
          WebkitMaskImage: "linear-gradient(to top, black 30%, transparent 95%)",
        }}
      />
      {/* silhueta (o pulso para quando o pôster some: nada de animação infinita invisível) */}
      <svg viewBox="0 0 100 260" style={{ position: "absolute", left: "50%", bottom: "8%", height: "80%", transform: "translateX(-50%)" }} className={hidden ? undefined : "motion-safe:animate-pulse"}>
        <defs>
          <linearGradient id="qp" x1="0" x2="1">
            <stop offset="0" stopColor={y2k ? "#4fe5ff" : "#cbbca7"} stopOpacity="0.55" />
            <stop offset="1" stopColor={y2k ? "#ff3d8e" : "#b9a993"} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path
          fill="url(#qp)"
          d="M50 4c8 0 13 6 13 15s-5 17-13 17-13-8-13-17S42 4 50 4zm-9 36h18l16 6 6 22-5 36-6-2 3-31-4-9-1 34 4 36-4 48 1 50h-12l-4-52-1-40h-2l-1 40-4 52H35l1-50-4-48 4-36-1-34-4 9 3 31-6 2-5-36 6-22z"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "3%",
          textAlign: "center",
          fontFamily: "var(--font-lcd), ui-monospace, monospace",
          fontSize: 18,
          letterSpacing: "0.12em",
          color: y2k ? "#7fff7f" : "#6e6e6e",
        }}
      >
        CARREGANDO PROVADOR…
      </span>
    </div>
  );
}

const positioned = /(^|\s)(absolute|fixed|sticky)(\s|$)/;

export default function LazyMannequinScene(props: MannequinSceneProps) {
  const [ready, setReady] = useState(false);
  const [posterGone, setPosterGone] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const mount = useCalmMount(box);
  const { onReady } = props;
  const handleReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);
  // depois do fade, o pôster sai do DOM (camada a menos para compor em cima do canvas)
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setPosterGone(true), 500);
    return () => window.clearTimeout(t);
  }, [ready]);
  return (
    <div ref={box} role="img" aria-label={props.ariaLabel} className={props.className} style={{ position: positioned.test(props.className ?? "") ? undefined : "relative", minHeight: 240 }}>
      {mount ? <MannequinScene {...props} className={undefined} onReady={handleReady} /> : null}
      {posterGone ? null : <Poster theme={props.theme ?? "y2k"} hidden={ready} />}
    </div>
  );
}
