import type { Shape } from "@/model/types";
import { MIN_AREA, difference, repairShape } from "./clip";
import { decomposeConvex, type Piece } from "./decompose";
import { involuteGear, ratchet } from "./gear";
import { massProps, type MassProps, type PolyWithHoles } from "./polygon";
import { circleRing } from "./primitives";
import { fail, ok, type GeoResult } from "./result";

/**
 * Forma da cena (src/model) → geometria: contorno para desenho, peças
 * convexas para o motor e propriedades de massa por unidade de densidade.
 */
export interface ShapeGeometry {
  /** contorno(s) no espaço local da peça */
  outline: PolyWithHoles[];
  /** peças convexas (círculos e polígonos de até 8 vértices) */
  pieces: Piece[];
  mass: MassProps;
  /** área perdida na decomposição, mm² */
  discardedArea: number;
}

/** Catraca a partir da forma de engrenagem do v1 (mesmas proporções do protótipo). */
export function ratchetFromGearShape(module: number, teeth: number, bore: number) {
  const r = (module * teeth) / 2;
  const depth = (Math.PI * module) / 2;
  return ratchet({ teeth, outerRadius: r + 0.4 * depth, depth, bore });
}

/** Soma propriedades de massa de várias formas (eixos paralelos). */
export function combineMass(list: MassProps[]): MassProps {
  let a = 0;
  let sx = 0;
  let sy = 0;
  for (const m of list) {
    a += m.area;
    sx += m.area * m.centroid[0];
    sy += m.area * m.centroid[1];
  }
  if (a <= 0) return { area: 0, centroid: [0, 0], inertia: 0 };
  const cx = sx / a;
  const cy = sy / a;
  let j = 0;
  for (const m of list) {
    const dx = m.centroid[0] - cx;
    const dy = m.centroid[1] - cy;
    j += m.inertia + m.area * (dx * dx + dy * dy);
  }
  return { area: a, centroid: [cx, cy], inertia: j };
}

function decomposeAll(shapes: PolyWithHoles[]): GeoResult<{ pieces: Piece[]; discarded: number }> {
  const pieces: Piece[] = [];
  const warnings: string[] = [];
  let discarded = 0;
  for (const s of shapes) {
    const d = decomposeConvex(s);
    if (!d.ok) return d;
    warnings.push(...d.warnings);
    discarded += d.value.discardedArea;
    for (const p of d.value.pieces) pieces.push({ kind: "poly", points: p });
  }
  return ok({ pieces, discarded }, warnings);
}

export function shapeGeometry(shape: Shape): GeoResult<ShapeGeometry> {
  switch (shape.kind) {
    case "circle": {
      if (!(shape.r > 0)) return fail("invalid", "O raio precisa ser maior que zero");
      const disc: PolyWithHoles = { outer: circleRing([0, 0], shape.r), holes: [] };
      if (shape.holes.length === 0) {
        const a = Math.PI * shape.r * shape.r;
        if (a < MIN_AREA) return fail("too-small", "A forma é pequena demais");
        return ok({
          outline: [disc],
          pieces: [{ kind: "circle", c: [0, 0], r: shape.r }],
          mass: { area: a, centroid: [0, 0], inertia: (a * shape.r * shape.r) / 2 },
          discardedArea: 0,
        });
      }
      const d = difference(
        disc,
        shape.holes.map((h) => ({ outer: h, holes: [] })),
      );
      if (!d.ok) return d;
      if (d.value.length === 0) return fail("empty", "Os furos removeram a peça inteira");
      const pcs = decomposeAll(d.value);
      if (!pcs.ok) return pcs;
      return ok(
        {
          outline: d.value,
          pieces: pcs.value.pieces,
          mass: combineMass(d.value.map(massProps)),
          discardedArea: pcs.value.discarded,
        },
        pcs.warnings,
      );
    }
    case "poly": {
      const r = repairShape({ outer: shape.outer, holes: shape.holes });
      if (!r.ok) return r;
      const pcs = decomposeAll(r.value);
      if (!pcs.ok) return pcs;
      return ok(
        {
          outline: r.value,
          pieces: pcs.value.pieces,
          mass: combineMass(r.value.map(massProps)),
          discardedArea: pcs.value.discarded,
        },
        [...r.warnings, ...pcs.warnings],
      );
    }
    case "gear": {
      const g =
        shape.profile === "ratchet"
          ? ratchetFromGearShape(shape.module, shape.teeth, shape.bore)
          : involuteGear({
              module: shape.module,
              teeth: shape.teeth,
              pressureAngle: shape.pressureAngle,
              bore: shape.bore,
            });
      if (!g.ok) return g;
      return ok(
        {
          outline: [g.value.outline],
          pieces: g.value.pieces,
          mass: massProps(g.value.outline),
          discardedArea: 0,
        },
        g.warnings,
      );
    }
  }
}
