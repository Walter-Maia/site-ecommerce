"use client";

import { useEffect, useRef, useState } from "react";
import { ANNOUNCEMENTS } from "@/data/site";
import { IconPause, IconPlay } from "./icons";

/** Letreiro contínuo; pausa no hover, no foco e pelo botão (WCAG 2.2.2). */
export function AnnouncementBar() {
  const [paused, setPaused] = useState(false);
  // Fora da tela o letreiro para: uma animação infinita, mesmo invisível, mantém o compositor gerando quadros.
  const [offscreen, setOffscreen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const items = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS];
  return (
    <div
      ref={root}
      className="marquee on-dark relative z-50 flex h-(--announce-h) items-center bg-ink text-paper"
      data-paused={paused || offscreen || undefined}
      role="region"
      aria-label="Avisos da loja"
    >
      <ul className="sr-only">
        {ANNOUNCEMENTS.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <div className="min-w-0 flex-1 overflow-hidden" aria-hidden="true">
        <div className="marquee-track flex w-max">
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0">
              {items.map((a, i) => (
                <span key={`${half}-${i}`} className="t-label flex items-center whitespace-nowrap px-6 text-[0.68rem] font-medium tracking-[0.12em]">
                  {a}
                  <span className="ml-12 inline-block size-[5px] rotate-45 bg-signal" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Retomar avisos" : "Pausar avisos"}
        className="relative grid h-full w-11 shrink-0 place-items-center border-l border-white/15 text-paper/80 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:text-paper"
      >
        {paused ? <IconPlay size={14} /> : <IconPause size={14} />}
      </button>
    </div>
  );
}
