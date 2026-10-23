import type { SVGProps } from "react";

/**
 * Ícones de traço (24×24, currentColor). Sem hooks: servem para Server e Client Components.
 * Decorativos por padrão — o nome acessível fica no botão.
 */
const PATHS = {
  rotate: "M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5",
  play: "M8 5.5v13l10.5-6.5z",
  pause: "M8.5 5.5v13M15.5 5.5v13",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  collapse: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  close: "M6 6l12 12M18 6L6 18",
  heart: "M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.3 15.3 20 20",
  left: "M14.5 6l-6 6 6 6",
  right: "M9.5 6l6 6-6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  keyboard: "M3.5 7h17v10h-17zM7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8",
  bookmark: "M6.5 4h11v16l-5.5-4-5.5 4z",
  plus: "M12 5v14M5 12h14",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, filled = false, ...rest }: { name: IconName; size?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  const solid = filled || name === "play";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill={solid ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
