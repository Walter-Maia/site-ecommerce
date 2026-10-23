"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Scroll suave (Lenis) DESLIGADO: ele troca a rolagem do compositor (thread própria, fluida mesmo com a
 * main thread ocupada) por um scrollTo por quadro na main thread — qualquer tarefa longa (hidratação,
 * WebGL, imagem) vira tranco na rolagem. Medido (scripts/qa/scroll-perf.mjs, home, CPU 4×): sem ganho de
 * fluidez e +10–20 pontos de main thread ocupada durante a rolagem. Para religar, true (o laço abaixo já
 * roda só enquanto há rolagem suave em andamento).
 */
const SMOOTH_SCROLL = false;

/**
 * Motor de movimento da loja:
 * 1) marca [data-reveal] com [data-in] ao entrar na tela (CSS faz a animação);
 * 2) Lenis (scroll suave), se SMOOTH_SCROLL, só em desktop com mouse, fora do provador e sem
 *    prefers-reduced-motion. Painéis, carrosséis e o canvas 3D rolam nativos.
 */
export function MotionRoot() {
  const pathname = usePathname();

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-motion", "");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = (el: Element) => el.setAttribute("data-in", "");

    if (reduce || !("IntersectionObserver" in window)) {
      const all = () => document.querySelectorAll("[data-reveal]:not([data-in])").forEach(reveal);
      all();
      const mo = new MutationObserver(all);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal(e.target);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    let queued = 0;
    const watched = new WeakSet<Element>();
    const scan = () => {
      queued = 0;
      document.querySelectorAll("[data-reveal]:not([data-in])").forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(() => {
      if (!queued) queued = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(queued);
    };
  }, []);

  const inProvador = pathname.startsWith("/provador");
  useEffect(() => {
    if (!SMOOTH_SCROLL || inProvador) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    let destroyed = false;
    let instance: { destroy: () => void } | null = null;
    import("lenis").then(({ default: Lenis }) => {
      if (destroyed) return;
      const lenis = new Lenis({
        // autoRaf rodava um requestAnimationFrame a cada quadro para sempre (página parada inclusive):
        // aqui o laço só existe enquanto há rolagem suave em andamento.
        autoRaf: false,
        lerp: 0.12,
        allowNestedScroll: true,
        anchors: true,
        prevent: (node) => !!node.closest?.("dialog, [data-lenis-prevent], canvas, .rail"),
      });
      let raf = 0;
      let last = 0;
      let clock = 0;
      const loop = (t: number) => {
        // relógio próprio: depois de uma pausa o primeiro passo não "pula" a animação inteira
        clock += last ? Math.min(t - last, 50) : 1000 / 60;
        last = t;
        lenis.raf(clock);
        if (lenis.isScrolling === "smooth") raf = requestAnimationFrame(loop);
        else raf = last = 0;
      };
      // toda rolagem suave (roda, âncora, scrollTo) passa por scrollTo: é o gatilho do laço
      const scrollTo = lenis.scrollTo.bind(lenis);
      lenis.scrollTo = (...args: Parameters<typeof scrollTo>) => {
        scrollTo(...args);
        if (!raf) raf = requestAnimationFrame(loop);
      };
      instance = {
        destroy: () => {
          cancelAnimationFrame(raf);
          lenis.destroy();
        },
      };
    });
    return () => {
      destroyed = true;
      instance?.destroy();
    };
  }, [inProvador]);

  return null;
}
