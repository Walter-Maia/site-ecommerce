import type { SVGProps } from "react";

/** Ícones de traço fino (1.5) desenhados para a loja. Decorativos por padrão. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7h18M3 12h12M3 17h18" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </Svg>
);
/** Sacola com alça em arco — a mesma do botão de compra rápida. */
export const IconBag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 8.5h15l-1 12h-13z" strokeLinejoin="miter" />
    <path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5" />
  </Svg>
);
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
  </Svg>
);
export const IconHeart = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"
      fill={filled ? "currentColor" : "none"}
      strokeLinejoin="round"
    />
  </Svg>
);
export const IconArrow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Svg>
);
export const IconRuler = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 16.5L16.5 3 21 7.5 7.5 21z" strokeLinejoin="miter" />
    <path d="M7 12.5l2 2M10 9.5l1.5 1.5M13 6.5l2 2" />
  </Svg>
);
export const IconReceipt = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" strokeLinejoin="miter" />
    <path d="M9 8h6M9 12h6" />
  </Svg>
);
export const IconTruck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 6.5h11v10h-11zM13.5 10h4.5l3 3.5v3h-7.5" strokeLinejoin="miter" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17.5" cy="18" r="1.8" />
  </Svg>
);
export const IconSwap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />
  </Svg>
);
export const IconFabric = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4h16v16H4z" strokeLinejoin="miter" />
    <path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" strokeWidth={0.9} />
  </Svg>
);
export const IconPause = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6v12M15 6v12" />
  </Svg>
);
export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5z" strokeLinejoin="miter" />
  </Svg>
);
/** Silhueta 3D (cubo/manequim) para o atalho do provador. */
export const IconCube = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z" strokeLinejoin="miter" />
    <path d="M4 7.4l8 4.6 8-4.6M12 12v9.2" />
  </Svg>
);

export function Stars({ value, size = 12, className }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (
    <svg width={size * 5 + 8} height={size} viewBox="0 0 68 12" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          transform={`translate(${i * 14} 0)`}
          d="M6 .6l1.6 3.6 3.9.4-2.9 2.6.8 3.9L6 9.1l-3.4 2 .8-3.9L.5 4.6l3.9-.4z"
          fill="currentColor"
        />
      ))}
    </svg>
  );
  return (
    <span className={`relative inline-block leading-none ${className ?? ""}`}>
      <span className="text-line">{row}</span>
      <span className="absolute inset-0 overflow-hidden text-ink" style={{ width: `${pct}%` }}>
        {row}
      </span>
    </span>
  );
}
