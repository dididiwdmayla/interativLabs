import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { area, signedArea } from "@/geometry/polygon";
import { totalArea } from "@/geometry/stroke";
import type { Vec2 } from "@/geometry/vec";
import { validateScene } from "@/model/scene";
import type { Link, Part, Scene } from "@/model/types";
import { prepareScene } from "@/render/prepare";
import { buildPart } from "@/parts";
import { emptyHistory, push, redo, run, undo } from "./history";
import { commitPlan, DEFAULT_PENCIL, pencilPlan, resolveSides, type PencilTool } from "./pencil";

const hash = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
const PX = 0.2;

/** Placa de 40×20 mm (paramétrica) na camada 2 e o fundo na 1, sem gravidade. */
function plateScene(): { scene: Scene; plate: Part } {
  const base: Scene = {
    version: 4,
    meta: { title: "Lápis", createdAt: "2026-11-07T00:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z" },
    settings: { gravity: { on: false, g: 9810 }, snap: { grid: 1, on: false } },
    layers: [
      { id: "L1", name: "Base", visible: true, locked: false, thickness: 3 },
      { id: "L2", name: "Peças", visible: true, locked: false, thickness: 3 },
    ],
    parts: [],
    links: [],
  };
  const plate = buildPart(base, "plate", { layer: "L2", x: 0, y: 0, params: { w: 40, h: 20 } });
  plate.fixed = false;
  base.parts.push(plate);
  return { scene: base, plate };
}

function apply(
  scene: Scene,
  tool: Partial<PencilTool>,
  points: Vec2[],
  opts: { tap?: boolean; flip?: boolean; separate?: boolean; selected?: string | null } = {},
) {
  const model = prepareScene(scene);
  const t = { ...DEFAULT_PENCIL, ...tool };
  const plan = pencilPlan(model, t, { points, tap: !!opts.tap, px: PX }, 1, opts.selected ?? null);
  if (plan.kind === "none") throw new Error(plan.reason);
  if (plan.kind === "sides" && opts.flip) plan.pick = plan.pick === 0 ? 1 : 0;
  const c = commitPlan(scene, plan, "L2", { separate: opts.separate });
  if (c.kind !== "command") throw new Error(c.reason);
  const result = run(scene, c.command.label, c.command.recipe)!;
  const valid = validateScene(result.scene);
  expect(valid.ok, JSON.stringify(valid)).toBe(true);
  // desfazer volta ao hash anterior; refazer, ao novo
  const back = undo(result.scene, push(emptyHistory(), result.entry))!;
  expect(hash(back.scene)).toBe(hash(scene));
  expect(hash(redo(back.scene, back.history)!.scene)).toBe(hash(result.scene));
  return { scene: result.scene, plan, command: c.command };
}

const loop = (c: Vec2, r: number, n = 120): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Vec2;
  });

const partArea = (p: Part) => {
  const m = prepareScene({ ...plateScene().scene, parts: [p], links: [] }).parts.get(p.id)!;
  return m.area;
};

