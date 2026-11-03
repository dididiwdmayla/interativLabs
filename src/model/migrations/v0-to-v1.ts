import { V0_MATERIALS, type MaterialId } from "../materials";
import type { Layer, Link, Part, Scene, Shape, Vec2 } from "../types";
import { DEG, MM_PER_PX, V0_MM_PER_UNIT, rpmToRadPerSec } from "../units";
import type { V0Link, V0Part, V0Scene, V0Shape, V0Vec } from "../v0";

/**
 * Migração v0 (protótipo, px) → v1 (mm).
 *
 * Comprimento: 1 px = 0,2 mm. O motor do protótipo usava 50 px por unidade,
 * ou seja, 10 mm por unidade, com massa em g (densidade × área em cm² ×
 * 1 cm de espessura, igual à espessura nominal do v1). Por isso:
 *   força       v0 (g·10mm/s²)       × 10   → g·mm/s²
 *   torque      v0 (g·(10mm)²/s²)    × 100  → g·mm²/s²
 *   rigidez e amortecimento lineares: mesma unidade (g/s², g/s), sem fator
 *   rigidez e amortecimento de torção: × 100
 *   carga da câmara (força × distância): × 100
 *   gravidade   10 un/s² × 10 mm/un = 100 mm/s² (o valor calibrado do protótipo)
 *
 * Formas: engrenagem v0 {r, teeth, depth, style} → módulo = 2r/dentes, 20°,
 * sem furo; "reto" vira perfil evolvente (o v0 usava um trapézio aproximado)
 * e "serra" vira catraca. O resto é conversão direta.
 *
 * Números de chamada: atribuídos na ordem do arquivo, peças primeiro.
 */

const FORCE = V0_MM_PER_UNIT;
const TORQUE = V0_MM_PER_UNIT * V0_MM_PER_UNIT;
const DEFAULT_PRESSURE_ANGLE = 20 * DEG;

export interface MigrateOptions {
  /** Data para meta.createdAt/updatedAt (ISO). Padrão: agora. */
  now?: string;
}

/** px → mm; normaliza -0 para 0 (JSON não guarda o sinal do zero). */
const mm = (px: number) => px * MM_PER_PX + 0;
const vmm = (p: V0Vec): Vec2 => [mm(p[0]), mm(p[1])];

function rot(p: Vec2, a: number): Vec2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

function toWorld(part: V0Part, p: V0Vec): Vec2 {
  const r = rot([p[0], p[1]], part.angle ?? 0);
  return [part.x + r[0], part.y + r[1]];
}

function migrateShape(s: V0Shape): Shape {
  switch (s.type) {
    case "poly":
      return { kind: "poly", outer: s.pts.map(vmm), holes: [] };
    case "circle":
      return { kind: "circle", r: mm(s.r), holes: [] };
    case "gear":
      return {
        kind: "gear",
        module: (2 * mm(s.r)) / s.teeth,
        teeth: s.teeth,
        pressureAngle: DEFAULT_PRESSURE_ANGLE,
        profile: s.style === "serra" ? "ratchet" : "involute",
        bore: 0,
      };
  }
}

function migrateMaterial(m: string | undefined): MaterialId {
  return (m && V0_MATERIALS[m]) || "steel";
}

