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
  | "chevron"
  | "fit"
  | "pause"
  | "play"
  | "step"
  | "restart"
  | "xray"
  | "close"
  | "fullscreen"
  | "share"
  | "tips"
  | "lefty"
  | "examples"
  | "parts"
  | "layerAdd"
  | "duplicate"
  | "trash"
  | "rotate"
  | "mirror"
  | "lock"
  | "unlock"
  | "eye"
  | "eyeOff"
  | "grip"
  | "minus"
  | "plus"
  | "details"
  | "export"
  | "import"
  | "fixed"
  | "loose"
  | "pencil"
  | "up"
  | "down";

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
  // enquadrar: quatro cantos de moldura em volta de uma cruz de centro
  fit: () => (
    <>
      <path d="M3.75 8.5V3.75H8.5M15.5 3.75H20.25V8.5M20.25 15.5V20.25H15.5M8.5 20.25H3.75V15.5" />
      <path d="M12 8.5V15.5M8.5 12H15.5" className="thin" />
    </>
  ),
  pause: () => (
    <>
      <rect x="6.5" y="5" width="3.5" height="14" className="fillInk" />
      <rect x="14" y="5" width="3.5" height="14" className="fillInk" />
    </>
  ),
  play: () => <path d="M7 4.5L19 12L7 19.5Z" className="fillInk" />,
  step: () => (
    <>
      <path d="M5.5 5L15 12L5.5 19Z" className="fillInk" />
      <path d="M18 5V19" />
    </>
  ),
  restart: () => (
    <>
      <path d="M6.4 8.2A7 7 0 1 1 5 12.5" />
      <path d="M3 4.5L8.6 5.2L6.4 10.4Z" className="fillInk" />
    </>
  ),
  // raio-x: duas pranchas só em contorno, a de trás em linha oculta
  xray: () => (
    <>
      <rect x="7.75" y="3.75" width="12.5" height="10.5" className="dashed" />
      <rect x="3.75" y="9.75" width="12.5" height="10.5" />
    </>
  ),
  close: () => <path d="M6 6L18 18M18 6L6 18" />,
  // tela cheia: quatro cantos com setas para fora
  fullscreen: () => (
    <>
      <path d="M3.75 9V3.75H9M15 3.75H20.25V9M20.25 15V20.25H15M9 20.25H3.75V15" />
      <path d="M4.5 4.5L9.5 9.5M19.5 4.5L14.5 9.5M19.5 19.5L14.5 14.5M4.5 19.5L9.5 14.5" className="thin" />
    </>
  ),
  // Compartilhar do Safari: bandeja aberta com seta para cima
  share: () => (
    <>
      <path d="M8.5 9.25H5.75V21H18.25V9.25H15.5" />
      <path d="M12 2.75V15" />
      <path d="M8.25 6.25L12 2.5L15.75 6.25" />
    </>
  ),
  // dica: número de chamada com a linha até o ponto
  tips: () => (
    <>
      <circle cx="8.5" cy="8.5" r="5.75" />
      <path d="M8.5 7V11.5M8.5 4.9V5.6" />
      <path d="M12.6 12.6C15 15 16.5 16.8 19 19.5" className="thin" />
      <circle cx="19.25" cy="19.75" r="1.1" className="fillInk" />
    </>
  ),
  // canhoto: os dois lados trocam
  lefty: () => (
    <>
      <path d="M4 8.5H19M15.5 5L19.25 8.5L15.5 12" />
      <path d="M20 15.5H5M8.5 12L4.75 15.5L8.5 19" />
    </>
  ),
  // exemplos: prancha com a figura e o "Fig." embaixo
  examples: (c) => (
    <>
      <rect x="3.75" y="2.75" width="16.5" height="18.5" />
      {c.hatch(<circle cx="12" cy="10.5" r="4.25" />, "ex")}
      <circle cx="12" cy="10.5" r="4.25" />
      <path d="M7 18H11M13 18H17" className="thin" />
    </>
  ),
  // peças prontas: bandeja com uma placa e um disco
  parts: (c) => (
    <>
      <path d="M2.75 13.75V20.25H21.25V13.75" />
      {c.hatch(<rect x="4.75" y="7.75" width="8.5" height="8.5" />, "pt")}
      <rect x="4.75" y="7.75" width="8.5" height="8.5" />
      <circle cx="17.25" cy="10" r="3.5" className="fillStage" />
      <circle cx="17.25" cy="10" r="1" className="thin" />
    </>
  ),
  layerAdd: () => (
    <>
      <rect x="7.75" y="2.75" width="13.5" height="9.5" className="thin" />
      <rect x="2.75" y="7.75" width="13.5" height="9.5" className="fillStage" />
      <path d="M18.5 15.5V21.5M15.5 18.5H21.5" />
    </>
  ),
  duplicate: (c) => (
    <>
      <rect x="8.75" y="2.75" width="12.5" height="12.5" className="thin" />
      {c.hatch(<rect x="2.75" y="8.75" width="12.5" height="12.5" />, "du")}
      <rect x="2.75" y="8.75" width="12.5" height="12.5" />
    </>
  ),
  trash: () => (
    <>
      <path d="M3.5 6.25H20.5M9 6V3.25H15V6" />
      <path d="M5.75 6.25L7 21H17L18.25 6.25" />
      <path d="M10 9.5V17.75M14 9.5V17.75" className="thin" />
    </>
  ),
  // girar 90°: arco de um quarto com ponta de seta
  rotate: () => (
    <>
      <path d="M5 12A7 7 0 0 1 12 5H14" />
      <path d="M13.5 1.75L18 5L13.5 8.25Z" className="fillInk" />
      <rect x="7.75" y="10.75" width="10.5" height="10.5" className="thin" />
    </>
  ),
  // espelhar: eixo em traço-ponto e duas metades
  mirror: (c) => (
    <>
      <path d="M12 2V5M12 7V8M12 10V14M12 16V17M12 19V22" className="thin" />
      {c.hatch(<path d="M9.75 5.5V18.5L3 18.5Z" />, "mi")}
      <path d="M9.75 5.5V18.5L3 18.5Z" />
      <path d="M14.25 5.5V18.5L21 18.5Z" />
    </>
  ),
  lock: () => (
    <>
      <rect x="4.75" y="10.75" width="14.5" height="10.5" />
      <path d="M8 10.5V7.5C8 5.3 9.8 3.5 12 3.5C14.2 3.5 16 5.3 16 7.5V10.5" />
      <path d="M12 14.5V17.5" />
    </>
  ),
  unlock: () => (
    <>
      <rect x="4.75" y="10.75" width="14.5" height="10.5" />
      <path d="M8 10.5V7.5C8 5.3 9.8 3.5 12 3.5C14 3.5 15.5 4.9 15.9 6.75" />
      <path d="M12 14.5V17.5" />
    </>
  ),
  eye: () => (
    <>
      <path d="M2.5 12C5 7.5 8.5 5.5 12 5.5C15.5 5.5 19 7.5 21.5 12C19 16.5 15.5 18.5 12 18.5C8.5 18.5 5 16.5 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="1" className="fillInk" />
    </>
  ),
  eyeOff: () => (
    <>
      <path
        d="M2.5 12C5 7.5 8.5 5.5 12 5.5C15.5 5.5 19 7.5 21.5 12C19 16.5 15.5 18.5 12 18.5C8.5 18.5 5 16.5 2.5 12Z"
        className="dashed"
      />
      <path d="M4 20L20 4" />
    </>
  ),
  grip: () => <path d="M7 8.5H17M7 12H17M7 15.5H17" className="thin" />,
  minus: () => <path d="M5 12H19" />,
  plus: () => <path d="M12 5V19M5 12H19" />,
  // detalhes: cotas com valores
  details: () => (
    <>
      <path d="M3 6.5H21M3 12H21M3 17.5H21" className="thin" />
      <path d="M7 4.25V8.75M15 9.75V14.25M10 15.25V19.75" />
    </>
  ),
  export: () => (
    <>
      <path d="M4 13.5V20.25H20V13.5" />
      <path d="M12 3V15M7.75 7.25L12 3L16.25 7.25" />
    </>
  ),
  import: () => (
    <>
      <path d="M4 13.5V20.25H20V13.5" />
      <path d="M12 3V15M7.75 10.75L12 15L16.25 10.75" />
    </>
  ),
  // fixa: o símbolo de apoio (traço com tiques a 45°)
  fixed: (c) => (
    <>
      {c.hatch(<rect x="5.75" y="3.75" width="12.5" height="9.5" />, "fx")}
      <rect x="5.75" y="3.75" width="12.5" height="9.5" />
      <path d="M12 13.5V16.5M5 16.5H19" />
      <path
        d="M7 16.5L4.75 19.25M10 16.5L7.75 19.25M13 16.5L10.75 19.25M16 16.5L13.75 19.25M19 16.5L16.75 19.25"
        className="thin"
      />
    </>
  ),
  // solta: a peça com setas de movimento
  loose: (c) => (
    <>
      {c.hatch(<rect x="6.75" y="6.75" width="10.5" height="10.5" />, "lo")}
      <rect x="6.75" y="6.75" width="10.5" height="10.5" />
      <path d="M12 1.75V4.5M12 19.5V22.25M1.75 12H4.5M19.5 12H22.25" className="thin" />
    </>
  ),
  pencil: () => (
    <>
      <path d="M4 20L5 15.5L16 4.5L19.5 8L8.5 19Z" />
      <path d="M13.75 6.75L17.25 10.25" className="thin" />
      <path d="M4 20H20" className="thin" />
    </>
  ),
  up: () => (
    <>
      <path d="M12 20V5" />
      <path d="M6.5 10L12 4.5L17.5 10" />
    </>
  ),
  down: () => (
    <>
      <path d="M12 4V19" />
      <path d="M6.5 14L12 19.5L17.5 14" />
    </>
  ),
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
