import type { ReactNode } from "react";
import { assets } from "@/assets/registry";
import type { Vec2 } from "@/geometry/vec";
import type { Link } from "@/model/types";
import { coilCount, coilMetrics } from "./geometry";
import { HW_MIN_PX, HW_REF, assetRef, type ArtContext, type HwId } from "./hardware";
import type { SpringNodes } from "./nodes";
import { worldOf, type LinkModel } from "./prepare";

/**
 * Desenho das ligações (identidade, "Ligações"; manifesto do lote 01):
 * ferragens por `<use>` das imagens do registro, sobre assento e sombra
 * procedurais; símbolos procedurais abaixo de 10 px de tela; mola com
 * pontas e espiras; haste, cabo, trilho, suporte elástico, câmara e o
 * símbolo de apoio. Variante `gold` na ligação selecionada.
 */

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Ferragem de Ø d (mm) centrada na origem. */
function Hardware({ ctx, id, d, gold }: { ctx: ArtContext; id: HwId; d: number; gold: boolean }) {
  const a = assets[id];
  const k = ((a.mmPerPx ?? 0.03) * d) / HW_REF[id];
  return <use href={assetRef(ctx, id, gold)} transform={`scale(${f(k)})`} className="hw" />;
}

/** Tamanho visível da ferragem. */
const tiny = (ctx: ArtContext, d: number) => d / ctx.px < HW_MIN_PX;

function partSize(ctx: ArtContext, id: string | null): number {
  return id === null ? Infinity : (ctx.model.parts.get(id)?.size ?? Infinity);
}

export function Ground({ p, px }: { p: Vec2; px: number }) {
  // traço curto com quatro tiques a 45° embaixo
  const w = 12 * px;
  const t = 3.2 * px;
  let d = `M${f(p[0] - w / 2)} ${f(p[1] + 5 * px)}h${f(w)}`;
  for (let i = 0; i < 4; i++) {
    const x = p[0] - w / 2 + (w * (i + 0.5)) / 4;
    d += `M${f(x)} ${f(p[1] + 5 * px)}l${f(-t)} ${f(t)}`;
  }
  return <path className="ground" d={`M${f(p[0])} ${f(p[1])}v${f(5 * px)}${d}`} />;
}

