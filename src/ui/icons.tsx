import type { ReactNode } from "react";

/**
 * Ícones desenhados no projeto, como pequenas pranchas de patente:
 * grade de 24 px, traço de 1,5 px, pontas retas, superfícies com 2 a 4
 * linhas de hachura a 45°. O ícone de cada ligação é o próprio símbolo
 * dela no palco (docs/identidade/identidade.md, "Interface").
 *
 * Cada desenho recebe `hatch(clipId)` para recortar a hachura na forma.
 */

export type IconName =
  | "select"
  | "rect"
  | "circle"
  | "poly"
  | "free"
  | "gear"
  | "screw"
  | "axle"
  | "pin"
  | "slider"
  | "spring"
  | "chamber"
  | "sensor"
  | "menu"
  | "undo"
  | "redo"
  | "layers"
  | "chevron";

/** Linhas a 45° cobrindo a grade inteira; recortadas pela forma de cada ícone. */
function hatchLines(spacing: number, offset = 0): string {
  let d = "";
  for (let c = -24 + offset; c <= 24; c += spacing) {
    d += `M${c} 24L${c + 24} 0`;
  }
  return d;
}

const HATCH_5 = hatchLines(5, 1);
const HATCH_4 = hatchLines(4, 0.5);

function gearPath(cx: number, cy: number, teeth: number, rRoot: number, rTip: number): string {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const at = (r: number, t: number) => {
      const ang = a + t * step;
      return `${(cx + r * Math.cos(ang)).toFixed(2)} ${(cy + r * Math.sin(ang)).toFixed(2)}`;
    };
    pts.push(at(rRoot, 0), at(rRoot, 0.2), at(rTip, 0.32), at(rTip, 0.58), at(rRoot, 0.7));
  }
  return `M${pts.join("L")}Z`;
}

const GEAR = gearPath(12, 12, 9, 7.2, 9.8);

function springPath(): { front: string; back: string } {
  // Mola de compressão vista de lado: frente em traço cheio, costas finas.
  let front = "";
  let back = "";
  const x0 = 4.5;
  const pitch = 3;
  for (let i = 0; i < 5; i++) {
    const x = x0 + i * pitch;
    front += `M${x} 17L${x + pitch / 2 + 0.5} 7`;
    back += `M${x + pitch / 2 + 0.5} 7L${x + pitch} 17`;
  }
  return { front, back };
}

const SPRING = springPath();

interface DrawCtx {
  clip: (id: string) => string;
  hatch: (shape: ReactNode, key: string, dense?: boolean) => ReactNode;
}

