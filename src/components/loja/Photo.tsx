import Image, { getImageProps } from "next/image";
import { preload as preloadImage } from "react-dom";
import clsx from "clsx";
import { imageExists } from "./media";

interface PhotoProps {
  src: string;
  alt: string;
  sizes: string;
  /** Proporção da caixa (ex.: "4 / 5"). A caixa mantém o tamanho mesmo sem a foto. */
  ratio?: string;
  className?: string;
  imgClassName?: string;
  preload?: boolean;
  reveal?: boolean;
  /** Texto discreto exibido enquanto a foto não existe. */
  fallbackLabel?: string;
}

/** Foto em caixa com proporção fixa e fundo --sand. Server Component. */
export function Photo({ src, alt, sizes, ratio, className, imgClassName, preload, reveal, fallbackLabel }: PhotoProps) {
  const exists = imageExists(src);
  return (
    <div
      className={clsx("media", className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
      data-reveal={reveal ? "clip" : undefined}
    >
      {exists ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          loading={preload ? "eager" : undefined}
          fetchPriority={preload ? "high" : undefined}
          className={clsx("object-cover", imgClassName)}
        />
      ) : (
        <Fallback label={fallbackLabel} alt={alt} />
      )}
    </div>
  );
}

export function Fallback({ label, alt }: { label?: string; alt?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center" role={alt ? "img" : undefined} aria-label={alt || undefined}>
      {label ? (
        <span aria-hidden="true" className="t-label t-cond px-4 text-center text-[0.7rem] text-mute/70">
          {label}
        </span>
      ) : null}
    </div>
  );
}

interface ArtPhotoProps {
  desktop: string;
  mobile: string;
  alt: string;
  /** Largura em que a versão desktop entra. */
  breakpoint?: number;
  className?: string;
  imgClassName?: string;
  preload?: boolean;
  reveal?: boolean;
  fallbackLabel?: string;
}

/**
 * Direção de arte: recorte vertical no celular, horizontal no desktop.
 * Se só uma das versões existir, ela serve para as duas larguras.
 */
export function ArtPhoto({ desktop, mobile, alt, breakpoint = 768, className, imgClassName, preload, reveal, fallbackLabel }: ArtPhotoProps) {
  const hasD = imageExists(desktop);
  const hasM = imageExists(mobile);
  const box = clsx("media", className);
  if (!hasD && !hasM) {
    return (
      <div className={box} data-reveal={reveal ? "clip" : undefined}>
        <Fallback label={fallbackLabel} alt={alt} />
      </div>
    );
  }
  // <img preload> do Next não serve para <picture> (baixaria as duas fontes). Para o LCP, cada
  // fonte ganha um <link rel=preload> com a MESMA media query do <source>: o navegador baixa
  // só a que vale para a tela, já no <head>, com prioridade alta.
  const common = {
    alt,
    sizes: "100vw",
    loading: preload ? "eager" : "lazy",
    fetchPriority: preload ? "high" : "auto",
  } as const;
  const d = getImageProps({ ...common, src: hasD ? desktop : mobile, width: 1920, height: 1080 });
  const m = getImageProps({ ...common, src: hasM ? mobile : desktop, width: 1000, height: 1500 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { srcSet: mobileSet, style: _s, width: _w, height: _h, ...rest } = m.props;
  if (preload) {
    preloadImage(d.props.src, { as: "image", imageSrcSet: d.props.srcSet, imageSizes: "100vw", media: `(min-width: ${breakpoint}px)`, fetchPriority: "high" });
    preloadImage(m.props.src, { as: "image", imageSrcSet: mobileSet, imageSizes: "100vw", media: `(max-width: ${breakpoint - 0.02}px)`, fetchPriority: "high" });
  }
  return (
    <div className={box} data-reveal={reveal ? "clip" : undefined}>
      <picture>
        <source media={`(min-width: ${breakpoint}px)`} srcSet={d.props.srcSet} sizes="100vw" />
        <source srcSet={mobileSet} sizes="100vw" />
        <img {...rest} alt={alt} className={clsx("object-cover", imgClassName)} />
      </picture>
    </div>
  );
}
