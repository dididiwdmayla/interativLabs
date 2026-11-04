import { dcos, dsin } from "@/geometry/dmath";
import { rack } from "@/geometry/gear";
import { seededRandom } from "@/model/ids";
import { DEG } from "@/model/units";
import type { ScriptRun } from "@/sim/script";
import { Builder, r4, writeFixture } from "./builder";

/**
 * Calibração para gravidade real (item 5.2): as quatro cenas pesadas do
 * comparativo, agora em v2 e com 9 810 mm/s². Camadas de 10 mm (as massas do
 * comparativo).
 */
export function generateCalibracao(): void {
  // Pilha
  {
    const b = new Builder("Pilha de 200 caixas");
    const L = b.layer("Pilha", 10);
    b.rect("Chão", L, 55, 5, 140, 10, "steel", { fixed: true });
    for (let c = 0; c < 10; c++)
      for (let r = 0; r < 20; r++)
        b.rect(`Caixa ${c + 1}.${r + 1}`, L, c * 11 + 5, -5 - 10 * r, 10, 10, "wood");
    writeFixture("calibracao", "pilha", b.scene, {
      title: "Pilha de 200 caixas",
      notes: "10 colunas de 20 caixas de 10 mm (madeira), 1 mm entre colunas, gravidade real.",
      view: [-15, -215, 140, 230],
      runs: [
        {
          name: "3 s",
          duration: 3,
          inputs: [],
          assertions: [
            {
              kind: "maxDisp",
              label: "em 3 s, nenhuma caixa sai mais de 1 mm do lugar",
              parts: "dynamic",
              max: 1,
            },
          ],
        },
      ],
    });
  }

  // Corrente
  {
    const b = new Builder("Corrente de 40 elos");
    const L = b.layer("Corrente", 10);
    let prev: string | null = null;
    for (let i = 0; i < 40; i++) {
      const e = b.rect(`Elo ${i + 1}`, L, 8 * i + 4, 0, 10, 2, "steel");
      b.link({ kind: "axle", a: prev, b: e.id, at: [-4, 0] });
      prev = e.id;
    }
    writeFixture("calibracao", "corrente", b.scene, {
      title: "Corrente de 40 elos",
      notes:
        "40 elos de 8 mm (aço) ligados por eixos, presa pela ponta esquerda, solta na horizontal, gravidade real.",
      view: [-330, -20, 660, 360],
      runs: [
        {
          name: "5 s",
          duration: 5,
          inputs: [],
          assertions: [
            {
              kind: "maxField",
              label: "em 5 s, nenhum eixo abre mais que 0,5 mm",
              links: "axles",
              field: "gap",
              max: 0.5,
            },
          ],
        },
      ],
    });
  }

  // Pinhão e cremalheira
  {
    const b = new Builder("Pinhão e cremalheira");
    const L = b.layer("Engrenagem", 10);
    const m = 1;
    const x0 = 60;
    const r = 6;
    const rk = rack({ module: m, teeth: 16, bodyHeight: 3 });
    if (!rk.ok) throw new Error(rk.error.message);
    const rackPart = b.poly("Cremalheira", L, r4(x0 - 8.5 * Math.PI * m), 0, rk.value.outline.outer, "steel");
    const pinion = b.part({
      name: "Pinhão",
      layer: L,
      x: x0,
      y: r,
      material: "steel",
      shape: {
        kind: "gear",
        module: m,
        teeth: 12,
        pressureAngle: r4(20 * DEG),
        profile: "involute",
        bore: 0,
      },
    });
    const speed = r4(Math.PI);
    const axle = b.link({ kind: "axle", a: null, b: pinion.id, at: [0, 0], motor: { speed, maxTorque: 1 } });
    const slider = b.link({
      kind: "slider",
      a: null,
      b: rackPart.id,
      at: [r4(8.5 * Math.PI), -2],
      dir: 0,
      travel: [-20, 20],
      spring: { k: 0, rest: 0, damping: 2e-5 },
    });
    const seg = 0.4;
    const n = 20;
    const inputs = Array.from({ length: n }, (_, i) => ({
      kind: "motor" as const,
      link: axle.id,
      t: r4(seg * (i + 1)),
      speed: i % 2 === 0 ? -speed : speed,
    }));
    writeFixture("calibracao", "pinhao", b.scene, {
      title: "Pinhão e cremalheira",
      notes:
        "Pinhão de 12 dentes, módulo 1, motor a ½ volta/s que inverte o sentido 20 vezes; cremalheira num trilho, gravidade real.",
      view: [20, -15, 80, 40],
      runs: [
        {
          name: "20 inversões",
          duration: r4(seg * (n + 1)),
          inputs,
          assertions: [
            {
              kind: "compare",
              label: "no primeiro trecho, deslocamento da cremalheira = raio primitivo × ângulo (erro < 2%)",
              a: { link: slider.id, field: "translation" },
              b: { link: axle.id, field: "angle" },
              t: seg,
              op: "ratio",
              min: r * 0.98,
              max: r * 1.02,
            },
            { kind: "maxPenetration", label: "penetração entre dentes menor que 0,1 mm", max: 0.1 },
          ],
        },
      ],
    });
  }

  // Bala
  {
    const b = new Builder("Bala de prova");
    const L = b.layer("Prova", 10);
    b.rect("Parede", L, 0.5, 0, 1, 200, "steel", { fixed: true });
    const ball = b.circle("Esfera", L, -50, 0, 2.5, "steel", { fast: true });
    const rnd = seededRandom(7);
    const v = 20_000;
    const perStep = v / 240;
    const runs: ScriptRun[] = [];
    for (let i = 0; i < 100; i++) {
      const th = (-60 + 120 * rnd()) * DEG;
      const yi = -40 + 80 * rnd();
      const s = 1 + perStep * rnd();
      runs.push({
        name: `lançamento ${i + 1}`,
        duration: 0.04,
        override: { [ball.id]: { x: r4(-2.5 - s * dcos(th)), y: r4(yi - s * dsin(th)) } },
        inputs: [
          { kind: "velocity", part: ball.id, t: 0, v: [r4(v * dcos(th)), r4(v * dsin(th))], omega: 0 },
        ],
        assertions: [
          {
            kind: "range",
            label: "não atravessa a parede de 1 mm",
            q: { part: ball.id, field: "x" },
            max: 0.5,
          },
        ],
      });
    }
    writeFixture("calibracao", "bala", b.scene, {
      title: "Bala de prova",
      notes:
        "Esfera de 5 mm (aço, detecção contínua) a 20 m/s contra parede fixa de 1 mm, 100 lançamentos de −60° a 60°.",
      view: [-70, -60, 90, 120],
      runs,
    });
  }
}