const ICONS: Record<IconName, (c: DrawCtx) => ReactNode> = {
  select: (c) => {
    const d = "M6.5 3.5V18.5L10.4 15L13 20.75L15.4 19.7L12.85 14H17.75Z";
    return (
      <>
        {c.hatch(<path d={d} />, "s")}
        <path d={d} strokeLinejoin="miter" />
      </>
    );
  },
  rect: (c) => (
    <>
      {c.hatch(<rect x="3.75" y="6.75" width="16.5" height="10.5" />, "r")}
      <rect x="3.75" y="6.75" width="16.5" height="10.5" />
      <path d="M5.25 19.5H20.25" className="thin" />
    </>
  ),
  circle: () => (
    <>
      <circle cx="12" cy="12" r="7.25" />
      <path
        d="M12 2V5M12 7.5V8.5M12 10.5V13.5M12 15.5V16.5M12 19V22M2 12H5M7.5 12H8.5M10.5 12H13.5M15.5 12H16.5M19 12H22"
        className="thin"
      />
    </>
  ),
  poly: (c) => {
    const d = "M4.5 17L7.5 5L15.5 4L20 11.5L14 20Z";
    return (
      <>
        {c.hatch(<path d={d} />, "p")}
        <path d={d} strokeLinejoin="miter" />
        <path
          d="M3.25 15.75h2.5v2.5h-2.5zM6.25 3.75h2.5v2.5h-2.5zM14.25 2.75h2.5v2.5h-2.5zM18.75 10.25h2.5v2.5h-2.5zM12.75 18.75h2.5v2.5h-2.5z"
          className="node"
        />
      </>
    );
  },
  free: (c) => {
    const d =
      "M5 14.5C3.6 10.2 6.4 5.2 11 5.6C14.3 5.9 14.1 8.9 17.2 8.6C20.2 8.3 21 12.3 19 15.2C16.8 18.3 12.7 19.6 9.4 18.6C7.3 18 5.6 16.5 5 14.5Z";
    return (
      <>
        {c.hatch(<path d={d} />, "f")}
        <path d={d} strokeLinejoin="round" />
      </>
    );
  },
  gear: (c) => (
    <>
      {c.hatch(<path d={GEAR} />, "g")}
      <path d={GEAR} strokeLinejoin="miter" />
      <circle cx="12" cy="12" r="2.6" className="fillStage" />
    </>
  ),
  screw: () => (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="6.25" className="thin" />
      <path d="M5.75 10.75H18.25M5.75 13.25H18.25" />
      <path
        d="M7.5 11.25L8.75 12.75M10 11.25L11.25 12.75M12.5 11.25L13.75 12.75M15 11.25L16.25 12.75"
        className="thin"
      />
    </>
  ),
  axle: (c) => (
    <>
      <path d="M12 1.5V5M12 7V8M12 16V17M12 19V22.5M1.5 12H5M7 12H8M16 12H17M19 12H22.5" className="thin" />
      <circle cx="12" cy="12" r="6.5" />
      {c.hatch(<circle cx="12" cy="12" r="3" />, "a", true)}
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  pin: (c) => (
    <>
      <circle cx="12" cy="12" r="8.5" className="dashed" />
      {c.hatch(<circle cx="12" cy="12" r="4.5" />, "pa", true)}
      <g transform="matrix(-1 0 0 1 24 0)">{c.hatch(<circle cx="12" cy="12" r="4.5" />, "pb", true)}</g>
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
  slider: (c) => (
    <>
      <path d="M2 7.25H22M2 16.75H22" className="thin" />
      <path d="M1.5 12H4.5M6.5 12H7.5M17 12H18M20 12H22.5" className="thin" />
      {c.hatch(<rect x="8.75" y="8.75" width="6.5" height="6.5" />, "sl")}
      <rect x="8.75" y="8.75" width="6.5" height="6.5" />
      <path d="M3.25 5V19M20.75 5V19" />
    </>
  ),
  spring: () => (
    <>
      <path d={SPRING.back} className="thin" />
      <path d={SPRING.front} />
      <path d="M2 17H4.5M19.5 17H22" />
    </>
  ),
  chamber: (c) => (
    <>
      {c.hatch(<path d="M2.5 5.5H21.5V8H5V16H21.5V18.5H2.5Z" />, "cw", true)}
      <path d="M2.5 5.5H21.5M2.5 18.5H21.5M2.5 5.5V18.5M5 8H21.5M5 16H21.5M5 8V16" />
      <rect x="13.5" y="8" width="3.5" height="8" />
      <path
        d="M7 10.25h.01M9 12.5h.01M7.5 14h.01M10.5 10.5h.01M11.25 13.75h.01M8.75 9.5h.01"
        className="dot"
      />
    </>
  ),
  sensor: () => (
    <>
      <circle cx="12" cy="12" r="5.25" className="dashed" />
      <path d="M12 2.25V5M12 19V21.75M2.25 12H5M19 12H21.75M5.1 5.1L7 7M17 17L18.9 18.9M5.1 18.9L7 17M17 7L18.9 5.1" />
      <circle cx="12" cy="12" r="1" className="fillInk" />
    </>
  ),
  menu: () => <path d="M4 7H20M4 12H20M4 17H14" />,
  undo: () => (
    <>
      <path d="M8.5 9.5H15C17.8 9.5 20 11.7 20 14.5C20 17.3 17.8 19.5 15 19.5H10" />
      <path d="M4 9.5L9 5V14Z" className="fillInk" />
    </>
  ),
  redo: () => (
    <>
      <path d="M15.5 9.5H9C6.2 9.5 4 11.7 4 14.5C4 17.3 6.2 19.5 9 19.5H14" />
      <path d="M20 9.5L15 5V14Z" className="fillInk" />
    </>
  ),
  layers: () => (
    <>
      <rect x="7.75" y="2.75" width="13.5" height="10.5" className="thin" />
      <rect x="5.25" y="6.75" width="13.5" height="10.5" className="fillStage thin" />
      <rect x="2.75" y="10.75" width="13.5" height="10.5" className="fillStage" />
      <rect x="4.5" y="12.5" width="10" height="7" className="thin" />
    </>
  ),
  chevron: () => <path d="M6 14.5L12 9L18 14.5" />,
};

interface IconProps {
  name: IconName;
  size?: number;
  /** id único da instância (React useId), usado nos clipPath da hachura */
  uid: string;
}

export function Icon({ name, size = 24, uid }: IconProps) {
  const clip = (k: string) => `${uid}-${k}`;
  const ctx: DrawCtx = {
    clip,
    hatch: (shape, key, dense) => (
      <g key={key}>
        <clipPath id={clip(key)}>{shape}</clipPath>
        <path d={dense ? HATCH_4 : HATCH_5} clipPath={`url(#${clip(key)})`} className="hatch" />
      </g>
    ),
  };
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICONS[name](ctx)}
    </svg>
  );
}
