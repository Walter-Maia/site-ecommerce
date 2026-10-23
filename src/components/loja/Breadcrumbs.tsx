import Link from "next/link";
import clsx from "clsx";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo/jsonld";

export type Crumb = { name: string; path: string };

/** Trilha visível + BreadcrumbList. O último item é a página atual. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <>
      <nav aria-label="Você está em" className={clsx("text-[0.8rem] text-mute", className)}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={c.path} className="flex items-center gap-2">
                {last ? (
                  <span aria-current="page" className="text-ink-2">
                    {c.name}
                  </span>
                ) : (
                  <>
                    <Link href={c.path} className="link-line py-1.5 hover:text-ink">
                      {c.name}
                    </Link>
                    <span aria-hidden="true" className="text-line">
                      /
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(items)} />
    </>
  );
}
