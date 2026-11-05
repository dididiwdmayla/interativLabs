import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { Pacer, blendAt } from "./pacing";
import { SimSession } from "./session";

/**
 * Câmera lenta fluida: com um relógio de tela falso, como o controlador do
 * app (o desenho só vê os passos que já chegaram do worker), a pose
 * desenhada muda a cada quadro enquanto há movimento.
 */

const H = 1 / 240;

describe("câmera lenta com relógio falso", () => {
  let make: () => EngineAdapter;
  let scene: Scene;
  beforeAll(async () => {
    make = await loadBox2d();
    const r = loadScene(JSON.parse(readFileSync("scenes/fixtures/fixacoes/pendulo.scene.json", "utf8")));
    if (!r.ok) throw new Error("pêndulo inválido");
    scene = r.scene;
  });

  /**
   * Laço do controlador: a cada quadro de tela soma o tempo, desenha a
   * posição de desenho com o que já chegou e só então "recebe" os passos
   * pedidos (o worker responde depois do quadro).
   */
  function drawn(speed: number, frames: number, mix: boolean): { x: number; y: number; angle: number }[] {
    const s = new SimSession(make, scene);
    const p = new Pacer(H);
    const out = new Float32Array(s.rec.stride);
    const id = scene.parts.find((q) => !q.fixed)!.id;
    const poses: { x: number; y: number; angle: number }[] = [];
    let pendingSteps = 0;
    for (let i = 0; i < frames; i++) {
      for (let k = 0; k < pendingSteps; k++) s.advance();
      p.advance(1 / 60, speed);
      pendingSteps = p.take();
      const at = blendAt(p.display(), s.rec.oldest, s.step);
      const f = mix ? s.rec.blend(at.step, at.alpha, H, out) : s.rec.view(s.step, H);
      poses.push({ ...f!.pose(id)! });
    }
    s.dispose();
    return poses;
  }

  const repeats = (poses: { x: number; y: number; angle: number }[]) =>
    poses.slice(1).filter((q, i) => q.x === poses[i]!.x && q.y === poses[i]!.y && q.angle === poses[i]!.angle)
      .length;

  it("em Lento, o desenho muda a cada quadro (sem repetir pose em quadros seguidos)", () => {
    // 2 s de tela = 0,1 s simulado: o pêndulo solto a 30° está descendo
    const poses = drawn(0.05, 120, true).slice(2);
    expect(repeats(poses)).toBe(0);
  });

  it("sem mistura, o Lento repetia a pose em 4 de cada 5 quadros", () => {
    const poses = drawn(0.05, 120, false).slice(2);
    expect(repeats(poses)).toBeGreaterThan(80);
  });

  it("em Normal e em Real o desenho também anda a cada quadro", () => {
    expect(repeats(drawn(0.25, 60, true).slice(2))).toBe(0);
    expect(repeats(drawn(1, 30, true).slice(2))).toBe(0);
  });
});
