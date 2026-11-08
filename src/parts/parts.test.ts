import { describe, expect, it } from "vitest";
import { shapeGeometry } from "@/geometry/shape";
import { shapeOutline } from "@/geometry/outline";
import type { Scene } from "@/model/types";
import { validateScene } from "@/model/scene";
import { GENERATORS, buildPart, clampParams, defaults, mirroredShape, paramsOf, regenerate } from "./index";
import { run } from "@/editor/history";
import { deleteParts, duplicatePart, movePart, setPose } from "@/editor/commands";
import { buildPlan } from "@/engine/plan";
import { CAPSULE_CHARGES, CAPSULE_DEFAULTS, CAPSULE_PROPORTIONS, capsuleGeometry } from "./capsule";
import { buildInsertion } from "./insert";

const blank: Scene = {
  version: 4,
  meta: { title: "t", createdAt: "", updatedAt: "" },
  settings: { gravity: { on: true, g: 9810 }, snap: { grid: 2, on: true } },
  layers: [
    { id: "L1", name: "Fundo", visible: true, locked: false, thickness: 3 },
    { id: "L2", name: "Meio", visible: true, locked: false, thickness: 3 },
  ],
  parts: [],
  links: [],
};

/** área analítica esperada de cada peça com os parâmetros padrão (mm²), com tolerância */
const AREA: Record<string, [number, number]> = {
  plate: [60 * 40 - (4 - Math.PI) * 9, 0.01],
  bar: [(80 - 8) * 8 + Math.PI * 16, 0.01],
  disc: [Math.PI * 225, 0.002],
  block: [400, 0.001],
  lever: [(60 - 10) * 10 + Math.PI * 25 - 2 * Math.PI * 4, 0.01],
  ball: [Math.PI * 9, 0.002],
  "plate-hole": [40 * 30 - (4 - Math.PI) * 4 - Math.PI * 9, 0.01],
  "plate-slot": [40 * 16 - (4 - Math.PI) * 4 - (16 * 4 + Math.PI * 4), 0.01],
};

describe("peças prontas", () => {
  it("incluem came e peças multicamada, com nome, parâmetros com faixa e unidade, e padrões dentro da faixa", () => {
    expect(GENERATORS.map((g) => g.id)).toEqual([
      "plate",
      "bar",
      "disc",
      "block",
      "lever",
      "ball",
      "gear",
      "ratchet",
      "rack",
      "plate-hole",
      "plate-slot",
      "cam",
      "gear-ratchet",
      "pinion-crank",
      "capsule",
      "extractor",
      "ejector",
    ]);
    for (const g of GENERATORS) {
      expect(g.name.length).toBeGreaterThan(2);
      for (const p of g.params) {
        expect(p.min).toBeLessThan(p.max);
        expect(p.default).toBeGreaterThanOrEqual(p.min);
        expect(p.default).toBeLessThanOrEqual(p.max);
      }
      for (const k of g.main) expect(g.params.some((p) => p.key === k)).toBe(true);
    }
  });

  for (const g of GENERATORS)
    it(`${g.name}: forma válida no padrão e nos limites dos parâmetros, com área coerente`, () => {
      const cases = [defaults(g)];
      for (const p of g.params) {
        cases.push(clampParams(g, { ...defaults(g), [p.key]: p.min }));
        cases.push(clampParams(g, { ...defaults(g), [p.key]: p.max }));
      }
      for (const params of cases) {
        const shape = g.build(params);
        const o = shapeOutline(shape);
        expect(o.ok, `${g.id} ${JSON.stringify(params)}`).toBe(true);
        const geo = shapeGeometry(shape);
        expect(geo.ok, `${g.id} decomposição ${JSON.stringify(params)}`).toBe(true);
        if (o.ok) expect(o.value.mass.area).toBeGreaterThan(0);
      }
      const exp = AREA[g.id];
      if (exp) {
        const o = shapeOutline(g.build(defaults(g)));
        if (!o.ok) throw new Error("forma");
        expect(Math.abs(o.value.mass.area - exp[0]) / exp[0]).toBeLessThan(exp[1]);
      }
      // espelhada também vale
      const part = buildPart(blank, g.id, { x: 0, y: 0, layer: "L2" });
      const m = mirroredShape(part);
      if (m) expect(shapeOutline(m).ok).toBe(true);
    });

  it("peça nova: próximo número de chamada, nome com número, fixa só na camada 1", () => {
    const a = buildPart(blank, "bar", { x: 0, y: 0, layer: "L1" });
    expect(a.fixed).toBe(true);
    expect(a.name).toBe("Barra 1");
    const s1 = { ...blank, parts: [a] };
    const b = buildPart(s1, "bar", { x: 0, y: 0, layer: "L2" });
    expect(b.fixed).toBe(false);
    expect(b.name).toBe("Barra 2");
    expect(b.ref).toBe(a.ref + 1);
    expect(b.source?.generator).toBe("bar");
    expect(validateScene({ ...s1, parts: [a, b] }).ok).toBe(true);
  });

  it("mudar o tamanho refaz a forma pelos parâmetros", () => {
    const a = buildPart(blank, "bar", { x: 0, y: 0, layer: "L2" });
    const s = { ...blank, parts: [a] };
    const cmd = regenerate(s, a.id, { l: 120 })!;
    const next = run(s, cmd.label, cmd.recipe)!.scene;
    expect(paramsOf(next.parts[0]!)!.params.l).toBe(120);
    const o = shapeOutline(next.parts[0]!.shape);
    if (!o.ok) throw new Error("forma");
    expect(o.value.mass.area).toBeCloseTo((120 - 8) * 8 + Math.PI * 16, 0);
    expect(regenerate(next, a.id, { l: 120 })).toBeNull();
  });
});

