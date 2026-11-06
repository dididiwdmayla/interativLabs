import type { PartPose } from "@/engine/types";
import { ringBounds, type PolyWithHoles } from "@/geometry/polygon";
import { shapeOutline } from "@/geometry/outline";
import { transform, type Vec2 } from "@/geometry/vec";
import { surfaces, linkLayer } from "@/model/profiles";
import { MATERIALS } from "@/model/materials";
import type { Id, Layer, Link, Part, Scene } from "@/model/types";
import type { HatchId } from "./hatch";
import type { Box } from "./view";

/**
 * Cena v2 → modelo de desenho: contornos, camadas, ordem, material e massa
 * de cada peça e o lugar de cada ligação (em que peça e camada ela é
 * desenhada). Montado uma vez por cena; nada aqui muda durante a simulação.
 */

export interface PartModel {
  part: Part;
  key: Id;
  profile?: Id;
  /** índice da camada (0 = fundo) */
  layer: number;
  /** ordem da peça dentro da camada */
  slot: number;
  outline: PolyWithHoles[];
  /** caminho evenodd no espaço local */
  d: string;
  /** move na simulação (não é fixa nem parafusada ao fundo) */
  dynamic: boolean;
  /** corpo fixo: faixa de hachura na borda e pautado no miolo */
  body: boolean;
  hatch: HatchId;
  /** ângulo da hachura: peças vizinhas do mesmo material alternam */
  angle: 0 | 45 | 135;
  /** menor lado da caixa local, mm */
  size: number;
  /** massa calculada, g */
  mass: number;
  /** área, mm² */
  area: number;
}

export interface LayerModel {
  layer: Layer;
  index: number;
  parts: PartModel[];
}

/** Ponto preso a uma peça (ou ao fundo, com part null), no espaço local dela. */
export interface Anchor {
  part: Id | null;
  at: Vec2;
}

export interface LinkModel {
  link: Link;
  /** camada onde o desenho principal fica (por cima das peças dela) */
  layer: number;
  /** peça que carrega o desenho (gira com ela); null = mundo */
  carrier: Id | null;
  /** ponto do desenho no espaço do carregador */
  at: Vec2;
  /** ponto da chamada no mundo, na pose desenhada */
  world: Vec2;
  /** faixa de camadas que a ligação atravessa (pino, sensor) ou toca */
  span: [number, number];
  /** preso ao fundo: símbolo de apoio no mundo */
  ground: Vec2 | null;
}

