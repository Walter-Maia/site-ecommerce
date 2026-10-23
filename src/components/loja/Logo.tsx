import Image from "next/image";
import { SITE } from "@/data/site";

/**
 * Selo da loja KIM & KRIS (arte fornecida pela cliente, redesenhada em alta
 * resolução com fundo transparente em public/images/brand/). É o logo da LOJA:
 * as peças à venda não levam esse selo.
 */
interface LogoProps {
  className?: string;
  /** Texto alternativo; passe "" quando o contexto já nomeia o logo (ex.: link com aria-label). */
  title?: string;
  /** "sm" (cabeçalho, menu) usa o arquivo de 256 px; "lg" (rodapé) o de 512 px. */
  size?: "sm" | "lg";
  priority?: boolean;
}

export function Logo({ className, title = SITE.name, size = "sm", priority = false }: LogoProps) {
  const px = size === "sm" ? 256 : 512;
  return (
    <Image
      src={`/images/brand/kim-e-kris-selo-${px}.webp`}
      alt={title}
      width={px}
      height={px}
      sizes={size === "sm" ? "48px" : "(min-width: 768px) 176px, 112px"}
      priority={priority}
      className={className}
    />
  );
}
