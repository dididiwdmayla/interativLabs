import type { HammerPoint, HammerTool } from "@/editor/hammer";
import { toScreen, viewMatrix, type View } from "@/render/view";
import { Icon } from "./icons";

export function HammerPreview({
  hit,
  tool,
  view,
  touch,
  stamped,
}: {
  hit: HammerPoint;
  tool: HammerTool;
  view: View;
  touch: boolean;
  stamped: boolean;
}) {
  const p = toScreen(view, hit.point);
  const dy = touch && !stamped ? -64 : 0;
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
        {[hit.a, hit.b].map(
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
