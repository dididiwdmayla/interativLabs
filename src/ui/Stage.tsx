import { useId, useRef } from "react";
import { toolById } from "@/editor/tools";
import { useUiStore } from "@/editor/useUiStore";
import { useElementSize } from "./useElementSize";

/** Escala provisória do palco até o item 6 (câmera com pinça e enquadrar). */
const PX_PER_MM = 2.5;
const GRID_MM = 10;
const GRID_MAJOR_MM = 50;

interface StageProps {
  figure: number;
  title: string;
}

/**
 * O palco: a prancha onde se desenha. Moldura de fio duplo recuada 8 px;
 * no modo editar o fio interno é traço-ponto (desenho em andamento), na
 * simulação vira contínuo (a prancha impressa, em operação).
 */
export function Stage({ figure, title }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(ref);
  const uid = useId();
  const mode = useUiStore((s) => s.mode);
  const tool = useUiStore((s) => s.tool);
  const editing = mode === "edit";

  const inset = 8;
  const gap = 3;
  const minor = GRID_MM * PX_PER_MM;
  const major = GRID_MAJOR_MM * PX_PER_MM;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const ready = width > 0 && height > 0;

  return (
    <main className="stage" ref={ref} data-mode={mode}>
      {ready && (
        <svg
          className="stage__svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Prancha: ${title}`}
        >
          <defs>
            <radialGradient id={`${uid}v`} cx="50%" cy="48%" r="75%">
              <stop offset="60%" className="stage__vignette-in" />
              <stop offset="100%" className="stage__vignette-out" />
            </radialGradient>
            <pattern
              id={`${uid}g`}
              width={minor}
              height={minor}
              patternUnits="userSpaceOnUse"
              x={cx - minor / 2}
              y={cy - minor / 2}
            >
              <path
                d={`M${minor / 2 - 2.5} ${minor / 2}h5M${minor / 2} ${minor / 2 - 2.5}v5`}
                className="stage__cross"
              />
            </pattern>
            <pattern
              id={`${uid}G`}
              width={major}
              height={major}
              patternUnits="userSpaceOnUse"
              x={cx - major / 2}
              y={cy - major / 2}
            >
              <path
                d={`M${major / 2 - 4.5} ${major / 2}h9M${major / 2} ${major / 2 - 4.5}v9`}
                className="stage__cross stage__cross--major"
              />
            </pattern>
            <clipPath id={`${uid}c`}>
              <rect
                x={inset + gap}
                y={inset + gap}
                width={width - 2 * (inset + gap)}
                height={height - 2 * (inset + gap)}
              />
            </clipPath>
          </defs>

          <rect width={width} height={height} fill={`url(#${uid}v)`} />

          {editing && (
            <g clipPath={`url(#${uid}c)`} className="stage__grid">
              <rect width={width} height={height} fill={`url(#${uid}g)`} />
              <rect width={width} height={height} fill={`url(#${uid}G)`} />
            </g>
          )}

          <rect
            className="stage__frame stage__frame--outer"
            x={inset}
            y={inset}
            width={width - 2 * inset}
            height={height - 2 * inset}
          />
          <rect
            className={`stage__frame stage__frame--inner${editing ? " is-draft" : ""}`}
            x={inset + gap}
            y={inset + gap}
            width={width - 2 * (inset + gap)}
            height={height - 2 * (inset + gap)}
          />

          <text className="stage__fig" x={inset + gap + 14} y={height - inset - gap - 14}>
            <tspan className="stage__fig-script">Fig. {figure}</tspan>
            <tspan className="stage__fig-name" dx="10">
              {title}
            </tspan>
          </text>
        </svg>
      )}
      {editing && (
        <p className="stage__hint" aria-live="polite">
          {toolById(tool).hint}
        </p>
      )}
    </main>
  );
}
