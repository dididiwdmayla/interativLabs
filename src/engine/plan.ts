import { type Piece } from "@/geometry/decompose";
import { shapeGeometry } from "@/geometry/shape";
import { rotate, transform, type Vec2 } from "@/geometry/vec";
import { MATERIALS } from "@/model/materials";
import type { Id, Link, Part, Scene } from "@/model/types";
import { GAS_RT, KPA_MM2, N } from "@/model/units";

/**
 * Plano de compilação comum a todos os motores, em unidades da cena.
 *
 * - Peças parafusadas viram um corpo composto (união por componentes conexos).
 *   Grupo com peça fixa ou parafuso ao fundo = corpo estático, na origem.
 *   O índice 0 é o fundo (mundo fixo, sem forma), ponta das ligações com
 *   `a: null`.
 * - Corpo dinâmico: origem no centro de massa e ângulo 0 na pose desenhada.
 *   Assim o ângulo de um eixo é a diferença dos ângulos dos corpos, o eixo de
 *   um trilho é o mesmo nos dois corpos, e nenhum motor precisa de ângulo de
 *   referência.
 * - Massa e inércia vêm da geometria (densidade × área × espessura da camada),
 *   não das peças convexas: sobreposições da decomposição não contam.
 */

export interface PlanFixture {
  /** no espaço do corpo, mm */
  piece: Piece;
  /** categoria = máscara (bits de camada) */
  bits: number;
  friction: number;
  restitution: number;
  sensor: boolean;
  /** peça dona (para pinos e sensores, a hospedeira) */
  part: Id;
  /** id da ligação, para pino e sensor */
  link?: Id;
}

export interface PlanBody {
  index: number;
  static: boolean;
  parts: Id[];
  /** origem do corpo no mundo (centro de massa), mm */
  position: Vec2;
  /** g */
  mass: number;
  /** g·mm² em torno do centro de massa */
  inertia: number;
  bullet: boolean;
  fixtures: PlanFixture[];
}

export interface PartRel {
  body: number;
  x: number;
  y: number;
  angle: number;
}

export interface PlanAxle {
  id: Id;
  a: number;
  b: number;
  /** ponto do eixo no mundo na pose desenhada, mm */
  anchor: Vec2;
  motor?: { speed: number; maxTorque: number };
  limit?: { lower: number; upper: number };
  torsion?: { k: number; rest: number; damping: number };
}

export interface PlanSlider {
  id: Id;
  a: number;
  b: number;
  anchor: Vec2;
  /** direção unitária no mundo na pose desenhada */
  axis: Vec2;
  lower: number;
  upper: number;
  spring?: { k: number; rest: number; damping: number };
}

export interface PlanSpring {
  id: Id;
  a: number;
  b: number;
  /** pontos no espaço de cada corpo, mm */
  localA: Vec2;
  localB: Vec2;
  k: number;
  damping: number;
  freeLength: number;
}

export interface PlanChamber {
  id: Id;
  a: number;
  /** projétil: corpo, ou −1 se não houver */
  b: number;
  /** fundo e direção no espaço do corpo a */
  base: Vec2;
  axis: Vec2;
  bore: number;
  length: number;
  charge: number;
  burn: number;
  /** distância do centro de massa do projétil até a face traseira, ao longo do eixo */
  rearOffset: number;
}

export interface PlanSensor {
  id: Id;
  body: number;
  host: Id;
  center: Vec2;
  r: number;
  minSpeed: number;
  triggers: Id[];
}

export interface Plan {
  bodies: PlanBody[];
  partRel: Map<Id, PartRel>;
  /** peças na ordem da cena (para snapshots estáveis) */
  partIds: Id[];
  axles: PlanAxle[];
  sliders: PlanSlider[];
  springs: PlanSpring[];
  chambers: PlanChamber[];
  sensors: PlanSensor[];
  /** ligações na ordem da cena, com o tipo */
  links: { id: Id; kind: Link["kind"] }[];
  /** mm/s² */
  gravity: Vec2;
  warnings: string[];
}

/** Densidade do pino (aço), g/mm³. */
const PIN_DENSITY = MATERIALS.steel.density;
const PIN_FRICTION = 0.2;
const PIN_RESTITUTION = 0.05;

