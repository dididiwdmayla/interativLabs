import { writeFileSync } from "node:fs";
import { loadBox2d } from "@/engine/box2d/load";
import { hammerFix, hammerPoint } from "@/editor/hammer";
import { run } from "@/editor/history";
import { commitPlan, DEFAULT_PENCIL, pencilPlan, type PencilTool } from "@/editor/pencil";
import type { Vec2 } from "@/geometry/vec";
import { loadScene } from "@/model/scene";
import type { Link, Part, Scene } from "@/model/types";
import { prepareScene } from "@/render/prepare";
import { INVARIANTS, abuseScene } from "@/sim/abuse";

/**
 * Abuso rápido das formas do Lápis (Fase 1 · Parte E2c, item 15.4): cenas
 * montadas pelos mesmos comandos da interface (laço, borracha com régua,
 * pincel, corte em duas peças), com ligações do Martelo, passam pelas
 * invariantes do teste de abuso nas três velocidades e três manobras.
 * O controle monta o corte em duas com retângulos, sem o Lápis: separa o que
 * é da forma desenhada do que é do arranjo (duas placas articuladas que se
 * chocam na mesma camada).
 * Grava docs/decisoes/abuso-e2c-lapis.json.
 */

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

function base(): Scene {
  return {
    version: 3,
    meta: { title: "Lápis", createdAt: "2026-11-07T00:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z" },
    settings: { gravity: { on: true, g: 9810 }, snap: { grid: 1, on: false } },
    layers: [
      { id: "L1", name: "Base", visible: true, locked: false, thickness: 3 },
      { id: "L2", name: "Peças", visible: true, locked: false, thickness: 3 },
    ],
    parts: [
      {
        id: "base",
        ref: 1,
        name: "Base 1",
        layer: "L1",
        x: 0,
        y: 0,
        angle: 0,
        shape: rect(120, 70),
        material: "aluminum",
        fixed: true,
        fast: false,
      },
    ],
    links: [],
  };
}

function wobble(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32 - 0.5;
  };
}

function pencil(
  s: Scene,
  tool: Partial<PencilTool>,
  pts: Vec2[],
  layer: number,
  tap = false,
  selected?: string,
) {
  const plan = pencilPlan(
    prepareScene(s),
    { ...DEFAULT_PENCIL, ...tool },
    { points: pts, tap, px: 0.2 },
    layer,
    selected ?? null,
  );
  if (plan.kind === "none") throw new Error(plan.reason);
  const c = commitPlan(s, plan, s.layers[layer]!.id, { separate: true });
  if (c.kind !== "command") throw new Error(c.reason);
  return run(s, c.command.label, c.command.recipe)!.scene;
}

function stamp(s: Scene, tool: "axle" | "pin" | "screw", at: Vec2, layer: number) {
  const model = prepareScene(s);
  const f = hammerFix(model, tool, hammerPoint(model, tool, at, layer, 0.001));
  if (!f || f.warning) throw new Error(f?.warning ?? "sem ligação");
  return run(s, f.command.label, f.command.recipe)!.scene;
}

const loop = (c: Vec2, r: number, seed: number): Vec2[] => {
  const rnd = wobble(seed);
  return Array.from({ length: 91 }, (_, i) => {
    const a = (2 * Math.PI * i) / 90;
    const rr = r + 0.6 * rnd();
    return [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)] as Vec2;
  });
};

