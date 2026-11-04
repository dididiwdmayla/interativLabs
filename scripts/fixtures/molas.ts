import { PI, dcos, dsin } from "@/geometry/dmath";
import { DEG, G_REAL as G } from "@/model/units";
import { Builder, br, r4, writeFixture } from "./builder";

/** Molas 2.0 (item 5.4): apoiada, só tração, sólido, guia, pré-carga e mola rígida. */

const STEEL = 0.00785;
/** g·mm/s² → N */
const toN = (v: number) => v * 1e-6;
/** amortecimento (N·s/mm) para a razão ζ com massa m (g) e rigidez k (N/mm) */
const dampFor = (zeta: number, k: number, m: number) =>
  r4(((zeta * 2 * Math.sqrt(k * 1e6 * m)) / 1e6) * 1e4) / 1e4;
const coil = (turns: number, wireD: number, outerD = 8) => ({ outerD, wireD, turns });

export function generateMolas(): void {
  // Apoiada e só tração
  {
    const b = new Builder("Mola apoiada e mola de tração");
    const L = b.layer("Molas", 3);
    const w = 30;
    const h = r4(20 / (STEEL * 3 * w));
    const m = STEEL * w * h * 3;
    const k = 0.02;
    const free = 40;
    const x = toN(m * G) / k;
    const c = dampFor(0.3, k, m);
    // à esquerda: bloco apoiado numa mola de compressão (só empurra)
    b.rect("Base", L, 0, 105, 50, 10, "steel", { fixed: true });
    const blockA = b.rect("Bloco apoiado", L, 0, 100 - free - h / 2, w, h, "steel");
    b.link({ kind: "slider", a: null, b: blockA.id, at: [0, 0], dir: r4(PI / 2), travel: [-100, 100] });
    const seated = b.link({
      kind: "spring",
      a: null,
      b: blockA.id,
      atA: [0, 100],
      atB: [0, r4(h / 2)],
      k,
      damping: c,
      freeLength: free,
      mode: "seated",
      solidLength: 8,
      coil: coil(10, 0.8),
    });
    // à direita: bloco pendurado numa mola de tração (só puxa)
    b.rect("Teto", L, 80, -5, 50, 10, "steel", { fixed: true });
    const blockB = b.rect("Bloco pendurado", L, 80, free + h / 2, w, h, "steel");
    b.link({ kind: "slider", a: null, b: blockB.id, at: [0, 0], dir: r4(PI / 2), travel: [-100, 100] });
    const tension = b.link({
      kind: "spring",
      a: null,
      b: blockB.id,
      atA: [80, 0],
      atB: [0, r4(-h / 2)],
      k,
      damping: c,
      freeLength: free,
      mode: "tension",
      solidLength: 8,
      coil: coil(10, 0.8),
    });
    const len = (id: string) => ({ link: id, field: "length" });
    writeFixture("molas", "apoiada", b.scene, {
      title: "Mola apoiada e mola de tração",
      notes: `Dois blocos de ${br(m, 2)} g em trilhos verticais, molas de ${br(k)} N/mm e ${free} mm livres. À esquerda, apoiado numa mola de compressão (só empurra); à direita, pendurado numa mola de tração (só puxa). Compressão e extensão estáticas esperadas: m·g/k = ${br(x, 3)} mm. Na segunda execução os dois levam um empurrão para cima.`,
      view: [-40, -20, 160, 135],
      runs: [
        {
          name: "repouso",
          duration: 3,
          inputs: [],
          assertions: [
            {
              kind: "mean",
              label: `apoiada: compressão estática = m·g/k (${br(x, 2)} mm ± 2%)`,
              q: len(seated.id),
              from: 2.5,
              to: 3,
              min: r4(free - 1.02 * x),
              max: r4(free - 0.98 * x),
            },
            {
              kind: "mean",
              label: `só tração: extensão estática = m·g/k (${br(x, 2)} mm ± 2%)`,
              q: len(tension.id),
              from: 2.5,
              to: 3,
              min: r4(free + 0.98 * x),
              max: r4(free + 1.02 * x),
            },
          ],
        },
        {
          name: "empurrão para cima",
          duration: 3,
          inputs: [
            { kind: "velocity", part: blockA.id, t: 1.5, v: [0, -700], omega: 0 },
            { kind: "velocity", part: blockB.id, t: 1.5, v: [0, -700], omega: 0 },
          ],
          assertions: [
            {
              kind: "while",
              label: "apoiada, puxada além do comprimento livre: não puxa (força nula)",
              cond: len(seated.id),
              condMin: free + 0.2,
              q: { link: seated.id, field: "force" },
              min: 0,
              max: 0,
              minSteps: 5,
            },
            {
              kind: "while",
              label: "só tração, empurrada abaixo do comprimento livre: não empurra (força nula)",
              cond: len(tension.id),
              condMax: free - 0.2,
              q: { link: tension.id, field: "force" },
              min: 0,
              max: 0,
              minSteps: 5,
            },
            {
              kind: "mean",
              label: "os dois caem pela gravidade e voltam ao repouso (apoiada ± 2%)",
              q: len(seated.id),
              from: 2.7,
              to: 3,
              min: r4(free - 1.02 * x),
              max: r4(free - 0.98 * x),
            },
          ],
        },
      ],
    });
  }

  // Comprimento sólido
  {
    const b = new Builder("Comprimento sólido");
    const L = b.layer("Mola", 10);
    const hb = 36;
    const vb = r4(100 / (STEEL * 10 * hb));
    const m = STEEL * hb * vb * 10;
    const k = 0.05;
    const free = 30;
    const solid = 10;
    const F = 50 * k * (free - solid);
    b.rect("Parede", L, -5, 0, 10, 60, "steel", { fixed: true });
    const block = b.rect("Bloco de 100 g", L, free + hb / 2, 0, hb, vb, "steel");
    const slider = b.link({ kind: "slider", a: null, b: block.id, at: [0, 0], dir: 0, travel: [-40, 20] });
    const spring = b.link({
      kind: "spring",
      a: null,
      b: block.id,
      atA: [0, 0],
      atB: [-hb / 2, 0],
      k,
      damping: dampFor(0.3, k, m),
      freeLength: free,
      mode: "seated",
      solidLength: solid,
      coil: coil(10, 1, 10),
    });
    writeFixture("molas", "solido", b.scene, {
      title: "Comprimento sólido",
      notes: `Bloco de ${br(m, 1)} g num trilho, mola apoiada de ${br(k)} N/mm, ${free} mm livres e ${solid} mm sólidos (10 espiras de 1 mm). De 0,3 a 1,3 s uma força de ${br(F, 1)} N (50 × k × curso) empurra o bloco contra a mola.`,
      view: [-15, -35, 90, 70],
      runs: [
        {
          name: "força 50 × k × curso",
          duration: 3,
          inputs: [{ kind: "force", part: block.id, t0: 0.3, t1: 1.3, f: [-F, 0] }],
          assertions: [
            {
              kind: "range",
              label: `a mola nunca fica menor que o sólido − 0,05 mm (${br(solid - 0.05, 2)} mm)`,
              q: { link: spring.id, field: "length" },
              min: solid - 0.05,
            },
            {
              kind: "mean",
              label: `devolve a força como batente (${br(F, 1)} N ± 2%)`,
              q: { link: spring.id, field: "force" },
              from: 0.8,
              to: 1.3,
              min: r4(F * 0.98),
              max: r4(F * 1.02),
            },
            {
              kind: "range",
              label: "sem explodir: o bloco fica no trilho e em velocidade razoável",
              q: { link: slider.id, field: "translation" },
              min: -20.05,
              max: 20.05,
            },
          ],
        },
      ],
    });
  }

  // Mola com guia
  {
    const b = new Builder("Mola com guia");
    const L1 = b.layer("Haste", 3);
    const L2 = b.layer("Bloco", 3);
    const alpha = 30 * DEG;
    const ca = dcos(alpha);
    const sa = dsin(alpha);
    const rod = b.rect("Haste-guia", L1, 0, 0, 120, 4, "steel", { fixed: true, angle: alpha });
    // ponto da haste no espaço local → mundo
    const at = (lx: number, ly: number): [number, number] => [lx * ca - ly * sa, lx * sa + ly * ca];
    const bw = 16;
    const bh = 10;
    const m = STEEL * bw * bh * 3;
    const k = 0.01;
    const free = 40;
    const base = -50;
    // bloco sobre a haste, 6 mm acima do eixo; a mola pega na face esquerda, fora do eixo
    const cx = base + free + bw / 2;
    const [bx, by] = at(cx, -6);
    const block = b.rect("Bloco", L2, bx, by, bw, bh, "steel", { angle: alpha });
    const slider = b.link({ kind: "slider", a: rod.id, b: block.id, at: [0, 0], dir: 0, travel: [-30, 30] });
    const spring = b.link({
      kind: "spring",
      a: rod.id,
      b: block.id,
      atA: [base, 0],
      atB: [-bw / 2, 0],
      k,
      damping: dampFor(0.1, k, m),
      freeLength: free,
      mode: "fixed",
      guide: rod.id,
      coil: coil(12, 0.6, 7),
    });
    const ext = toN(m * G * sa) / k;
    writeFixture("molas", "guia", b.scene, {
      title: "Mola com guia",
      notes: `Haste fixa inclinada 30°, passando por dentro de uma mola de ${br(k)} N/mm; um bloco de ${br(m, 2)} g desliza nela. A mola pega no bloco 6 mm acima do eixo da haste: sem a guia, a força sairia torta. Extensão estática esperada: m·g·sen 30°/k = ${br(ext, 3)} mm.`,
      view: [-70, -50, 140, 100],
      runs: [
        {
          name: "4 s",
          duration: 4,
          inputs: [],
          assertions: [
            {
              kind: "while",
              label: "a força fica alinhada ao eixo da guia (transversal < 1% da força)",
              cond: { abs: { link: spring.id, field: "force" } },
              condMin: 1e-4,
              q: {
                div: [{ link: spring.id, field: "sideForce" }, { abs: { link: spring.id, field: "force" } }],
              },
              min: 0,
              max: 0.01,
              minSteps: 100,
            },
            {
              kind: "maxPenetration",
              label: "nenhum contato entre a haste e a mola (a mola não colide)",
              max: 1e-9,
            },
            {
              kind: "decays",
              label: "o bloco oscila e assenta",
              q: { link: slider.id, field: "translation" },
              from: 0,
              to: 4,
              final: 0.02,
            },
            {
              kind: "mean",
              label: `extensão final = m·g·sen 30°/k (${br(ext, 2)} mm ± 2%)`,
              q: { link: slider.id, field: "translation" },
              from: 3.5,
              to: 4,
              min: r4(ext * 0.98),
              max: r4(ext * 1.02),
            },
          ],
        },
      ],
    });
  }

  // Pré-carga
  {
    const b = new Builder("Pré-carga");
    const L = b.layer("Mola", 3);
    const k = 0.05;
    const free = 30;
    const mounted = 20;
    const F = k * (free - mounted);
    b.rect("Parede", L, -5, 0, 10, 40, "steel", { fixed: true });
    const block = b.rect("Bloco", L, mounted + 10, 0, 20, 10, "steel");
    const slider = b.link({ kind: "slider", a: null, b: block.id, at: [0, 0], dir: 0, travel: [-5, 0] });
    const spring = b.link({
      kind: "spring",
      a: null,
      b: block.id,
      atA: [0, 0],
      atB: [-10, 0],
      k,
      damping: 0.0002,
      freeLength: free,
      mode: "seated",
      coil: coil(8, 0.8),
    });
    writeFixture("molas", "pre-carga", b.scene, {
      title: "Pré-carga",
      notes: `Mola de ${br(k)} N/mm e ${free} mm livres montada com ${mounted} mm, empurrando um bloco contra o batente do trilho: ${br(F, 2)} N desde o primeiro passo.`,
      view: [-15, -25, 60, 50],
      runs: [
        {
          name: "1 s",
          duration: 1,
          inputs: [],
          assertions: [
            {
              kind: "at",
              label: `no primeiro passo a mola já empurra com k·(livre − montada) = ${br(F, 2)} N (± 1%)`,
              q: { link: spring.id, field: "force" },
              t: r4(1 / 240),
              min: r4(F * 0.99),
              max: r4(F * 1.01),
            },
            {
              kind: "mean",
              label: `o batente do trilho segura a mesma força (${br(F, 2)} N ± 1%)`,
              q: { abs: { link: slider.id, field: "force" } },
              from: 0.5,
              to: 1,
              min: r4(F * 0.99),
              max: r4(F * 1.01),
            },
            {
              kind: "maxDisp",
              label: "o bloco não sai do batente (< 0,01 mm)",
              parts: [block.id],
              max: 0.01,
            },
          ],
        },
      ],
    });
  }

  // Mola rígida demais para o passo: vira mola nativa
  {
    const b = new Builder("Mola rígida");
    const L = b.layer("Mola", 3);
    const k = 2;
    const w = 10;
    const h = 8;
    const m = STEEL * w * h * 3;
    const free = 20;
    const drop = 5;
    const omega = Math.sqrt((k * 1e6) / m);
    b.rect("Base", L, 0, 5, 30, 10, "steel", { fixed: true });
    const block = b.rect("Bloco", L, 0, -free - drop - h / 2, w, h, "steel");
    b.link({ kind: "slider", a: null, b: block.id, at: [0, 0], dir: r4(PI / 2), travel: [-50, 50] });
    const spring = b.link({
      kind: "spring",
      a: null,
      b: block.id,
      atA: [0, 0],
      atB: [0, h / 2],
      k,
      damping: dampFor(0.5, k, m),
      freeLength: free + drop,
      mode: "seated",
      solidLength: 4,
      coil: coil(8, 0.5, 6),
    });
    const x = toN(m * G) / k;
    writeFixture("molas", "rigida", b.scene, {
      title: "Mola rígida (nativa)",
      notes: `Bloco de ${br(m, 2)} g sobre uma mola de ${br(k)} N/mm: ω·h = ${br(omega / 240, 2)} (a força explícita explode acima de 2). O adaptador troca pela mola nativa do Box2D. O bloco cai ${drop} mm sobre a mola. Compressão estática esperada: ${br(x, 4)} mm.`,
      view: [-25, -45, 50, 55],
      runs: [
        {
          name: "queda",
          duration: 2,
          inputs: [],
          assertions: [
            {
              kind: "range",
              label: "estável: o bloco não explode nem atravessa a mola",
              q: { link: spring.id, field: "length" },
              min: 4,
              max: free + drop + 0.01,
            },
            {
              kind: "mean",
              label: `assenta na compressão estática m·g/k (${br(x, 4)} mm ± 5%)`,
              q: { link: spring.id, field: "length" },
              from: 1.5,
              to: 2,
              min: r4(free + drop - 1.05 * x),
              max: r4(free + drop - 0.95 * x),
            },
            {
              kind: "span",
              label: "parado no fim (variação < 0,001 mm)",
              q: { link: spring.id, field: "length" },
              from: 1.5,
              to: 2,
              max: 0.001,
            },
          ],
        },
      ],
    });
  }
}
