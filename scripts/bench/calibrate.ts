/**
 * Calibração do Box2D para gravidade real (item 5.2): roda as quatro cenas de
 * scenes/fixtures/calibracao/ com uma sequência de ajustes, do padrão do
 * Box2D até o calibrado, e grava docs/decisoes/calibracao-node.json com a
 * tabela parâmetro × resultado × custo.
 * Uso: npm run calibrate
 */
import { writeFileSync } from "node:fs";
import factory from "box2d3-wasm/compat";
import {
  BOX2D_DEFAULTS,
  CALIBRATED_TUNING,
  createBox2dAdapter,
  type Box2dTuning,
} from "@/engine/box2d/box2dAdapter";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";

const MS = { contactSpeed: 3000, restitutionThreshold: 1000, hitEventThreshold: 100 };

const STEPS: { label: string; tuning: Box2dTuning }[] = [
  { label: "padrão do Box2D (valores em metros lidos como mm)", tuning: BOX2D_DEFAULTS },
  {
    label: "velocidades em mm/s (empurrão 3 000, quique 1 000, impacto 100)",
    tuning: { ...BOX2D_DEFAULTS, ...MS },
  },
  {
    label: "+ lengthUnits 5 (folga 0,025 mm, especulativa 0,1 mm)",
    tuning: { ...BOX2D_DEFAULTS, ...MS, lengthUnits: 5 },
  },
  { label: "+ contato 60 Hz", tuning: { ...BOX2D_DEFAULTS, ...MS, lengthUnits: 5, contactHertz: 60 } },
  {
    label: "+ contato 240 Hz, 8 subpassos",
    tuning: { ...BOX2D_DEFAULTS, ...MS, lengthUnits: 5, contactHertz: 240, subSteps: 8 },
  },
  {
    label: "+ contato 480 Hz, 12 subpassos, juntas 720 Hz (ζ 1)",
    tuning: {
      ...BOX2D_DEFAULTS,
      ...MS,
      lengthUnits: 5,
      contactHertz: 480,
      subSteps: 12,
      jointHertz: 720,
      jointDampingRatio: 1,
    },
  },
  {
    label: "+ juntas sem amortecimento (ζ 0)",
    tuning: {
      ...BOX2D_DEFAULTS,
      ...MS,
      lengthUnits: 5,
      contactHertz: 480,
      subSteps: 12,
      jointHertz: 720,
      jointDampingRatio: 0,
    },
  },
  { label: "+ 16 subpassos, juntas 960 Hz", tuning: { ...CALIBRATED_TUNING, contactDampingRatio: 10 } },
  { label: "calibrado: + amortecimento do contato 3 (era 10)", tuning: CALIBRATED_TUNING },
];

const IDS = ["calibracao/pilha", "calibracao/corrente", "calibracao/pinhao", "calibracao/bala"];

export async function main() {
  const B = await factory();
  const rows: Record<string, unknown>[] = [];
  for (const s of STEPS) {
    const row: Record<string, unknown> = { ajuste: s.label, tuning: s.tuning };
    for (const id of IDS) {
      const f = FIXTURES.find((x) => x.id === id)!;
      const r = await runFixture(createBox2dAdapter(B as never, s.tuning), f.script, await f.load(), {
        now: () => performance.now(),
      });
      const runs = r.runs;
      const fails = runs.flatMap((x) => x.assertions.filter((a) => !a.pass));
      const key = id.split("/")[1]!;
      row[key] = {
        passa: fails.length === 0,
        valor:
          key === "bala"
            ? `${runs.length - fails.length} de ${runs.length}`
            : runs[0]!.assertions.map((a) => a.value).join(" · "),
        penetracao: Math.max(...runs.map((x) => x.maxDepth)),
        mediana: Math.max(...runs.map((x) => x.stepMedian)),
        p95: Math.max(...runs.map((x) => x.stepP95)),
      };
    }
    rows.push(row);
    const c = (k: string) => row[k] as { passa: boolean; valor: string; mediana: number; p95: number };
    console.log(
      `| ${s.label} | ${["pilha", "corrente", "pinhao", "bala"].map((k) => `${c(k).passa ? "passa" : "**não**"} (${c(k).valor})`).join(" | ")} | ${c("pilha").mediana.toFixed(3).replace(".", ",")} / ${c("pilha").p95.toFixed(3).replace(".", ",")} |`,
    );
  }
  writeFileSync(
    "docs/decisoes/calibracao-node.json",
    JSON.stringify({ createdAt: new Date().toISOString(), rows }, null, 2) + "\n",
  );
}
