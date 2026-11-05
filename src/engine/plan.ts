import { type Piece } from "@/geometry/decompose";
import { shapeGeometry } from "@/geometry/shape";
import { principalAxis, straightSlot } from "@/geometry/slot";
import { rotate, transform, type Vec2 } from "@/geometry/vec";
import { MATERIALS } from "@/model/materials";
import type { Id, Link, Part, Scene } from "@/model/types";
import type { PlanChamber } from "./chamber";
import { N } from "@/model/units";
import { PI, dcos, dhypot, dsin } from "@/geometry/dmath";

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
  /** g·mm²/s² (atrito como motor de velocidade zero; 0 = sem atrito) */
  friction: number;
}

/** Haste (distância fixa) ou cabo (só o máximo). */
export interface PlanDistance {
  id: Id;
  kind: "rod" | "cable";
  a: number;
  b: number;
  /** pontos no mundo na pose desenhada, mm */
  anchorA: Vec2;
  anchorB: Vec2;
  /** haste: comprimento desenhado; cabo: comprimento máximo (mm) */
  length: number;
}

/** Suporte elástico: solda com frequências. */
export interface PlanMount {
  id: Id;
  a: number;
  b: number;
  anchor: Vec2;
  linearHz: number;
  angularHz: number;
  damping: number;
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
  /** g·mm/s² (atrito como motor de velocidade zero; 0 = sem atrito) */
  friction: number;
}

export interface PlanSpring {
  id: Id;
  a: number;
  b: number;
  /** pontos no espaço de cada corpo, mm */
  localA: Vec2;
  localB: Vec2;
  /** g/s² */
  k: number;
  /** g/s */
  damping: number;
  freeLength: number;
  /** presa | apoiada (só empurra) | só puxa */
  mode: "fixed" | "seated" | "tension";
  /** espiras encostadas: batente rígido, mm */
  solidLength: number;
  /** peça-guia: o eixo da mola acompanha este corpo (direção de A para B no espaço dele) */
  guide?: { body: number; axis: Vec2 };
  /** massa efetiva ao longo da mola na pose desenhada, g (Infinity se as duas pontas são fixas) */
  effMass: number;
}

export type { PlanChamber, PlanWall } from "./chamber";

/** Pino num rasgo reto em modo junta: ponto sobre a linha de centro, com batentes. */
export interface PlanSlot {
  id: Id;
  /** corpo da peça-guia (com o rasgo) e corpo do pino */
  a: number;
  b: number;
  /** centro do pino no mundo, na pose desenhada (origem da junta) */
  anchor: Vec2;
  /** direção do rasgo no mundo, na pose desenhada */
  axis: Vec2;
  /** curso ao longo do eixo a partir da pose desenhada, descontado o raio do pino */
  lower: number;
  upper: number;
  /** meio do rasgo, em relação à origem (mm ao longo do eixo) */
  mid: number;
}

/** Pino num furo em modo contato: só para o snapshot (a colisão é da geometria). */
export interface PlanSlotContact {
  id: Id;
  /** corpo e ponto (no espaço do corpo) do centro do pino */
  pinBody: number;
  pinLocal: Vec2;
  /** corpo da guia e contorno do furo no espaço do corpo */
  guideBody: number;
  hole: Vec2[];
  r: number;
}

export interface PlanSensor {
  id: Id;
  body: number;
  host: Id;
  center: Vec2;
  r: number;
  minSpeed: number;
  actions: { do: "ignite" | "open" | "close"; target: Id; vent?: number }[];
}

