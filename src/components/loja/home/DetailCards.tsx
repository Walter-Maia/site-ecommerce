import Link from "next/link";
import { Carousel } from "../Carousel";
import { Photo } from "../Photo";
import { SectionHead } from "../RevealTitle";
import { editorial } from "../media";

export interface DetailCard {
  image: string;
  title: string;
  text: string;
  href: string;
  alt: string;
}

/** "Descubra cada detalhe": cards verticais 9:16 em carrossel. */
export function DetailCards({ cards }: { cards: DetailCard[] }) {
  return (
    <section aria-labelledby="detalhes-titulo" className="cv-auto py-20 [--cv-h:620px] md:py-28 md:[--cv-h:765px]">
      <SectionHead id="detalhes-titulo" lines={["Descubra", "cada detalhe"]} kicker="De perto" />
      <Carousel label="Detalhes das peças" cols={{ base: 1.35, md: 2.6, lg: 4.4 }}>
        {cards.map((c) => (
          <Link key={c.image} href={c.href} className="zoom-host group relative block">
            <Photo src={editorial(c.image)} alt={c.alt} ratio="9 / 16" sizes="(min-width: 1100px) 23vw, (min-width: 768px) 38vw, 74vw" imgClassName="zoom-target" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="on-dark absolute inset-x-0 bottom-0 p-5 text-white">
              <h3 className="font-serif text-[1.45rem] leading-[1.1] tracking-[-0.015em]">{c.title}</h3>
              <p className="mt-2 text-sm leading-snug text-white/85">{c.text}</p>
              <span className="t-label mt-4 inline-block border-b border-white/70 pb-0.5 transition-colors group-hover:border-white">Ver peça</span>
            </div>
          </Link>
        ))}
      </Carousel>
    </section>
  );
}
