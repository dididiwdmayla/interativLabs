import type { BenchReport, SceneResult } from "./types";

const ms = (n: number) => (Number.isFinite(n) ? n.toFixed(3).replace(".", ",") : "—");
const mm = (n: number | null, d = 3) =>
  n === null || !Number.isFinite(n) ? "—" : n.toFixed(d).replace(".", ",");

/** Uma linha por cena e motor, em texto (para colar no chat e no documento). */
export function reportTable(r: BenchReport): string {
  const engines = r.engines.map((e) => e.id);
  const lines: string[] = [];
  lines.push(
    `Bancada interativLabs — ${r.environment.kind === "node" ? "Node" : "navegador"} — ${r.createdAt}`,
    `Aparelho: ${r.environment.userAgent} · núcleos: ${r.environment.hardwareConcurrency ?? "?"} · relógio: ${mm(r.environment.timerResolutionUs, 1)} µs`,
    `Escala: ${r.unitMm} mm por unidade · passo 1/240 s`,
    ``,
    `| Cena | Motor | mm/un | Passa | Passo mediana (ms) | Passo p95 (ms) | Penetração máx. (mm) | Tremor RMS (mm) | Determinístico | Hash |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
  );
  const rows = r.results
    .slice()
    .sort(
      (a, b) =>
        a.scene.localeCompare(b.scene) ||
        a.unitMm - b.unitMm ||
        engines.indexOf(a.engine) - engines.indexOf(b.engine),
    );
  for (const x of rows) lines.push(row(x));
  const fails = rows.filter((x) => !x.pass);
  if (fails.length) {
    lines.push(``, `Falhas:`);
    for (const f of fails)
      for (const a of f.assertions.filter((a) => !a.pass))
        lines.push(`- ${f.scene} · ${f.engine} · ${f.unitMm} mm/un: ${a.label} → ${a.value}`);
  }
  return lines.join("\n");
}

function row(x: SceneResult): string {
  return `| ${x.scene} | ${x.engine} | ${x.unitMm} | ${x.pass ? "sim" : "não"} | ${ms(x.stepMedian)} | ${ms(x.stepP95)} | ${mm(x.maxDepth, 4)} | ${mm(x.jitter, 4)} | ${x.deterministic ? "sim" : "não"} | ${x.hash} |`;
}
