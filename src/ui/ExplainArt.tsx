import { useId, type ReactNode } from "react";
import { assets } from "@/assets/registry";
import { EXPLAIN } from "@/editor/explain";
import type { LinkKind } from "@/model/types";
import "./explain.css";

/**
 * Animação pequena de cada cartão "o que é" (Parte E2d), no traço da
 * prancha: chapas com hachura, ferragens do lote 01 onde cabem, ouro só no
 * que a mão mexeria e brasa na energia (gás, sensor). Laço de CSS só com
 * `transform` e `opacity`; em prefers-reduced-motion, imagem parada.
 */

const W = 200;
const H = 110;

/** Ferragem do lote 01 (imagem do registro), centrada em (x, y), com Ø d. */
function Hw({
  id,
  x,
  y,
  d,
}: {
  id: "hw-axle" | "hw-screw-slot" | "hw-pin" | "hw-sensor";
  x: number;
  y: number;
  d: number;
}) {
  return (
    <image
      href={assets[id].src.x2}
      x={x - d / 2}
      y={y - d / 2}
      width={d}
      height={d}
      preserveAspectRatio="none"
    />
  );
}

/** Chapa com hachura a 45°, recortada pela forma. */
function Plate({ d, uid, className }: { d: string; uid: string; className?: string }) {
  return (
    <g className={className}>
      <path d={d} className="xa-face" />
      <path d={d} className="xa-hatch" fill={`url(#${uid}h)`} />
      <path d={d} className="xa-line" />
    </g>
  );
}

const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;

/** Mola em zigue-zague de comprimento `len` (eixo x), altura `h`. */
function zigzag(len: number, h: number, n = 8): string {
  let d = "M0 0";
  for (let i = 0; i < n; i++) d += `L${((i + 0.5) * len) / n} ${i % 2 ? h / 2 : -h / 2}`;
  return `${d}L${len} 0`;
}

