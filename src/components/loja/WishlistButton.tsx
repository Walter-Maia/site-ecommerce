"use client";

import clsx from "clsx";
import { IconHeart } from "./icons";
import { useStore } from "./StoreProvider";

/** Coração de curtir com estado otimista. */
export function WishlistButton({
  productId,
  productName,
  className,
  variant = "overlay",
}: {
  productId: string;
  productName: string;
  className?: string;
  variant?: "overlay" | "boxed";
}) {
  const { liked, toggleLike } = useStore();
  const on = liked.has(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remover ${productName} das curtidas` : `Curtir ${productName}`}
      onClick={() => toggleLike(productId)}
      className={clsx(
        "group/heart grid place-items-center transition-colors",
        variant === "overlay" ? "icon-btn" : "size-12 border border-line hover:border-ink",
        on ? "text-signal" : "text-ink",
        className,
      )}
    >
      <IconHeart
        filled={on}
        size={variant === "overlay" ? 20 : 22}
        className="transition-transform duration-200 ease-(--ease-out) group-active/heart:scale-90"
      />
    </button>
  );
}
