import clsx from "clsx";
import { discountPercent, formatPrice } from "@/lib/format";

export function Price({
  price,
  compareAt,
  className,
  size = "sm",
}: {
  price: number;
  compareAt?: number;
  className?: string;
  size?: "sm" | "lg";
}) {
  const off = discountPercent(price, compareAt);
  return (
    <p className={clsx("tabular flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={clsx("font-medium", size === "lg" ? "text-2xl tracking-[-0.01em]" : "text-sm")}>
        <span className="sr-only">{off ? "Preço com desconto: " : "Preço: "}</span>
        {formatPrice(price)}
      </span>
      {off && compareAt ? (
        <>
          <s className={clsx("text-mute", size === "lg" ? "text-base" : "text-xs")}>
            <span className="sr-only">Preço anterior: </span>
            {formatPrice(compareAt)}
          </s>
          <DiscountBadge off={off} />
        </>
      ) : null}
    </p>
  );
}

export function DiscountBadge({ off, className }: { off: number; className?: string }) {
  return (
    <span className={clsx("t-label t-cond inline-flex items-center bg-signal px-1.5 py-[3px] text-[0.68rem] text-white", className)}>
      -{off}%
    </span>
  );
}
