import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { area, signedArea } from "@/geometry/polygon";
import { straightSlot } from "@/geometry/slot";
import type { Vec2 } from "@/geometry/vec";
import { validateScene } from "@/model/scene";
import type { Part, Scene } from "@/model/types";
import { prepareScene } from "@/render/prepare";
import { hammerFix, hammerPoint } from "./hammer";
import { emptyHistory, push, redo, run, undo } from "./history";
import { commitPlan, DEFAULT_PENCIL, pencilPlan, type PencilTool } from "./pencil";

/** Item 15.3: traço com largura (pincel e borracha) e régua. */

const hash = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
const PX = 0.2;

function noise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

const rect = (w: number, h: number): Part["shape"] => ({
  kind: "poly",
  outer: [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ],
  holes: [],
});

function scene(): Scene {
  return {
    version: 4,
    meta: { title: "Traço", createdAt: "2026-11-07T00:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z" },
    settings: { gravity: { on: false, g: 9810 }, snap: { grid: 1, on: false } },
    layers: [
      { id: "L1", name: "Base", visible: true, locked: false, thickness: 3 },
      { id: "L2", name: "Peças", visible: true, locked: false, thickness: 3 },
    ],
    parts: [
      {
        id: "plate",
        ref: 1,
        name: "Placa 1",
        layer: "L1",
        x: 0,
        y: 0,
        angle: 0,
        shape: rect(60, 40),
        material: "steel",
        fixed: true,
        fast: false,
      },
    ],
    links: [],
  };
}

function draw(s: Scene, tool: Partial<PencilTool>, points: Vec2[], layer = 0, tap = false) {
  const plan = pencilPlan(
    prepareScene(s),
    { ...DEFAULT_PENCIL, ...tool },
    { points, tap, px: PX },
    layer,
    null,
  );
  if (plan.kind === "none") throw new Error(plan.reason);
  const c = commitPlan(s, plan, s.layers[layer]!.id);
  if (c.kind !== "command") throw new Error(c.reason);
  const r = run(s, c.command.label, c.command.recipe)!;
  expect(validateScene(r.scene).ok).toBe(true);
  const back = undo(r.scene, push(emptyHistory(), r.entry))!;
  expect(hash(back.scene)).toBe(hash(s));
  expect(hash(redo(back.scene, back.history)!.scene)).toBe(hash(r.scene));
  return r.scene;
}

const holeAreas = (p: Part) =>
  p.shape.kind === "poly" ? p.shape.holes.map((h) => Math.abs(signedArea(h))) : [];

describe("Lápis: traço com largura", () => {
  it("borracha de 2 mm num traço de 30 mm tira 60 mm² ±5% (sem as pontas redondas)", () => {
    const pts: Vec2[] = [];
    for (let i = 0; i <= 60; i++) pts.push([-15 + i * 0.5, 0.15 * Math.sin(i / 6)]);
    const out = draw(scene(), { form: "stroke", op: "cut", width: 2 }, pts);
    const [hole] = holeAreas(out.parts[0]!);
    const body = hole! - Math.PI * 1 * 1;
    expect(Math.abs(body - 60) / 60).toBeLessThan(0.05);
  });

  it("toque com borracha de 3 mm dá furo de Ø 3 ±0,05 mm", () => {
    const out = draw(scene(), { form: "stroke", op: "cut", width: 3 }, [[5, 5]], 0, true);
    const shape = out.parts[0]!.shape;
    if (shape.kind !== "poly") throw new Error("poly");
    const h = shape.holes[0]!;
    const xs = h.map((p) => p[0]);
    const ys = h.map((p) => p[1]);
    expect(Math.abs(Math.max(...xs) - Math.min(...xs) - 3)).toBeLessThan(0.05);
    expect(Math.abs(Math.max(...ys) - Math.min(...ys) - 3)).toBeLessThan(0.05);
    expect(Math.abs(2 * Math.sqrt(Math.abs(signedArea(h)) / Math.PI) - 3)).toBeLessThan(0.05);
  });

  it("pincel no vazio cria a peça (barra à mão)", () => {
    const s = scene();
    const pts: Vec2[] = [];
    for (let i = 0; i <= 40; i++) pts.push([45 + i * 0.5, -10 + i * 0.3]);
    const out = draw(s, { form: "stroke", op: "add", width: 5 }, pts, 1);
    expect(out.parts).toHaveLength(2);
    const made = out.parts[1]!;
    expect(made).toMatchObject({ layer: "L2", material: "steel", fixed: false });
    const m = prepareScene(out).parts.get(made.id)!;
    // barra de ~23 mm com 5 mm de largura e pontas redondas
    expect(m.area).toBeGreaterThan(5 * 23);
    expect(m.area).toBeLessThan(5 * 24 + Math.PI * 6.25 + 5);
  });

  it("pincel que encosta na peça une a ela (alavanca à mão)", () => {
    const pts: Vec2[] = [];
    for (let i = 0; i <= 30; i++) pts.push([25 + i * 0.5, 0]);
    const out = draw(scene(), { form: "stroke", op: "add", width: 4 }, pts);
    expect(out.parts).toHaveLength(1);
    expect(prepareScene(out).parts.get("plate")!.area).toBeGreaterThan(2400 + 30);
  });
});