function scenes(): { id: string; scene: Scene }[] {
  // 1. rasgo pela régua na base e uma corrediça com pino; placa com laço, num eixo
  let a = base();
  const rnd = wobble(7);
  a = pencil(
    a,
    { form: "stroke", op: "cut", width: 3, ruler: true },
    Array.from({ length: 40 }, (_, i) => [-30 + 0.9 * rnd(), -20 + i * 1] as Vec2),
    0,
  );
  a = structuredClone(a);
  a.parts.push({
    ...a.parts[0]!,
    id: "runner",
    ref: 20,
    name: "Corrediça",
    layer: "L2",
    x: -30,
    y: -12,
    shape: rect(8, 5),
    material: "steel",
    fixed: false,
  });
  a.parts.push({
    ...a.parts[0]!,
    id: "plate",
    ref: 21,
    name: "Placa 21",
    layer: "L2",
    x: 20,
    y: 0,
    shape: rect(40, 20),
    material: "steel",
    fixed: false,
  });
  a = stamp(a, "pin", [-30, -12], 1);
  a = pencil(a, { form: "contour", op: "cut" }, loop([24, 2], 5, 3), 1, false, "plate");
  a = stamp(a, "axle", [8, 0], 1);
  // 2. alavanca desenhada com o pincel, num eixo, com um peso desenhado no vazio
  let b = base();
  const arm: Vec2[] = Array.from({ length: 50 }, (_, i) => {
    const t = i / 49;
    return (t < 0.6 ? [-40 + t * 60, -10 + t * 12] : [-4 + (t - 0.6) * 30, 2 - (t - 0.6) * 40]) as Vec2;
  });
  b = pencil(
    b,
    { form: "stroke", op: "add", width: 5 },
    arm.map((p, i) => [p[0], p[1] + 0.4 * Math.sin(i * 2.1)] as Vec2),
    1,
  );
  b = stamp(b, "axle", [-4, 2], 1);
  b = pencil(b, { form: "contour", op: "add" }, loop([30, -20], 4, 9), 1);
  // 3. placa cortada em duas peças, cada uma aparafusada à base num lado
  let c = base();
  c = structuredClone(c);
  c.parts.push({
    ...c.parts[0]!,
    id: "plate",
    ref: 30,
    name: "Placa 30",
    layer: "L2",
    x: 0,
    y: 0,
    shape: rect(50, 24),
    material: "brass",
    fixed: false,
  });
  c = stamp(c, "axle", [-18, 0], 1);
  c = stamp(c, "axle", [18, 0], 1);
  c = pencil(
    c,
    { form: "contour", op: "cut" },
    [
      [-2, -20],
      [2, -20],
      [2, 20],
      [-2, 20],
      [-2, -20],
    ],
    1,
    false,
    "plate",
  );
  // controle: as mesmas duas metades como retângulos, sem o Lápis
  let d = base();
  d = structuredClone(d);
  const half = (id: string, x: number): Part => ({
    ...d.parts[0]!,
    id,
    ref: x > 0 ? 41 : 40,
    name: id,
    layer: "L2",
    x,
    y: 0,
    shape: rect(23, 24),
    material: "brass",
    fixed: false,
  });
  d.parts.push(half("left", -13.5), half("right", 13.5));
  d = stamp(d, "axle", [-18, 0], 1);
  d = stamp(d, "axle", [18, 0], 1);
  return [
    { id: "lapis/rasgo-e-laco", scene: a },
    { id: "lapis/alavanca-a-mao", scene: b },
    { id: "lapis/corte-em-duas", scene: c },
    { id: "controle/duas-placas-sem-lapis", scene: d },
  ];
}

const n = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : String(v));

export async function main(args: string[]) {
  const make = await loadBox2d();
  const report = [];
  for (const { id, scene } of scenes()) {
    const valid = loadScene(scene);
    if (!valid.ok) throw new Error(`${id}: ${valid.issues.map((i) => i.message).join("; ")}`);
    const links = scene.links.map((l: Link) => l.kind).join(", ");
    const r = abuseScene(make, id, valid.scene, { fastScene: false, sample: 12 });
    report.push({ ...r, links });
    const fails = INVARIANTS.filter((i) => !r.results[i.id].pass);
    console.log(
      `${id} [${links}]: ${r.parts} peças, ${r.runs} execuções` +
        (fails.length
          ? ` — FALHA: ${fails.map((i) => `${i.id} ${n(r.results[i.id].worst)}`).join("; ")}`
          : " — ok"),
    );
  }
  writeFileSync(args[0] || "docs/decisoes/abuso-e2c-lapis.json", JSON.stringify(report, null, 2) + "\n");
}
