import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import { buildPlan } from "@/engine/plan";
import type { EngineAdapter } from "@/engine/types";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { N } from "@/model/units";
import { Pacer } from "@/sim/pacing";
import { HAND, chase, handLimits } from "./runtime";

/**
 * A mão (Fase 1 · Parte F, item 14.3): força limitada pelo peso, pelas
 * molas, pelos suportes elásticos e pelas juntas; alvo que persegue o dedo
 * com velocidade limitada e para quando o dedo para.
 */

const H = 1 / 240;
let make: () => EngineAdapter;
const load = (path: string): Scene => {
  const r = loadScene(JSON.parse(readFileSync(path, "utf8")));
  if (!r.ok) throw new Error(path);
  return r.scene;
};
const bodyOf = (scene: Scene, name: string) => {
  const plan = buildPlan(scene);
  const id = scene.parts.find((p) => p.name === name)!.id;
  return { plan, body: plan.partRel.get(id)!.body, id };
};

beforeAll(async () => {
  make = await loadBox2d();
});

describe("limites da mão", () => {
  it("peso sem mola: 10 vezes o peso, mola de 30 Hz", () => {
    const { plan, body } = bodyOf(load("scenes/fixtures/fixacoes/cabo.scene.json"), "Peso de 20 g");
    const h = handLimits(plan, body);
    expect(h.maxForce / N).toBeCloseTo(10 * 0.02 * 9.81, 3);
    expect(h.hertz).toBe(HAND.hertzMin);
  });

  it("suporte elástico: o suporte limita abaixo de 10 vezes o peso", () => {
    const { plan, body } = bodyOf(
      load("scenes/fixtures/fixacoes/parafuso-suporte.scene.json"),
      "Barra no suporte",
    );
    const h = handLimits(plan, body);
    expect(h.mountCap).toBeLessThan(h.weight);
    expect(h.maxForce).toBe(h.mountCap);
  });

  it("ferrolho: vence a mola de retorno, sem passar do que abre o trilho 0,25 mm", () => {
    const { plan, body } = bodyOf(load("scenes/examples/lancador-bancada.json"), "Ferrolho");
    const h = handLimits(plan, body);
    expect(h.maxForce / N).toBeGreaterThan(1.23); // mola de retorno no fim do curso
    expect(h.maxForce).toBeLessThanOrEqual(h.jointCap);
    expect(h.hertz).toBeLessThan(960 / 8);
  });

  it("o alvo anda no máximo o passo pedido e para no dedo", () => {
    expect(chase([0, 0], [10, 0], 2.5)).toEqual([2.5, 0]);
    expect(chase([9, 0], [10, 0], 2.5)).toEqual([10, 0]);
  });
});

describe("a mão no motor", () => {
  it("cabo: arrastando o peso 3 vezes a cena para fora, o cabo não passa de 50,5 mm", () => {
    const scene = load("scenes/fixtures/fixacoes/cabo.scene.json");
    for (const speed of [0.05, 0.25, 1]) {
      const a = make();
      a.compile(scene, { unitMm: 1 });
      for (let i = 0; i < 60; i++) a.step(H);
      const p0 = a.pose("p1")!;
      a.dragStart("p1", [p0.x, p0.y]);
      const pacer = new Pacer(H, { lookahead: 0 });
      let max = 0;
      for (let f = 0; f < 90; f++) {
        const k = f < 45 ? f / 45 : (90 - f) / 45;
        a.dragMove([p0.x + 240 * k, p0.y - 120 * k]);
        pacer.advance(1 / 60, speed);
        for (let n = pacer.take(); n > 0; n--) {
          a.step(H);
          max = Math.max(max, a.snapshot().links.k2!.length!);
        }
      }
      a.dragEnd();
      for (let i = 0; i < 240; i++) {
        a.step(H);
        max = Math.max(max, a.snapshot().links.k2!.length!);
      }
      a.dispose();
      expect(max, `velocidade ${speed}`).toBeLessThan(50.5);
    }
  });

  it("em Lento, o dedo a 100 mm/s na tela não vira 2 000 mm/s; e a peça para quando o dedo para", () => {
    const scene = load("scenes/fixtures/fixacoes/cabo.scene.json");
    const a = make();
    a.compile(scene, { unitMm: 1 });
    for (let i = 0; i < 60; i++) a.step(H);
    const p0 = a.pose("p1")!;
    a.dragStart("p1", [p0.x, p0.y]);
    const pacer = new Pacer(H, { lookahead: 0 });
    let prev = p0;
    let vmax = 0;
    // 1 s de tela a 100 mm/s para o lado (Lento: 0,05 s simulado)
    for (let f = 0; f < 60; f++) {
      a.dragMove([p0.x + (100 * (f + 1)) / 60, p0.y]);
      pacer.advance(1 / 60, 0.05);
      for (let n = pacer.take(); n > 0; n--) {
        a.step(H);
        const p = a.pose("p1")!;
        vmax = Math.max(vmax, Math.hypot(p.x - prev.x, p.y - prev.y) / H);
        prev = p;
      }
    }
    expect(vmax).toBeLessThan(HAND.speed * 1.2);
    // o dedo para: depois de 0,5 s a peça está parada perto dele (não segue andando)
    for (let i = 0; i < 120; i++) a.step(H);
    const p1 = a.pose("p1")!;
    for (let i = 0; i < 60; i++) a.step(H);
    const p2 = a.pose("p1")!;
    expect(Math.hypot(p2.x - p1.x, p2.y - p1.y)).toBeLessThan(0.5);
    a.dispose();
  });

  it("ao soltar, o ponto agarrado sai com no máximo 750 mm/s", () => {
    const scene = load("scenes/fixtures/fixacoes/pendulo.scene.json");
    const id = scene.parts.find((p) => !p.fixed)!.id;
    const a = make();
    a.compile(scene, { unitMm: 1 });
    const p0 = a.pose(id)!;
    a.dragStart(id, [p0.x, p0.y]);
    for (let i = 0; i < 60; i++) {
      a.dragMove([p0.x + 200 * Math.sin(i / 5), p0.y - 100]);
      a.step(H);
    }
    a.dragEnd();
    const s0 = a.pose(id)!;
    a.step(H);
    const s1 = a.pose(id)!;
    // o centro da barra é o ponto agarrado
    expect(Math.hypot(s1.x - s0.x, s1.y - s0.y) / H).toBeLessThan(HAND.release + 60);
    a.dispose();
  });
});
