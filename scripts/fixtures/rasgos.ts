import { PI, dcos, dsin } from "@/geometry/dmath";
import { arcPoints, circleRing, slotRing } from "@/geometry/primitives";
import type { Vec2 } from "@/geometry/vec";
import { DEG } from "@/model/units";
import { Builder, r4, writeFixture } from "./builder";

/** Furos e rasgos como guia (item 5.5). */

/** Rasgo em arco: faixa de largura w em torno de um arco de raio R, de a0 a a1 (rad). */
function arcSlot(R: number, w: number, a0: number, a1: number): Vec2[] {
  const outer = arcPoints([0, 0], R + w / 2, a0, a1);
  const capB = arcPoints([R * dcos(a1), R * dsin(a1)], w / 2, a1, a1 + PI).slice(1, -1);
  const inner = arcPoints([0, 0], R - w / 2, a1, a0);
  const capA = arcPoints([R * dcos(a0), R * dsin(a0)], w / 2, a0 + PI, a0 + 2 * PI).slice(1, -1);
  return [...outer, ...capB, ...inner, ...capA];
}

export function generateRasgos(): void {
  // Rasgo reto em modo junta
  {
    const b = new Builder("Rasgo reto");
    const L1 = b.layer("Placa", 3);
    const L2 = b.layer("Alavanca", 3);
    b.rect("Placa com rasgo", L1, 0, 0, 60, 20, "steel", {
      fixed: true,
      holes: [slotRing([-10, 0], [10, 0], 4.2)],
    });
    const lever = b.rect("Alavanca", L2, 0, 22, 6, 50, "steel");
    const pin = b.link({ kind: "pin", host: lever.id, at: [0, -22], r: 2, layers: [L1, L2] });
    const slot = b.link({ kind: "slot", pin: pin.id, guide: "p1", hole: 0, mode: "joint" });
    writeFixture("rasgos", "reto", b.scene, {
      title: "Rasgo reto (junta)",
      notes:
        "Placa fixa com um rasgo reto de 20 mm (linha de centro) e 4,2 mm de largura; uma alavanca pendurada por um pino de Ø 4 mm que corre no rasgo. O roteiro arrasta a ponta de baixo da alavanca para a direita e para a esquerda, além dos batentes do pino (a alavanca inclina ~0,5 rad), e solta.",
      view: [-50, -20, 100, 80],
      runs: [
        {
          name: "arrasto",
          duration: 3,
          inputs: [
            {
              kind: "dragPath",
              part: lever.id,
              path: [
                [0, 44],
                [30, 38],
                [-30, 38],
              ],
              t0: 0.2,
              t1: 1.6,
              release: 1.6,
            },
          ],
          assertions: [
            {
              kind: "range",
              label: "desvio transversal do pino < 0,01 mm",
              q: { link: slot.id, field: "deviation" },
              min: -0.01,
              max: 0.01,
            },
            {
              kind: "range",
              label: "o pino para nos batentes (10 mm + 0,1 mm de folga de cada lado)",
              q: { link: slot.id, field: "position" },
              min: -10.11,
              max: 10.11,
            },
            {
              kind: "span",
              label: "e chega aos dois batentes",
              q: { link: slot.id, field: "position" },
              min: 20.15,
            },
            {
              kind: "span",
              label: "solta, a alavanca gira livre em torno do pino",
              q: { part: lever.id, field: "angle" },
              from: 1.8,
              to: 3,
              min: 0.2,
            },
          ],
        },
      ],
    });
  }

  // Rasgo curvo em modo contato
  {
    const b = new Builder("Rasgo curvo");
    const L1 = b.layer("Placa", 3);
    const L2 = b.layer("Peça", 3);
    const R = 30;
    const plate = b.poly(
      "Placa com rasgo em arco",
      L1,
      0,
      0,
      [
        [-10, -10],
        [45, -10],
        [45, 45],
        [-10, 45],
      ],
      "steel",
      { fixed: true, holes: [arcSlot(R, 4.4, 0, PI / 2)] },
    );
    const disc = b.circle("Peça com pino", L2, R, 0, 6, "steel");
    const pin = b.link({ kind: "pin", host: disc.id, at: [0, 0], r: 2, layers: [L1, L2] });
    const slot = b.link({ kind: "slot", pin: pin.id, guide: plate.id, hole: 0, mode: "contact" });
    const at = (deg: number): Vec2 => [r4(R * dcos(deg * DEG)), r4(R * dsin(deg * DEG))];
    writeFixture("rasgos", "curvo", b.scene, {
      title: "Rasgo curvo (contato)",
      notes:
        "Placa fixa na camada 1 com um rasgo em arco de 90° (raio 30 mm, 4,4 mm de largura); peça na camada 2 com um pino de Ø 4 mm que ocupa as camadas 1 e 2. O roteiro arrasta a peça ao longo do arco, até 5° além das pontas, e volta.",
      view: [-15, -15, 65, 65],
      runs: [
        {
          name: "arrasto",
          duration: 3.2,
          inputs: [
            {
              kind: "dragPath",
              part: disc.id,
              path: [0, -5, 5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 85, 75, 65, 55, 45, 35, 25, 15, 5, -5].map(
                at,
              ),
              t0: 0.1,
              t1: 3,
              release: 3,
            },
          ],
          assertions: [
            {
              kind: "span",
              label: "o pino percorre o arco de ponta a ponta (≥ 88°)",
              q: { around: { part: disc.id, at: [0, 0], center: [0, 0] } },
              min: r4(88 * DEG),
            },
            { kind: "maxPenetration", label: "penetração < 0,1 mm", max: 0.1 },
            {
              kind: "range",
              label: "nunca escapa do rasgo (folga até a parede ≥ −0,1 mm)",
              q: { link: slot.id, field: "clearance" },
              min: -0.1,
            },
          ],
        },
      ],
    });
  }

  // Mancal com folga
  {
    const b = new Builder("Mancal com folga");
    const L1 = b.layer("Placa", 3);
    const L2 = b.layer("Alavanca", 3);
    b.rect("Placa com furo de Ø 4,2", L1, 0, 0, 20, 20, "steel", {
      fixed: true,
      holes: [circleRing([0, 0], 2.1)],
    });
    const th = 60 * DEG;
    const lever = b.rect("Alavanca", L2, -17 * dsin(th), 17 * dcos(th), 6, 40, "steel", { angle: th });
    const pin = b.link({ kind: "pin", host: lever.id, at: [0, -17], r: 2, layers: [L1, L2] });
    const slot = b.link({ kind: "slot", pin: pin.id, guide: "p1", hole: 0, mode: "contact" });
    writeFixture("rasgos", "mancal", b.scene, {
      title: "Mancal com folga",
      notes:
        "Pino de Ø 4 mm num furo redondo de Ø 4,2 mm (0,1 mm de folga radial; o furo é um polígono com 0,02 mm de tolerância de corda). A alavanca é solta a 60° e balança em torno do furo.",
      view: [-45, -15, 90, 60],
      runs: [
        {
          name: "3 s",
          duration: 3,
          inputs: [],
          assertions: [
            {
              kind: "span",
              label: "a peça gira em torno do furo",
              q: { part: lever.id, field: "angle" },
              min: 1.5,
            },
            {
              kind: "range",
              label: "o centro do pino fica dentro de folga + penetração (≤ 0,2 mm do centro do furo)",
              q: {
                dist: [
                  { part: lever.id, at: [0, -17] },
                  { part: null, at: [0, 0] },
                ],
              },
              max: 0.2,
            },
            {
              kind: "range",
              label: "penetração do pino na parede < 0,1 mm",
              q: { link: slot.id, field: "clearance" },
              min: -0.1,
            },
          ],
        },
      ],
    });
  }

  // Camadas
  {
    const b = new Builder("Pino e camadas");
    const L1 = b.layer("Fundo", 3);
    const L2 = b.layer("Meio", 3);
    const L3 = b.layer("Frente", 3);
    b.rect("Prateleira (camada 1)", L1, 0, 50, 60, 10, "steel", { fixed: true });
    const box = b.rect("Caixa solta (camada 1)", L1, 0, 40, 40, 10, "steel");
    b.rect("Piso (camada 3)", L3, 0, 100, 60, 10, "steel", { fixed: true });
    const falling = b.rect("Peça com pino (camada 2)", L2, 0, -300, 16, 8, "steel");
    b.link({ kind: "pin", host: falling.id, at: [0, 0], r: 3, layers: [L2, L3] });
    writeFixture("rasgos", "camadas", b.scene, {
      title: "Pino e camadas",
      notes:
        "Uma peça na camada 2 com um pino de faixa 2–3 cai sobre uma caixa solta e uma prateleira da camada 1 e depois sobre um piso da camada 3. O pino atravessa a camada 1 sem tocar e para na camada 3.",
      view: [-45, -310, 90, 430],
      runs: [
        {
          name: "queda",
          duration: 2,
          inputs: [],
          assertions: [
            {
              kind: "maxDisp",
              label: "o pino nunca toca a peça da camada 1 no caminho (a caixa não se move)",
              parts: [box.id],
              from: 0.2,
              max: 0.001,
            },
            {
              kind: "mean",
              label: "atravessa e para no piso da camada 3 (centro a 92 mm ± 0,1)",
              q: { part: falling.id, field: "y" },
              from: 1.5,
              to: 2,
              min: 91.9,
              max: 92.1,
            },
          ],
        },
      ],
    });
  }
}