describe("Lápis: régua", () => {
  function shakySlot(): Scene {
    const rnd = noise(5);
    const pts: Vec2[] = [];
    for (let i = 0; i <= 60; i++) pts.push([0.9 * 2 * rnd(), -10 + i * (20 / 60)]);
    return draw(scene(), { form: "stroke", op: "cut", width: 3, ruler: true }, pts);
  }
  it("traço tremido de ±1 mm vira rasgo reto", () => {
    const out = shakySlot();
    const shape = out.parts[0]!.shape;
    if (shape.kind !== "poly") throw new Error("poly");
    expect(shape.holes).toHaveLength(1);
    const slot = straightSlot(shape.holes[0]!);
    expect(slot).not.toBeNull();
    expect(slot!.r).toBeCloseTo(1.5, 2);
    expect(slot!.length).toBeGreaterThan(18);
  });

  it("o Martelo põe um pino joint no rasgo, e ele corre no Testar", async () => {
    const s = structuredClone(shakySlot());
    s.parts.push({
      id: "bar",
      ref: 5,
      name: "Barra 5",
      layer: "L2",
      x: 0,
      y: -4,
      angle: 0,
      shape: rect(8, 4),
      material: "steel",
      fixed: false,
      fast: false,
    });
    const model = prepareScene(s);
    const hit = hammerPoint(model, "pin", [0, -4], 1, 0.001);
    const stamp = hammerFix(model, "pin", hit)!;
    expect(stamp.warning).toBeUndefined();
    const r = run(s, stamp.command.label, stamp.command.recipe)!;
    const slotLink = r.scene.links.find((l) => l.kind === "slot");
    expect(slotLink).toMatchObject({ kind: "slot", mode: "joint", guide: "plate" });
    // no Testar, com gravidade (y para baixo na prancha), a barra corre pelo rasgo
    const sim = { ...r.scene, settings: { ...r.scene.settings, gravity: { on: true, g: 9810 } } };
    const { loadBox2d } = await import("@/engine/box2d/load");
    const engine = (await loadBox2d())();
    const report = engine.compile(sim, { unitMm: 1 });
    expect(report.warnings).toEqual([]);
    let maxX = 0;
    for (let i = 0; i < 240; i++) {
      engine.step(1 / 240);
      maxX = Math.max(maxX, Math.abs(engine.snapshot().parts.bar!.x));
    }
    const end = engine.snapshot().parts.bar!;
    expect(end.y).toBeGreaterThan(4);
    expect(maxX).toBeLessThan(0.3);
    engine.dispose();
  });

  it("círculo à mão com régua vira círculo de raio ±3%", () => {
    const rnd = noise(3);
    const pts: Vec2[] = [];
    for (let i = 0; i <= 90; i++) {
      const a = (2 * Math.PI * i) / 90;
      const r = 6 + 0.4 * 2 * rnd();
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const out = draw(scene(), { form: "contour", op: "cut", ruler: true }, pts);
    const shape = out.parts[0]!.shape;
    if (shape.kind !== "poly") throw new Error("poly");
    const h = shape.holes[0]!;
    const c = [h.reduce((s, p) => s + p[0], 0) / h.length, h.reduce((s, p) => s + p[1], 0) / h.length];
    const radii = h.map((p) => Math.hypot(p[0] - c[0]!, p[1] - c[1]!));
    const mean = radii.reduce((s, v) => s + v, 0) / radii.length;
    expect(Math.abs(mean - 6) / 6).toBeLessThan(0.03);
    // e é círculo de verdade: todos os raios iguais
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.05);
    void area;
  });
});
