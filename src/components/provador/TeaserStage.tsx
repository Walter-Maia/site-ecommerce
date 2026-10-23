"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Appearance, BodyParams, WornItem } from "@/lib/provador/contract";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "./context";
import { Icon } from "./ui/icons";
import { PosterFigure, type PosterColors } from "./ui/PosterFigure";

// Nem o wrapper do motor entra no bundle da home: só é pedido quando o palco entra na tela.
const LazyMannequinScene = lazy(() => import("./scene/LazyMannequinScene"));

/**
 * Manequim do teaser: pôster estático primeiro; o canvas 3D só carrega quando o palco
 * entra na viewport e só gira enquanto está visível. Em movimento reduzido, fica no
 * pôster até a pessoa pedir.
 */
export function TeaserStage({
  bodyParams,
  appearance,
  outfit,
  poster,
  label,
}: {
  bodyParams: BodyParams;
  appearance: Appearance;
  outfit: WornItem[];
  poster: PosterColors;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const load = seen && (!reduced || requested);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setSeen(true);
      },
      { rootMargin: "80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // se o motor não avisar onReady, mostra o canvas mesmo assim
  useEffect(() => {
    if (!load || ready) return;
    const t = window.setTimeout(() => setReady(true), 6000);
    return () => window.clearTimeout(t);
  }, [load, ready]);

  return (
    <div ref={ref} className="pv-tstage">
      <div className="pv-tstage__poster" data-hidden={(load && ready) || undefined} aria-hidden="true">
        <PosterFigure c={poster} />
      </div>
      {load ? (
        <div className="pv-tstage__canvas" data-ready={ready || undefined}>
          <Suspense fallback={null}>
            <LazyMannequinScene
              bodyParams={bodyParams}
              appearance={appearance}
              outfit={outfit}
              autoRotate={visible && !reduced}
              view="frente"
              theme="y2k"
              quality="baixa"
              ariaLabel={label}
              className="size-full"
              onReady={() => setReady(true)}
            />
          </Suspense>
        </div>
      ) : (
        <span className="sr-only">{label}</span>
      )}
      {reduced && !requested ? (
        <button type="button" className="pv-tstage__load" onClick={() => setRequested(true)}>
          <Icon name="play" size={14} /> Ver em 3D
        </button>
      ) : null}
    </div>
  );
}
