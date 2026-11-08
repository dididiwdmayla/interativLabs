/** Roda as cenas de teste de um grupo e mostra cada afirmação. Uso: node scripts/run-ts.mjs scripts/fixtures/check.ts ciclo */
import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";

export async function main(args: string[]) {
  const make = await loadBox2d();
  for (const f of FIXTURES.filter((x) => x.id.startsWith(args[0] ?? ""))) {
    const r = await runFixture(make(), f.script, await f.load());
    console.log(`${f.id} ${r.hash} ${r.pass ? "passa" : "FALHA"}`);
    for (const run of r.runs) {
      if (run.warnings.length) console.log("  avisos:", run.warnings.join("; "));
      for (const a of run.assertions)
        console.log(`  ${a.pass ? "ok " : "XX "} ${run.name}: ${a.label} → ${a.value}`);
    }
  }
}
