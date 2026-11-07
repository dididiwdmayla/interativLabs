import { memo, useLayoutEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { assets, type Asset } from "@/assets/registry";
import { layoutCallouts, type CalloutTarget } from "./callouts";
import { calloutGeometry } from "./calloutScene";
import { chamberGeo } from "./geometry";
import { HATCHES, WOOD_TILE_PX, hatchCoverage, hatchScale, patternTransform, type HatchId } from "./hatch";
import { HW_IDS, type ArtContext } from "./hardware";
import { CarriedArt, Ground, TwoEndArt } from "./LinkArt";
import { NO_LOOK, badgeSpot, hiddenEnd, linkShow, spreadOffset, type Look, type LinkShow } from "./look";
import type { StageNodes } from "./nodes";
import type { LinkModel, PartModel, SceneModel } from "./prepare";
import { SkinCache, type PartSkin } from "./skin";
import { hatchStep, mmPerPx } from "./view";
import "./render.css";

/**
 * A cena em SVG, na pele da Prancha índigo (docs/identidade/identidade.md).
 * Uma `<g>` por camada na ordem do array (índice 0 = fundo); em cada uma,
 * as sombras sobre a camada de baixo, o gás das câmaras, as peças (parede,
 * face, hachura, chanfro, contorno) e as ligações. Monta uma vez por cena e
 * por zoom assentado; as poses vêm do StageNodes, escritas direto nos nós.
 */

export type LayerMode = "focus" | "all" | "xray";
export type Selection = { kind: "part" | "link"; id: string } | null;

export interface SceneSvgProps {
  model: SceneModel;
  nodes: StageNodes;
  uid: string;
  /** zoom assentado (fim do gesto) */
  zoom: number;
  /** zoom do enquadramento: a sombra tem 3 px nele e acompanha o zoom até 6 px */
  fitZoom: number;
  mode: "edit" | "simulate";
  layerMode: LayerMode;
  active: number;
  selection: Selection;
  /** chamadas visíveis (desligadas nas capturas do perf, por exemplo) */
  callouts?: boolean;
  /** tamanho do palco, px */
  size: { width: number; height: number };
  /** camadas em cores, afastadas, isoladas e peças escondidas (estado de vista) */
  look?: Look;
  /** rastro do movimento (Testar): monta os caminhos fixos que o escritor preenche */
  trail?: boolean;
}

/** Caminhos do rastro: 13 peças × 6 trechos (src/ui/sim/trail.ts). */
const TRAIL_SLOTS = 13;
const TRAIL_SEGMENTS = 6;

type LayerState = "full" | "active" | "below" | "above" | "xray" | "xray-active";

function layerState(i: number, p: SceneSvgProps): LayerState {
  if (p.layerMode === "xray") return i === p.active ? "xray-active" : "xray";
  // em cores, todas as camadas plenas: cada uma na cor dela
  if (p.mode === "simulate" || p.layerMode === "all" || p.look?.colors) return "full";
  return i === p.active ? "active" : i < p.active ? "below" : "above";
}

const ANGLES = [45, 135] as const;

/** Acima de tantas peças móveis, a parede delas não é desenhada no Simular. */
export const WALL_BUDGET = 40;

function imageFor(a: Asset, uid: string, tint?: string): ReactNode {
  const t = tint ? a.tints.find((x) => x.token === tint) : undefined;
  const src = t ? t.src : a.src;
  return (
    <image
      key={`${a.id}${tint === "gold" ? "-gold" : ""}`}
      id={`${uid}a-${a.id}${tint === "gold" ? "-gold" : ""}`}
      href={src.x2}
      width={a.width}
      height={a.height}
      x={-a.anchor.x * a.width}
      y={-a.anchor.y * a.height}
      preserveAspectRatio="none"
    />
  );
}

/** Padrões de hachura, imagens das ferragens e da mola. */
const Defs = memo(function Defs({ uid, step, woods }: { uid: string; step: number; woods: PartModel[] }) {
  const pats: ReactNode[] = [];
  for (const [id, h] of Object.entries(HATCHES)) {
    const angles = h.angled ? ANGLES : ([0] as const);
    for (const a of angles)
      pats.push(
        <pattern
          key={`${id}-${a}`}
          id={`${uid}h-${id}-${a}`}
          patternUnits="userSpaceOnUse"
          width={h.w}
          height={h.h}
          patternTransform={patternTransform(step, a)}
        >
          {h.lines.map((l, i) => (
            <path
              key={i}
              d={l.d}
              className={id === "body" ? "hatch hatch--body" : "hatch"}
              strokeWidth={l.w}
              strokeDasharray={l.dash}
            />
          ))}
        </pattern>,
      );
  }
  const wood = assets["hatch-wood"];
  const woodSrc = wood.tints.find((t) => t.token === "ink-2")?.src ?? wood.src;
  const k = hatchScale(step);
  for (const m of woods) {
    // cada peça desloca o ladrilho por uma fração tirada do ref
    const off = ((m.part.ref * 0.381) % 1) * WOOD_TILE_PX;
    pats.push(
      <pattern
        key={`w-${m.key}`}
        id={`${uid}w-${m.key}`}
        patternUnits="userSpaceOnUse"
        width={WOOD_TILE_PX}
        height={WOOD_TILE_PX}
        patternTransform={`scale(${k}) translate(${off} ${off * 0.618})`}
      >
        <image href={woodSrc.x2} width={WOOD_TILE_PX} height={WOOD_TILE_PX} preserveAspectRatio="none" />
      </pattern>,
    );
  }
  const imgs: ReactNode[] = [];
  for (const id of [...HW_IDS, "spring-coil", "spring-end"] as const) {
    const a = assets[id];
    imgs.push(imageFor(a, uid), imageFor(a, uid, "gold"));
  }
  return (
    <defs>
      {pats}
      {imgs}
    </defs>
  );
});

function hatchFill(uid: string, m: PartModel, h: HatchId = m.hatch): string {
  if (h === "wood") return `url(#${uid}w-${m.key})`;
  const angle = h === "rubber" || h === "body" ? 0 : m.angle;
  return `url(#${uid}h-${h}-${angle})`;
}

interface PartArtProps {
  m: PartModel;
  skin: PartSkin;
  uid: string;
  nodes: StageNodes;
  selected: boolean;
  carried: LinkModel[];
  ctx: ArtContext;
  /** escondida ou fora do isolar: some do desenho (as ligações dela que ficam continuam) */
  gone: boolean;
  /** número da camada (modo em cores) */
  badge: number | null;
  show: (lm: LinkModel) => LinkShow;
}

/** Diâmetro do selo, px de tela. */
const BADGE_PX = 13;

/**
 * Selo do número da camada, no espaço local da peça (gira com ela): um
 * círculo de fio duplo, dentro, no ponto mais longe das bordas; fora, junto
 * do canto de cima, com uma linha fina, quando a peça não comporta o selo.
 */
function LayerBadge({ m, n, px }: { m: PartModel; n: number; px: number }) {
  const r = (BADGE_PX / 2) * px;
  const spot = badgeSpot(m);
  const inside = spot.room >= r;
  const [, by0, bx1] = spot.box;
  const at: [number, number] = inside ? spot.at : [bx1 + 1.3 * r, by0 - 1.3 * r];
  const lead = inside ? null : `M${spot.at[0]} ${spot.at[1]}L${at[0] - 0.7 * r} ${at[1] + 0.7 * r}`;
  return (
    <g className={`layerbadge${inside ? "" : " is-out"}`}>
      {lead && <path className="layerbadge__lead" d={lead} />}
      <g transform={`translate(${at[0]} ${at[1]})`}>
        <circle className="layerbadge__plate" r={r} />
        <circle className="layerbadge__inner" r={r - 1.6 * px} />
        <text className="layerbadge__num" y={3.4 * px} style={{ fontSize: `${9.5 * px}px` }}>
          {n}
        </text>
      </g>
    </g>
  );
}

/** Envoltório de uma ligação com o estado dela na vista (some, fica, ponta tracejada). */
function LinkWrap({ show, children }: { show: LinkShow; children: ReactNode }) {
  return <g className={`linkwrap is-${show}`}>{children}</g>;
}

/** Uma peça: parede (cópia deslocada no mundo) e o grupo com face, hachura, chanfro e contorno. */
function PartArt({ m, skin, uid, nodes, selected, carried, ctx, gone, badge, show }: PartArtProps) {
  const id = m.part.id;
  return (
    <g
      className={`part${m.dynamic ? " part--dynamic" : " part--fixed"}${skin.tiny ? " is-tiny" : ""}${gone ? " is-gone" : ""}`}
      data-part={id}
      data-gone={gone || undefined}
    >
      <g className="part__wallg" ref={nodes.refPart(id, "wall", m.key)}>
        <path className="part__wall" d={m.d} />
      </g>
      <g ref={nodes.refPart(id, "g", m.key)}>
        <path className="part__face" d={m.d} />
        {skin.tiny ? (
          <path className="part__hatch part__tone" d={m.d} style={{ fillOpacity: hatchCoverage(m.hatch) }} />
        ) : m.body ? (
          <>
            <path className="part__hatch" d={skin.inner + skin.core} fill={hatchFill(uid, m)} />
            {skin.core && <path className="part__hatch" d={skin.core} fill={hatchFill(uid, m, "body")} />}
          </>
        ) : (
          <path className="part__hatch" d={skin.inner} fill={hatchFill(uid, m)} />
        )}
        {!skin.tiny && (
          <>
            <path className="part__light" d={skin.light} />
            <path className="part__faint" d={skin.faint} />
            <path className="part__innerline" d={skin.inner} />
          </>
        )}
        <path className="part__outline" d={m.d} />
        {selected && <path className="part__select" d={m.d} />}
        {badge !== null && <LayerBadge m={m} n={badge} px={ctx.px} />}
        {carried.map((lm) => (
          <LinkWrap key={lm.link.id} show={show(lm)}>
            <CarriedArt ctx={ctx} lm={lm} />
            {show(lm) === "half" && <HalfRing lm={lm} px={ctx.px} />}
          </LinkWrap>
        ))}
      </g>
    </g>
  );
}

/** Ligação que toca uma peça escondida: anel tracejado em volta da ferragem. */
function HalfRing({ lm, px }: { lm: LinkModel; px: number }) {
  return <circle className="link-ghost" cx={lm.at[0]} cy={lm.at[1]} r={Math.max(2.2, 9 * px)} />;
}

export function SceneSvg(props: SceneSvgProps) {
  const { model, nodes, uid, zoom, fitZoom, mode, selection, size } = props;
  const look = props.look ?? NO_LOOK;
  const spread = look.spread;
  const show = (lm: LinkModel) => linkShow(lm, look, props.active);
  const gone = (m: PartModel) => look.hidden.has(m.part.id) || (look.isolate && m.layer !== props.active);
  const px = mmPerPx(zoom);
  const step = hatchStep(zoom);
  // um cache por cena (a chave é o id da peça)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const skins = useMemo(() => new SkinCache(), [model]);
  const woods = useMemo(() => model.partList.filter((m) => m.hatch === "wood"), [model]);
  const selectedLink = selection?.kind === "link" ? selection.id : null;
  const ctx: ArtContext = { uid, px, selected: selectedLink, active: props.active, nodes, model };

  // contexto do escritor de quadros: medidas em px de tela, convertidas para mm
  const writeCtx = {
    wallMm: (zoom >= 3 ? 3 : 2) * px,
    shadowMm: Math.min(6 * px, 3 * mmPerPx(fitZoom)),
    px,
  };

  const geos = useMemo(
    () =>
      new Map(
        model.links.flatMap((lm) =>
          lm.link.kind === "chamber" ? [[lm.link.id, chamberGeo(model.scene, lm.link)] as const] : [],
        ),
      ),
    [model],
  );

  // ligações por lugar de desenho
  const carriedBy = new Map<string, LinkModel[]>();
  const worldAt = new Map<number, LinkModel[]>();
  const followersAt = new Map<number, LinkModel[]>();
  for (const lm of model.links) {
    const k = lm.link.kind;
    if (k === "spring" || k === "rod" || k === "cable" || k === "slot") {
      if (k !== "slot") worldAt.set(lm.layer, [...(worldAt.get(lm.layer) ?? []), lm]);
      continue;
    }
    if (lm.carrier === null) worldAt.set(lm.layer, [...(worldAt.get(lm.layer) ?? []), lm]);
    else {
      const surface =
        model.partList.find((m) => m.part.id === lm.carrier && m.layer === lm.layer) ??
        model.parts.get(lm.carrier);
      if (surface) carriedBy.set(surface.key, [...(carriedBy.get(surface.key) ?? []), lm]);
    }
    if (k === "pin" || k === "sensor") {
      for (let i = lm.span[0]; i <= lm.span[1]; i++)
        if (i !== lm.layer) followersAt.set(i, [...(followersAt.get(i) ?? []), lm]);
    }
  }

  const calloutGeo = useMemo(() => calloutGeometry(model), [model]);

  // chamadas: ligações no Editar; a peça selecionada (no Simular, só se ela se move)
  const callouts = useMemo(() => {
    // afastadas, as chamadas não acompanham as folhas: saem
    if (props.callouts === false || spread > 0) return [];
    const targets: CalloutTarget[] = [];
    if (mode === "edit")
      for (const lm of model.links) {
        if (lm.link.kind === "slot") continue;
        const touches = lm.span[0] <= props.active && props.active <= lm.span[1];
        const ranged = lm.link.kind === "pin" || lm.link.kind === "sensor";
        targets.push({
          id: lm.link.id,
          ref: lm.link.ref,
          p: lm.world,
          sub: ranged && lm.span[0] !== lm.span[1] ? `${lm.span[0] + 1}–${lm.span[1] + 1}` : undefined,
          priority: (touches ? 10 : 0) + (selection?.id === lm.link.id ? 100 : 0),
        });
      }
    if (selection?.kind === "part") {
      const m = model.parts.get(selection.id);
      if (m && (mode === "edit" || m.dynamic))
        targets.push({ id: m.part.id, ref: m.part.ref, p: [m.part.x, m.part.y], priority: 1000 });
    }
    // espaço livre e cruzamentos: contornos das peças visíveis no mundo
    return layoutCallouts(targets, calloutGeo.bounds, px, calloutGeo.geo);
  }, [model, mode, selection, px, props.active, props.callouts, calloutGeo, spread]);

  // depois de cada montagem, reaplica o quadro atual (as poses não passam pelo React)
  useLayoutEffect(() => {
    nodes.setContext({ ...writeCtx, walls: !heavy, spread, active: props.active });
    nodes.trailFocus = selection?.kind === "part" ? selection.id : null;
    if (!props.trail || mode !== "simulate") nodes.trailEls.length = 0;
    nodes.write(nodes.frame, true);
  });

  // Folhas: por camada, uma com o que fica parado e outra com o que se move,
  // cada uma num <svg> composto à parte (will-change). Durante a simulação
  // só as folhas que se movem são repintadas; as placas fixas ficam em cache.
  const sheets: { key: string; layer: number; kind: "static" | "dynamic"; items: ReactNode[] }[] = [];
  for (const L of model.layers) {
    const st = layerState(L.index, props);
    const strong = (lm: LinkModel) => lm.span[0] <= props.active && props.active <= lm.span[1];
    const items: Record<"static" | "dynamic", ReactNode[]> = { static: [], dynamic: [] };
    const kindOf = (m: PartModel | undefined) => (m?.dynamic ? "dynamic" : "static");
    // afastadas: a moldura de cada prancha, na cor da camada, com o número no canto
    if (spread > 0) {
      const [bx, by, bw, bh] = model.bounds;
      const pad = 6 * px;
      const kind = L.parts.some((m) => !m.dynamic) || !L.parts.length ? "static" : "dynamic";
      items[kind].push(
        <g key="plate" className="sheetframe">
          <rect x={bx - pad} y={by - pad} width={bw + 2 * pad} height={bh + 2 * pad} />
          <text x={bx + bw + pad - 4 * px} y={by - pad - 4 * px} style={{ fontSize: `${12 * px}px` }}>
            {L.index + 1}
          </text>
        </g>,
      );
    }
    if (L.index > 0)
      for (const m of L.parts)
        items[kindOf(m)].push(
          <g
            key={`s-${m.part.id}`}
            ref={nodes.refPart(m.part.id, "shadow", m.key)}
            className={gone(m) ? "is-gone" : undefined}
          >
            <path className="part__shadow" d={m.d} />
          </g>,
        );
    for (const lm of model.links) {
      if (lm.link.kind !== "chamber" || lm.layer !== L.index) continue;
      const geo = geos.get(lm.link.id)!;
      items.dynamic.push(
        <LinkWrap key={`gas-${lm.link.id}`} show={show(lm)}>
          <polygon className="gas" ref={nodes.refChamber(lm.link.id, geo, "gas")} />
        </LinkWrap>,
      );
    }
    for (const m of L.parts)
      items[kindOf(m)].push(
        <PartArt
          key={m.part.id}
          m={m}
          skin={skins.get(m, zoom)}
          uid={uid}
          nodes={nodes}
          selected={selection?.kind === "part" && selection.id === m.part.id}
          carried={carriedBy.get(m.key) ?? []}
          ctx={ctx}
          gone={gone(m)}
          badge={look.colors ? L.index + 1 : null}
          show={show}
        />,
      );
    for (const lm of followersAt.get(L.index) ?? [])
      items[kindOf(model.parts.get(lm.carrier ?? ""))].push(
        <LinkWrap key={`f-${lm.link.id}`} show={show(lm)}>
          <g
            className={`follower${strong(lm) ? " link--strong" : ""}`}
            ref={nodes.refFollower(lm.carrier ?? "")}
          >
            <CarriedArt ctx={ctx} lm={lm} follower />
          </g>
        </LinkWrap>,
      );
    // afastadas: pino e sensor que atravessam camadas viram uma haste entre as folhas
    if (spread > 0)
      for (const lm of model.links) {
        const k = lm.link.kind;
        if ((k !== "pin" && k !== "sensor") || lm.span[0] !== L.index || lm.span[1] <= lm.span[0]) continue;
        const host = lm.link.host;
        const off = spreadOffset(lm.span[1] - lm.span[0], spread);
        items[kindOf(model.parts.get(host))].push(
          <LinkWrap key={`h-${lm.link.id}`} show={show(lm)}>
            <g className="haste" ref={nodes.refHaste(lm.link.id, host, lm.at)}>
              <line className="haste__rod" x2={off[0] * px} y2={off[1] * px} />
              <circle className="haste__end" r={1.6 * px} />
              <circle className="haste__end" cx={off[0] * px} cy={off[1] * px} r={1.6 * px} />
            </g>
          </LinkWrap>,
        );
      }
    for (const lm of worldAt.get(L.index) ?? []) {
      const k = lm.link.kind;
      if (lm.carrier === null && k !== "spring" && k !== "rod" && k !== "cable")
        items.static.push(
          <LinkWrap key={lm.link.id} show={show(lm)}>
            <CarriedArt ctx={ctx} lm={lm} />
          </LinkWrap>,
        );
      else
        items.dynamic.push(
          <LinkWrap key={lm.link.id} show={show(lm)}>
            <TwoEndArt ctx={ctx} lm={lm} ghost={show(lm) === "half" ? hiddenEnd(lm, look) : null} />
          </LinkWrap>,
        );
    }
    for (const lm of model.links)
      if (lm.ground && lm.layer === L.index)
        items.static.push(
          <LinkWrap key={`g-${lm.link.id}`} show={show(lm)}>
            <Ground p={lm.ground} px={px} />
          </LinkWrap>,
        );
    // afastadas, o manômetro vai na folha da câmara (a de cima fica deslocada)
    if (spread > 0)
      for (const lm of model.links)
        if (lm.link.kind === "chamber" && lm.layer === L.index)
          items.dynamic.push(
            <LinkWrap key={`kpa-${lm.link.id}`} show={show(lm)}>
              <text
                className="gauge"
                style={{ fontSize: `${12 * px}px` }}
                ref={nodes.refChamber(lm.link.id, geos.get(lm.link.id)!, "label")}
              />
            </LinkWrap>,
          );
    for (const kind of ["static", "dynamic"] as const)
      if (items[kind].length)
        sheets.push({
          key: `${L.layer.id}-${kind}`,
          layer: L.index,
          kind,
          items: [
            <g
              key="layer"
              className={`layer layer--${st}${L.layer.visible === false ? " is-hidden" : ""}`}
              data-layer={L.index}
              style={{ "--layer-color": `var(--layer-${(L.index % 16) + 1})` } as CSSProperties}
            >
              {items[kind]}
            </g>,
          ],
        });
  }

  // orçamento de pintura (docs/decisoes/desempenho.md): com muitas peças
  // móveis, a parede delas sai no Simular (fica no Editar e nas fixas)
  const heavy = mode === "simulate" && model.partList.filter((m) => m.dynamic).length > WALL_BUDGET;
  const sheetStyle = (layer: number | null): CSSProperties | undefined => {
    if (spread <= 0 || layer === null) return undefined;
    const o = spreadOffset(layer, spread);
    return { transform: `translate(${o[0]}px, ${o[1]}px)` };
  };
  const svg = (key: string, cls: string, children: ReactNode, layer: number | null = null) => (
    <svg
      key={key}
      style={sheetStyle(layer)}
      data-sheet-layer={layer ?? undefined}
      className={`stage__sheet scene${zoom >= 3 ? " is-close" : ""}${heavy ? " is-heavy" : ""}${look.colors ? " is-colors" : ""}${look.isolate ? " is-isolated" : ""}${spread > 0 ? " is-spread" : ""} ${cls}`}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      data-mode={mode}
      aria-hidden="true"
    >
      <g className="world" ref={nodes.refWorld(key)}>
        {children}
      </g>
    </svg>
  );

  return (
    <>
      {svg("defs", "stage__sheet--defs", <Defs uid={uid} step={step} woods={woods} />)}
      {sheets.map((sh) => svg(sh.key, `stage__sheet--${sh.kind}`, sh.items, sh.layer))}
      {svg(
        "overlay",
        "stage__sheet--overlay",
        <g className="overlay">
          {model.links.map((lm) =>
            lm.link.kind === "chamber" && spread <= 0 && show(lm) !== "gone" ? (
              <text
                key={`kpa-${lm.link.id}`}
                className="gauge"
                style={{ fontSize: `${12 * px}px` }}
                ref={nodes.refChamber(lm.link.id, geos.get(lm.link.id)!, "label")}
              />
            ) : null,
          )}
          {props.trail && mode === "simulate" && (
            <g className="trails">
              {Array.from({ length: TRAIL_SLOTS * TRAIL_SEGMENTS }, (_, i) => (
                <path key={i} className={`trail trail--${i % TRAIL_SEGMENTS}`} ref={nodes.refTrail(i)} />
              ))}
            </g>
          )}
          <g className="callouts">
            {callouts.map((c) =>
              c.hidden ? null : (
                <g key={c.id} className={`callout${selection?.id === c.id ? " is-selected" : ""}`}>
                  <path
                    className="callout__line"
                    d={c.d}
                    ref={model.parts.has(c.id) ? nodes.refPartCallout(c.id, c.label, "line") : undefined}
                  />
                  <circle
                    className="callout__dot"
                    cx={c.p[0]}
                    cy={c.p[1]}
                    r={px}
                    ref={model.parts.has(c.id) ? nodes.refPartCallout(c.id, c.label, "dot") : undefined}
                  />
                  <text
                    className="callout__num"
                    x={c.label[0]}
                    y={c.label[1] + (c.sub ? -2 * px : 4.5 * px)}
                    style={{ fontSize: `${13 * px}px` }}
                  >
                    {c.ref}
                  </text>
                  {c.sub && (
                    <text
                      className="callout__sub"
                      x={c.label[0]}
                      y={c.label[1] + 11 * px}
                      style={{ fontSize: `${11 * px}px` }}
                    >
                      {c.sub}
                    </text>
                  )}
                </g>
              ),
            )}
          </g>
          <g className="drag" visibility="hidden" ref={nodes.refDrag("g")}>
            <line className="drag__wire" ref={nodes.refDrag("wire")} />
            <circle className="drag__ring" r={6 * px} ref={nodes.refDrag("ring")} />
          </g>
        </g>,
        props.active,
      )}
    </>
  );
}
