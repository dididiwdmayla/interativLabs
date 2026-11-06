import { readFileSync } from "node:fs";
import { PI } from "@/geometry/dmath";
import { migrateV2ToV3 } from "@/model/migrations/v2-to-v3";
import { migrateV1ToV2 } from "@/model/migrations/v1-to-v2";
import { migrateV0ToV1 } from "@/model/migrations/v0-to-v1";
import { validateSceneV1 } from "@/model/scene";
import type { Scene } from "@/model/types";
import { DEG, G_REAL, P_ATM } from "@/model/units";
import { Builder, NOW, br, r4, writeExample } from "./builder";

/**
 * Exemplos (item 5.7): as três cenas do protótipo em v2, recalibradas para
 * gravidade real e unidades reais, e dois mecanismos novos.
 *
 * Recalibração: a cena do protótipo tinha 100 mm/s² e massas de 10 mm de
 * espessura. Aqui a gravidade é a real (×98,1) e as camadas têm 3 mm (massas
 * ×0,3). Para manter os mesmos equilíbrios, toda força (rigidez, torque, carga
 * de gás) é multiplicada por 98,1 × 0,3 = 29,43; o amortecimento por
 * √(29,43 × 0,3) para manter a razão de amortecimento; as velocidades de
 * impacto mínimo por √98,1 (o movimento fica ~10 vezes mais rápido, o tempo
 * real das peças desse tamanho).
 */

const THICK = 3;
const G_SCALE = G_REAL / 100;
const M_SCALE = THICK / 10;
const F_SCALE = G_SCALE * M_SCALE;
const C_SCALE = Math.sqrt(F_SCALE * M_SCALE);
const V_SCALE = Math.sqrt(G_SCALE);

function prototype(name: string, title: string): Scene {
  const v0 = JSON.parse(readFileSync(`reference/prototype-v0/scenes/${name}.json`, "utf8"));
  const v1 = validateSceneV1(migrateV0ToV1(v0, { now: NOW }));
  if (!v1.ok) throw new Error(`${name}: ${JSON.stringify(v1.issues)}`);
  const s = migrateV2ToV3(migrateV1ToV2(v1.scene));
  s.meta.title = title;
  s.settings.gravity.g = G_REAL;
  for (const l of s.layers) l.thickness = THICK;
  for (const l of s.links) {
    switch (l.kind) {
      case "axle":
        if (l.motor) l.motor.maxTorque = r4(l.motor.maxTorque * F_SCALE * 1e4) / 1e4;
        if (l.torsion) {
          l.torsion.k = r4(l.torsion.k * F_SCALE * 1e4) / 1e4;
          l.torsion.damping = r4(l.torsion.damping * C_SCALE * 1e6) / 1e6;
        }
        break;
      case "slider":
        if (l.spring) {
          l.spring.k = r4(l.spring.k * F_SCALE * 1e4) / 1e4;
          l.spring.damping = r4(l.spring.damping * C_SCALE * 1e6) / 1e6;
        }
        break;
      case "spring":
        l.k = r4(l.k * F_SCALE * 1e4) / 1e4;
        l.damping = r4(l.damping * C_SCALE * 1e6) / 1e6;
        break;
      case "chamber":
        if (l.gas.charge) l.gas.charge.amount = Number((l.gas.charge.amount * F_SCALE).toPrecision(6));
        break;
      case "sensor":
        l.minSpeed = r4(l.minSpeed * V_SCALE);
        break;
    }
  }
  return s;
}

