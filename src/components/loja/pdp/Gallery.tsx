"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { IconArrow, IconArrowLeft } from "../icons";

export interface GalleryImage {
  src: string;
  alt: string;
}

/**
 * Galeria da PDP: trilho com scroll-snap (arrasta no celular), miniaturas
 * verticais e setas no desktop, contador "1/2". A 1ª foto é o LCP.
 */
export function Gallery({ images, fallbackLabel }: { images: GalleryImage[]; fallbackLabel: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = images.length;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(total - 1, i));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  if (total === 0) {
    return (
      <div className="media grid aspect-[4/5] place-items-center">
        <span className="t-label t-cond text-mute/70">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[72px_minmax(0,1fr)] lg:gap-4" role="region" aria-roledescription="galeria" aria-label="Fotos do produto">
      {total > 1 ? (
        <ul className="hidden lg:flex lg:flex-col lg:gap-3" aria-label="Miniaturas">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Ver foto ${i + 1} de ${total}`}
                aria-current={index === i ? "true" : undefined}
                className={clsx("media block aspect-[4/5] w-full outline-offset-2 transition-opacity", index === i ? "opacity-100 ring-1 ring-ink" : "opacity-60 hover:opacity-100")}
              >
                <Image src={img.src} alt="" fill sizes="72px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative -mx-(--gutter) md:mx-0">
        <div
          ref={track}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar"
          tabIndex={0}
          aria-label="Fotos, role para os lados"
          data-lenis-prevent
        >
          {images.map((img, i) => (
            <figure key={img.src} className="media aspect-[4/5] w-full shrink-0 snap-start" aria-label={`Foto ${i + 1} de ${total}`}>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(min-width: 1024px) 52vw, (min-width: 768px) 48vw, 100vw"
                preload={i === 0}
                fetchPriority={i === 0 ? "high" : undefined}
                className="object-cover"
              />
            </figure>
          ))}
        </div>
        {total > 1 ? (
          <>
            <p className="tabular pointer-events-none absolute bottom-4 left-4 bg-paper/90 px-2.5 py-1 text-xs font-medium" aria-live="polite">
              {index + 1}/{total}
            </p>
            <div className="absolute bottom-3 right-3 hidden gap-1 lg:flex">
              <button type="button" className="icon-btn bg-paper/90 disabled:opacity-40" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Foto anterior">
                <IconArrowLeft size={18} />
              </button>
              <button type="button" className="icon-btn bg-paper/90 disabled:opacity-40" onClick={() => go(index + 1)} disabled={index === total - 1} aria-label="Próxima foto">
                <IconArrow size={18} />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
