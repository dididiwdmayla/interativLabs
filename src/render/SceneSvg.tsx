import { memo, useLayoutEffect, useMemo, type ReactNode } from "react";
import { assets, type Asset } from "@/assets/registry";
import { layoutCallouts, type CalloutTarget } from "./callouts";
import { calloutGeometry } from "./calloutScene";
import { chamberGeo } from "./geometry";
import { HATCHES, WOOD_TILE_PX, hatchCoverage, hatchScale, patternTransform, type HatchId } from "./hatch";
import { HW_IDS, type ArtContext } from "./hardware";
import { CarriedArt, Ground, TwoEndArt } from "./LinkArt";
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
}

type LayerState = "full" | "active" | "below" | "above" | "xray" | "xray-active";

function layerState(i: number, p: SceneSvgProps): LayerState {
  if (p.layerMode === "xray") return i === p.active ? "xray-active" : "xray";
  if (p.mode === "simulate" || p.layerMode === "all") return "full";
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
        key={`w-${m.part.id}`}
        id={`${uid}w-${m.part.id}`}
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
  if (h === "wood") return `url(#${uid}w-${m.part.id})`;
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
}

/** Uma peça: parede (cópia deslocada no mundo) e o grupo com face, hachura, chanfro e contorno. */
function PartArt({ m, skin, uid, nodes, selected, carried, ctx }: PartArtProps) {
  const id = m.part.id;
  return (
    <g
      className={`part${m.dynamic ? " part--dynamic" : " part--fixed"}${skin.tiny ? " is-tiny" : ""}`}
      data-part={id}
    >
      <g className="part__wallg" ref={nodes.refPart(id, "wall")}>
        <path className="part__wall" d={m.d} />
      </g>
      <g ref={nodes.refPart(id, "g")}>
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
        {carried.map((lm) => (
          <CarriedArt key={lm.link.id} ctx={ctx} lm={lm} />
        ))}
      </g>
    </g>
  );
}

export function SceneSvg(props: SceneSvgProps) {
  const { model, nodes, uid, zoom, fitZoom, mode, selection, size } = props;
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
    else carriedBy.set(lm.carrier, [...(carriedBy.get(lm.carrier) ?? []), lm]);
    if (k === "pin" || k === "sensor") {
      for (let i = lm.span[0]; i <= lm.span[1]; i++)
        if (i !== lm.layer) followersAt.set(i, [...(followersAt.get(i) ?? []), lm]);
    }
  }

  const calloutGeo = useMemo(() => calloutGeometry(model), [model]);

  // chamadas: ligações no Editar; a peça selecionada (no Simular, só se ela se move)
  const callouts = useMemo(() => {
    if (props.callouts === false) return [];
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
  }, [model, mode, selection, px, props.active, props.callouts, calloutGeo]);

  // depois de cada montagem, reaplica o quadro atual (as poses não passam pelo React)
  useLayoutEffect(() => {
    nodes.setContext({ ...writeCtx, walls: !heavy });
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
    if (L.index > 0)
      for (const m of L.parts)
        items[kindOf(m)].push(
          <g key={`s-${m.part.id}`} ref={nodes.refPart(m.part.id, "shadow")}>
            <path className="part__shadow" d={m.d} />
          </g>,
        );
    for (const lm of model.links) {
      if (lm.link.kind !== "chamber" || lm.layer !== L.index) continue;
      const geo = geos.get(lm.link.id)!;
      items.dynamic.push(
        <polygon key={`gas-${lm.link.id}`} className="gas" ref={nodes.refChamber(lm.link.id, geo, "gas")} />,
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
          carried={carriedBy.get(m.part.id) ?? []}
          ctx={ctx}
        />,
      );
    for (const lm of followersAt.get(L.index) ?? [])
      items[kindOf(model.parts.get(lm.carrier ?? ""))].push(
        <g
          key={`f-${lm.link.id}`}
          className={`follower${strong(lm) ? " link--strong" : ""}`}
          ref={nodes.refFollower(lm.carrier ?? "")}
        >
          <CarriedArt ctx={ctx} lm={lm} follower />
        </g>,
      );
    for (const lm of worldAt.get(L.index) ?? []) {
      const k = lm.link.kind;
      if (lm.carrier === null && k !== "spring" && k !== "rod" && k !== "cable")
        items.static.push(<CarriedArt key={lm.link.id} ctx={ctx} lm={lm} />);
      else items.dynamic.push(<TwoEndArt key={lm.link.id} ctx={ctx} lm={lm} />);
    }
    for (const lm of model.links)
      if (lm.ground && lm.layer === L.index)
        items.static.push(<Ground key={`g-${lm.link.id}`} p={lm.ground} px={px} />);
    for (const kind of ["static", "dynamic"] as const)
      if (items[kind].length)
        sheets.push({
          key: `${L.layer.id}-${kind}`,
          layer: L.index,
          kind,
          items: [
            <g key="layer" className={`layer layer--${st}`} data-layer={L.index}>
              {items[kind]}
            </g>,
          ],
        });
  }

  // orçamento de pintura (docs/decisoes/desempenho.md): com muitas peças
  // móveis, a parede delas sai no Simular (fica no Editar e nas fixas)
  const heavy = mode === "simulate" && model.partList.filter((m) => m.dynamic).length > WALL_BUDGET;
  const svg = (key: string, cls: string, children: ReactNode) => (
    <svg
      key={key}
      className={`stage__sheet scene${zoom >= 3 ? " is-close" : ""}${heavy ? " is-heavy" : ""} ${cls}`}
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
      {sheets.map((sh) => svg(sh.key, `stage__sheet--${sh.kind}`, sh.items))}
      {svg(
        "overlay",
        "stage__sheet--overlay",
        <g className="overlay">
          {model.links.map((lm) =>
            lm.link.kind === "chamber" ? (
              <text
                key={`kpa-${lm.link.id}`}
                className="gauge"
                style={{ fontSize: `${12 * px}px` }}
                ref={nodes.refChamber(lm.link.id, geos.get(lm.link.id)!, "label")}
              />
            ) : null,
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
      )}
    </>
  );
}
