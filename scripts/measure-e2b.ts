import { writeFileSync } from "node:fs";
import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";

export async function main() {
  const make = await loadBox2d();
  const results = [];
  for (const f of FIXTURES.filter((f) => f.id.startsWith("multicamada/") || f.id === "fixacoes/trava")) {
    results.push(await runFixture(make(), f.script, await f.load(), { now: () => performance.now() }));
  }
  writeFileSync("docs/decisoes/medidas-e2b.json", JSON.stringify(results, null, 2) + "\n");
}
