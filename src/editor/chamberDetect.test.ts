import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";
import { buildPlan } from "@/engine/plan";
import { prepareScene } from "@/render/prepare";
import type { ChamberLink, Scene } from "@/model/types";
import { hammerPoint } from "./hammer";
import { dragLink } from "./hammerDrag";

/**
 * Câmara pela regra de 07/11 (docs/arquitetura.md §6, Parte E2c): recriar a
 * câmara dos exemplos numa cópia sem ela, com o mesmo arraste (do fundo à
 * boca), e rodar o ciclo do exemplo com a geometria detectada. Carga,
 * respiros, vedação e sensores são ajustes do cartão: vêm do exemplo.
 */
function rebuildChamber(file: string, layer: number) {
  const scene = JSON.parse(readFileSync(file, "utf8")) as Scene;
  const original = scene.links.find((l) => l.kind === "chamber") as ChamberLink;
  const copy = structuredClone(scene);
  copy.links = copy.links.filter((l) => l.id !== original.id && l.kind !== "sensor");
  copy.settings.snap.on = false;
  const model = prepareScene(copy);
  const end: [number, number] = [original.at[0] + original.length, original.at[1]];
  const start = hammerPoint(model, "chamber", original.at, layer, 0.001);
  const result = dragLink(model, "chamber", start, hammerPoint(model, "chamber", end, layer, 0.001), layer)!;
  const link = result.link as ChamberLink;
  const rebuilt = structuredClone(scene);
  rebuilt.links = rebuilt.links.map((l) =>
    l.id === original.id
      ? {
          ...original,
          body: link.body,
          at: link.at,
          dir: link.dir,
          bore: link.bore,
          length: link.length,
          walls: link.walls.map((w) => ({
            ...w,
            seal: original.walls.find((o) => o.part === w.part)?.seal ?? w.seal,
          })),
        }
      : l,
  );
  return { scene, original, link, warning: result.warning, rebuilt };
}

async function cycle(id: string, scene: Scene) {
  const f = FIXTURES.find((x) => x.id === id)!;
  const make = await loadBox2d();
  const r = await runFixture(make(), f.script, scene);
  return r.runs.flatMap((run) => run.assertions.map((a) => ({ ...a, runName: run.name })));
}

const sameBody = (scene: Scene, a: string, b: string) => {
  const plan = buildPlan(scene);
  return plan.partRel.get(a)?.body === plan.partRel.get(b)?.body;
};

describe("câmara pela regra de 07/11", () => {
  it("Lançador de bancada: corpo no fundo, Êmbolo à frente, Ferrolho atrás, ciclo do exemplo", async () => {
    const { scene, original, link, warning, rebuilt } = rebuildChamber(
      "scenes/examples/lancador-bancada.json",
      1,
    );
    expect(link.body).toBe(original.body);
    expect(link.at).toEqual(original.at);
    expect(link.dir).toBe(original.dir);
    expect(link.walls[0]!.part).toBe(original.walls[0]!.part);
    expect(sameBody(scene, link.walls[1]!.part, original.walls[1]!.part)).toBe(true);
    // a face do Êmbolo dentro do tubo da Luva (vão 4,1 mm)
    expect(link.bore).toBeCloseTo(4.05, 2);
    // desenho e dado concordam (E2d): a câmara declarada é o tubo da Luva
    expect(Math.abs(link.bore - original.bore)).toBeLessThanOrEqual(0.1);
    expect(warning).toBeUndefined();
    const failed = (await cycle("exemplos/lancador-bancada", rebuilt)).filter((a) => !a.pass);
    expect(failed.map((a) => `${a.runName}: ${a.label} (${a.value})`)).toEqual([]);
  });

  it("Lançador de bancada: a esfera sai a 10,3 ±0,3 m/s e a cena de teste passa inteira", async () => {
    const scene = JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene;
    const all = await cycle("exemplos/lancador-bancada", scene);
    expect(all.filter((a) => !a.pass).map((a) => `${a.runName}: ${a.label} (${a.value})`)).toEqual([]);
    const exit = all.find((a) => /sai pela boca/.test(a.label))!;
    const peak = Number(/pico ([\d,]+)/.exec(String(exit.value))![1]!.replace(",", ".")) / 1000;
    expect(peak).toBeGreaterThanOrEqual(10.0);
    expect(peak).toBeLessThanOrEqual(10.6);
  });

  it("Cilindro de dois pistões: as duas paredes do exemplo, ciclo do exemplo", async () => {
    const { original, link, rebuilt } = rebuildChamber("scenes/examples/cilindro-dois-pistoes.json", 0);
    expect(link.body).toBe(original.body);
    expect(link.walls.map((w) => w.part)).toEqual(original.walls.map((w) => w.part));
    expect(link.bore).toBeCloseTo(9.8, 2);
    const failed = (await cycle("exemplos/cilindro-dois-pistoes", rebuilt)).filter((a) => !a.pass);
    expect(failed.map((a) => `${a.runName}: ${a.label} (${a.value})`)).toEqual([]);
  });
});

describe("câmara num cilindro fixo", () => {
  function cylinder(pistonHalf: number): Scene {
    const scene = JSON.parse(readFileSync("scenes/examples/cilindro-dois-pistoes.json", "utf8")) as Scene;
    scene.links = [];
    const base = scene.parts[0]!;
    scene.parts = [
      {
        ...base,
        id: "cyl",
        fixed: true,
        x: 0,
        y: 0,
        shape: {
          kind: "poly",
          outer: [
            [-25, -6],
            [25, -6],
            [25, 6],
            [-25, 6],
          ],
          holes: [
            [
              [-20, -3],
              [-20, 3],
              [20, 3],
              [20, -3],
            ],
          ],
        },
      },
      {
        ...base,
        id: "piston",
        fixed: false,
        x: 5,
        y: 0,
        shape: {
          kind: "poly",
          outer: [
            [-2, -pistonHalf],
            [2, -pistonHalf],
            [2, pistonHalf],
            [-2, pistonHalf],
          ],
          holes: [],
        },
      },
    ];
    scene.settings.snap.on = false;
    return scene;
  }
  const drag = (scene: Scene) => {
    const model = prepareScene(scene);
    return dragLink(
      model,
      "chamber",
      hammerPoint(model, "chamber", [-19, 0], 0, 0.001),
      hammerPoint(model, "chamber", [19, 0], 0, 0.001),
      0,
    )!;
  };
  it("corpo é a peça fixa sob o começo; diâmetro é a largura do pistão no vão", () => {
    const r = drag(cylinder(2.9));
    const link = r.link as ChamberLink;
    expect(link.body).toBe("cyl");
    expect(link.walls.map((w) => w.part)).toEqual(["piston"]);
    expect(link.bore).toBeCloseTo(5.8, 6);
    expect(r.warning).toBeUndefined();
  });
  it("pistão folgado (mais de 10% menor que o vão) avisa no cartão", () => {
    const r = drag(cylinder(2.6));
    expect((r.link as ChamberLink).bore).toBeCloseTo(5.2, 6);
    expect(r.warning).toMatch(/5,2 mm.*6 mm/);
  });
  it("peça que fecha menos de 80% do furo não conta como parede", () => {
    const r = drag(cylinder(2.3));
    expect((r.link as ChamberLink).walls).toEqual([]);
    expect(r.warning).toBe("Toque na parede");
  });
});
