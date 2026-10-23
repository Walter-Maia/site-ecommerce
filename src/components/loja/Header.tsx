"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/data/site";
import { Logo } from "./Logo";
import { IconBag, IconMenu, IconSearch, IconUser } from "./icons";
import { useStore } from "./StoreProvider";

/**
 * Header fixo: transparente sobre o hero da home e sólido no resto;
 * some ao rolar para baixo e volta ao rolar para cima.
 */
export function Header() {
  const pathname = usePathname();
  const { cart, openPanel, panel } = useStore();
  const isHome = pathname === "/";
  const [atTop, setAtTop] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const read = () => {
      raf = 0;
      const y = window.scrollY;
      setAtTop(y < 24);
      const delta = y - last;
      if (y < 320) setHidden(false);
      else if (delta > 8) setHidden(true);
      else if (delta < -8) setHidden(false);
      last = y;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const transparent = isHome && atTop && panel === null;
  const count = cart.itemCount;

  return (
    <header
      className="site-header"
      data-transparent={transparent || undefined}
      data-hidden={(hidden && panel === null) || undefined}
    >
      <div className="gutter grid h-full grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex items-center gap-1 lg:gap-6">
          <button
            type="button"
            className="icon-btn -ml-2.5 lg:ml-[-10px] lg:w-auto lg:gap-2.5 lg:px-2.5 lg:[display:inline-flex]"
            aria-label="Abrir menu"
            aria-haspopup="dialog"
            aria-expanded={panel === "menu"}
            onClick={() => openPanel("menu")}
          >
            <IconMenu />
            <span className="t-label hidden lg:inline" aria-hidden="true">
              Menu
            </span>
          </button>
          <nav aria-label="Principal" className="hidden xl:block">
            <ul className="flex items-center gap-6">
              {NAV.primary.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="t-label link-line whitespace-nowrap py-2"
                    aria-current={pathname === l.href ? "page" : undefined}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Link href="/" aria-label="KIM KRISS — página inicial" className="block px-2 py-2.5 md:py-2">
          <Logo title="" className="h-6 w-auto md:h-7" />
        </Link>

        <div className="-mr-2.5 flex items-center justify-end">
          <button
            type="button"
            className="icon-btn"
            aria-label="Buscar"
            aria-haspopup="dialog"
            aria-expanded={panel === "search"}
            onClick={() => openPanel("search")}
          >
            <IconSearch />
          </button>
          <Link href="/conta" className="icon-btn hidden sm:inline-grid" aria-label="Minha conta">
            <IconUser />
          </Link>
          <button
            type="button"
            className="icon-btn relative"
            aria-label={`Sacola, ${count} ${count === 1 ? "item" : "itens"}`}
            aria-haspopup="dialog"
            aria-expanded={panel === "cart"}
            onClick={() => openPanel("cart")}
          >
            <IconBag />
            <span
              aria-hidden="true"
              className={`tabular absolute right-0.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[0.65rem] font-semibold leading-none transition-transform duration-300 ${
                count > 0 ? "scale-100 bg-signal text-white" : "scale-0"
              }`}
            >
              {count > 0 ? count : ""}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
