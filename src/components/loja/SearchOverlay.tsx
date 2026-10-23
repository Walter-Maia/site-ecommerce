"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { pagePath, withBasePath } from "@/lib/static-demo";
import { POPULAR_SEARCHES } from "./constants";
import { Sheet } from "./Sheet";
import { IconClose, IconSearch } from "./icons";
import { useStore } from "./StoreProvider";

export function SearchOverlay() {
  const { panel, closePanel } = useStore();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const open = panel === "search";

  return (
    <Sheet open={open} onClose={closePanel} side="top" labelledBy="busca-titulo" panelClassName="pb-8 md:pb-12">
      <div className="gutter flex h-(--header-h) items-center justify-between">
        <h2 id="busca-titulo" className="t-label text-mute">
          Buscar na KIM & KRIS
        </h2>
        <button type="button" className="icon-btn -mr-2.5" onClick={closePanel} aria-label="Fechar busca">
          <IconClose />
        </button>
      </div>
      <div className="gutter mx-auto w-full max-w-5xl">
        <form
          action={withBasePath(pagePath("/busca"))} // form cru (sem JS): basePath à mão na demo estática; no-op no servidor
          method="get"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = input.current?.value.trim() ?? "";
            closePanel();
            router.push(q ? `/busca?q=${encodeURIComponent(q)}` : "/busca");
          }}
          className="underline-field flex items-center gap-3 border-b border-ink pb-2"
        >
          <label htmlFor="busca-overlay" className="sr-only">
            O que você procura?
          </label>
          <IconSearch size={26} className="shrink-0" />
          <input
            ref={input}
            id="busca-overlay"
            name="q"
            type="search"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Camiseta, jersey, moletom…"
            className="min-h-14 w-full min-w-0 bg-transparent font-serif text-[clamp(1.6rem,4.5vw,2.8rem)] tracking-[-0.02em] no-ring outline-none placeholder:text-mute/70"
          />
          <button type="submit" className="btn btn-solid hidden shrink-0 sm:inline-flex">
            Buscar
          </button>
        </form>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="t-label mr-2 text-mute">Mais buscados</span>
          {POPULAR_SEARCHES.map((q) => (
            <Link
              key={q}
              href={`/busca?q=${encodeURIComponent(q)}`}
              onClick={closePanel}
              className="inline-flex min-h-11 items-center border border-line px-4 text-sm transition-colors hover:border-ink"
            >
              {q}
            </Link>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