function Scene({ kind, uid }: { kind: LinkKind; uid: string }): ReactNode {
  switch (kind) {
    case "screw":
      return (
        <>
          <Plate d={rect(20, 64, 160, 22)} uid={uid} className="xa-fixed" />
          <g className="xa-move xa-move--pair">
            <Plate d={rect(52, 40, 64, 26)} uid={uid} />
            <Plate d={rect(86, 30, 62, 18)} uid={uid} />
            <Hw id="hw-screw-slot" x={100} y={44} d={13} />
          </g>
        </>
      );
    case "axle":
      return (
        <>
          <Plate d={rect(20, 72, 160, 22)} uid={uid} className="xa-fixed" />
          <g className="xa-spin" style={{ transformOrigin: "100px 56px" }}>
            <Plate d="M100 50L170 53L170 59L100 62Q94 56 100 50Z" uid={uid} />
            <circle cx={100} cy={56} r={9} className="xa-face xa-line" />
          </g>
          <Hw id="hw-axle" x={100} y={56} d={15} />
        </>
      );
    case "pin":
      return (
        <>
          <g className="xa-pushed">
            <Plate d={rect(108, 58, 56, 30)} uid={uid} className="xa-lower" />
          </g>
          <g className="xa-pusher">
            <Plate d={rect(30, 30, 70, 22)} uid={uid} />
            <path d="M92 52V72" className="xa-dash" />
            <circle cx={92} cy={72} r={5} className="xa-face xa-line" />
            <Hw id="hw-pin" x={92} y={41} d={10} />
          </g>
        </>
      );
    case "slot":
      return (
        <>
          <Plate
            d={`${rect(20, 34, 160, 42)}M46 49H154A6 6 0 0 1 154 61H46A6 6 0 0 1 46 49Z`}
            uid={uid}
            className="xa-fixed"
          />
          <path d="M40 55H160" className="xa-center" />
          <g className="xa-run xa-run--slot">
            <circle cx={46} cy={55} r={5} className="xa-face xa-line" />
            <Hw id="hw-pin" x={46} y={55} d={9} />
          </g>
        </>
      );
    case "slider":
      return (
        <>
          <path d="M28 48H172M28 68H172" className="xa-line" />
          <path d="M20 58H180" className="xa-center" />
          <rect x={24} y={44} width={5} height={28} className="xa-stop" />
          <rect x={171} y={44} width={5} height={28} className="xa-stop" />
          <g className="xa-run xa-run--slider">
            <Plate d={rect(30, 50, 36, 16)} uid={uid} />
          </g>
        </>
      );
    case "rod":
      return (
        <>
          <Plate d={rect(20, 82, 160, 16)} uid={uid} className="xa-fixed" />
          <g className="xa-spin" style={{ transformOrigin: "52px 50px" }}>
            <circle cx={52} cy={50} r={20} className="xa-face xa-line" />
            <circle cx={68} cy={50} r={2.5} className="xa-line" />
          </g>
          <Hw id="hw-axle" x={52} y={50} d={12} />
          <g className="xa-rod" style={{ transformOrigin: "68px 50px" }}>
            <rect x={66} y={47.5} width={74} height={5} rx={2.5} className="xa-face xa-line" />
          </g>
          <g className="xa-run xa-run--rod">
            <Plate d={rect(132, 40, 30, 20)} uid={uid} />
          </g>
        </>
      );
    case "cable":
      return (
        <>
          <Plate d={rect(40, 10, 120, 12)} uid={uid} className="xa-fixed" />
          <g className="xa-stretch" style={{ transformOrigin: "100px 22px" }}>
            <path d="M100 22V66" className="xa-cable" />
          </g>
          <g className="xa-hang">
            <Plate d={rect(88, 66, 24, 20)} uid={uid} />
          </g>
        </>
      );
    case "mount":
      return (
        <>
          <Plate d={rect(20, 74, 160, 18)} uid={uid} className="xa-fixed" />
          <g className="xa-wobble" style={{ transformOrigin: "100px 74px" }}>
            <Plate d={rect(70, 40, 60, 30)} uid={uid} />
            <rect x={92} y={68} width={16} height={7} className="xa-mount" />
          </g>
        </>
      );
    case "spring":
      return (
        <>
          <Plate d={rect(20, 36, 18, 44)} uid={uid} className="xa-fixed" />
          <g className="xa-coil" style={{ transformOrigin: "38px 58px" }}>
            <path d={zigzag(70, 20)} transform="translate(38 58)" className="xa-spring" />
          </g>
          <g className="xa-run xa-run--spring">
            <Plate d={rect(108, 42, 30, 32)} uid={uid} />
          </g>
        </>
      );
    case "lock":
      return (
        <>
          <Plate d={rect(20, 20, 160, 18)} uid={uid} className="xa-fixed" />
          <g className="xa-fall" style={{ transformOrigin: "70px 38px" }}>
            <Plate d={rect(64, 38, 90, 16)} uid={uid} />
          </g>
          <Hw id="hw-axle" x={70} y={46} d={10} />
          <g className="xa-latch">
            <rect x={136} y={30} width={10} height={22} className="xa-face xa-line" />
            <path d="M136 41H146" className="xa-line" />
          </g>
        </>
      );
    case "chamber":
      return (
        <>
          <path d="M20 40H180M20 72H180" className="xa-line" />
          <path d="M14 56H186" className="xa-center" />
          <g className="xa-gas" style={{ transformOrigin: "100px 56px" }}>
            <rect x={84} y={41} width={32} height={30} className="xa-ember" />
          </g>
          <g className="xa-wall xa-wall--a">
            <Plate d={rect(64, 41, 18, 30)} uid={uid} />
          </g>
          <g className="xa-wall xa-wall--b">
            <Plate d={rect(118, 41, 18, 30)} uid={uid} />
          </g>
        </>
      );
    case "sensor":
      return (
        <>
          <Plate d={rect(20, 80, 160, 14)} uid={uid} className="xa-fixed" />
          <g className="xa-flash">
            <circle cx={140} cy={56} r={16} className="xa-zone" />
          </g>
          <circle cx={140} cy={56} r={16} className="xa-zone xa-zone--idle" />
          <Hw id="hw-sensor" x={140} y={56} d={11} />
          <g className="xa-run xa-run--ball">
            <circle cx={36} cy={56} r={8} className="xa-face xa-line" />
          </g>
        </>
      );
  }
}

/**
 * Biela e manivela de verdade (raio 16, haste 72): as poses da haste e do
 * bloco em 12 quadros-chave, para a haste não "escorregar" do pino.
 */
function rodKeyframes(): string {
  const r = 16;
  const L = 72;
  const n = 12;
  let rod = "";
  let block = "";
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    const px = 52 + r * Math.cos(a);
    const py = 50 + r * Math.sin(a);
    const bx = px + Math.sqrt(L * L - (py - 50) ** 2);
    const phi = (Math.atan2(50 - py, bx - px) * 180) / Math.PI;
    const pct = ((100 * i) / n).toFixed(2);
    rod += `${pct}%{transform:translate(${(px - 68).toFixed(2)}px,${(py - 50).toFixed(2)}px) rotate(${phi.toFixed(2)}deg)}`;
    block += `${pct}%{transform:translateX(${(bx - 140).toFixed(2)}px)}`;
  }
  return `@keyframes xa-rod{${rod}}@keyframes xa-rodblock{${block}}`;
}
const ROD_KEYFRAMES = rodKeyframes();

/** A animação do cartão de `kind`. */
export function ExplainArt({ kind }: { kind: LinkKind }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      className="explainart"
      data-kind={kind}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={EXPLAIN[kind].shows}
    >
      <defs>
        <pattern
          id={`${uid}h`}
          patternUnits="userSpaceOnUse"
          width="5"
          height="5"
          patternTransform="rotate(45)"
        >
          <path d="M0 0V5" className="xa-hatchline" />
        </pattern>
      </defs>
      {kind === "rod" && <style>{ROD_KEYFRAMES}</style>}
      <Scene kind={kind} uid={uid} />
    </svg>
  );
}