/** g por mm² de área: densidade (g/mm³) × espessura da camada (mm). */
const massPerArea = (density: number, thickness: number) => density * thickness;

export function layerBitsSpan(order: Map<Id, number>, from: Id, to: Id): number {
  const a = order.get(from) ?? 0;
  const b = order.get(to) ?? a;
  let m = 0;
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) m |= 1 << i;
  return m;
}

export function buildPlan(scene: Scene): Plan {
  const warnings: string[] = [];
  const order = new Map(scene.layers.map((l, i) => [l.id, i] as const));
  const thickness = new Map(scene.layers.map((l) => [l.id, l.thickness] as const));
  const thick = (layer: Id) => thickness.get(layer) ?? 0;
  const parts = scene.parts.filter((p) => order.has(p.layer));
  const byId = new Map(parts.map((p) => [p.id, p] as const));

  // Geometria de cada peça.
  const geo = new Map<Id, ReturnType<typeof shapeGeometry>>();
  for (const p of parts) {
    const g = shapeGeometry(p.shape);
    geo.set(p.id, g);
    if (!g.ok) warnings.push(`${p.name || p.id}: ${g.error.message}; a peça ficou fora da simulação`);
    else for (const w of g.warnings) warnings.push(`${p.name || p.id}: ${w}`);
  }
  const valid = parts.filter((p) => geo.get(p.id)?.ok);
  const validIds = new Set(valid.map((p) => p.id));

  // Grupos de parafusos.
  const parent = new Map(valid.map((p) => [p.id, p.id] as const));
  const find = (x: Id): Id => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const screwedToGround = new Set<Id>();
  for (const l of scene.links) {
    if (l.kind !== "screw" || !validIds.has(l.b)) continue;
    if (l.a === null) screwedToGround.add(l.b);
    else if (validIds.has(l.a)) parent.set(find(l.a), find(l.b));
  }
  const groups = new Map<Id, Part[]>();
  for (const p of valid) {
    const r = find(p.id);
    const g = groups.get(r);
    if (g) g.push(p);
    else groups.set(r, [p]);
  }

  const ground: PlanBody = {
    index: 0,
    static: true,
    parts: [],
    position: [0, 0],
    mass: 0,
    inertia: 0,
    bullet: false,
    fixtures: [],
  };
  const bodies: PlanBody[] = [ground];
  const partRel = new Map<Id, PartRel>();
  const bodyOfPart = new Map<Id, number>();

  // Pinos contam na massa da hospedeira.
  const pinsByHost = new Map<Id, Link[]>();
  for (const l of scene.links) {
    if (l.kind !== "pin" || !validIds.has(l.host)) continue;
    const list = pinsByHost.get(l.host);
    if (list) list.push(l);
    else pinsByHost.set(l.host, [l]);
  }

  for (const group of groups.values()) {
    const isStatic = group.some((p) => p.fixed || screwedToGround.has(p.id));
    let body: PlanBody;
    if (isStatic) {
      // Cada grupo fixo é um corpo estático próprio, na origem: uma junta com
      // uma peça fixa só desliga o contato com aquela peça, não com todas.
      body = {
        index: bodies.length,
        static: true,
        parts: [],
        position: [0, 0],
        mass: 0,
        inertia: 0,
        bullet: false,
        fixtures: [],
      };
      bodies.push(body);
    } else {
      // Centro de massa e inércia do grupo, no mundo.
      let m = 0;
      let sx = 0;
      let sy = 0;
      const items: { m: number; c: Vec2; j: number }[] = [];
      for (const p of group) {
        const g = geo.get(p.id)!;
        if (!g.ok) continue;
        const k = massPerArea(MATERIALS[p.material].density, thick(p.layer));
        const c = transform(g.value.mass.centroid, p.x, p.y, p.angle);
        items.push({ m: k * g.value.mass.area, c, j: k * g.value.mass.inertia });
        for (const pin of pinsByHost.get(p.id) ?? []) {
          if (pin.kind !== "pin") continue;
          const pm = massPerArea(PIN_DENSITY, thick(p.layer)) * Math.PI * pin.r * pin.r;
          items.push({ m: pm, c: transform(pin.at, p.x, p.y, p.angle), j: (pm * pin.r * pin.r) / 2 });
        }
      }
      for (const it of items) {
        m += it.m;
        sx += it.m * it.c[0];
        sy += it.m * it.c[1];
      }
      const com: Vec2 = m > 0 ? [sx / m, sy / m] : [group[0]!.x, group[0]!.y];
      let inertia = 0;
      for (const it of items) inertia += it.j + it.m * ((it.c[0] - com[0]) ** 2 + (it.c[1] - com[1]) ** 2);
      if (!(m > 0)) {
        m = 1;
        inertia = 1;
      }
      body = {
        index: bodies.length,
        static: false,
        parts: [],
        position: com,
        mass: m,
        inertia: Math.max(inertia, 1e-9),
        bullet: false,
        fixtures: [],
      };
      bodies.push(body);
    }
    for (const p of group) {
      const g = geo.get(p.id)!;
      if (!g.ok) continue;
      const rel: PartRel = {
        body: body.index,
        x: p.x - body.position[0],
        y: p.y - body.position[1],
        angle: p.angle,
      };
      partRel.set(p.id, rel);
      bodyOfPart.set(p.id, body.index);
      body.parts.push(p.id);
      if (p.fast) body.bullet = true;
      const mat = MATERIALS[p.material];
      const bits = 1 << order.get(p.layer)!;
      for (const piece of g.value.pieces) {
        body.fixtures.push({
          piece: toBody(piece, rel),
          bits,
          friction: mat.friction,
          restitution: mat.restitution,
          sensor: false,
          part: p.id,
        });
      }
    }
  }

  const relOf = (id: Id | null) => (id === null ? null : (partRel.get(id) ?? null));
  /** ponto local de uma peça → mundo, mm (pose desenhada) */
  const worldOf = (id: Id | null, at: Vec2): Vec2 => {
    if (id === null) return at;
    const p = byId.get(id);
    return p ? transform(at, p.x, p.y, p.angle) : at;
  };
  const angleOf = (id: Id | null) => (id === null ? 0 : (byId.get(id)?.angle ?? 0));
  const bodyIdx = (id: Id | null): number => (id === null ? 0 : (bodyOfPart.get(id) ?? -1));
  /** mundo (pose desenhada) → espaço do corpo */
  const toLocal = (body: number, w: Vec2): Vec2 => {
    const b = bodies[body]!;
    return [w[0] - b.position[0], w[1] - b.position[1]];
  };

  const plan: Plan = {
    bodies,
    partRel,
    partIds: valid.map((p) => p.id),
    axles: [],
    sliders: [],
    springs: [],
    chambers: [],
    sensors: [],
    links: scene.links.map((l) => ({ id: l.id, kind: l.kind })),
    gravity: scene.settings.gravity.on ? [0, scene.settings.gravity.g] : [0, 0],
    warnings,
  };

  for (const l of scene.links) {
    switch (l.kind) {
      case "screw":
        break;
      case "axle": {
        const a = bodyIdx(l.a);
        const b = bodyIdx(l.b);
        if (a < 0 || b < 0) break;
        if (a === b) {
          warnings.push(`Eixo ${l.ref}: as duas peças já estão no mesmo corpo; foi ignorado`);
          break;
        }
        plan.axles.push({
          id: l.id,
          a,
          b,
          anchor: worldOf(l.b, l.at),
          ...(l.motor ? { motor: { speed: l.motor.speed, maxTorque: l.motor.maxTorque * N } } : {}),
          ...(l.limit ? { limit: { ...l.limit } } : {}),
          ...(l.torsion
            ? { torsion: { k: l.torsion.k * N, rest: l.torsion.rest, damping: l.torsion.damping * N } }
            : {}),
        });
        break;
      }
      case "slider": {
        const a = bodyIdx(l.a);
        const b = bodyIdx(l.b);
        if (a < 0 || b < 0) break;
        if (a === b) {
          warnings.push(`Trilho ${l.ref}: as duas peças já estão no mesmo corpo; foi ignorado`);
          break;
        }
        const ang = angleOf(l.b) + l.dir;
        plan.sliders.push({
          id: l.id,
          a,
          b,
          anchor: worldOf(l.b, l.at),
          axis: [Math.cos(ang), Math.sin(ang)],
          lower: l.travel[0],
          upper: l.travel[1],
          ...(l.spring
            ? { spring: { k: l.spring.k * N, rest: l.spring.rest, damping: l.spring.damping * N } }
            : {}),
        });
        break;
      }
      case "spring": {
        const a = bodyIdx(l.a);
        const b = bodyIdx(l.b);
        if (a < 0 || b < 0) break;
        if (a === b) {
          warnings.push(`Mola ${l.ref}: as duas pontas estão no mesmo corpo; foi ignorada`);
          break;
        }
        plan.springs.push({
          id: l.id,
          a,
          b,
          localA: toLocal(a, worldOf(l.a, l.atA)),
          localB: toLocal(b, worldOf(l.b, l.atB)),
          k: l.k * N,
          damping: l.damping * N,
          freeLength: l.freeLength,
        });
        break;
      }
      case "chamber": {
        const a = bodyIdx(l.body);
        const wall = l.walls[0]?.part ?? null;
        const bi = wall === null ? -1 : bodyIdx(wall);
        const b = bi > 0 && !bodies[bi]!.static ? bi : -1;
        if (a < 0) break;
        const ang = angleOf(l.body) + l.dir;
        const axis: Vec2 = [Math.cos(ang), Math.sin(ang)];
        let rear = 0;
        if (b > 0) {
          let mn = Infinity;
          for (const f of bodies[b]!.fixtures) {
            if (f.sensor) continue;
            if (f.piece.kind === "circle")
              mn = Math.min(mn, f.piece.c[0] * axis[0] + f.piece.c[1] * axis[1] - f.piece.r);
            else for (const q of f.piece.points) mn = Math.min(mn, q[0] * axis[0] + q[1] * axis[1]);
          }
          rear = Number.isFinite(mn) ? -mn : 0;
        } else if (wall !== null) warnings.push(`Câmara ${l.ref}: o projétil precisa ser uma peça móvel`);
        plan.chambers.push({
          id: l.id,
          a,
          b: b > 0 ? b : -1,
          base: toLocal(a, worldOf(l.body, l.at)),
          axis,
          bore: l.bore,
          length: l.length,
          // Provisório até o gás 2.0: carga n·R·T (F = carga / s), queima em s.
          charge: (l.gas.charge?.amount ?? 0) * GAS_RT * KPA_MM2,
          burn: (l.gas.charge?.burnMs ?? 0) / 1000,
          rearOffset: rear,
        });
        break;
      }
      case "pin":
      case "sensor": {
        const rel = relOf(l.host);
        const host = byId.get(l.host);
        if (!rel || !host) break;
        const body = bodies[rel.body]!;
        const c = toBodyPoint(l.at, rel);
        const bits = layerBitsSpan(order, l.layers[0], l.layers[1]);
        body.fixtures.push({
          piece: { kind: "circle", c, r: l.r },
          bits,
          friction: PIN_FRICTION,
          restitution: PIN_RESTITUTION,
          sensor: l.kind === "sensor",
          part: l.host,
          link: l.id,
        });
        if (l.kind === "sensor") {
          plan.sensors.push({
            id: l.id,
            body: rel.body,
            host: l.host,
            center: c,
            r: l.r,
            minSpeed: l.minSpeed,
            triggers: l.actions.filter((x) => x.do === "ignite").map((x) => x.target),
          });
        }
        break;
      }
    }
  }
  if (bodies.some((b) => !b.static && b.fixtures.length === 0))
    warnings.push(
      `Há corpo sem forma de colisão (${bodies.filter((b) => !b.static && !b.fixtures.length).length})`,
    );
  return plan;
}

function toBodyPoint(p: Vec2, rel: PartRel): Vec2 {
  const r = rotate(p, rel.angle);
  return [r[0] + rel.x, r[1] + rel.y];
}

function toBody(piece: Piece, rel: PartRel): Piece {
  if (piece.kind === "circle") return { kind: "circle", c: toBodyPoint(piece.c, rel), r: piece.r };
  return { kind: "poly", points: piece.points.map((p) => toBodyPoint(p, rel)) };
}
