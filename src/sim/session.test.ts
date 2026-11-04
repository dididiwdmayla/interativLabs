import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { PoseHash } from "./runner";
import { SimSession } from "./session";

/**
 * A linha do tempo volta a um passo recriando o mundo e reexecutando as
 * entradas gravadas. O determinismo garante o mesmo estado: o hash das
 * poses depois da volta é o mesmo da execução contínua.
 */

let make: () => EngineAdapter;
const load = (name: string): Scene => {
  const r = loadScene(JSON.parse(readFileSync(`scenes/examples/${name}.json`, "utf8")));
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("; "));
  return r.scene;
};
const hashOf = (s: SimSession) => {
  const h = new PoseHash();
  h.addSnapshot(
    s.snapshot(),
    s.scene.parts.map((p) => p.id),
  );
  return h.digest();
};

beforeAll(async () => {
  make = await loadBox2d();
});

/** Arrasta a peça por um caminho entre os passos a e b, soltando em b. */
function runWithDrag(
  s: SimSession,
  until: number,
  part: string,
  from: [number, number],
  a: number,
  b: number,
) {
  while (s.step < until) {
    if (s.step === a) s.dragStart(part, from);
    if (s.step > a && s.step < b) s.dragMove([from[0] + (s.step - a) * 0.08, from[1] - (s.step - a) * 0.05]);
    if (s.step === b) s.dragEnd();
    s.advance();
  }
}

describe("sessão de simulação", () => {
  it("reexecuta até o passo N e chega ao mesmo hash da execução contínua (biela, com arrasto)", () => {
    const scene = load("biela-manivela");
    const cruz =
      scene.parts.find((p) => !p.fixed && p.name.toLowerCase().includes("cruzeta")) ?? scene.parts[2]!;
    const s = new SimSession(make, scene);
    runWithDrag(s, 400, cruz.id, [cruz.x, cruz.y], 60, 300);
    const atN = hashOf(s);
    runWithDrag(s, 700, cruz.id, [cruz.x, cruz.y], 60, 300);
    const at700 = hashOf(s);
    expect(s.recordedInputs().length).toBeGreaterThan(10);

    const r = s.rewind(400);
    while (!r.advance(1000)) {
      /* fatias até o fim */
    }
    expect(s.step).toBe(400);
    expect(hashOf(s)).toBe(atN);
    // e segue igual dali
    runWithDrag(s, 700, cruz.id, [cruz.x, cruz.y], 60, 300);
    expect(hashOf(s)).toBe(at700);
    s.dispose();
  });

  it("volta no meio de um disparo de gás (cilindro) e repete o mesmo resultado", () => {
    const scene = load("cilindro-dois-pistoes");
    const s = new SimSession(make, scene);
    for (let i = 0; i < 160; i++) s.advance();
    const at160 = hashOf(s);
    for (let i = 0; i < 80; i++) s.advance();
    const at240 = hashOf(s);
    expect(s.events.some((e) => e.kind === "chamber-fired")).toBe(true);
    const r = s.rewind(160);
    let n = 0;
    while (!r.advance(0.0001)) n++;
    expect(n).toBeGreaterThan(0); // em fatias
    expect(hashOf(s)).toBe(at160);
    while (s.step < 240) s.advance();
    expect(hashOf(s)).toBe(at240);
    s.dispose();
  });

  it("grava os últimos 10 s e mostra quadros antigos", () => {
    const scene = load("cilindro-dois-pistoes");
    const s = new SimSession(make, scene, { capacity: 100 });
    for (let i = 0; i < 250; i++) s.advance();
    expect(s.rec.latest).toBe(250);
    expect(s.rec.oldest).toBe(150);
    expect(s.frame(149)).toBeNull();
    const f = s.frame(200)!;
    expect(f.time).toBeCloseTo(200 / 240, 9);
    expect(f.pose(scene.parts[2]!.id)).toBeDefined();
    s.dispose();
  });

  it("reiniciar volta ao passo zero, sem entradas", () => {
    const scene = load("biela-manivela");
    const s = new SimSession(make, scene);
    const h0 = hashOf(s);
    s.dragStart(scene.parts[2]!.id, [scene.parts[2]!.x, scene.parts[2]!.y]);
    for (let i = 0; i < 50; i++) s.advance();
    s.restart();
    expect(s.step).toBe(0);
    expect(s.recordedInputs()).toHaveLength(0);
    expect(hashOf(s)).toBe(h0);
    s.dispose();
  });
});
