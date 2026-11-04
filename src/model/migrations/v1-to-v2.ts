import { transform } from "@/geometry/vec";
import type { Link, LinkV1, Scene, SceneV1, Vec2 } from "../types";
import { GAS_RT, KPA_MM2, N, V1_THICKNESS_MM } from "../units";

/**
 * Migração v1 → v2 (docs/arquitetura.md §3.1).
 *
 * - Camadas ganham `thickness` = 10 mm, a espessura nominal com que a v1 (e o
 *   protótipo) calculava a massa. Com as densidades em g/mm³ da tabela de
 *   materiais, as massas continuam as mesmas (a menos do aço, 7,8 → 7,85).
 * - Forças: a v1 guardava g·mm/s² (µN); a v2 guarda N. Rigidez, amortecimento,
 *   torque do motor e mola de torção são divididos por 10⁶.
 * - Mola vira `mode: "fixed"`, com espiras de desenho e comprimento sólido
 *   bem abaixo do menor comprimento que ela tinha (não muda o comportamento).
 * - Câmara vira câmara v2 de uma parede (o projétil), respiro aberto na saída,
 *   gás isotérmico e carga equivalente: a v1 empurrava com F = carga / s; a v2
 *   empurra com (P − p0)·A = n·R·T / s. Com p0 = 0 (ambiente sem pressão,
 *   como na v1), n = carga / (R·T). O escape lento da v1 (τ = 1,5 s) não
 *   existe na v2.
 * - `triggers` do sensor viram `actions: [{ do: "ignite", target }]`.
 * - A gravidade da cena é preservada (as cenas do protótipo continuam com a
 *   gravidade de bancada delas).
 */

const force = (v: number) => v / N;

/** Espiras de desenho de uma mola migrada. */
function coilFor(freeLength: number, drawn: number) {
  const ref = Math.max(1, Math.min(freeLength > 0 ? freeLength : drawn, drawn > 0 ? drawn : freeLength));
  const turns = Math.max(3, Math.round(ref / 6));
  const wireD = Math.min(0.8, ref / (4 * turns));
  return { coil: { outerD: 6, wireD, turns }, solidLength: turns * wireD };
}

export function migrateV1ToV2(v1: SceneV1): Scene {
  const byId = new Map(v1.parts.map((p) => [p.id, p] as const));
  const world = (id: string | null, at: Vec2): Vec2 => {
    const p = id === null ? undefined : byId.get(id);
    return p ? transform(at, p.x, p.y, p.angle) : at;
  };

  const links: Link[] = v1.links.map((l: LinkV1): Link => {
    switch (l.kind) {
      case "screw":
      case "pin":
        return { ...l };
      case "axle": {
        const { motor, torsion, ...rest } = l;
        const out: Link = { ...rest };
        if (motor) out.motor = { speed: motor.speed, maxTorque: force(motor.maxTorque) };
        if (torsion)
          out.torsion = { k: force(torsion.k), rest: torsion.rest, damping: force(torsion.damping) };
        return out;
      }
      case "slider": {
        const { spring, ...rest } = l;
        const out: Link = { ...rest };
        if (spring) out.spring = { k: force(spring.k), rest: spring.rest, damping: force(spring.damping) };
        return out;
      }
      case "spring": {
        const pa = world(l.a, l.atA);
        const pb = world(l.b, l.atB);
        const drawn = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        return {
          id: l.id,
          ref: l.ref,
          kind: "spring",
          a: l.a,
          b: l.b,
          atA: l.atA,
          atB: l.atB,
          k: force(l.k),
          damping: force(l.damping),
          freeLength: l.freeLength,
          mode: "fixed",
          ...coilFor(l.freeLength, drawn),
        };
      }
      case "chamber":
        return {
          id: l.id,
          ref: l.ref,
          kind: "chamber",
          body: l.a,
          at: l.at,
          dir: l.dir,
          bore: l.bore,
          length: l.length,
          walls: l.b === null ? [] : [{ part: l.b, seal: l.length }],
          vents: [{ at: l.length, d: l.bore, open: true }],
          ports: [],
          gas: {
            model: "isothermal",
            gamma: 1.4,
            p0: 0,
            charge: { amount: l.charge / (GAS_RT * KPA_MM2), burnMs: l.burn * 1000 },
          },
        };
      case "sensor": {
        const { triggers, ...rest } = l;
        return { ...rest, actions: triggers.map((target) => ({ do: "ignite" as const, target })) };
      }
    }
  });

  return {
    version: 2,
    meta: { ...v1.meta },
    settings: {
      gravity: { ...v1.settings.gravity },
      snap: { ...v1.settings.snap },
    },
    layers: v1.layers.map((l) => ({ ...l, thickness: V1_THICKNESS_MM })),
    parts: v1.parts.map((p) => ({ ...p })),
    links,
  };
}
