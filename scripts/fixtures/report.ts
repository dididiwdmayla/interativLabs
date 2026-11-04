/**
 * Tabela das afirmações de todas as cenas de teste, com o valor medido no
 * Node (Box2D calibrado), em Markdown.
 * Uso: node scripts/run-ts.mjs scripts/fixtures/report.ts > arquivo.md
 */
import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";

export async function main() {
  const make = await loadBox2d();
  const out = ["| Cena | Afirmação | Passa | Medido |", "| --- | --- | --- | --- |"];
  for (const f of FIXTURES) {
    const r = await runFixture(make(), f.script, await f.load());
    for (const run of r.runs)
      for (const a of run.assertions) {
        if (f.id === "calibracao/bala" && run !== r.runs[0]) continue;
        const label = (r.runs.length > 1 && f.id !== "calibracao/bala" ? `${run.name}: ` : "") + a.label;
        const value =
          f.id === "calibracao/bala"
            ? `${r.runs.filter((x) => x.assertions.every((y) => y.pass)).length} de 100`
            : a.value;
        out.push(
          `| ${f.script.title} | ${label.replace(/\|/g, "/")} | ${a.pass ? "sim" : a.expectedFailure ? "falha esperada" : "**não**"} | ${value} |`,
        );
      }
  }
  console.log(out.join("\n"));
}
