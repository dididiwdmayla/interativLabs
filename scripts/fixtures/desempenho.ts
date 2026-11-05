import type { Vec2 } from "@/geometry/vec";
import type { MaterialId } from "@/model/materials";
import { Builder, writeFixture } from "./builder";

/**
 * Cena sintética de desempenho (Fase 1 · item 6.7): 150 peças e 100
 * ligações de todos os tipos em 4 camadas, com hachuras de todos os
 * materiais, ferragens e molas. Vinte células de mecanismo (placa fixa,
 * braço com motor, engrenagem parafusada, bloco num trilho com mola,
 * prateleira, esfera e calço) e uma fileira de dez engrenagens motorizadas.
 * Usada pela página /#perf; o roteiro só confere que ela fica estável.
 */

const PITCH = 78;
const COLS = 5;
const ROWS = 4;

const ring = (c: Vec2, r: number, n = 20): Vec2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (-2 * Math.PI * i) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Vec2;
  });

/** Rasgo reto (estádio) de p1 a p2, horário (furo). */
function slot(p1: Vec2, p2: Vec2, w: number): Vec2[] {
  const r = w / 2;
  const out: Vec2[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 8;
    out.push([p1[0] + r * Math.cos(a), p1[1] + r * Math.sin(a)]);
  }
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 8;
    out.push([p2[0] + r * Math.cos(a), p2[1] + r * Math.sin(a)]);
  }
  return out.reverse();
}

const FIFTH = ["cable", "rod", "mount", "pin", "sensor", "chamber", "slot", "cable", "rod"] as const;