export function generateExemplos(): void {
  const notesCal = `Recalibrada do protótipo para gravidade real: camadas de ${THICK} mm, forças × ${br(F_SCALE, 2)}, amortecimentos × ${br(C_SCALE, 2)}.`;

  // Lançador
  {
    const s = prototype("lancador", "Lançador de esfera");
    writeExample("lancador", s, {
      title: "Lançador de esfera",
      notes: `${notesCal} A câmara mantém o ambiente sem pressão da v1 (p0 = 0), para a carga equivalente valer. Puxar o gatilho solta o retém; o percussor bate no sensor e acende a carga.`,
      view: [0, 20, 150, 60],
      runs: [
        {
          name: "repouso e disparo",
          duration: 1.5,
          inputs: [
            { kind: "drag", part: "p13", from: [69, 69], to: [62.15, 68.73], t0: 0.5, t1: 0.7, release: 1.2 },
          ],
          assertions: [
            {
              kind: "maxDisp",
              label: "parado, o retém segura o percussor (< 0,2 mm)",
              parts: ["p11"],
              from: 0.2,
              to: 0.5,
              max: 0.2,
            },
            {
              kind: "events",
              label: "puxando o gatilho, o sensor dispara uma vez",
              event: "sensor",
              match: { sensor: "k15" },
              min: 1,
              max: 1,
            },
            { kind: "events", label: "e a câmara acende", event: "chamber-fired", min: 1, max: 1 },
            {
              kind: "at",
              label: "a esfera sai do cano (x > 142,4 mm)",
              q: { part: "p10", field: "x" },
              t: 1.5,
              min: 142.4,
            },
          ],
        },
      ],
    });
  }

  // Trava
  {
    const s = prototype("trava", "Trava de porta");
    writeExample("trava", s, {
      title: "Trava de porta",
      notes: `${notesCal} Girar a maçaneta recolhe a lingueta pelo pino; soltando, a mola de torção e a do trilho devolvem tudo.`,
      view: [30, 25, 90, 50],
      runs: [
        {
          name: "girar e soltar",
          duration: 2,
          inputs: [
            // o dedo passa um pouco do ponto de 30° (como a mão de verdade, até o batente):
            // a mão do app tem atraso sob carga e não chega ao batente parando no ponto exato
            { kind: "drag", part: "p9", from: [46, 66.8], to: [55.1, 88.3], t0: 0.3, t1: 0.6, release: 0.9 },
          ],
          assertions: [
            {
              kind: "at",
              label: "a maçaneta gira 30°",
              q: { link: "k12", field: "angle" },
              t: 0.85,
              max: -0.5149,
            },
            {
              kind: "at",
              label: "e a lingueta recolhe pelo menos 6 mm",
              q: { link: "k10", field: "translation" },
              t: 0.85,
              min: 6,
            },
            {
              kind: "at",
              label: "soltando, volta à posição inicial (±0,3 mm) em até 1 s",
              q: { part: "p8", disp: true },
              t: 1.9,
              max: 0.3,
            },
          ],
        },
      ],
    });
  }

  // Engrenagens e catraca, com a lingueta corrigida
  {
    const s = prototype("engrenagens", "Engrenagens e catraca");
    const pawl = s.links.find((l) => l.id === "k14");
    if (pawl?.kind === "axle" && pawl.limit) pawl.limit.lower = r4(-12 * DEG);
    const step = (2 * PI) / 14;
    writeExample("engrenagens", s, {
      title: "Engrenagens e catraca",
      notes: `${notesCal} Batente da lingueta corrigido para −12° (era −25°): ela segura antes de a catraca girar um passo de dente. A favor, o motor gira a −12 rpm e a catraca passa livre; contra, a +12 rpm, a lingueta trava.`,
      view: [5, 15, 95, 70],
      runs: [
        {
          name: "a favor",
          duration: 5,
          inputs: [],
          assertions: [
            {
              kind: "compare",
              label: "a intermediária gira −1,5 × a motora (±2%)",
              a: { link: "k11", field: "angle" },
              b: { link: "k10", field: "angle" },
              t: 5,
              op: "ratio",
              min: -1.53,
              max: -1.47,
            },
            {
              kind: "compare",
              label: "a catraca gira 2 × a motora (±2%)",
              a: { link: "k13", field: "angle" },
              b: { link: "k10", field: "angle" },
              t: 5,
              op: "ratio",
              min: 1.96,
              max: 2.04,
            },
          ],
        },
        {
          name: "contra",
          duration: 2,
          inputs: [{ kind: "motor", link: "k10", t: 0, speed: r4((12 * 2 * PI) / 60) }],
          assertions: [
            {
              kind: "span",
              label: `contra, a lingueta trava antes de um passo de dente (${br(step / DEG, 1)}°)`,
              q: { link: "k13", field: "angle" },
              max: r4(step),
            },
          ],
        },
      ],
    });
  }

  // Biela e manivela
  {
    const b = new Builder("Biela e manivela");
    const L1 = b.layer("Base", 3);
    const L2 = b.layer("Manivela", 3);
    const L3 = b.layer("Cruzeta", 3);
    const R = 15;
    const rod = 50;
    b.rect("Base", L1, 30, 0, 120, 50, "aluminum", { fixed: true });
    b.rect("Guia de cima", L3, 65, -8, 70, 4, "steel", { fixed: true });
    b.rect("Guia de baixo", L3, 65, 8, 70, 4, "steel", { fixed: true });
    const crank = b.circle("Manivela", L2, 0, 0, 20, "steel");
    const axle = b.link({
      kind: "axle",
      a: null,
      b: crank.id,
      at: [0, 0],
      motor: { speed: r4(PI), maxTorque: 50 },
      friction: 0.05,
    });
    const block = b.rect("Cruzeta", L3, R + rod, 0, 16, 11.8, "steel");
    const link = b.link({ kind: "rod", a: crank.id, b: block.id, atA: [R, 0], atB: [0, 0] });
    b.link({ kind: "pin", host: crank.id, at: [R, 0], r: 1.5, layers: [L2, L2] });
    const slider = b.link({
      kind: "slider",
      a: null,
      b: block.id,
      at: [0, 0],
      dir: 0,
      travel: [-45, 15],
      friction: 0.02,
    });
    writeExample("biela-manivela", b.scene, {
      title: "Biela e manivela",
      notes:
        "Manivela de raio 15 mm num eixo com motor a ½ volta/s, haste de 50 mm até uma cruzeta que corre entre duas guias. A rotação vira vaivém de 30 mm.",
      view: [-35, -35, 130, 70],
      runs: [
        {
          name: "4 s",
          duration: 4,
          inputs: [],
          assertions: [
            {
              kind: "span",
              label: "curso da cruzeta = 2 × raio (30 mm ± 1%)",
              q: { link: slider.id, field: "translation" },
              from: 1,
              to: 4,
              min: 29.7,
              max: 30.3,
            },
            {
              kind: "range",
              label: "comprimento da haste constante (±0,01 mm)",
              q: { link: link.id, field: "length" },
              min: 49.99,
              max: 50.01,
            },
            {
              kind: "mean",
              label: "a manivela gira na velocidade do motor (±2%)",
              q: { link: axle.id, field: "speed" },
              from: 1,
              to: 4,
              min: r4(PI * 0.98),
              max: r4(PI * 1.02),
            },
          ],
        },
      ],
    });
  }

  // Cilindro de dois pistões (recuo do fundo)
  {
    const b = new Builder("Cilindro de dois pistões");
    const L1 = b.layer("Corpo", 10);
    const w = 10;
    const L0 = 20;
    b.rect("Trilho de cima", L1, 40, -w / 2 - 2.5, 140, 5, "steel", { fixed: true });
    b.rect("Trilho de baixo", L1, 40, w / 2 + 2.5, 140, 5, "steel", { fixed: true });
    const piston = b.rect("Pistão", L1, L0 + 5, 0, 10, w - 0.2, "steel");
    const block = b.rect("Fundo móvel", L1, -20, 0, 40, w - 1, "steel");
    const slider = b.link({
      kind: "slider",
      a: null,
      b: block.id,
      at: [0, 0],
      dir: 0,
      travel: [-25, 0],
      spring: { k: 0.3, rest: 2, damping: 0.004 },
    });
    const chamber = b.link({
      kind: "chamber",
      body: null,
      at: [0, 0],
      dir: 0,
      bore: w,
      length: 100,
      walls: [
        { part: piston.id, seal: 200 },
        { part: block.id, seal: 200 },
      ],
      vents: [{ at: 40, d: 6, open: true }],
      ports: [],
      gas: { model: "adiabatic", gamma: 1.4, p0: P_ATM, charge: { amount: 0.128, burnMs: 8 } },
    });
    // gatilho: um bloco solto que cai num sensor e acende a carga
    const host = b.rect("Suporte do sensor", L1, -72, -40, 6, 14, "steel", { fixed: true });
    b.rect("Aparador", L1, -57, -25, 16, 4, "steel", { fixed: true });
    b.circle("Esfera de disparo", L1, -57, -70, 2.5, "steel");
    b.link({
      kind: "sensor",
      host: host.id,
      at: [15, 0],
      r: 2.5,
      layers: [L1, L1],
      minSpeed: 300,
      actions: [{ do: "ignite", target: chamber.id }],
    });
    writeExample("cilindro-dois-pistoes", b.scene, {
      title: "Cilindro de dois pistões",
      notes:
        "Recuo do fundo: o gás empurra as duas paredes. O pistão leve (7,7 g) avança pelo furo; o fundo móvel (28 g), num trilho com mola, recua e volta ao batente. Uma esfera cai no sensor e acende a carga. Veja em 0,05×.",
      view: [-75, -80, 200, 110],
      runs: [
        {
          name: "disparo",
          duration: 1.5,
          inputs: [],
          assertions: [
            { kind: "events", label: "a esfera acende a carga", event: "chamber-fired", min: 1, max: 1 },
            {
              kind: "span",
              label: "o fundo recua",
              q: { link: slider.id, field: "translation" },
              min: 0.3,
            },
            {
              kind: "at",
              label: "o pistão sai pela boca",
              q: { part: piston.id, along: [1, 0] },
              t: 1.5,
              min: 60,
            },
            {
              kind: "at",
              label: "a mola devolve o fundo ao batente (±0,2 mm)",
              q: { part: block.id, disp: true },
              t: 1.5,
              max: 0.2,
            },
          ],
        },
      ],
    });
  }
}
