"use client";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/manequins", label: "Manequins" },
  { href: "/admin/pedidos", label: "Pedidos" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções do admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "whitespace-nowrap px-3 py-2.5 text-sm transition-colors",
              active ? "bg-ink text-paper" : "text-ink-2 hover:bg-sand hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
