import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PartPose } from "@/engine/types";
import type { Handle } from "@/editor/handles";
import type { SnapGuide } from "@/editor/snap";
import type { Vec2 } from "@/geometry/vec";
import { poseTransform, type StageNodes } from "@/render/nodes";

/**
 * Camada de edição por cima da cena, no espaço do mundo: as alças da peça
 * selecionada (ouro fino, alvo de 44 px), a guia do encaixe (tracejado em
 * ouro), o contorno de prévia do esticar e o fantasma da peça que vem da
 * gaveta. Durante o gesto, só `transform` e `d` mudam, direto nos nós.
 */

export interface OverlayHandle {
  /** pose da seleção durante o gesto (null: a desenhada) */
  pose(p: PartPose | null): void;
  guides(g: SnapGuide[]): void;
  /** contorno de prévia no espaço local da peça (esticar) */
  preview(d: string | null): void;
  /** fantasma da peça que entra, com a pose no mundo */
  ghost(d: string | null, pose?: PartPose): void;
}

interface Props {
  nodes: StageNodes;
  size: { width: number; height: number };
  /** mm por px de tela */
  px: number;
  /** pose desenhada da peça selecionada e as alças dela */
  selection: { pose: PartPose; handles: Handle[]; d: string } | null;
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();
const FAR = 4000;

function guidePath(g: SnapGuide[], px: number): { lines: string; marks: string } {
  let lines = "";
  let marks = "";
  const r = 5 * px;
  for (const x of g) {
    if (x.kind === "line") {
      const a: Vec2 = [x.p[0] - x.u[0] * FAR, x.p[1] - x.u[1] * FAR];
      const b: Vec2 = [x.p[0] + x.u[0] * FAR, x.p[1] + x.u[1] * FAR];
      lines += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
    } else if (x.kind === "edge") {
      const dx = x.b[0] - x.a[0];
      const dy = x.b[1] - x.a[1];
      const L = Math.hypot(dx, dy) || 1;
      const e = 30 * px;
      lines += `M${f(x.a[0] - (dx / L) * e)} ${f(x.a[1] - (dy / L) * e)}L${f(x.b[0] + (dx / L) * e)} ${f(x.b[1] + (dy / L) * e)}`;
      marks += `M${f(x.at[0] - r)} ${f(x.at[1] - r)}h${f(2 * r)}v${f(2 * r)}h${f(-2 * r)}Z`;
    } else if (x.kind === "point") {
      const [cx, cy] = x.at;
      const L = 18 * px;
      lines += `M${f(cx - L)} ${f(cy)}H${f(cx + L)}M${f(cx)} ${f(cy - L)}V${f(cy + L)}`;
      // centro: cruz dentro de círculo; vértice: quadrado
      if (x.target === "vertex") marks += `M${f(cx - r)} ${f(cy - r)}h${f(2 * r)}v${f(2 * r)}h${f(-2 * r)}Z`;
      else
        marks += `M${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}Z`;
    } else if (x.kind === "grid") {
      const [cx, cy] = x.at;
      const s = 4 * px;
      marks += `M${f(cx - s)} ${f(cy)}H${f(cx + s)}M${f(cx)} ${f(cy - s)}V${f(cy + s)}`;
    }
  }
  return { lines, marks };
}

export const EditOverlay = forwardRef<OverlayHandle, Props>(function EditOverlay(
  { nodes, size, px, selection },
  ref,
) {
  const sel = useRef<SVGGElement>(null);
  const prev = useRef<SVGPathElement>(null);
  const lines = useRef<SVGPathElement>(null);
  const marks = useRef<SVGPathElement>(null);
  const ghostG = useRef<SVGGElement>(null);
  const ghostP = useRef<SVGPathElement>(null);
  const base = selection?.pose ?? null;

  useImperativeHandle(
    ref,
    () => ({
      pose(p) {
        const q = p ?? base;
        if (q) sel.current?.setAttribute("transform", poseTransform(q));
      },
      guides(g) {
        const { lines: l, marks: m } = guidePath(g, px);
        lines.current?.setAttribute("d", l);
        marks.current?.setAttribute("d", m);
      },
      preview(d) {
        prev.current?.setAttribute("d", d ?? "");
      },
      ghost(d, pose) {
        if (!ghostG.current || !ghostP.current) return;
        ghostP.current.setAttribute("d", d ?? "");
        if (pose) ghostG.current.setAttribute("transform", poseTransform(pose));
      },
    }),
    [base, px],
  );

  const hr = 5 * px;
  return (
    <svg
      className="stage__sheet stage__sheet--edit scene"
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-hidden="true"
    >
      <g className="world" ref={nodes.refWorld("edit")}>
        <path className="snapguide" ref={lines} />
        <path className="snapmark" ref={marks} />
        {selection && (
          <g ref={sel} transform={poseTransform(selection.pose)} className="handles">
            <path className="handles__preview" ref={prev} />
            {selection.handles.map((h) =>
              h.kind === "rotate" ? (
                <g
                  key={h.id}
                  transform={`translate(${f(h.local[0])} ${f(h.local[1])})`}
                  className="handle--rotate"
                >
                  <path d={`M0 ${f(26 * px)}V${f(hr)}`} className="handles__stem" />
                  <path
                    d={`M${f(-7 * px)} ${f(2 * px)}A${f(8 * px)} ${f(8 * px)} 0 1 1 ${f(7 * px)} ${f(2 * px)}`}
                    className="handles__arc"
                  />
                  <path
                    d={`M${f(7 * px)} ${f(2 * px)}l${f(-3.5 * px)} ${f(-1 * px)}l${f(4.5 * px)} ${f(-3.5 * px)}Z`}
                    className="handles__tip"
                  />
                </g>
              ) : (
                <circle key={h.id} cx={h.local[0]} cy={h.local[1]} r={hr} className="handles__dot" />
              ),
            )}
          </g>
        )}
        <g ref={ghostG} className="ghost">
          <path ref={ghostP} className="ghost__path" />
        </g>
      </g>
    </svg>
  );
});
