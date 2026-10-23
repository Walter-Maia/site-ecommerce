import Link from "next/link";
import type { Category } from "@/lib/types";
import { Photo } from "../Photo";
import { SectionHead } from "../RevealTitle";
import { editorial } from "../media";

/** Seis categorias em destaque: grade 2×3 no celular, faixa de 6 no desktop. */
export function CategoryShowcase({ categories }: { categories: (Category & { alt: string })[] }) {
  return (
    <section aria-labelledby="categorias-titulo" className="cv-auto py-20 [--cv-h:940px] md:py-28 md:[--cv-h:620px] xl:[--cv-h:420px]">
      <SectionHead id="categorias-titulo" lines={["Por categoria"]} />
      <ul className="gutter grid grid-cols-2 gap-x-2.5 gap-y-8 md:grid-cols-3 md:gap-x-4 xl:grid-cols-6">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/categoria/${c.slug}`} className="zoom-host group block">
              <Photo
                src={editorial(`categoria-${c.slug}`)}
                alt={c.alt}
                ratio="3 / 4"
                sizes="(min-width: 1280px) 16vw, (min-width: 768px) 32vw, 48vw"
                reveal
                imgClassName="zoom-target"
                fallbackLabel={c.name}
              />
              <span className="mt-3 block font-serif text-[1.3rem] leading-tight tracking-[-0.015em] underline-offset-[5px] group-hover:underline md:text-2xl">
                {c.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