export function migrateV0ToV1(v0: V0Scene, opts: MigrateOptions = {}): Scene {
  const now = opts.now ?? new Date().toISOString();
  let ref = 0;
  const nextRef = () => ++ref;

  const layers: Layer[] = v0.layers.map((l) => ({
    id: l.id,
    name: l.name,
    visible: l.visible !== false,
    locked: false,
  }));

  const byId = new Map<string, V0Part>(v0.parts.map((p) => [p.id, p]));

  const parts: Part[] = v0.parts.map((p) => ({
    id: p.id,
    ref: nextRef(),
    name: p.name,
    layer: p.layer,
    x: mm(p.x),
    y: mm(p.y),
    angle: p.angle ?? 0,
    shape: migrateShape(p.shape),
    material: migrateMaterial(p.material),
    fixed: !!p.fixed,
    fast: !!p.bullet,
  }));

  const hostLayer = (id: string) => byId.get(id)?.layer ?? layers[0]?.id ?? "";

  const links: Link[] = v0.links.map((L: V0Link): Link => {
    const id = L.id;
    switch (L.type) {
      case "screw":
        return { id, ref: nextRef(), kind: "screw", a: L.a ?? null, b: L.b, at: vmm(L.p) };
      case "axle": {
        const link: Link = { id, ref: nextRef(), kind: "axle", a: L.a ?? null, b: L.b, at: vmm(L.p) };
        if (L.motorOn)
          link.motor = { speed: rpmToRadPerSec(L.rpm ?? 0), maxTorque: (L.torque ?? 0) * TORQUE };
        if (L.limitOn) link.limit = { lower: (L.lower ?? 0) * DEG, upper: (L.upper ?? 0) * DEG };
        if ((L.tk ?? 0) > 0 || (L.td ?? 0) > 0) {
          link.torsion = {
            k: (L.tk ?? 0) * TORQUE,
            rest: (L.trest ?? 0) * DEG,
            damping: (L.td ?? 0) * TORQUE,
          };
        }
        return link;
      }
      case "pin":
        return {
          id,
          ref: nextRef(),
          kind: "pin",
          host: L.host,
          at: vmm(L.p),
          r: mm(L.r ?? 5),
          layers: [L.from ?? hostLayer(L.host), L.to ?? L.from ?? hostLayer(L.host)],
        };
      case "sensor":
        return {
          id,
          ref: nextRef(),
          kind: "sensor",
          host: L.host,
          at: vmm(L.p),
          r: mm(L.r ?? 5),
          layers: [L.from ?? hostLayer(L.host), L.to ?? L.from ?? hostLayer(L.host)],
          minSpeed: mm(L.minSpeed ?? 0),
          triggers: L.target ? [L.target] : [],
        };
      case "slider": {
        const link: Link = {
          id,
          ref: nextRef(),
          kind: "slider",
          a: L.a ?? null,
          b: L.b,
          at: vmm(L.p),
          dir: L.dir ?? 0,
          travel: [mm(-(L.back ?? 0)), mm(L.travel ?? 0)],
        };
        if ((L.k ?? 0) > 0 || (L.damp ?? 0) > 0) {
          link.spring = { k: L.k ?? 0, rest: mm(L.rest ?? 0), damping: L.damp ?? 0 };
        }
        return link;
      }
      case "spring": {
        const pa = L.a && byId.get(L.a) ? toWorld(byId.get(L.a) as V0Part, L.pa) : L.pa;
        const pb = L.b && byId.get(L.b) ? toWorld(byId.get(L.b) as V0Part, L.pb) : L.pb;
        const drawn = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        return {
          id,
          ref: nextRef(),
          kind: "spring",
          a: L.a ?? null,
          b: L.b ?? null,
          atA: vmm(L.pa),
          atB: vmm(L.pb),
          k: L.k ?? 0,
          damping: L.damp ?? 0,
          freeLength: mm((drawn * (L.free ?? 100)) / 100),
        };
      }
      case "chamber":
        return {
          id,
          ref: nextRef(),
          kind: "chamber",
          a: L.a ?? null,
          b: L.b ?? null,
          at: vmm(L.p),
          dir: L.dir ?? 0,
          bore: mm(L.width ?? 20),
          length: mm(L.vent ?? 200),
          charge: (L.charge ?? 0) * TORQUE,
          burn: (L.burn ?? 0) / 1000,
        };
    }
  });

  const st = v0.settings ?? {};
  return {
    version: 1,
    meta: { title: v0.title ?? "Projeto sem nome", createdAt: now, updatedAt: now },
    settings: {
      gravity: { on: st.gravity !== false, g: (st.g ?? 10) * V0_MM_PER_UNIT },
      snap: { grid: mm(10), on: st.snap !== false },
    },
    layers,
    parts,
    links,
  };
}

export { FORCE as V0_FORCE_FACTOR, TORQUE as V0_TORQUE_FACTOR };
