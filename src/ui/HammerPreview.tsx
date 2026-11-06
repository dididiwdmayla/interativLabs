import { assets } from "@/assets/registry";
import { coilCount, coilMetrics } from "@/render/geometry";
import type { HammerPoint, HammerTool } from "@/editor/hammer";
import { toScreen, viewMatrix, mmPerPx, type View } from "@/render/view";
import { Icon } from "./icons";

export function HammerPreview({
  hit,
  start,
  tool,
  view,
  touch,
  stamped,
}: {
  hit: HammerPoint;
  start?: HammerPoint;
  tool: HammerTool;
  view: View;
  touch: boolean;
  stamped: boolean;
}) {
  const p = toScreen(view, hit.point);
  const dy = touch && !stamped ? -64 : 0;
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
      data-touch-offset={dy}
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
          <path className="hammerpreview__line" d={`M${from[0]} ${from[1]}v${dy}M${p[0]} ${p[1]}v${dy}`} />
          <g transform={`translate(${from[0]} ${from[1] + dy}) rotate(${angle})`}>
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
      <g transform={`translate(${p[0]} ${p[1]})`}>
        <path className="hammerpreview__line" d={`M-9 0H9M0-9V9M0 0V${dy}`} />
        {hit.guides.length > 0 && <circle r="7" className="hammerpreview__line" />}
        {stamped && <circle className="hammerpreview__line hammerink" r="13" />}
        <g transform={`translate(0 ${dy})`}>
          <g className={stamped ? `hammerstamp hammerstamp--${tool}` : undefined}>
            <circle r="19" className="hammerpreview__head" />
            <g transform="translate(-12 -12)">
              <Icon name={tool === "lock" ? "latch" : tool} uid="hammer-preview" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
