import { assets } from "@/assets/registry";
import { coilCount, coilMetrics } from "@/render/geometry";
import type { HammerPoint, HammerTool } from "@/editor/hammer";
import { toScreen, viewMatrix, mmPerPx, type View } from "@/render/view";
import type { Vec2 } from "@/geometry/vec";
import { Icon } from "./icons";

/**
 * Prévia do Martelo: as duas peças realçadas em ouro (a de cima cheia, a de
 * baixo tracejada), a ferragem fantasma no ponto e, com o cursor deslocado
 * aceso, a mira (anel em ouro com cruz fina) e a linha fina até o dedo.
 * Só `transform` e `opacity` se animam.
 */
export function HammerPreview({
  hit,
  start,
  tool,
  view,
  finger,
  raw,
  stamped,
}: {
  hit: HammerPoint;
  start?: HammerPoint;
  tool: HammerTool;
  view: View;
  /** dedo, px do palco, quando o cursor deslocado está aceso */
  finger?: Vec2 | null;
  /** ponto do cursor antes do encaixe, px do palco */
  raw?: Vec2 | null;
  stamped: boolean;
}) {
  const p = toScreen(view, hit.point);
  const dy = finger ? finger[1] - (raw?.[1] ?? p[1]) : 0;
  const from = start ? toScreen(view, start.point) : p;
  const length = Math.hypot(p[0] - from[0], p[1] - from[1]);
  const angle = (Math.atan2(p[1] - from[1], p[0] - from[0]) * 180) / Math.PI;
  const worldLength = start ? Math.hypot(hit.point[0] - start.point[0], hit.point[1] - start.point[1]) : 0;
  const outerD = Math.max(1, Math.min(8, worldLength / 5));
  const metrics = coilMetrics(outerD);
  const turns = coilCount(worldLength, outerD);
  const end = metrics.end / mmPerPx(view.zoom);
  const pitch = Math.max(0, length - 2 * end) / turns;
  const coil = assets["spring-coil"];
  const coilHeight = (coil.height * metrics.s) / mmPerPx(view.zoom);
  const coilSrc = coil.tints.find((t) => t.token === "gold")?.src.x2 ?? coil.src.x2;
  return (
    <svg
      className="hammerpreview"
      width="100%"
      height="100%"
      aria-hidden="true"
      data-hammer-preview
      data-cursor={finger ? "lit" : "off"}
      data-touch-offset={finger ? -dy : 0}
      data-point={raw ? `${raw[0].toFixed(2)} ${raw[1].toFixed(2)}` : undefined}
      data-finger={finger ? `${finger[0].toFixed(2)} ${finger[1].toFixed(2)}` : undefined}
    >
      <g transform={viewMatrix(view)}>
        {[start?.b ?? hit.a, hit.b].map(
          (m, i) =>
            m && (
              <path
                key={m.key}
                className={`hammerpreview__outline${i === 0 ? " hammerpreview__below" : ""}`}
                d={m.d}
                transform={`translate(${m.part.x} ${m.part.y}) rotate(${(m.part.angle * 180) / Math.PI})`}
              />
            ),
        )}
      </g>
      {start && (
        <>
          <g transform={`translate(${from[0]} ${from[1]}) rotate(${angle})`}>
            {tool === "spring" ? (
              <g>
                <path className="hammerpreview__line" d={`M0 0H${end}M${length - end} 0H${length}`} />
                {Array.from({ length: turns }, (_, i) => (
                  <image
                    key={i}
                    href={coilSrc}
                    x={end + i * pitch}
                    y={-coilHeight * coil.anchor.y}
                    width={pitch}
                    height={coilHeight}
                    preserveAspectRatio="none"
                  />
                ))}
              </g>
            ) : tool === "cable" ? (
              <path className="hammerpreview__line" d={`M0 0Q${length / 2} 8 ${length} 0`} />
            ) : tool === "slider" ? (
              <path
                className="hammerpreview__line"
                d={`M0 -6H${length}M0 6H${length}M0 -12V12M${length} -12V12`}
              />
            ) : (
              <rect
                x="0"
                y={tool === "chamber" ? -8 : -2}
                width={length}
                height={tool === "chamber" ? 16 : 4}
                className="hammerpreview__head"
              />
            )}
            <circle r="3" className="hammerpreview__head" />
            <circle cx={length} r="3" className="hammerpreview__head" />
          </g>
        </>
      )}
      {finger && raw && (
        <path
          className="hammerpreview__line hammerpreview__tether"
          d={`M${raw[0]} ${raw[1] + 13}L${finger[0]} ${finger[1] - 6}`}
        />
      )}
      <g transform={`translate(${p[0]} ${p[1]})`}>
        {finger && (
          <g className="hammercursor">
            <circle r="13" className="hammercursor__ring" />
            <path className="hammercursor__cross" d="M-21 0H-15M15 0H21M0-21V-15M0 15V21M-3 0H3M0-3V3" />
          </g>
        )}
        {!finger && <path className="hammerpreview__line" d="M-9 0H9M0-9V9" />}
        {hit.guides.length > 0 && <circle r="7" className="hammerpreview__line" />}
        {stamped && <circle className="hammerpreview__line hammerink" r="13" />}
        {start ? null : stamped ? (
          <g className={`hammerstamp hammerstamp--${tool}`}>
            <circle r="15" className="hammerpreview__head" />
            <g transform="translate(-12 -12)">
              <Icon name={tool === "lock" ? "latch" : tool} uid="hammer-preview" />
            </g>
          </g>
        ) : (
          <g className="hammerghost" transform="translate(-9.6 -9.6) scale(0.8)">
            <Icon name={tool === "lock" ? "latch" : tool} uid="hammer-preview" />
          </g>
        )}
      </g>
    </svg>
  );
}
