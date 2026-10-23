import Link from "next/link";
import type { Product } from "@/lib/types";
import { Photo } from "../Photo";
import { Price } from "../Price";
import { QuickAdd } from "../QuickAdd";
import { RevealTitle } from "../RevealTitle";
import { editorial } from "../media";

/** Quatro fotos de modelo lado a lado, cada uma ligada a uma peça, com compra rápida. */
export function LookGrid({ looks }: { looks: { image: string; product: Product }[] }) {
  return (
    <section aria-labelledby="looks-titulo" className="cv-auto py-20 [--cv-h:815px] md:py-28 md:[--cv-h:675px]">
      <div className="gutter mb-8 grid gap-4 md:mb-12 md:grid-cols-12 md:items-end">
        <RevealTitle id="looks-titulo" lines={["Do jeito que", "a rua veste"]} className="md:col-span-7" />
        <p className="max-w-sm text-[0.95rem] leading-relaxed text-ink-2 md:col-span-4 md:col-start-9 md:justify-self-end">
          Looks da campanha com as peças da loja. Toque na sacola para escolher o tamanho sem sair da página.
        </p>
      </div>
      <ul className="gutter grid grid-cols-2 gap-x-2.5 gap-y-8 md:gap-x-4 lg:grid-cols-4">
        {looks.map(({ image, product: p }, i) => (
          <li key={image} className="relative">
            <div className="zoom-host relative">
              <Link href={`/produto/${p.slug}`} className="block" tabIndex={-1} aria-hidden="true">
                <Photo
                  src={editorial(image)}
                  alt=""
                  ratio="3 / 4"
                  sizes="(min-width: 1024px) 24vw, 48vw"
                  reveal
                  imgClassName="zoom-target"
                  fallbackLabel={`Look ${String(i + 1).padStart(2, "0")}`}
                />
              </Link>
              <QuickAdd productId={p.id} productName={p.name} sizes={p.sizes} />
            </div>
            <div className="mt-3">
              <h3 className="font-serif text-[0.98rem] leading-snug md:text-[1.05rem]">
                <Link href={`/produto/${p.slug}`} className="hover:underline">
                  {p.name}
                </Link>
              </h3>
              <Price price={p.price} compareAt={p.compareAtPrice} className="mt-1" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
