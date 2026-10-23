import Link from "next/link";
import clsx from "clsx";
import { ArtPhoto } from "../Photo";
import { editorial } from "../media";

interface BannerProps {
  id: string;
  image: string;
  alt: string;
  kicker: React.ReactNode;
  title: React.ReactNode;
  text: string;
  cta: { href: string; label: string };
  /**
   * overlay = texto branco sobre a foto (sombra no rodapé);
   * split = foto clara: texto em coluna própria (desktop) ou abaixo da foto (celular).
   */
  layout?: "overlay" | "split";
  imgClassName?: string;
  titleClassName?: string;
}

/** Banner sangrado com direção de arte (vertical no celular, horizontal no desktop). */
export function EditorialBanner({ id, image, alt, kicker, title, text, cta, layout = "overlay", imgClassName, titleClassName }: BannerProps) {
  const photo = (cls: string) => (
    <ArtPhoto
      desktop={editorial(image)}
      mobile={editorial(`${image}-mobile`)}
      alt={alt}
      reveal
      className={cls}
      imgClassName={imgClassName}
    />
  );

  if (layout === "split") {
    return (
      <section aria-labelledby={id} className="cv-auto bg-paper text-ink [--cv-h:810px] md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:[--cv-h:720px]">
        {photo("aspect-[4/5] w-full md:order-2 md:aspect-auto md:h-[min(50vw,92svh)] md:min-h-[540px]")}
        <div className="gutter flex flex-col justify-end py-10 md:order-1 md:py-14" data-reveal="fade">
          <div className="mb-3 text-sm text-ink-2">{kicker}</div>
          <h2 id={id} className={clsx("t-display text-[clamp(3rem,7.5vw,7rem)]", titleClassName)}>
            {title}
          </h2>
          <p className="mt-4 max-w-[36ch] text-[0.98rem] leading-relaxed text-ink-2">{text}</p>
          <div>
            <Link href={cta.href} className="btn mt-7">
              {cta.label}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={id} className="on-dark cv-auto relative overflow-hidden bg-night text-white [--cv-h:490px] md:[--cv-h:810px]">
      {photo("aspect-[4/5] w-full bg-night md:aspect-auto md:h-[min(56.25vw,94svh)] md:min-h-[560px]")}
      {/* No celular o texto cobre mais da foto (4:5): sombra um pouco mais densa para manter 4,5:1. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/45 to-transparent md:from-black/70 md:via-black/25" />
      <div className="gutter absolute inset-x-0 bottom-0 pb-10 md:pb-14">
        <div className="max-w-xl max-md:[text-shadow:0_1px_14px_rgb(0_0_0/0.55)]" data-reveal="fade">
          <div className="mb-3 text-sm text-white">{kicker}</div>
          <h2 id={id} className={clsx("t-display text-[clamp(3rem,9vw,8rem)]", titleClassName)}>
            {title}
          </h2>
          <p className="mt-4 max-w-[38ch] text-[0.98rem] leading-relaxed text-white">{text}</p>
          <Link href={cta.href} className="btn btn-light mt-7">
            {cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
