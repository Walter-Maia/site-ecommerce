import Link from "next/link";
import clsx from "clsx";

/** Título que sobe linha a linha por trás de uma máscara (CSS + [data-in]). */
export function RevealTitle({
  lines,
  as: Tag = "h2",
  id,
  className,
}: {
  lines: string[];
  as?: "h1" | "h2" | "h3" | "p";
  id?: string;
  className?: string;
}) {
  return (
    <Tag id={id} className={clsx("t-title", className)} data-reveal="lines">
      {lines.map((l, i) => (
        <span key={i} className="rl" style={{ "--i": i } as React.CSSProperties}>
          <span>{l}</span>
          {i < lines.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}

/** Cabeçalho de seção: título em serifa à esquerda, link "ver tudo" à direita. */
export function SectionHead({
  id,
  lines,
  kicker,
  href,
  hrefLabel = "Ver tudo",
  className,
}: {
  id: string;
  lines: string[];
  kicker?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={clsx("gutter mb-8 flex items-end justify-between gap-6 md:mb-10", className)}>
      <div>
        {kicker ? <p className="mb-3 text-sm text-mute">{kicker}</p> : null}
        <RevealTitle id={id} lines={lines} />
      </div>
      {href ? (
        <Link href={href} className="t-label link-line mb-1 inline-flex min-h-11 shrink-0 items-center">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}
