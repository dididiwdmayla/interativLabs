/**
 * Inspeciona o estado de uma ligação ao longo de uma cena de teste.
 * Uso: node scripts/run-ts.mjs scripts/fixtures/inspect.ts <id da cena> <execução> <id da ligação> [campos] [t0,t1]
 * Ex.: node scripts/run-ts.mjs scripts/fixtures/inspect.ts molas/solido 0 k4 length,force 0.9,1.1
 */
import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { applyInputs, applyRunChanges } from "@/sim/runner";
export async function main(args: string[]) {
  const make = await loadBox2d();
  const f = FIXTURES.find((x) => x.id === args[0])!;
  const run = f.script.runs[Number(args[1] ?? 0)]!;
  const scene = applyRunChanges(await f.load(), run);
  const a = make();
  a.compile(scene, { unitMm: 1 });
  const fields = (args[3] ?? "length,force,stopForce").split(",");
  const [t0, t1] = (args[4] ?? "0,1").split(",").map(Number);
  for (let i = 0; i < Math.round(run.duration * 240); i++) {
    applyInputs(a, run.inputs, i / 240, 1 / 240);
    a.step(1 / 240);
    const t = (i + 1) / 240;
    if (t < t0! || t > t1!) continue;
    const s = a.snapshot();
    const st = s.links[args[2]!] as unknown as Record<string, number>;
    console.log(t.toFixed(4), fields.map((k) => `${k}=${JSON.stringify(st?.[k])}`).join(" "));
  }
}