describe("peças do ciclo (Fase 2 · M2a)", () => {
  const scene = (): Scene => structuredClone(blank);
  const insert = (sc: Scene, id: string, x = 0, y = 0, layer = "L2") => {
    const ins = buildInsertion(sc, id, { x, y, layer })!;
    return { scene: run(sc, ins.command.label, ins.command.recipe)!.scene, id: ins.id };
  };

  it("cápsula: a área do estojo, a massa no latão, o aro maior que o corpo e a esfera presa na boca", () => {
    const { scene: sc, id } = insert(scene(), "capsule", 10, 5);
    expect(validateScene(sc).ok).toBe(true);
    const kase = sc.parts.find((p) => p.id === id)!;
    expect(kase.material).toBe("brass");
    const c = kase.capsule!;
    expect(c.charge).toBe(CAPSULE_CHARGES[1]);
    const geo = capsuleGeometry(CAPSULE_DEFAULTS);
    // área: aro + canaleta + corpo − furo, com o rebaixo do aro (dois triângulos)
    const P = CAPSULE_PROPORTIONS;
    const D = CAPSULE_DEFAULTS.diameter;
    const R = CAPSULE_DEFAULTS.rim;
    const L = CAPSULE_DEFAULTS.length;
    const und = P.rimUndercut * (R / 2 - (D / 2 - P.grooveDepth)) ** 2;
    const area =
      P.rimWidth * R +
      P.grooveWidth * (D - 2 * P.grooveDepth) +
      (L - P.rimWidth - P.grooveWidth) * D -
      (L - P.baseThickness) * geo.capsule.bore +
      und;
    const o = shapeOutline(kase.shape);
    if (!o.ok) throw new Error("forma");
    expect(o.value.mass.area).toBeCloseTo(area, 3);
    expect(geo.rimHalf).toBeGreaterThan(geo.bodyHalf);
    expect(geo.grooveHalf).toBeLessThan(geo.bodyHalf);
    // massa no motor: latão × área × espessura da camada
    const plan = buildPlan(sc);
    const body = plan.bodies[plan.partRel.get(id)!.body]!;
    expect(body.mass).toBeCloseTo(0.0085 * area * 3, 3);
    // a esfera presa: um disco de aço na boca, na camada do estojo, cabendo no furo
    const ball = sc.parts.find((p) => p.id === c.projectile)!;
    expect(ball.shape.kind).toBe("circle");
    expect(ball.layer).toBe(kase.layer);
    expect(ball.x).toBeCloseTo(10 + geo.ball.at[0], 6);
    if (ball.shape.kind === "circle") expect(2 * ball.shape.r).toBeLessThan(c.bore);
    expect(plan.capsules).toHaveLength(1);
    expect(plan.capsules[0]!.ball).toBeGreaterThan(0);
  });

  it("cápsula: mudar o comprimento refaz o estojo e leva a esfera para a nova boca", () => {
    const { scene: sc, id } = insert(scene(), "capsule");
    const cmd = regenerate(sc, id, { length: 30 })!;
    const next = run(sc, cmd.label, cmd.recipe)!.scene;
    expect(validateScene(next).ok).toBe(true);
    const kase = next.parts.find((p) => p.id === id)!;
    expect(kase.capsule!.mouth[0]).toBeCloseTo(15, 6);
    const ball = next.parts.find((p) => p.id === kase.capsule!.projectile)!;
    expect(ball.x).toBeCloseTo(capsuleGeometry({ ...CAPSULE_DEFAULTS, length: 30 }).ball.at[0], 6);
  });

  it("cápsula: mover, girar, duplicar e excluir o estojo cuidam da esfera", () => {
    const first = insert(scene(), "capsule");
    const id = first.id;
    let sc = first.scene;
    const ballOf = (s: Scene, cid: string) =>
      s.parts.find((p) => p.id === s.parts.find((q) => q.id === cid)!.capsule!.projectile)!;
    const b0 = ballOf(sc, id);
    let cmd = movePart(sc, id, 20, 7)!;
    sc = run(sc, cmd.label, cmd.recipe)!.scene;
    expect(ballOf(sc, id).x).toBeCloseTo(b0.x + 20, 6);
    expect(ballOf(sc, id).y).toBeCloseTo(b0.y + 7, 6);
    cmd = setPose(sc, id, { x: 20, y: 7, angle: Math.PI / 2 })!;
    sc = run(sc, cmd.label, cmd.recipe)!.scene;
    expect(ballOf(sc, id).x).toBeCloseTo(20, 6);
    expect(ballOf(sc, id).y).toBeCloseTo(7 + (b0.x - 0), 6);
    const dup = duplicatePart(sc, id)!;
    sc = run(sc, dup.command.label, dup.command.recipe)!.scene;
    expect(validateScene(sc).ok).toBe(true);
    expect(ballOf(sc, dup.newId).id).not.toBe(ballOf(sc, id).id);
    // excluir a esfera deixa o estojo vazio; excluir o estojo leva a esfera
    const ball = ballOf(sc, dup.newId).id;
    cmd = deleteParts(sc, [ball])!;
    const emptied = run(sc, cmd.label, cmd.recipe)!.scene;
    expect(emptied.parts.find((p) => p.id === dup.newId)!.capsule!.projectile).toBeUndefined();
    expect(validateScene(emptied).ok).toBe(true);
    cmd = deleteParts(sc, [id])!;
    const gone = run(sc, cmd.label, cmd.recipe)!.scene;
    expect(gone.parts).toHaveLength(2);
    expect(validateScene(gone).ok).toBe(true);
  });

  it("extrator: gancho com o furo do eixo, já cravado com mola de torção na peça de baixo", () => {
    let sc = scene();
    const plate = buildPart(sc, "plate", { x: 0, y: 0, layer: "L1" });
    sc = { ...sc, parts: [plate] };
    const { scene: s2, id } = insert(sc, "extractor", 5, 3);
    expect(validateScene(s2).ok).toBe(true);
    const ext = s2.parts.find((p) => p.id === id)!;
    expect(ext.shape.kind === "poly" && ext.shape.holes.length).toBe(1);
    const axle = s2.links.find((l) => l.kind === "axle" && l.b === id)!;
    expect(axle.kind === "axle" && axle.a).toBe(plate.id);
    expect(axle.kind === "axle" && axle.torsion?.k).toBeGreaterThan(0);
    expect(axle.kind === "axle" && axle.limit).toBeTruthy();
    // sem nada embaixo, crava no fundo
    const { scene: s3, id: id3 } = insert(scene(), "extractor", 500, 500);
    expect(
      s3.links.find((l) => l.kind === "axle" && l.b === id3)!.kind === "axle" &&
        (s3.links[0] as { a: null }).a,
    ).toBeNull();
  });

  it("ejetor: batente fixo em qualquer camada", () => {
    const { scene: sc, id } = insert(scene(), "ejector");
    expect(sc.parts.find((p) => p.id === id)!.fixed).toBe(true);
  });
});