export interface Plan {
  bodies: PlanBody[];
  partRel: Map<Id, PartRel>;
  /** peças na ordem da cena (para snapshots estáveis) */
  partIds: Id[];
  axles: PlanAxle[];
  distances: PlanDistance[];
  mounts: PlanMount[];
  sliders: PlanSlider[];
  slots: PlanSlot[];
  slotContacts: PlanSlotContact[];
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
    distances: [],
    mounts: [],
    sliders: [],
    slots: [],
    slotContacts: [],
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
          friction: (l.friction ?? 0) * N,
        });
        break;
      }
      case "rod":
      case "cable": {
        const a = bodyIdx(l.a);
        const b = bodyIdx(l.b);
        if (a < 0 || b < 0) break;
        const what = l.kind === "rod" ? "Haste" : "Cabo";
        if (a === b) {
          warnings.push(`${what} ${l.ref}: as duas pontas estão no mesmo corpo; foi ignorado`);
          break;
        }
        const anchorA = worldOf(l.a, l.atA);
        const anchorB = worldOf(l.b, l.atB);
        const drawn = dhypot(anchorB[0] - anchorA[0], anchorB[1] - anchorA[1]);
        if (l.kind === "rod" && drawn < 1e-6) {
          warnings.push(`Haste ${l.ref}: as duas pontas coincidem; foi ignorada`);
          break;
        }
        if (l.kind === "cable" && drawn > l.maxLength + 1e-6)
          warnings.push(`Cabo ${l.ref}: desenhado mais longo que o comprimento máximo; começa puxando`);
        plan.distances.push({
          id: l.id,
          kind: l.kind,
          a,
          b,
          anchorA,
          anchorB,
          length: l.kind === "rod" ? drawn : l.maxLength,
        });
        break;
      }
      case "mount": {
        const a = bodyIdx(l.a);
        const b = bodyIdx(l.b);
        if (a < 0 || b < 0) break;
        if (a === b) {
          warnings.push(`Suporte ${l.ref}: as duas peças já estão no mesmo corpo; foi ignorado`);
          break;
        }
        plan.mounts.push({
          id: l.id,
          a,
          b,
          anchor: worldOf(l.b, l.at),
          linearHz: l.linearHz,
          angularHz: l.angularHz,
          damping: l.damping,
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
          axis: [dcos(ang), dsin(ang)],
          lower: l.travel[0],
          upper: l.travel[1],
          ...(l.spring
            ? { spring: { k: l.spring.k * N, rest: l.spring.rest, damping: l.spring.damping * N } }
            : {}),
          friction: (l.friction ?? 0) * N,
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
        const wa = worldOf(l.a, l.atA);
        const wb = worldOf(l.b, l.atB);
        const dl = dhypot(wb[0] - wa[0], wb[1] - wa[1]);
        let guide: PlanSpring["guide"];
        if (l.guide !== undefined) {
          const gb = bodyIdx(l.guide);
          const gp = byId.get(l.guide);
          // eixo da guia: eixo principal do contorno da peça-guia, apontando de A para B
          const ax = gp && gp.shape.kind === "poly" ? principalAxis(gp.shape.outer) : null;
          if (gb >= 0 && gp && ax && dl > 1e-9) {
            const u = rotate(ax.u, gp.angle);
            const sg = u[0] * (wb[0] - wa[0]) + u[1] * (wb[1] - wa[1]) < 0 ? -1 : 1;
            guide = { body: gb, axis: [u[0] * sg, u[1] * sg] };
          } else warnings.push(`Mola ${l.ref}: a guia precisa ser um polígono alongado; ficou sem guia`);
        }
        // Massa efetiva ao longo da mola: 1 / (1/mA + 1/mB + (rA×u)²/IA + (rB×u)²/IB).
        let K = 0;
        if (dl > 1e-9) {
          const u: Vec2 = [(wb[0] - wa[0]) / dl, (wb[1] - wa[1]) / dl];
          for (const [bi, w] of [
            [a, wa],
            [b, wb],
          ] as const) {
            const bd = bodies[bi]!;
            if (bd.static) continue;
            const rx = w[0] - bd.position[0];
            const ry = w[1] - bd.position[1];
            const c = rx * u[1] - ry * u[0];
            K += 1 / bd.mass + (c * c) / bd.inertia;
          }
        }
        plan.springs.push({
          id: l.id,
          a,
          b,
          localA: toLocal(a, wa),
          localB: toLocal(b, wb),
          k: l.k * N,
          damping: l.damping * N,
          freeLength: l.freeLength,
          mode: l.mode,
          solidLength: l.solidLength ?? l.coil.turns * l.coil.wireD,
          ...(guide ? { guide } : {}),
          effMass: K > 0 ? 1 / K : Infinity,
        });
        break;
      }
      case "chamber": {
        const body = bodyIdx(l.body);
        if (body < 0) break;
        const ang = angleOf(l.body) + l.dir;
        const u: Vec2 = [dcos(ang), dsin(ang)];
        const baseW = worldOf(l.body, l.at);
        const proj = (q: Vec2) => (q[0] - baseW[0]) * u[0] + (q[1] - baseW[1]) * u[1];
        // extremos de cada parede ao longo do eixo, pela geometria da peça
        const ext = l.walls.map((w) => {
          const part = byId.get(w.part);
          const g = geo.get(w.part);
          const bi = bodyIdx(w.part);
          if (!part || !g || !g.ok || bi < 0 || bodies[bi]!.static) return null;
          let mn = Infinity;
          let mx = -Infinity;
          for (const pc of g.value.pieces) {
            const pts = pc.kind === "circle" ? [] : pc.points;
            if (pc.kind === "circle") {
              const c = proj(transform(pc.c, part.x, part.y, part.angle));
              mn = Math.min(mn, c - pc.r);
              mx = Math.max(mx, c + pc.r);
            }
            for (const q of pts) {
              const t = proj(transform(q, part.x, part.y, part.angle));
              mn = Math.min(mn, t);
              mx = Math.max(mx, t);
            }
          }
          return { w, bi, mn, mx, mid: (mn + mx) / 2 };
        });
        if (ext.some((e) => e === null) || ext.length === 0) {
          warnings.push(`Câmara ${l.ref}: as paredes precisam ser peças móveis; ficou de fora`);
          break;
        }
        const ok = ext as NonNullable<(typeof ext)[number]>[];
        const frontIdx = ok.length === 2 && ok[1]!.mid > ok[0]!.mid ? 1 : 0;
        const walls = ok.map((e, i) => {
          const side: 1 | -1 = ok.length === 1 || i === frontIdx ? 1 : -1;
          const s0 = side > 0 ? e.mn : e.mx;
          const faceW: Vec2 = [baseW[0] + u[0] * s0, baseW[1] + u[1] * s0];
          return { part: e.w.part, body: e.bi, side, face: toLocal(e.bi, faceW), s0, seal: e.w.seal };
        });
        if (walls.length === 1 && walls[0]!.s0 < 0)
          warnings.push(`Câmara ${l.ref}: a parede está atrás do fundo; o gás começa sem volume`);
        if (walls.length === 2 && walls[0]!.side === walls[1]!.side)
          warnings.push(`Câmara ${l.ref}: as duas paredes estão do mesmo lado`);
        const area = (PI * l.bore * l.bore) / 4;
        plan.chambers.push({
          id: l.id,
          ref: l.ref,
          body,
          base: toLocal(body, baseW),
          axis: u,
          area,
          length: l.length,
          walls,
          vents: l.vents.map((v) => ({ at: v.at, d: v.d, area: (PI * v.d * v.d) / 4, open: v.open })),
          ports: l.ports.map((pt) => ({
            to: -1,
            toId: pt.to,
            at: pt.at,
            d: pt.d,
            area: (PI * pt.d * pt.d) / 4,
          })),
          model: l.gas.model,
          gamma: l.gas.gamma,
          p0: l.gas.p0,
          charge: l.gas.charge?.amount ?? 0,
          burn: (l.gas.charge?.burnMs ?? 0) / 1000,
          shots: l.gas.charge?.shots ?? 1,
        });
        break;
      }
      case "slot": {
        const pin = scene.links.find((x) => x.id === l.pin);
        const guide = byId.get(l.guide);
        if (!pin || pin.kind !== "pin" || !guide || guide.shape.kind === "gear") break;
        const hole = guide.shape.holes[l.hole];
        const a = bodyIdx(l.guide);
        const b = bodyIdx(pin.host);
        if (!hole || a < 0 || b < 0) break;
        if (a === b) {
          warnings.push(`Rasgo ${l.ref}: o pino e a guia estão no mesmo corpo; foi ignorado`);
          break;
        }
        const center = worldOf(pin.host, pin.at);
        if (l.mode === "contact") {
          plan.slotContacts.push({
            id: l.id,
            pinBody: b,
            pinLocal: toLocal(b, center),
            guideBody: a,
            hole: hole.map((q) => toLocal(a, worldOf(l.guide, q))),
            r: pin.r,
          });
          break;
        }
        const st = straightSlot(hole);
        if (!st) {
          warnings.push(`Rasgo ${l.ref}: o furo não é um rasgo reto; use o modo contato`);
          break;
        }
        const p1 = worldOf(l.guide, st.p1);
        const p2 = worldOf(l.guide, st.p2);
        const ux = (p2[0] - p1[0]) / st.length;
        const uy = (p2[1] - p1[1]) / st.length;
        const t1 = (p1[0] - center[0]) * ux + (p1[1] - center[1]) * uy;
        const t2 = (p2[0] - center[0]) * ux + (p2[1] - center[1]) * uy;
        const play = Math.max(0, st.r - pin.r);
        // origem da junta: o centro do pino projetado na linha de centro do rasgo
        const off = -(center[0] - p1[0]) * uy + (center[1] - p1[1]) * ux;
        if (Math.abs(off) > 1e-6)
          warnings.push(
            `Rasgo ${l.ref}: o pino está ${off.toFixed(3)} mm fora da linha de centro; foi encostado nela`,
          );
        const anchor: Vec2 = [center[0] + uy * off, center[1] - ux * off];
        plan.slots.push({
          id: l.id,
          a,
          b,
          anchor,
          axis: [ux, uy],
          lower: t1 - play,
          upper: t2 + play,
          mid: (t1 + t2) / 2,
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
            actions: l.actions.map((x) => ({ ...x })),
          });
        }
        break;
      }
    }
  }
  for (const ch of plan.chambers)
    for (const pt of ch.ports) {
      pt.to = plan.chambers.findIndex((c) => c.id === pt.toId);
      if (pt.to < 0) warnings.push(`Câmara ${ch.ref}: a porta leva a uma câmara que ficou de fora`);
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
