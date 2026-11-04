/**
 * Grava scenes/fixtures/hashes.json: o hash das poses de cada cena de teste
 * rodada no Node com o Box2D calibrado. O teste do Vitest confere que o
 * arquivo está em dia; o do Playwright, que o Chromium dá o mesmo.
 * Uso: npm run fixtures:hashes
 */
import { writeFileSync } from "node:fs";
import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";

export async function main() {
  const make = await loadBox2d();
  const out: Record<string, string> = {};
  for (const f of FIXTURES) {
    const r = await runFixture(make(), f.script, await f.load(), { now: () => performance.now() });
    out[f.id] = r.hash;
    const fails = r.runs.flatMap((x) =>
      x.assertions
        .filter((a) => !a.pass)
        .map((a) => `${x.name}: ${a.label} → ${a.value}${a.expectedFailure ? " (esperada)" : ""}`),
    );
    const med = Math.max(...r.runs.map((x) => x.stepMedian));
    console.log(
      `${f.id.padEnd(28)} ${r.hash} ${r.pass ? "passa" : "FALHA"} ${med.toFixed(3)} ms${fails.length ? "\n   " + fails.join("\n   ") : ""}`,
    );
  }
  writeFileSync("scenes/fixtures/hashes.json", JSON.stringify(out, null, 2) + "\n");
}