export interface SceneModel {
  scene: Scene;
  layers: LayerModel[];
  parts: Map<Id, PartModel>;
  /** na ordem de desenho: camada, depois ordem no array */
  partList: PartModel[];
  links: LinkModel[];
  linkById: Map<Id, LinkModel>;
  /** caixa de tudo no mundo, mm */
  bounds: Box;
  /** caixa do que interessa enquadrar: peças móveis e ligações (sem móveis: tudo) */
  focus: Box;
  /** poses desenhadas */
  drawn: Map<Id, PartPose>;
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function outlinePath(outline: PolyWithHoles[]): string {
  let d = "";
  for (const s of outline)
    for (const ring of [s.outer, ...s.holes]) {
      if (ring.length < 3) continue;
      d += ring.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("") + "Z";
    }
  return d;
}

export function drawnPoses(scene: Scene): Map<Id, PartPose> {
  return new Map(scene.parts.map((p) => [p.id, { x: p.x, y: p.y, angle: p.angle }] as const));
}

/** Ponto local → mundo pela pose da peça. */
export function worldOf(pose: PartPose | undefined | null, at: Vec2): Vec2 {
  return pose ? transform(at, pose.x, pose.y, pose.angle) : at;
}

/** Ponto do mundo → local da peça. */
export function localOf(pose: PartPose | undefined | null, p: Vec2): Vec2 {
  if (!pose) return p;
  const c = Math.cos(-pose.angle);
  const s = Math.sin(-pose.angle);
  const dx = p[0] - pose.x;
  const dy = p[1] - pose.y;
  return [dx * c - dy * s, dx * s + dy * c];
}

export function prepareScene(scene: Scene): SceneModel {
  const layerIndex = new Map(scene.layers.map((l, i) => [l.id, i] as const));
  const groundScrewed = new Set(
    scene.links.flatMap((l) => (l.kind === "screw" && l.a === null ? [l.b] : [])),
  );
  const drawn = drawnPoses(scene);
  const layers: LayerModel[] = scene.layers.map((layer, index) => ({ layer, index, parts: [] }));
  const parts = new Map<Id, PartModel>();
  const partList: PartModel[] = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (p: Vec2) => {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  };

  let f0 = Infinity;
  let g0 = Infinity;
  let f1 = -Infinity;
  let g1 = -Infinity;
  const growFocus = (p: Vec2) => {
    f0 = Math.min(f0, p[0]);
    g0 = Math.min(g0, p[1]);
    f1 = Math.max(f1, p[0]);
    g1 = Math.max(g1, p[1]);
  };

  for (const owner of scene.parts)
    for (const surface of surfaces(owner)) {
      const part: Part =
        surface.id === owner.id
          ? owner
          : {
              ...owner,
              layer: surface.layer,
              shape: surface.shape,
              material: surface.material,
              source: surface.source,
            };
      const li = layerIndex.get(part.layer) ?? 0;
      const g = shapeOutline(part.shape);
      if (!g.ok) continue;
      const lm = layers[li]!;
      const outline = g.value.outline;
      let bx0 = Infinity;
      let by0 = Infinity;
      let bx1 = -Infinity;
      let by1 = -Infinity;
      for (const s of outline) {
        const b = ringBounds(s.outer);
        bx0 = Math.min(bx0, b.minX);
        by0 = Math.min(by0, b.minY);
        bx1 = Math.max(bx1, b.maxX);
        by1 = Math.max(by1, b.maxY);
        for (const q of s.outer) grow(transform(q, part.x, part.y, part.angle));
      }
      const dynamic = !part.fixed && !groundScrewed.has(part.id);
      if (dynamic)
        for (const s of outline) for (const q of s.outer) growFocus(transform(q, part.x, part.y, part.angle));
      // paridade entre as peças do mesmo material na camada
      const same = lm.parts.filter((p) => p.part.material === part.material).length;
      const hatch: HatchId = part.material;
      const angled = hatch !== "rubber" && hatch !== "wood";
      const m: PartModel = {
        part,
        key: surface.id,
        ...(surface.id === owner.id ? {} : { profile: surface.id }),
        layer: li,
        slot: lm.parts.length,
        outline,
        d: outlinePath(outline),
        dynamic,
        body: !dynamic,
        hatch,
        angle: angled ? (same % 2 ? 135 : 45) : 0,
        size: Math.min(bx1 - bx0, by1 - by0),
        area: g.value.mass.area,
        mass: g.value.mass.area * MATERIALS[part.material].density * (lm.layer.thickness ?? 3),
      };
      lm.parts.push(m);
      if (surface.id === owner.id) parts.set(part.id, m);
    }
  for (const l of layers) partList.push(...l.parts);

  const layerOf = (id: Id | null) => (id === null ? -1 : (parts.get(id)?.layer ?? -1));
  const order = new Map(partList.map((p, i) => [p.part.id, i] as const));
  /** a mais alta das duas peças (camada, depois ordem) */
  const higher = (a: Id | null, b: Id | null): Id | null => {
    if (a === null) return b;
    if (b === null) return a;
    const la = layerOf(a);
    const lb = layerOf(b);
    if (la !== lb) return la > lb ? a : b;
    return (order.get(a) ?? 0) > (order.get(b) ?? 0) ? a : b;
  };
  const range = (ids: [Id, Id]): [number, number] => {
    const a = layerIndex.get(ids[0]) ?? 0;
    const b = layerIndex.get(ids[1]) ?? 0;
    return [Math.min(a, b), Math.max(a, b)];
  };

  const links: LinkModel[] = [];
  for (const link of scene.links) {
    let lm: LinkModel | null = null;
    switch (link.kind) {
      case "lock":
      case "screw":
      case "axle":
      case "mount":
      case "slider": {
        if (!parts.has(link.b)) break;
        const world = worldOf(drawn.get(link.b), link.at);
        let carrier: Id | null = link.b;
        if (link.kind === "screw") carrier = higher(link.a, link.b);
        if (link.kind === "slider") carrier = link.a;
        const la = layerOf(link.a);
        const lb = layerOf(link.b);
        lm = {
          link,
          layer: link.kind === "slider" ? lb : Math.max(la, lb),
          carrier,
          at: carrier === null ? world : localOf(drawn.get(carrier), world),
          world,
          span: [la < 0 ? lb : Math.min(la, lb), Math.max(la, lb)],
          ground: link.a === null ? world : null,
        };
        break;
      }
      case "pin":
      case "sensor": {
        if (!parts.has(link.host)) break;
        const world = worldOf(drawn.get(link.host), link.at);
        lm = {
          link,
          layer: layerOf(link.host),
          carrier: link.host,
          at: link.at,
          world,
          span: range(link.layers),
          ground: null,
        };
        break;
      }
      case "rod":
      case "cable":
      case "spring": {
        const wa = worldOf(link.a === null ? null : drawn.get(link.a), link.atA);
        const wb = worldOf(link.b === null ? null : drawn.get(link.b), link.atB);
        const la = layerOf(link.a);
        const lb = layerOf(link.b);
        lm = {
          link,
          layer: Math.max(la, lb, 0),
          carrier: null,
          at: [0, 0],
          world: [(wa[0] + wb[0]) / 2, (wa[1] + wb[1]) / 2],
          span: [la < 0 ? lb : lb < 0 ? la : Math.min(la, lb), Math.max(la, lb)],
          ground: link.a === null ? wa : link.b === null ? wb : null,
        };
        break;
      }
      case "chamber": {
        const world = worldOf(link.body === null ? null : drawn.get(link.body), link.at);
        const wl = link.walls.map((w) => layerOf(w.part)).filter((x) => x >= 0);
        const lb = layerOf(link.body);
        const ly = Math.max(lb, ...wl, 0);
        lm = {
          link,
          layer: ly,
          carrier: link.body,
          at: link.at,
          world,
          span: [Math.min(ly, ...wl), ly],
          ground: null,
        };
        break;
      }
      case "slot": {
        const pin = scene.links.find((l) => l.id === link.pin);
        const guide = drawn.get(link.guide);
        if (!pin || pin.kind !== "pin" || !guide) break;
        const world = worldOf(drawn.get(pin.host), pin.at);
        const lg = layerIndex.get(linkLayer(scene, link)) ?? layerOf(link.guide);
        lm = {
          link,
          layer: lg,
          carrier: link.guide,
          at: localOf(guide, world),
          world,
          span: [lg, lg],
          ground: null,
        };
        break;
      }
    }
    if (lm) {
      links.push(lm);
      grow(lm.world);
      if (lm.link.kind !== "slot") growFocus(lm.world);
    }
  }

  if (!Number.isFinite(x0)) {
    x0 = -50;
    y0 = -50;
    x1 = 50;
    y1 = 50;
  }
  // margem do enquadramento: 6% do maior lado (no mínimo 3 mm)
  const hasFocus = Number.isFinite(f0) && f1 - f0 + (g1 - g0) > 1;
  const m = hasFocus ? Math.max(3, 0.06 * Math.max(f1 - f0, g1 - g0)) : 0;
  const focus: Box = hasFocus
    ? [Math.max(x0, f0 - m), Math.max(y0, g0 - m), 0, 0]
    : [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)];
  if (hasFocus) {
    focus[2] = Math.max(1, Math.min(x1, f1 + m) - focus[0]);
    focus[3] = Math.max(1, Math.min(y1, g1 + m) - focus[1]);
  }
  return {
    focus,
    scene,
    layers,
    parts,
    partList,
    links,
    linkById: new Map(links.map((l) => [l.link.id, l] as const)),
    bounds: [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)],
    drawn,
  };
}
