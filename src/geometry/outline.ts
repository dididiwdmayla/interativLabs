import type { Shape } from "@/model/types";
import { MIN_AREA, difference, repairShape } from "./clip";
import { involuteGear } from "./gear";
import { massProps, type MassProps, type PolyWithHoles } from "./polygon";
import { circleRing } from "./primitives";
import { fail, ok, type GeoResult } from "./result";
import { combineMass, ratchetFromGearShape } from "./shape-mass";

/**
 * Só o contorno e a massa de uma forma, sem a decomposição convexa (que
 * puxa o earcut e custa caro). É o que o renderizador precisa; o motor usa
 * shapeGeometry. O contorno é o mesmo das duas (teste em outline.test.ts).
 */
export function shapeOutline(shape: Shape): GeoResult<{ outline: PolyWithHoles[]; mass: MassProps }> {
  switch (shape.kind) {
    case "circle": {
      if (!(shape.r > 0)) return fail("invalid", "O raio precisa ser maior que zero");
      const disc: PolyWithHoles = { outer: circleRing([0, 0], shape.r), holes: [] };
      if (shape.holes.length === 0) {
        const a = Math.PI * shape.r * shape.r;
        if (a < MIN_AREA) return fail("too-small", "A forma é pequena demais");
        return ok({
          outline: [disc],
          mass: { area: a, centroid: [0, 0], inertia: (a * shape.r * shape.r) / 2 },
        });
      }
      const d = difference(
        disc,
        shape.holes.map((h) => ({ outer: h, holes: [] })),
      );
      if (!d.ok) return d;
      if (d.value.length === 0) return fail("empty", "Os furos removeram a peça inteira");
      return ok({ outline: d.value, mass: combineMass(d.value.map(massProps)) });
    }
    case "poly": {
      const r = repairShape({ outer: shape.outer, holes: shape.holes });
      if (!r.ok) return r;
      return ok({ outline: r.value, mass: combineMass(r.value.map(massProps)) }, r.warnings);
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
      return ok({ outline: [g.value.outline], mass: massProps(g.value.outline) }, g.warnings);
    }
  }
}
