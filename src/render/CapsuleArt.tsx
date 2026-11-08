import type { PartPose } from "@/engine/types";
import type { Part } from "@/model/types";

/**
 * A cápsula no traço da prancha (Fase 2 · M2a), dentro do grupo da peça:
 * carregada, a carga em pontilhado de brasa no furo, do fundo interno até a
 * esfera; deflagrada (classe `is-fired` no grupo da peça, trocada pelo
 * StageNodes no Testar), sem a brasa, com a marca do golpe na espoleta e o
 * traço do estojo levemente apagado (render.css). Nada aqui anima: só a
 * classe muda, uma vez.
 */

const f = (v: number) => String(Math.round(v * 1000) / 1000);

/** Até onde vai a carga: a face de trás da esfera, ou a boca sem esfera (local do estojo). */
function chargeEnd(part: Part, drawn: Map<string, PartPose>): number {
  const c = part.capsule!;
  const dx = c.mouth[0] - c.base[0];
  const dy = c.mouth[1] - c.base[1];
  const len = Math.hypot(dx, dy);
  const ball = c.projectile ? drawn.get(c.projectile) : undefined;
  const self = drawn.get(part.id);
  if (!ball || !self || len === 0) return len;
  // centro da esfera no espaço do estojo, projetado no eixo
  const wx = ball.x - self.x;
  const wy = ball.y - self.y;
  const cos = Math.cos(-self.angle);
  const sin = Math.sin(-self.angle);
  const lx = wx * cos - wy * sin - c.base[0];
  const ly = wx * sin + wy * cos - c.base[1];
  return Math.max(0.5, Math.min(len, (lx * dx + ly * dy) / len - c.bore / 2));
}

export function CapsuleArt({ part, drawn, px }: { part: Part; drawn: Map<string, PartPose>; px: number }) {
  const c = part.capsule;
  if (!c) return null;
  const ang = (Math.atan2(c.mouth[1] - c.base[1], c.mouth[0] - c.base[0]) * 180) / Math.PI;
  const end = chargeEnd(part, drawn);
  const r = c.bore / 2;
  const dot = Math.max(0.25, Math.min(r / 4, 1.4 * px * 5));
  const rows = [-0.5, 0, 0.5].map((k) => k * r);
  return (
    <g className="capsule">
      <g
        className="capsule__charge"
        transform={`translate(${f(c.base[0])} ${f(c.base[1])}) rotate(${f(ang)})`}
        style={{ strokeWidth: dot, strokeDasharray: `0 ${f(dot * 2.4)}` }}
      >
        {rows.map((y, i) => (
          <path key={i} d={`M${f(dot + (i % 2) * dot * 1.2)} ${f(y)}H${f(end - dot)}`} />
        ))}
      </g>
      <g
        className="capsule__mark"
        transform={`translate(${f(c.primer[0])} ${f(c.primer[1])}) rotate(${f(ang)})`}
      >
        <path d={`M${f(0.15)} ${f(-r * 0.32)}Q${f(r * 0.32)} 0 ${f(0.15)} ${f(r * 0.32)}`} />
        <circle cx={f(r * 0.12)} r={f(r * 0.1)} />
      </g>
    </g>
  );
}
