"use client";

import Link from "next/link";
import Image from "next/image";
import { NAV, SITE } from "@/data/site";
import type { Category } from "@/lib/types";
import { Logo } from "./Logo";
import { RollText } from "./RollText";
import { Sheet } from "./Sheet";
import { IconClose } from "./icons";
import { useStore } from "./StoreProvider";

export function MenuOverlay({ categories, image }: { categories: Category[]; image: string | null }) {
  const { panel, closePanel } = useStore();
  const close = () => closePanel();
  return (
    <Sheet open={panel === "menu"} onClose={close} side="full" labelledBy="menu-titulo">
      <div className="gutter flex h-(--header-h) shrink-0 items-center justify-between border-b border-line">
        <button type="button" className="icon-btn -ml-2.5" onClick={close} aria-label="Fechar menu">
          <IconClose />
        </button>
        <h2 id="menu-titulo" className="sr-only">
          Menu
        </h2>
        <Link href="/" onClick={close} aria-label="KIM KRISS — página inicial" className="px-2 py-2">
          <Logo title="" className="h-6 w-auto md:h-7" />
        </Link>
        <span className="w-11" />
      </div>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.25fr_1fr]">
        <nav aria-label="Menu completo" className="gutter flex flex-col justify-between gap-12 py-10 lg:py-14">
          <ul className="stagger flex flex-col">
            {NAV.primary.map((l, i) => (
              <li key={l.href} style={{ "--i": i } as React.CSSProperties} className="menu-row overflow-hidden">
                <Link
                  href={l.href}
                  onClick={close}
                  className="flex items-baseline py-1 font-serif text-[clamp(2.6rem,9vw,5.6rem)] tracking-[-0.03em]"
                >
                  <RollText text={l.label} />
                </Link>
              </li>
            ))}
          </ul>

          <div className="stagger grid gap-10 sm:grid-cols-2">
            <div style={{ "--i": 4 } as React.CSSProperties}>
              <p className="t-label mb-4 text-mute">Categorias</p>
              <ul className="grid grid-cols-2 gap-x-6 text-[0.95rem]">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/categoria/${c.slug}`} onClick={close} className="link-line inline-flex min-h-11 items-center">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ "--i": 5 } as React.CSSProperties}>
              <p className="t-label mb-4 text-mute">Atendimento</p>
              <ul className="text-[0.95rem]">
                {NAV.footer[1].links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={close} className="link-line inline-flex min-h-11 items-center">
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/conta" onClick={close} className="link-line inline-flex min-h-11 items-center">
                    Minha conta
                  </Link>
                </li>
              </ul>
              <p className="mt-6 text-xs text-mute">{SITE.email}</p>
            </div>
          </div>
        </nav>

        <div className="relative hidden bg-sand lg:block">
          {image ? (
            <>
              <Image src={image} alt="" fill sizes="40vw" className="object-cover" />
              <p className="absolute bottom-8 left-8 right-8 font-serif text-3xl leading-tight text-white drop-shadow-[0_1px_12px_rgb(0_0_0/0.35)]">
                Feito em São Paulo,
                <br />
                para a quadra e para a rua.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