/** Arte de uma ligação no espaço do carregador (`lm.at` já local). */
export function CarriedArt({ ctx, lm, follower }: { ctx: ArtContext; lm: LinkModel; follower?: boolean }) {
  const l = lm.link;
  const gold = ctx.selected === l.id;
  const [x, y] = lm.at;
  const px = ctx.px;
  const strong = lm.span[0] <= ctx.active && ctx.active <= lm.span[1];
  const cls = `link link--${l.kind}${gold ? " is-selected" : ""}${strong ? " link--strong" : ""}`;
  let body: ReactNode;
  switch (l.kind) {
    case "screw": {
      const d = Math.min(6, partSize(ctx, lm.carrier) * 0.42);
      body = tiny(ctx, d) ? (
        <g className="hw-symbol">
          <circle r={d / 2} />
          <path d={`M${f(-d / 2)} 0H${f(d / 2)}`} />
        </g>
      ) : (
        <>
          <circle className="hw-shadow" r={d / 2} cx={1.5 * px} cy={1.5 * px} />
          <circle className="hw-seat" r={(d / 2) * 1.12} />
          <Hardware ctx={ctx} id={l.ref % 2 ? "hw-screw-slot" : "hw-screw-hex"} d={d} gold={gold} />
        </>
      );
      break;
    }
    case "axle": {
      const d = Math.min(8, partSize(ctx, l.b) * 0.5);
      const half = Math.max(d * 1.15, 8 * px);
      body = (
        <>
          {tiny(ctx, d) ? (
            <g className="hw-symbol">
              <circle r={d / 2} />
            </g>
          ) : (
            <>
              <circle className="hw-seat" r={(d / 2) * 1.04} />
              <Hardware ctx={ctx} id="hw-axle" d={d} gold={gold} />
            </>
          )}
          <path className="centerline" d={`M${f(-half)} 0H${f(half)}M0 ${f(-half)}V${f(half)}`} />
          {l.motor && (
            <path
              className="motor-arrow"
              d={`M${f(d * 0.95)} 0A${f(d * 0.95)} ${f(d * 0.95)} 0 1 ${l.motor.speed >= 0 ? 1 : 0} 0 ${f(
                l.motor.speed >= 0 ? -d * 0.95 : d * 0.95,
              )}`}
            />
          )}
        </>
      );
      break;
    }
    case "mount": {
      const s = Math.max(2.4, 9 * px);
      body = (
        <g className="mount">
          <rect x={-s / 2} y={-s / 2} width={s} height={s} />
          <path
            d={`M${f(-s / 2)} ${f(s * 0.25)}l${f(s / 6)} ${f(-s / 2)}l${f(s / 6)} ${f(s / 2)}l${f(s / 6)} ${f(-s / 2)}l${f(s / 6)} ${f(s / 2)}l${f(s / 6)} ${f(-s / 2)}l${f(s / 6)} ${f(s / 2)}`}
          />
        </g>
      );
      break;
    }
    case "pin": {
      const d = 2 * l.r;
      body = (
        <>
          {tiny(ctx, d) ? (
            <g className="hw-symbol">
              <circle r={l.r} />
            </g>
          ) : (
            <Hardware ctx={ctx} id="hw-pin" d={d} gold={gold} />
          )}
          {follower && <circle className="pin-ring" r={l.r * 1.45 + 2 * px} />}
        </>
      );
      break;
    }
    case "sensor": {
      const d = Math.min(6, 2 * l.r);
      const ticks: string[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r0 = l.r + 2 * px;
        const r1 = l.r + 6 * px;
        ticks.push(
          `M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)}L${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)}`,
        );
      }
      body = (
        <>
          <circle className="sensor-zone" r={l.r} />
          <path className="sensor-ticks" d={ticks.join("")} />
          {!follower &&
            (tiny(ctx, d) ? (
              <g className="hw-symbol">
                <circle r={d / 2} />
              </g>
            ) : (
              <Hardware ctx={ctx} id="hw-sensor" d={d} gold={gold} />
            ))}
          {follower && <circle className="pin-ring" r={l.r * 1.25 + 2 * px} />}
        </>
      );
      break;
    }
    case "slider":
      return <SliderArt ctx={ctx} lm={lm} gold={gold} />;
    case "chamber":
      return <ChamberArt ctx={ctx} lm={lm} gold={gold} />;
    default:
      return null;
  }
  return (
    <g className={cls} data-link={l.id} transform={`translate(${f(x)} ${f(y)})`}>
      {body}
    </g>
  );
}

/** Trilho: guia, batentes nas pontas do curso e o eixo de deslizamento, no espaço de `a`. */
function SliderArt({ ctx, lm, gold }: { ctx: ArtContext; lm: LinkModel; gold: boolean }) {
  const l = lm.link as Extract<Link, { kind: "slider" }>;
  const b = ctx.model.drawn.get(l.b);
  const carrier = lm.carrier === null ? null : ctx.model.drawn.get(lm.carrier);
  const ang = (b?.angle ?? 0) + l.dir - (carrier?.angle ?? 0);
  const bm = ctx.model.parts.get(l.b);
  const hw = Math.max(1.2, Math.min(4, (bm?.size ?? 6) * 0.35));
  const lo = l.travel[0] - hw;
  const hi = l.travel[1] + hw;
  const stop = Math.max(1, 4 * ctx.px);
  return (
    <g
      className={`link link--slider${gold ? " is-selected" : ""}`}
      data-link={l.id}
      transform={`translate(${f(lm.at[0])} ${f(lm.at[1])}) rotate(${f((ang * 180) / Math.PI)})`}
    >
      <path className="slider-guide" d={`M${f(lo)} ${f(-hw)}H${f(hi)}M${f(lo)} ${f(hw)}H${f(hi)}`} />
      <path className="centerline" d={`M${f(lo - 2 * stop)} 0H${f(hi + 2 * stop)}`} />
      <rect className="slider-stop" x={f(l.travel[0] - hw - stop)} y={-hw} width={stop} height={2 * hw} />
      <rect className="slider-stop" x={f(l.travel[1] + hw)} y={-hw} width={stop} height={2 * hw} />
    </g>
  );
}

