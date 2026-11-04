/**
 * Gera as cenas de medição em scenes/fixtures/bench/ (cena v1 + roteiro).
 * Determinístico: rodar de novo produz os mesmos arquivos.
 * Uso: npm run bench:scenes
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { rack } from "@/geometry/gear";
import { seededRandom } from "@/model/ids";
import type { MaterialId } from "@/model/materials";
import { migrateV0ToV1 } from "@/model/migrations/v0-to-v1";
import { validateSceneV1 } from "@/model/scene";
import type { LinkV1 as Link, Part, SceneV1 as Scene, Vec2 } from "@/model/types";

type Layer = Scene["layers"][number];
import { DEG, rpmToRadPerSec } from "@/model/units";
import type { BenchAssertion, BenchRun, BenchScript } from "@/bench/types";

const DIR = "scenes/fixtures/bench";
const NOW = "2026-11-04T00:00:00.000Z";
/** Gravidade real, mm/s², nas cenas sintéticas que medem o solver. */
const G = Number(process.env.BENCH_G ?? 100);

function migrated(name: string, title?: string): Scene {
  const v0 = JSON.parse(readFileSync(`reference/prototype-v0/scenes/${name}.json`, "utf8"));
  const r = validateSceneV1(migrateV0ToV1(v0, { now: NOW }));
  if (!r.ok) throw new Error(`${name}: ${JSON.stringify(r.issues)}`);
  if (title) r.scene.meta.title = title;
  return r.scene;
}

class Builder {
  scene: Scene;
  private ref = 0;
  private n = 0;
  constructor(title: string, gravity: number) {
    this.scene = {
      version: 1,
      meta: { title, createdAt: NOW, updatedAt: NOW },
      settings: {
        gravity: { on: gravity > 0, g: gravity > 0 ? gravity : 9810 },
        snap: { grid: 1, on: true },
      },
      layers: [],
      parts: [],
      links: [],
    };
  }
  layer(name: string): string {
    const l: Layer = { id: `L${this.scene.layers.length + 1}`, name, visible: true, locked: false };
    this.scene.layers.push(l);
    return l.id;
  }
  private id(p: string) {
    return `${p}${++this.n}`;
  }
  part(p: Omit<Part, "id" | "ref" | "angle" | "fast"> & { angle?: number; fast?: boolean }): Part {
    const part: Part = { id: this.id("p"), ref: ++this.ref, angle: 0, fast: false, ...p };
    this.scene.parts.push(part);
    return part;
  }
  rect(
    name: string,
    layer: string,
    x: number,
    y: number,
    w: number,
    h: number,
    material: MaterialId,
    fixed = false,
  ) {
    const outer: Vec2[] = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ];
    return this.part({ name, layer, x, y, material, fixed, shape: { kind: "poly", outer, holes: [] } });
  }
  link<L extends Link>(l: Omit<L, "id" | "ref">): L {
    const link = { id: this.id("k"), ref: ++this.ref, ...l } as L;
    this.scene.links.push(link);
    return link;
  }
}

