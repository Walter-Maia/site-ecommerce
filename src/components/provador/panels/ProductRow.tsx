"use client";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { useFitting } from "../context";
import { slotLabel } from "../slots";
import type { ProvadorProduct } from "../types";
import { Icon } from "../ui/icons";
import { ProductThumb } from "../ui/ProductThumb";

/** Linha de peça: miniatura, nome (link para a página da peça), preço, curtir e Vestir/Tirar. */
export function ProductRow({ p }: { p: ProvadorProduct }) {
  const f = useFitting();
  const worn = f.isWorn(p.id);
  const liked = f.wishlist.has(p.id);
  const inStock = p.sizes.some((s) => s.stock > 0);
  const prop = p.garment.slot === "prop";
  return (
    <li className="pv-row" data-worn={worn || undefined}>
      <ProductThumb p={p} />
      <div className="pv-row__info">
        <Link href={`/produto/${p.slug}`} className="pv-row__name">
          {p.name}
        </Link>
        <span className="pv-row__meta">
          <span className="pv-price">
            {formatPrice(p.price)}
            {p.compareAtPrice && p.compareAtPrice > p.price ? (
              <s>
                <span className="sr-only">de </span>
                {formatPrice(p.compareAtPrice)}
              </s>
            ) : null}
          </span>
          <span aria-hidden="true">·</span>
          <span>{slotLabel(p.garment.slot)}</span>
          {!inStock ? <span className="pv-row__out">Esgotado</span> : null}
        </span>
      </div>
      <button
        type="button"
        className="pv-heart"
        aria-pressed={liked}
        aria-label={`Curtir ${p.name}`}
        onClick={() => void f.toggleWish(p)}
      >
        <Icon name="heart" size={20} filled={liked} />
      </button>
      <button
        type="button"
        className="pv-wear"
        data-on={worn || undefined}
        aria-label={`${worn ? (prop ? "Soltar" : "Tirar") : prop ? "Segurar" : "Vestir"} ${p.name}`}
        onClick={() => f.toggleWear(p)}
      >
        {worn ? <Icon name="check" size={16} /> : null}
        {worn ? (prop ? "Soltar" : "Tirar") : prop ? "Segurar" : "Vestir"}
      </button>
    </li>
  );
}
