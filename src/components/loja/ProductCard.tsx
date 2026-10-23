import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { discountPercent } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Stars } from "./icons";
import { imageExists } from "./media";
import { Fallback } from "./Photo";
import { DiscountBadge, Price } from "./Price";
import { WishlistButton } from "./WishlistButton";

export const CARD_SIZES = "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw";

/**
 * Card de produto (Server Component): packshot em fundo areia e, no hover,
 * a foto com modelo. Coração é uma ilha cliente fora do link.
 */
export function ProductCard({
  product: p,
  sizes = CARD_SIZES,
  headingLevel = "h3",
  className,
}: {
  product: Product;
  sizes?: string;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const packshot = p.images.find((i) => i.kind === "packshot") ?? p.images[0];
  const modelo = p.images.find((i) => i.kind === "modelo");
  const hasPack = imageExists(packshot?.src);
  const hasModel = imageExists(modelo?.src);
  const main = hasPack ? packshot : hasModel ? modelo : null;
  const alt = hasPack && hasModel ? modelo : null;
  const off = discountPercent(p.price, p.compareAtPrice);
  const H = headingLevel;

  return (
    <article className={clsx("group/card relative", className)}>
      <Link href={`/produto/${p.slug}`} className="swap-host zoom-host block">
        <div className="media aspect-[4/5]">
          {main ? (
            <Image src={main.src} alt={main.alt} fill sizes={sizes} className="zoom-target object-cover" />
          ) : (
            <Fallback label={p.shortName} alt={p.name} />
          )}
          {alt ? (
            <Image
              src={alt.src}
              alt=""
              aria-hidden="true"
              fill
              sizes={sizes}
              className="swap-alt zoom-target object-cover transition-opacity duration-500"
            />
          ) : null}
          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5 md:left-3 md:top-3">
            {p.isNew ? <span className="t-label t-cond bg-paper px-1.5 py-[3px] text-[0.68rem]">Novo</span> : null}
            {off ? <DiscountBadge off={off} /> : null}
          </div>
        </div>
        <div className="pr-1 pt-3">
          <H className="font-serif text-[0.98rem] leading-snug tracking-[-0.005em] md:text-[1.05rem]">{p.name}</H>
          <Price price={p.price} compareAt={p.compareAtPrice} className="mt-1.5" />
          {p.reviewCount > 0 ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-mute">
              <Stars value={p.rating} size={10} />
              <span className="tabular">
                <span className="sr-only">Nota {p.rating.toString().replace(".", ",")} de 5, </span>({p.reviewCount}
                <span className="sr-only"> avaliações</span>)
              </span>
            </p>
          ) : null}
        </div>
      </Link>
      <WishlistButton productId={p.id} productName={p.name} className="absolute right-0.5 top-0.5 md:right-1 md:top-1" />
    </article>
  );
}