/** Câmara: furo em corte (linhas do furo, fundo e linha de centro), no espaço do corpo. */
function ChamberArt({ ctx, lm, gold }: { ctx: ArtContext; lm: LinkModel; gold: boolean }) {
  const l = lm.link as Extract<Link, { kind: "chamber" }>;
  const r = l.bore / 2;
  const L = l.length;
  const cap = Math.max(0.8, 3 * ctx.px);
  return (
    <g
      className={`link link--chamber${gold ? " is-selected" : ""}`}
      data-link={l.id}
      transform={`translate(${f(lm.at[0])} ${f(lm.at[1])}) rotate(${f((l.dir * 180) / Math.PI)})`}
    >
      <path className="chamber-bore" d={`M0 ${f(-r)}H${f(L)}M0 ${f(r)}H${f(L)}`} />
      <rect className="chamber-cap" x={-cap} y={-r - cap} width={cap} height={2 * r + 2 * cap} />
      <path className="centerline" d={`M${f(-2 * cap)} 0H${f(L + 2 * cap)}`} />
    </g>
  );
}

/** Ligações de duas pontas (mola, haste, cabo), escritas a cada quadro pelo StageNodes. */
export function TwoEndArt({ ctx, lm }: { ctx: ArtContext; lm: LinkModel }) {
  const l = lm.link;
  const gold = ctx.selected === l.id;
  const nodes = ctx.nodes;
  if (l.kind === "spring") {
    const D = l.coil.outerD;
    const m = coilMetrics(D);
    const wa = worldOf(l.a === null ? null : ctx.model.drawn.get(l.a), l.atA);
    const wb = worldOf(l.b === null ? null : ctx.model.drawn.get(l.b), l.atB);
    const n = coilCount(l.freeLength, D, Math.hypot(wb[0] - wa[0], wb[1] - wa[1]));
    const solid = l.solidLength ?? l.coil.turns * l.coil.wireD;
    const entry: SpringNodes = {
      a: { part: l.a, at: l.atA },
      b: { part: l.b, at: l.atB },
      n,
      outerD: D,
      end: m.end,
      solid,
    };
    const coils: ReactNode[] = [];
    for (let i = 0; i < n; i++)
      coils.push(
        <use
          key={i}
          href={assetRef(ctx, "spring-coil", gold)}
          transform={`translate(${f(i * m.pitch)} 0) scale(${f(m.s)})`}
        />,
      );
    return (
      <g
        className={`link link--spring${gold ? " is-selected" : ""}`}
        data-link={l.id}
        ref={nodes.refSpring(l.id, entry, "g")}
      >
        <g ref={nodes.refSpring(l.id, entry, "coils")}>{coils}</g>
        <use href={assetRef(ctx, "spring-end", gold)} transform={`scale(${f(m.s)})`} />
        <g ref={nodes.refSpring(l.id, entry, "endB")}>
          <use href={assetRef(ctx, "spring-end", gold)} transform={`scale(${f(-m.s)} ${f(m.s)})`} />
        </g>
      </g>
    );
  }
  if (l.kind === "rod") {
    const wa = worldOf(l.a === null ? null : ctx.model.drawn.get(l.a), l.atA);
    const wb = worldOf(l.b === null ? null : ctx.model.drawn.get(l.b), l.atB);
    const len = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
    const w = Math.max(1.6, Math.min(3.2, len * 0.1));
    return (
      <g
        className={`link link--rod${gold ? " is-selected" : ""}`}
        data-link={l.id}
        ref={nodes.refTwo("rods", l.id, {
          a: { part: l.a, at: l.atA },
          b: { part: l.b, at: l.atB },
          max: len,
        })}
      >
        <rect className="rod-bar" x={-w / 2} y={-w / 2} width={len + w} height={w} rx={w / 2} />
        <path className="rod-line" d={`M${f(w * 0.2)} 0H${f(len - w * 0.2)}`} />
        <circle className="rod-eye" r={w * 0.28} />
        <circle className="rod-eye" cx={len} r={w * 0.28} />
      </g>
    );
  }
  if (l.kind === "cable") {
    return (
      <path
        className={`link link--cable${gold ? " is-selected" : ""}`}
        data-link={l.id}
        ref={nodes.refTwo("cables", l.id, {
          a: { part: l.a, at: l.atA },
          b: { part: l.b, at: l.atB },
          max: l.maxLength,
        })}
      />
    );
  }
  return null;
}