describe("Lápis: contorno", () => {
  it("laço dentro da placa de 40×20 tira a área do laço ±2%, e a peça vira forma livre", () => {
    const { scene, plate } = plateScene();
    const ring = loop([4, 2], 5);
    const { scene: out, command } = apply(scene, { form: "contour", op: "cut" }, ring);
    const cut = out.parts[0]!;
    expect(cut.source).toBeUndefined();
    expect(command.label).toBe(`Recortar ${plate.name}`);
    expect(command.notice).toMatch(/forma livre/);
    const removed = partArea(plate) - partArea(cut);
    const drawn = Math.abs(signedArea(ring.slice(0, -1)));
    expect(Math.abs(removed - drawn) / drawn).toBeLessThan(0.02);
  });

  it("traço de borda a borda tira o lado escolhido, e trocar lado inverte", () => {
    const { scene } = plateScene();
    const line: Vec2[] = [
      [8, -14],
      [8.3, -5],
      [7.8, 5],
      [8, 14],
    ];
    const small = apply(scene, { form: "contour", op: "cut" }, line);
    expect(small.plan.kind).toBe("sides");
    // o lado menor (x > 8, 12 mm × 20) sai
    expect(partArea(small.scene.parts[0]!)).toBeCloseTo(560, -1);
    const flipped = apply(scene, { form: "contour", op: "cut" }, line, { flip: true });
    expect(partArea(flipped.scene.parts[0]!)).toBeCloseTo(240, -1);
    if (small.plan.kind === "sides") expect(totalArea(resolveSides(small.plan))).toBeCloseTo(560, -1);
  });

  it("corte em duas partes soltas cria duas peças e cada ligação fica do seu lado", () => {
    const { scene, plate } = plateScene();
    const other = {
      ...structuredClone(plate),
      id: "anchor",
      ref: 50,
      name: "Âncora",
      layer: "L1",
      fixed: true,
    };
    scene.parts.unshift(other);
    const left: Link = { kind: "axle", id: "kL", ref: 60, a: "anchor", b: plate.id, at: [-15, 0] };
    const right: Link = { kind: "screw", id: "kR", ref: 61, a: "anchor", b: plate.id, at: [15, 0] };
    const gone: Link = {
      kind: "pin",
      id: "kP",
      ref: 62,
      host: plate.id,
      at: [0, 0],
      r: 1,
      layers: ["L2", "L2"],
    };
    scene.links.push(left, right, gone);
    // um furo largo no meio que vai de borda a borda: uma faixa vertical de 4 mm
    const band: Vec2[] = [
      [-2, -15],
      [2, -15],
      [2, 15],
      [-2, 15],
      [-2, -15],
    ];
    const { scene: out, command } = apply(scene, { form: "contour", op: "cut" }, band, {
      selected: plate.id,
    });
    const parts = out.parts.filter((p) => p.layer === "L2");
    expect(parts).toHaveLength(2);
    const [kept, made] = [parts.find((p) => p.id === plate.id)!, parts.find((p) => p.id !== plate.id)!];
    const l = out.links.find((x) => x.id === "kL") as Extract<Link, { kind: "axle" }>;
    const r = out.links.find((x) => x.id === "kR") as Extract<Link, { kind: "screw" }>;
    const side = (p: Part) => (p.shape.kind === "poly" ? Math.sign(p.shape.outer[0]![0]) : 0);
    expect(l.b === kept.id ? side(kept) : side(made)).toBe(-1);
    expect(r.b === kept.id ? side(kept) : side(made)).toBe(1);
    expect(out.links.find((x) => x.id === "kP")).toBeUndefined();
    expect(command.warning).toMatch(/2 peças/);
    expect(command.warning).toMatch(/pino 62/);
  });
});

describe("Lápis: somar", () => {
  it("Somar no vazio cria a peça na camada ativa (aço, solta, número novo)", () => {
    const { scene } = plateScene();
    const ring = loop([60, 0], 6);
    const { scene: out, command } = apply(scene, { form: "contour", op: "add" }, ring);
    expect(out.parts).toHaveLength(2);
    const p = out.parts[1]!;
    expect(p).toMatchObject({ layer: "L2", material: "steel", fixed: false });
    expect(p.ref).toBeGreaterThan(scene.parts[0]!.ref);
    expect(command.label).toMatch(/^Desenhar Peça à mão 1/);
  });
  it("laço que encosta na placa une à placa", () => {
    const { scene } = plateScene();
    const { scene: out } = apply(scene, { form: "contour", op: "add" }, loop([20, 0], 5));
    expect(out.parts).toHaveLength(1);
    expect(partArea(out.parts[0]!)).toBeGreaterThan(partArea(scene.parts[0]!) + 30);
  });
});

describe("Lápis: física da forma nova", () => {
  it("placa recortada simula sem aviso de geometria, com a massa nova", async () => {
    const { scene } = plateScene();
    const { scene: out } = apply(scene, { form: "contour", op: "cut" }, loop([4, 2], 5));
    const before = prepareScene(scene).parts.get(scene.parts[0]!.id)!.mass;
    const after = prepareScene(out).parts.get(out.parts[0]!.id)!.mass;
    expect(after).toBeLessThan(before);
    expect(after / before).toBeCloseTo((800 - Math.PI * 25) / 800, 2);
    const { loadBox2d } = await import("@/engine/box2d/load");
    const make = await loadBox2d();
    const engine = make();
    const report = engine.compile(
      { ...out, settings: { ...out.settings, gravity: { on: true, g: 9810 } } },
      { unitMm: 1 },
    );
    expect(report.warnings).toEqual([]);
    for (let i = 0; i < 48; i++) engine.step(1 / 240);
    expect(engine.snapshot().parts[out.parts[0]!.id]!.y).toBeGreaterThan(1);
    engine.dispose();
  });
});

void area;