function write(name: string, scene: Scene, script: Omit<BenchScript, "scene">) {
  const v = validateSceneV1(scene);
  if (!v.ok) throw new Error(`${name}: ${JSON.stringify(v.issues)}`);
  writeFileSync(`${DIR}/${name}.scene.json`, JSON.stringify(v.scene, null, 2) + "\n");
  const full: BenchScript = { ...script, scene: `${name}.scene.json` };
  writeFileSync(`${DIR}/${name}.bench.json`, JSON.stringify(full, null, 2) + "\n");
  console.log(`${name}: ${scene.parts.length} peças, ${scene.links.length} ligações`);
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export async function main() {
  mkdirSync(DIR, { recursive: true });

  // 1 — Lançador (protótipo)
  write("01-lancador", migrated("lancador"), {
    id: "01-lancador",
    title: "Lançador",
    notes:
      "Migrado do protótipo. O desenho deixa 0,4 mm entre o pino do percussor e o retém: a medição de repouso começa depois de 0,5 s de acomodação. O tempo de saída da esfera conta a partir do disparo do sensor.",
    runs: [
      {
        name: "repouso e disparo",
        duration: 3,
        inputs: [
          { kind: "drag", part: "p13", from: [69, 69], to: [62.15, 68.73], t0: 1.5, t1: 1.8, release: 2.8 },
        ],
        assertions: [
          {
            kind: "maxDisplacement",
            label: "parado, o percussor não se move mais que 0,2 mm em 1 s",
            parts: ["p11"],
            from: 0.5,
            to: 1.5,
            max: 0.2,
          },
          {
            kind: "sensorCount",
            label: "puxando o gatilho, o sensor dispara exatamente 1 vez",
            sensor: "k15",
            equals: 1,
          },
          {
            kind: "crossAfterSensor",
            label: "a esfera passa da saída do cano em até 0,5 s",
            part: "p10",
            sensor: "k15",
            axis: [1, 0],
            value: 142.4,
            within: 0.5,
          },
        ],
      },
    ],
    still: { run: 0, parts: ["p11"], from: 0.5, to: 1.5 },
  });

  // 2 — Trava (protótipo)
  write("02-trava", migrated("trava"), {
    id: "02-trava",
    title: "Trava",
    notes: "Migrada do protótipo. A maçaneta é arrastada pela ponta até passar do batente de −30°.",
    runs: [
      {
        name: "girar e soltar",
        duration: 3.5,
        inputs: [
          { kind: "drag", part: "p9", from: [46, 66.8], to: [53.9, 85.5], t0: 0.5, t1: 1, release: 1.5 },
        ],
        assertions: [
          {
            kind: "linkAt",
            label: "a maçaneta gira 30°",
            link: "k12",
            field: "angle",
            at: 1.45,
            max: r4(-29.5 * DEG),
          },
          {
            kind: "linkAt",
            label: "girando a maçaneta 30°, a lingueta recolhe pelo menos 6 mm",
            link: "k10",
            field: "translation",
            at: 1.45,
            min: 6,
          },
          {
            kind: "returnsTo",
            label: "soltando, volta à posição inicial (±0,3 mm) em até 1 s",
            part: "p8",
            at: 2.5,
            tol: 0.3,
          },
        ],
      },
    ],
    still: { run: 0, parts: ["p8"], from: 2.5, to: 3.5 },
  });

  // 3 — Engrenagens e catraca (protótipo)
  const step = (2 * Math.PI) / 14;
  write("03-engrenagens", migrated("engrenagens"), {
    id: "03-engrenagens",
    title: "Engrenagens e catraca",
    notes:
      "Migrada do protótipo, com dentes evolventes de verdade (módulo 1,02 mm). Duas execuções a partir do repouso: motor a −12 rpm (a favor, a catraca gira livre) e a +12 rpm (contra, a lingueta trava).",
    runs: [
      {
        name: "a favor",
        duration: 5.5,
        inputs: [],
        assertions: [
          {
            kind: "ratio",
            label: "a favor, a razão das velocidades bate com a dos dentes (erro < 2%) por 5 s",
            base: "k10",
            links: [
              { link: "k11", ratio: -1.5 },
              { link: "k13", ratio: 2 },
            ],
            from: 0.5,
            to: 5.5,
            windows: 10,
            maxError: 0.02,
          },
        ],
      },
      {
        name: "contra",
        duration: 2,
        inputs: [{ kind: "motor", link: "k10", t: 0, speed: r4(rpmToRadPerSec(12)) }],
        assertions: [
          {
            kind: "maxRotation",
            label: "contra, o conjunto para antes de girar um passo de dente da catraca (25,7°)",
            link: "k13",
            from: 0,
            to: 2,
            max: r4(step),
          },
        ],
      },
    ],
    still: { run: 1, parts: ["p5", "p6", "p7", "p8", "p9"], from: 1, to: 2 },
  });

  // 4 — Pilha
  {
    const b = new Builder("Pilha de 200 caixas", G);
    const L = b.layer("Pilha");
    b.rect("Chão", L, 55, 5, 140, 10, "steel", true);
    for (let c = 0; c < 10; c++)
      for (let r = 0; r < 20; r++)
        b.rect(`Caixa ${c + 1}.${r + 1}`, L, c * 11 + 5, -5 - 10 * r, 10, 10, "wood");
    write("04-pilha", b.scene, {
      id: "04-pilha",
      title: "Pilha",
      notes: "10 colunas de 20 caixas de 10 mm (madeira), 1 mm entre colunas, gravidade real.",
      runs: [
        {
          name: "3 s",
          duration: 3,
          inputs: [],
          assertions: [
            {
              kind: "maxDisplacement",
              label: "após 3 s, nenhuma caixa saiu mais de 1 mm do lugar",
              parts: "dynamic",
              from: 0,
              to: 3,
              max: 1,
            },
          ],
        },
      ],
      still: { run: 0, parts: "dynamic", from: 2, to: 3 },
    });
  }

  // 5 — Corrente
  {
    const b = new Builder("Corrente de 40 elos", G);
    const L = b.layer("Corrente");
    let prev: Part | null = null;
    for (let i = 0; i < 40; i++) {
      const e = b.rect(`Elo ${i + 1}`, L, 8 * i + 4, 0, 10, 2, "steel");
      b.link<Extract<Link, { kind: "axle" }>>({
        kind: "axle",
        a: prev ? prev.id : null,
        b: e.id,
        at: [-4, 0],
      });
      prev = e;
    }
    write("05-corrente", b.scene, {
      id: "05-corrente",
      title: "Corrente",
      notes:
        "40 elos de 8 mm (aço) ligados por eixos, presa pela ponta esquerda, solta na horizontal, gravidade real.",
      runs: [
        {
          name: "5 s",
          duration: 5,
          inputs: [],
          assertions: [
            { kind: "jointGap", label: "em 5 s, nenhum eixo abre mais que 0,5 mm", links: "axles", max: 0.5 },
          ],
        },
      ],
    });
  }

  // 6 — Pinhão e cremalheira
  {
    const b = new Builder("Pinhão e cremalheira", 0);
    const L = b.layer("Engrenagem");
    const m = 1;
    const x0 = 60;
    const r = 6;
    const rk = rack({ module: m, teeth: 16, bodyHeight: 3 });
    if (!rk.ok) throw new Error(rk.error.message);
    const rackPart = b.part({
      name: "Cremalheira",
      layer: L,
      x: r4(x0 - 8.5 * Math.PI * m),
      y: 0,
      material: "steel",
      fixed: false,
      shape: { kind: "poly", outer: rk.value.outline.outer.map(([x, y]) => [r4(x), r4(y)]), holes: [] },
      source: { generator: "rack", params: { module: m, teeth: 16, bodyHeight: 3 } },
    });
    const pinion = b.part({
      name: "Pinhão",
      layer: L,
      x: x0,
      y: r,
      material: "steel",
      fixed: false,
      shape: {
        kind: "gear",
        module: m,
        teeth: 12,
        pressureAngle: r4(20 * DEG),
        profile: "involute",
        bore: 0,
      },
    });
    const speed = Math.PI;
    const axle = b.link<Extract<Link, { kind: "axle" }>>({
      kind: "axle",
      a: null,
      b: pinion.id,
      at: [0, 0],
      motor: { speed: r4(speed), maxTorque: 1e6 },
    });
    const slider = b.link<Extract<Link, { kind: "slider" }>>({
      kind: "slider",
      a: null,
      b: rackPart.id,
      at: [r4(8.5 * Math.PI), -2],
      dir: 0,
      travel: [-20, 20],
      spring: { k: 0, rest: 0, damping: 20 },
    });
    const seg = 0.4;
    const inputs = Array.from({ length: 50 }, (_, i) => ({
      kind: "motor" as const,
      link: axle.id,
      t: r4(seg * (i + 1)),
      speed: r4(i % 2 === 0 ? -speed : speed),
    }));
    write("06-pinhao-cremalheira", b.scene, {
      id: "06-pinhao-cremalheira",
      title: "Pinhão e cremalheira",
      notes:
        "Pinhão de 12 dentes, módulo 1, motor a ½ volta/s que inverte o sentido 50 vezes (trechos de 0,4 s). Cremalheira num trilho com amortecimento leve, sem gravidade.",
      runs: [
        {
          name: "50 inversões",
          duration: r4(seg * 51),
          inputs,
          assertions: [
            {
              kind: "rackFollows",
              label: "deslocamento da cremalheira = raio primitivo × ângulo (erro < 2%) e não trava",
              axle: axle.id,
              slider: slider.id,
              radius: r,
              motor: axle.id,
              maxError: 0.02,
              minTurn: 0.9,
            },
            { kind: "maxPenetration", label: "penetração entre dentes menor que 0,1 mm", max: 0.1 },
          ],
        },
      ],
    });
  }

  // 7 — Bala de prova
  {
    const b = new Builder("Bala de prova", 0);
    const L = b.layer("Prova");
    b.rect("Parede", L, 0.5, 0, 1, 200, "steel", true);
    const ball = b.part({
      name: "Esfera",
      layer: L,
      x: -50,
      y: 0,
      material: "steel",
      fixed: false,
      fast: true,
      shape: { kind: "circle", r: 2.5, holes: [] },
    });
    const rnd = seededRandom(7);
    const v = 20_000;
    const perStep = v / 240;
    const runs: BenchRun[] = [];
    for (let i = 0; i < 100; i++) {
      const th = (-60 + 120 * rnd()) * DEG;
      const yi = -40 + 80 * rnd();
      const s = 1 + perStep * rnd();
      const x = -2.5 - s * Math.cos(th);
      const y = yi - s * Math.sin(th);
      const a: BenchAssertion = {
        kind: "neverCrosses",
        label: "nenhum dos 100 lançamentos atravessa a parede de 1 mm",
        part: ball.id,
        point: [0.5, 0],
        normal: [1, 0],
      };
      runs.push({
        name: `lançamento ${i + 1}`,
        duration: 0.04,
        override: { [ball.id]: { x: r4(x), y: r4(y) } },
        inputs: [
          {
            kind: "velocity",
            part: ball.id,
            t: 0,
            v: [r4(v * Math.cos(th)), r4(v * Math.sin(th))],
            omega: 0,
          },
        ],
        assertions: [a],
      });
    }
    write("07-bala", b.scene, {
      id: "07-bala",
      title: "Bala de prova",
      notes:
        "Esfera de 5 mm (aço, detecção contínua) a 20 m/s contra parede fixa de 1 mm. 100 lançamentos com ângulo de −60° a 60° e distância inicial sorteada dentro de um passo (fase do impacto).",
      runs,
    });
  }

  // 8 — Escalas misturadas
  {
    const b = new Builder("Escalas misturadas", G);
    const L = b.layer("Barra");
    b.rect("Barra", L, 150, 5, 300, 10, "steel", true);
    const small: string[] = [];
    for (let k = 0; k < 20; k++) small.push(b.rect(`Peça ${k + 1}`, L, 7.5 + 15 * k, -0.5, 1, 1, "steel").id);
    write("08-escalas", b.scene, {
      id: "08-escalas",
      title: "Escalas misturadas",
      notes:
        "Barra fixa de 300 mm com 20 peças de 1 mm apoiadas, gravidade real. Também roda a 1 e a 10 mm por unidade.",
      runs: [
        {
          name: "3 s",
          duration: 3,
          inputs: [],
          assertions: [
            ...small.map((id): BenchAssertion => ({
              kind: "neverCrosses",
              label: "em 3 s, nenhuma peça de 1 mm atravessa a barra",
              part: id,
              point: [0, 0],
              normal: [0, 1],
            })),
            { kind: "jitter", label: "tremor abaixo de 0,05 mm", parts: small, from: 2, to: 3, max: 0.05 },
          ],
        },
      ],
      still: { run: 0, parts: small, from: 2, to: 3 },
      extraScales: [1, 10],
    });
  }
}
