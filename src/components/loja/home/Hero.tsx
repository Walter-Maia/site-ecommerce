import Link from "next/link";
import { ArtPhoto } from "../Photo";
import { editorial } from "../media";

/** Hero editorial sangrado sob o header transparente. Animação só em CSS. */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-titulo"
      className="on-dark relative -mt-(--header-h) h-[calc(100svh-var(--announce-h))] min-h-[600px] overflow-hidden bg-night text-white md:min-h-[640px]"
    >
      <ArtPhoto
        desktop={editorial("hero-arquibancada")}
        mobile={editorial("hero-arquibancada-mobile")}
        alt="Editorial da coleção Arquibancada: modelos com camisetas oversized e jerseys numeradas na arquibancada de concreto"
        className="hero-media absolute inset-0 bg-night"
        imgClassName="object-[50%_30%]"
        preload
      />
      {/* Sombra funcional: legibilidade do header e do título sobre a foto. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/75 via-black/35 to-transparent md:from-black/70 md:via-black/25" />

      <div className="gutter absolute inset-x-0 bottom-0 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:pb-14">
        <div>
          <p className="hero-fade mb-4 text-sm text-white">Coleção Arquibancada, primavera 2026</p>
          <h1 id="hero-titulo" className="t-display text-[clamp(3.1rem,12.5vw,10rem)]">
            <span className="rl hero-line" style={{ "--i": 0 } as React.CSSProperties}>
              <span>Arquibancada</span>
            </span>
            <span className="sr-only">: streetwear esportivo de São Paulo</span>
          </h1>
          <p className="hero-fade mt-5 max-w-[34ch] text-pretty text-[0.98rem] leading-relaxed text-white">
            Camisetas pesadas, jerseys de botão e o 07 nas costas. Roupa para assistir ao jogo de pé.
          </p>
          <div className="hero-fade mt-7">
            <Link href="/novidades?colecao=arquibancada" className="btn btn-light">
              Ver coleção
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
