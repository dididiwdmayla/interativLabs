import { describe, expect, it } from "vitest";
import { DEFAULT_SPEED, Pacer, SPEED_MODES, blendAt, lerpAngle, lerpSnapshot } from "./pacing";

/**
 * Ritmo da tela: quanto tempo simulado cabe em cada segundo de tela em
 * cada velocidade (relógio de tela falso) e a mistura de dois passos.
 */

const H = 1 / 240;

/** Relógio de tela de 1 s em quadros de `fps`, com tremor opcional (ms). */
function screenSecond(p: Pacer, speed: number, fps: number, jitter = 0): void {
  const n = Math.round(fps);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const wobble = jitter ? (i % 2 ? jitter : -jitter) / 1000 : 0;
    const dt = i === n - 1 ? 1 - total : 1 / fps + wobble;
    total += dt;
    p.advance(dt, speed);
    p.take();
  }
}

describe("velocidades", () => {
  it("são Lento (1/20), Normal (¼) e Real (1×), e Normal é o padrão", () => {
    expect(SPEED_MODES.map((m) => [m.name, m.frac, m.factor])).toEqual([
      ["Lento", "1/20", 0.05],
      ["Normal", "¼", 0.25],
      ["Real", "1×", 1],
    ]);
    expect(DEFAULT_SPEED).toBe(0.25);
  });

  for (const [name, speed] of [
    ["Normal", 0.25],
    ["Lento", 0.05],
    ["Real", 1],
  ] as const) {
    for (const [fps, jitter] of [
      [60, 0],
      [60, 1.7],
      [120, 0],
      [30, 0],
    ] as const) {
      it(`em ${name}, 1 s de tela avança ${speed} s simulado (±1%) a ${fps} qps${jitter ? " com tremor" : ""}`, () => {
        const p = new Pacer(H);
        screenSecond(p, speed, fps, jitter);
        expect(p.simTime()).toBeGreaterThan(speed * 0.99);
        expect(p.simTime()).toBeLessThan(speed * 1.01);
        // e os passos inteiros pedidos cobrem tudo menos a fração de um passo
        expect(p.requested * H).toBeGreaterThan(speed - H - 1e-9);
      });
    }
  }

  it("um quadro longo (aba voltando) conta no máximo 0,1 s", () => {
    const p = new Pacer(H);
    p.advance(3, 1);
    p.take();
    expect(p.simTime()).toBeLessThanOrEqual(0.1 + 1e-9);
  });
});

describe("mistura de quadros", () => {
  it("ângulo pelo menor arco", () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 6);
    expect(lerpAngle(0.1, 0.3, 0.5)).toBeCloseTo(0.2, 9);
  });

  it("posição de desenho: passo inteiro e fração, limitada ao que chegou", () => {
    expect(blendAt(4.25, 0, 10)).toEqual({ step: 4, alpha: 0.25 });
    expect(blendAt(12.5, 0, 10)).toEqual({ step: 10, alpha: 0 });
    expect(blendAt(-1, 3, 10)).toEqual({ step: 3, alpha: 0 });
  });

  it("snapshot do laboratório: poses e estado das ligações interpolados", () => {
    const a = {
      time: 0,
      steps: 0,
      parts: { p: { x: 0, y: 0, angle: 0 } },
      links: {
        c: {
          kind: "chamber" as const,
          pressure: 100,
          walls: [{ part: "w", force: 0, impulse: 0, work: 0, travel: 0, sealed: true }],
        },
      },
      events: [],
    };
    const b = {
      time: H,
      steps: 1,
      parts: { p: { x: 10, y: -4, angle: 1 } },
      links: {
        c: {
          kind: "chamber" as const,
          pressure: 300,
          walls: [{ part: "w", force: 2, impulse: 0, work: 0, travel: 4, sealed: true }],
        },
      },
      events: [],
    };
    const m = lerpSnapshot(a, b, 0.25);
    expect(m.parts.p).toEqual({ x: 2.5, y: -1, angle: 0.25 });
    expect(m.links.c?.pressure).toBe(150);
    expect(m.links.c?.walls?.[0]?.travel).toBe(1);
  });
});