export function generateDesempenho(): void {
  const b = new Builder("Desempenho: 150 peças e 100 ligações");
  const L1 = b.layer("Fundo");
  const L2 = b.layer("Braços");
  const L3 = b.layer("Trilhos");
  const L4 = b.layer("Frente");
  const plates: MaterialId[] = ["steel", "aluminum", "wood", "brass"];

  for (let i = 0; i < COLS * ROWS; i++) {
    const ox = (i % COLS) * PITCH;
    const oy = Math.floor(i / COLS) * PITCH;
    const at = (x: number, y: number): [number, number] => [ox + x, oy + y];
    const plate = b.rect(`Placa ${i + 1}`, L1, ...at(0, 0), 66, 66, plates[i % 4]!, {
      fixed: true,
      holes: [ring([-20, -20], 4), slot([10, 20], [22, 20], 4)],
    });
    // braço com motor, girando num eixo ao fundo
    const arm = b.rect(`Braço ${i + 1}`, L2, ...at(5, -10), 30, 6, i % 2 ? "brass" : "aluminum");
    b.link({
      kind: "axle",
      a: null,
      b: arm.id,
      at: [-15, 0],
      // 2 N·mm move o braço com a engrenagem (o peso dá ~0,4 N·mm) sem esmagar
      // o bloco leve em que o pino do braço encosta (40 N·mm afundava 1,4 mm)
      motor: { speed: i % 2 ? -2 : 1.5, maxTorque: 2 },
    });
    const bob = b.part({
      name: `Engrenagem ${i + 1}`,
      layer: L2,
      x: at(18, -10)[0],
      y: at(18, -10)[1],
      material: "steel",
      shape: {
        kind: "gear",
        module: 1,
        teeth: 12,
        pressureAngle: (20 * Math.PI) / 180,
        profile: "involute",
        bore: 2,
      },
    });
    b.link({ kind: "screw", a: arm.id, b: bob.id, at: [0, 0] });
    // bloco num trilho com mola de retorno, puxado pelo braço por uma mola
    const block = b.rect(`Bloco ${i + 1}`, L3, ...at(10, 12), 12, 8, "polymer");
    b.link({
      kind: "slider",
      a: null,
      b: block.id,
      at: [0, 0],
      dir: 0,
      travel: [-10, 10],
      spring: { k: 0.05, rest: 0, damping: 0.0005 },
    });
    const pa = at(18, -10);
    const pb = at(10, 12);
    b.link({
      kind: "spring",
      a: arm.id,
      b: block.id,
      atA: [13, 0],
      atB: [0, 0],
      k: 0.01,
      damping: 0.00005,
      freeLength: Math.round(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * 100) / 100,
      mode: "fixed",
      coil: { outerD: 4, wireD: 0.5, turns: 8 },
    });
    // prateleira e esfera na frente
    const shelf = b.rect(`Prateleira ${i + 1}`, L4, ...at(0, 27), 28, 3, "steel", { fixed: true });
    const ball = b.circle(`Esfera ${i + 1}`, L4, ...at(0, 22), 3.5, "rubber");
    // calço solto ao lado da esfera
    b.poly(
      `Calço ${i + 1}`,
      L4,
      ...at(9, 23.5),
      [
        [-4, 2],
        [4, 2],
        [1, -3],
      ],
      i % 2 ? "wood" : "polymer",
    );
    const fifth = i % 2 === 0 ? FIFTH[i / 2] : undefined;
    switch (fifth) {
      case "cable":
        b.link({ kind: "cable", a: null, b: ball.id, atA: at(0, 8), atB: [0, 0], maxLength: 16 });
        break;
      case "rod":
        b.link({ kind: "rod", a: null, b: ball.id, atA: at(-14, 22), atB: [0, 0] });
        break;
      case "mount":
        b.link({ kind: "mount", a: null, b: ball.id, at: [0, 0], linearHz: 8, angularHz: 4, damping: 0.3 });
        break;
      case "pin":
        b.link({ kind: "pin", host: arm.id, at: [13, 0], r: 1.5, layers: [L2, L4] });
        break;
      case "sensor":
        b.link({
          kind: "sensor",
          host: shelf.id,
          at: [0, -1.5],
          r: 3,
          layers: [L4, L4],
          minSpeed: 50,
          actions: [],
        });
        break;
      case "chamber":
        b.link({
          kind: "chamber",
          body: null,
          at: at(-14, 22),
          dir: 0,
          bore: 7,
          length: 30,
          walls: [{ part: ball.id, seal: 4 }],
          vents: [],
          ports: [],
          gas: { model: "isothermal", gamma: 1.4, p0: 101.325 },
        });
        break;
      case "slot": {
        // pino no bloco correndo no rasgo da placa (modo contato)
        const pin = b.link({ kind: "pin", host: block.id, at: [6, 8], r: 1.5, layers: [L1, L3] });
        b.link({ kind: "slot", pin: pin.id, guide: plate.id, hole: 1, mode: "contact" });
        break;
      }
    }
  }
  // fileira de dez engrenagens, em pares engrenados, a de cada par com motor
  const gy = ROWS * PITCH + 4;
  for (let k = 0; k < 10; k++) {
    const pair = Math.floor(k / 2);
    const x = pair * PITCH + (k % 2 ? 24 - 10 : -10);
    const g = b.part({
      name: `Roda ${k + 1}`,
      layer: L3,
      x,
      y: gy,
      angle: k % 2 ? Math.PI / 16 : 0,
      material: k % 2 ? "brass" : "steel",
      shape: {
        kind: "gear",
        module: 1.5,
        teeth: 16,
        pressureAngle: (20 * Math.PI) / 180,
        profile: "involute",
        bore: 4,
      },
    });
    b.link(
      k % 2
        ? { kind: "axle", a: null, b: g.id, at: [0, 0], friction: 0.5 }
        : { kind: "axle", a: null, b: g.id, at: [0, 0], motor: { speed: 1.2, maxTorque: 200 } },
    );
  }
  const s = b.scene;
  if (s.parts.length !== 150 || s.links.length !== 100)
    throw new Error(`desempenho: ${s.parts.length} peças e ${s.links.length} ligações (esperava 150 e 100)`);
  writeFixture("desempenho", "desempenho", s, {
    title: "Desempenho: 150 peças e 100 ligações",
    notes:
      "Cena sintética da página /#perf: vinte células com braço a motor, engrenagem parafusada, bloco num trilho, mola, esfera e uma ligação extra de cada tipo, mais dez engrenagens. O roteiro só confere que ela fica estável.",
    runs: [
      {
        name: "estável",
        duration: 2,
        inputs: [],
        assertions: [
          { kind: "maxPenetration", label: "nada atravessa (penetração < 1,5 mm)", max: 1.5, from: 0.2 },
          {
            kind: "maxDisp",
            label: "as esferas e os blocos não fogem (< 40 mm)",
            parts: s.parts.filter((p) => /Esfera|Bloco|Calço/.test(p.name)).map((p) => p.id),
            max: 40,
          },
        ],
      },
    ],
  });
}
