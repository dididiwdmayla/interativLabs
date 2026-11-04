import { PI, dcos, dsin } from "@/geometry/dmath";
import { DEG, G_REAL as G } from "@/model/units";
import { Builder, br, r4, writeFixture } from "./builder";

/** Fixações (item 5.3): rígida e relativas, com gravidade real. */
export function generateFixacoes(): void {
  // Pêndulo físico
  {
    const b = new Builder("Pêndulo");
    const L = b.layer("Pêndulo", 3);
    const len = 100;
    const w = 6;
    const d = len / 2;
    const th0 = 30 * DEG;
    const bar = b.rect("Barra", L, d * dsin(th0), d * dcos(th0), len, w, "steel", { angle: PI / 2 - th0 });
    const axle = b.link({ kind: "axle", a: null, b: bar.id, at: [-d, 0] });
    // I em torno do pivô / (m·g·d) — a massa cancela
    const iOverM = (len * len + w * w) / 12 + d * d;
    const T = 2 * PI * Math.sqrt(iOverM / (G * d));
    writeFixture("fixacoes", "pendulo", b.scene, {
      title: "Pêndulo",
      notes: `Barra de aço de 100 × 6 mm presa ao fundo por um eixo numa ponta, solta a 30°. Período do pêndulo físico 2π·√(I/(m·g·d)) = ${br(T)} s (a 30° de amplitude o período real é 1,7% maior). Na segunda execução o eixo tem 0,3 N·mm de atrito.`,
      view: [-70, -20, 140, 130],
      runs: [
        {
          name: "sem atrito",
          duration: 3,
          inputs: [],
          assertions: [
            {
              kind: "period",
              label: "o período bate com 2π·√(I/(m·g·d)) (±3%)",
              q: { link: axle.id, field: "angle" },
              from: 0.1,
              to: 3,
              expected: r4(T),
              tol: 0.03,
            },
            {
              kind: "maxField",
              label: "o eixo não abre (≤ 0,05 mm)",
              links: [axle.id],
              field: "gap",
              max: 0.05,
            },
          ],
        },
        {
          name: "com atrito",
          duration: 4,
          patch: { [axle.id]: { friction: 0.3 } },
          inputs: [],
          assertions: [
            {
              kind: "decays",
              label: "com atrito, a amplitude cai a cada ciclo até parar",
              q: { link: axle.id, field: "angle" },
              from: 0,
              to: 4,
              final: 0.002,
            },
            {
              kind: "range",
              label: "parado no fim (|ω| < 0,01 rad/s)",
              q: { link: axle.id, field: "speed" },
              from: 3.5,
              to: 4,
              min: -0.01,
              max: 0.01,
            },
          ],
        },
      ],
    });
  }

  // Parafusado × suporte elástico
  {
    const b = new Builder("Parafusado e suporte elástico");
    const L = b.layer("Barras", 3);
    const len = 60;
    const w = 6;
    const screwed = b.rect("Barra parafusada", L, 0, 0, len, w, "steel");
    b.link({ kind: "screw", a: null, b: screwed.id, at: [-len / 2, 0] });
    const mounted = b.rect("Barra no suporte", L, 0, 40, len, w, "steel");
    const hz = 30;
    const zeta = 0.2;
    b.link({
      kind: "mount",
      a: null,
      b: mounted.id,
      at: [-len / 2, 0],
      linearHz: hz,
      angularHz: hz,
      damping: zeta,
    });
    // Estática da solda macia do Box2D: mola linear ω²·K⁻¹ no ponto e mola angular ω²·I.
    // Deflexão do centro: g/ω² + (r²·m/I)·g·(1/ω_lin² + 1/ω_ang²), r = 30 mm, I/m = (L²+w²)/12.
    const om2 = (2 * PI * hz) ** 2;
    const rr = (len / 2) ** 2 / ((len * len + w * w) / 12);
    const defl = G / om2 + rr * G * (2 / om2);
    writeFixture("fixacoes", "parafuso-suporte", b.scene, {
      title: "Parafusado × suporte elástico",
      notes: `Duas barras iguais de aço (60 × 6 mm) em balanço, presas ao fundo pela ponta esquerda: a de cima por parafuso, a de baixo por suporte elástico de ${hz} Hz (ζ = ${br(zeta)}). Deflexão estática esperada do centro da barra no suporte: ${br(defl)} mm.`,
      view: [-45, -15, 90, 70],
      runs: [
        {
          name: "3 s",
          duration: 3,
          inputs: [],
          assertions: [
            {
              kind: "maxDisp",
              label: "a parafusada não se move (< 0,01 mm)",
              parts: [screwed.id],
              max: 0.01,
            },
            {
              kind: "span",
              label: "a do suporte cede com o próprio peso e oscila (passa da deflexão estática)",
              q: { part: mounted.id, along: [0, 1] },
              from: 0,
              to: 0.5,
              min: r4(defl * 1.3),
            },
            {
              kind: "mean",
              label: `assenta na deflexão estática da frequência configurada (${br(defl, 2)} mm ± 10%)`,
              q: { part: mounted.id, along: [0, 1] },
              from: 2.5,
              to: 3,
              min: r4(defl * 0.9),
              max: r4(defl * 1.1),
            },
            {
              kind: "span",
              label: "parada no fim (variação < 0,02 mm)",
              q: { part: mounted.id, along: [0, 1] },
              from: 2.5,
              to: 3,
              max: 0.02,
            },
          ],
        },
      ],
    });
  }

  // Biela e manivela
  {
    const b = new Builder("Biela e manivela");
    b.layer("Base", 3);
    const L2 = b.layer("Manivela", 3);
    const L3 = b.layer("Bloco", 3);
    const R = 15;
    const rod = 50;
    const crank = b.circle("Manivela", L2, 0, 0, 20, "steel");
    const axle = b.link({
      kind: "axle",
      a: null,
      b: crank.id,
      at: [0, 0],
      motor: { speed: r4(2 * PI), maxTorque: 50 },
    });
    const block = b.rect("Bloco", L3, R + rod, 0, 16, 10, "steel");
    const link = b.link({ kind: "rod", a: crank.id, b: block.id, atA: [R, 0], atB: [0, 0] });
    const slider = b.link({ kind: "slider", a: null, b: block.id, at: [0, 0], dir: 0, travel: [-45, 15] });
    writeFixture("fixacoes", "biela", b.scene, {
      title: "Biela e manivela (cena de teste)",
      notes:
        "Manivela de raio 15 mm num eixo com motor a 1 volta/s, haste de 50 mm até um bloco num trilho horizontal.",
      view: [-30, -30, 110, 60],
      runs: [
        {
          name: "3 s",
          duration: 3,
          inputs: [],
          assertions: [
            {
              kind: "span",
              label: "curso do bloco = 2 × raio da manivela (30 mm ± 1%)",
              q: { link: slider.id, field: "translation" },
              from: 1,
              to: 3,
              min: 29.7,
              max: 30.3,
            },
            {
              kind: "range",
              label: "comprimento da haste constante (50 ± 0,01 mm)",
              q: { link: link.id, field: "length" },
              min: 49.99,
              max: 50.01,
            },
            {
              kind: "mean",
              label: "a manivela gira na velocidade do motor (1 volta/s ± 1%)",
              q: { link: axle.id, field: "speed" },
              from: 1,
              to: 3,
              min: r4(2 * PI * 0.99),
              max: r4(2 * PI * 1.01),
            },
          ],
        },
      ],
    });
  }

  // Cabo
  {
    const b = new Builder("Cabo");
    const L = b.layer("Cabo", 10);
    const m = 20;
    const r = r4(Math.sqrt(m / (0.00785 * PI * 10)));
    const weight = b.circle("Peso de 20 g", L, 0, 50 + r, r, "steel");
    const cable = b.link({ kind: "cable", a: null, b: weight.id, atA: [0, 0], atB: [0, -r], maxLength: 50 });
    writeFixture("fixacoes", "cabo", b.scene, {
      title: "Cabo",
      notes:
        "Peso de 20 g pendurado num cabo de 50 mm. Em 1 s, um empurrão para cima (400 mm/s) afrouxa o cabo; o peso cai e o cabo estica de novo.",
      view: [-40, -10, 80, 85],
      runs: [
        {
          name: "empurrão",
          duration: 2.5,
          inputs: [{ kind: "velocity", part: weight.id, t: 1, v: [0, -400], omega: 0 }],
          assertions: [
            {
              kind: "range",
              label: "esticado, a distância fica em 50 ± 0,05 mm",
              q: { link: cable.id, field: "length" },
              from: 0.3,
              to: 1,
              min: 49.95,
              max: 50.05,
            },
            {
              kind: "range",
              label: "empurrado para cima, o cabo afrouxa (distância < 50 mm)",
              q: { link: cable.id, field: "length" },
              from: 1.01,
              to: 1.06,
              max: 49.9,
            },
            {
              kind: "range",
              label: "frouxo, o cabo não puxa (força nula)",
              q: { link: cable.id, field: "force" },
              from: 1.01,
              to: 1.06,
              min: -1e-6,
              max: 1e-6,
            },
            {
              kind: "range",
              label: "o peso cai de volta e o cabo estica de novo (50 ± 0,05 mm)",
              q: { link: cable.id, field: "length" },
              from: 1.8,
              to: 2.5,
              min: 49.95,
              max: 50.05,
            },
            {
              kind: "mean",
              label: "esticado, o cabo sustenta o peso (0,196 N ± 1%)",
              q: { link: cable.id, field: "force" },
              from: 2,
              to: 2.5,
              min: r4(m * G * 1e-6 * 0.99),
              max: r4(m * G * 1e-6 * 1.01),
            },
          ],
        },
      ],
    });
  }
}
