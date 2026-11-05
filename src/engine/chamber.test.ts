import { describe, expect, it } from "vitest";
import { ChamberSim, type ChamberGeometry, type PlanChamber } from "./chamber";

/**
 * Câmara arrombada (achado do teste de abuso, Parte F): uma parede que saiu
 * do furo de lado (arrancada, caída) não fecha mais o gás. Antes, quando a
 * projeção dela no eixo voltava para dentro do cilindro, o volume ficava
 * minúsculo e a força do gás puxava a peça de volta de metros de distância.
 */

const plan: PlanChamber = {
  id: "c",
  ref: 1,
  body: 0,
  base: [0, 0],
  axis: [1, 0],
  area: Math.PI * 9,
  length: 40,
  walls: [{ part: "w", body: 1, side: 1, face: [0, 0], s0: 10, seal: 200 }],
  vents: [],
  ports: [],
  model: "adiabatic",
  gamma: 1.4,
  p0: 101.325,
  charge: 0.1,
  burn: 0.001,
  shots: 1,
};

const geo = (s: number, lat: number): ChamberGeometry => ({
  base: [0, 0],
  axis: [1, 0],
  s: [s],
  faces: [[s, lat]],
  lat: [lat],
});

describe("câmara com a parede fora do furo", () => {
  it("dentro do furo, o gás comprimido empurra; fora dele, não empurra nem segura", () => {
    const ch = new ChamberSim(plan);
    const h = 1 / 240;
    ch.update(geo(10, 0), h, 0, []);
    ch.update(geo(2, 0), h, h, []); // comprimido a 1/5 do volume
    expect(ch.gasForce()).toBeGreaterThan(0);
    expect(ch.stiffness(h)).toBeGreaterThan(0);
    // a mesma posição no eixo, mas 3 600 mm para o lado: saiu do cilindro
    ch.update(geo(2, 3600), h, 2 * h, []);
    expect(ch.breached).toBe(true);
    expect(ch.gasForce()).toBe(0);
    expect(ch.stiffness(h)).toBe(0);
  });

  it("um pistão um pouco inclinado no furo continua vedando", () => {
    const ch = new ChamberSim(plan);
    ch.update(geo(10, 0), 1 / 240, 0, []);
    ch.update(geo(10, 2.5), 1 / 240, 1 / 240, []); // 2,5 mm do eixo, raio 3 mm
    expect(ch.breached).toBe(false);
  });
});
