"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { IconCube } from "../icons";

/**
 * Bolha flutuante (formato "stories") que leva ao Provador 3D.
 * Aparece depois do hero, some enquanto se rola para baixo (não cobre a leitura)
 * e volta ao rolar para cima; recolhe perto do rodapé.
 */
export function ProvadorBubble() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf = 0;
    let last = window.scrollY;
    let goingUp = true;
    // Altura da página e da janela em cache (ResizeObserver/resize): ler scrollHeight a cada quadro
    // de rolagem forçaria layout síncrono quando há estilo pendente (reveals, header).
    const doc = document.documentElement;
    let height = doc.scrollHeight;
    let vh = window.innerHeight;
    const measure = () => {
      height = doc.scrollHeight;
      vh = window.innerHeight;
    };
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    const read = () => {
      raf = 0;
      const y = window.scrollY;
      if (Math.abs(y - last) > 6) goingUp = y < last;
      last = y;
      const nearEnd = y + vh > height - 700;
      setVisible(y > vh * 0.75 && !nearEnd && goingUp);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <Link
      href="/provador"
      aria-label="Abrir o Provador 3D"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible || undefined}
      className={clsx(
        "group fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30 grid size-[68px] place-items-center rounded-full transition-[opacity,transform] duration-500 ease-(--ease-out) md:bottom-6 md:left-6 md:size-24",
        visible ? "opacity-100" : "pointer-events-none translate-y-4 scale-90 opacity-0",
      )}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full transition-transform duration-[1.6s] ease-(--ease-out) group-hover:rotate-[120deg]" aria-hidden="true">
        <defs>
          <path id="bolha-anel" d="M50 50m-41 0a41 41 0 1 1 82 0a41 41 0 1 1 -82 0" />
        </defs>
        <circle cx="50" cy="50" r="49" fill="var(--y2k-deep)" />
        <text fill="var(--y2k-lcd)" fontSize="7.4" letterSpacing="1.6" className="font-pixel">
          <textPath href="#bolha-anel">SELECT YOUR FIT · PROVADOR 3D · </textPath>
        </text>
      </svg>
      <span className="relative grid size-[36px] place-items-center rounded-full bg-paper text-y2k-deep ring-2 ring-y2k-magenta md:size-[52px]">
        <IconCube size={20} />
      </span>
    </Link>
  );
}
