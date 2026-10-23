/**
 * Wordmark KIM KRISS® — letras condensadas em itálico (skew de 12°) dentro do selo
 * vermelho. Desenhado em grade própria (altura de letra 20u, traço 3,8u) para ficar
 * legível a partir de 24px de altura. O monograma KK de src/app/icon.svg usa os mesmos K.
 */
const LETTERS =
  "M7 5H10.8V25H7ZM10.8 12.6L16.2 5L20.2 5L13.2 14.6L20.2 25L16.2 25L10.8 17.2ZM21.7 5H25.5V25H21.7ZM27 5H31.6L34.8 11.4L38 5H42.6V25H38.8V12.6L36.6 17H33L30.8 12.6V25H27ZM50.6 5H54.4V25H50.6ZM54.4 12.6L59.8 5L63.8 5L56.8 14.6L63.8 25L59.8 25L54.4 17.2ZM65.3 5L75.1 5L78.3 8.2L78.3 14.2L75.1 17.4L69.1 17.4L69.1 25L65.3 25ZM69.1 8.8L69.1 13.6L74.5 13.6L74.5 8.8ZM79.8 5H83.6V25H79.8ZM88.3 5H98.1V8.8H88.9V13.2H94.9L98.1 16.4V21.8L94.9 25H85.1V21.2H94.3V17H88.3L85.1 13.8V8.2ZM102.8 5H112.6V8.8H103.4V13.2H109.4L112.6 16.4V21.8L109.4 25H99.6V21.2H108.8V17H102.8L99.6 13.8V8.2Z";
const OVERLAYS = "M70.3 17L74.3 17L78.3 25L74.3 25Z";
const REG_R = "M116.40 7.9V5.3H117.35A.65 .65 0 0 1 117.35 6.6H116.40M117.30 6.6L118.10 7.9";

interface LogoProps {
  className?: string;
  /** Texto acessível; passe "" quando o contexto já nomeia o logo (ex.: link com aria-label). */
  title?: string;
  /** "seal" = selo vermelho com letras brancas; "ink" = só as letras, na cor atual. */
  variant?: "seal" | "ink";
}

export function Logo({ className, title = "KIM KRISS®", variant = "seal" }: LogoProps) {
  const fg = variant === "seal" ? "#fff" : "currentColor";
  const decorative = title === "";
  return (
    <svg
      viewBox="0 0 129.18 30"
      className={className}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
    >
      <g transform="translate(6.38 0) skewX(-12)">
        {variant === "seal" && <path d="M0 0H122.8V30H0Z" fill="var(--signal)" />}
        <path fill={fg} fillRule="evenodd" d={LETTERS} />
        <path fill={fg} d={OVERLAYS} />
        <g fill="none" stroke={fg} strokeWidth=".75">
          <circle cx="117.2" cy="6.6" r="2.4" />
          <path d={REG_R} />
        </g>
      </g>
    </svg>
  );
}
