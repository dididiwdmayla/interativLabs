import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { loadBox2d } from "@/engine/box2d/load";
import { loadScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { INVARIANTS, abuseScene, isFastScene, type SceneAbuse } from "@/sim/abuse";

/**
 * Teste de abuso completo (Fase 1 · Parte F, item 14.4): todas as cenas de
 * scenes/fixtures/ (fora a bancada) e todos os exemplos, cada peça móvel,
 * nas três velocidades e nas três manobras. Grava o resultado em JSON.
 *
 * Uso: npm run abuse -- [saída.json] [filtro]
 *   saída padrão docs/decisoes/abuso.json; filtro = parte do id da cena.
 *   ABUSE_SAMPLE (padrão 12): cenas com mais peças móveis usam uma amostra
 *   espalhada da mais pesada à mais leve. ABUSE_MAX_PARTS: só as N mais pesadas.
 */

function scenes(): { id: string; scene: Scene }[] {
  const out: { id: string; scene: Scene }[] = [];
  const load = (path: string): Scene => {
    const r = loadScene(JSON.parse(readFileSync(path, "utf8")));
    if (!r.ok) throw new Error(`${path}: ${r.issues.map((i) => i.message).join("; ")}`);
    return r.scene;
  };
  for (const g of readdirSync("scenes/fixtures").sort()) {
    if (g === "bench" || g.includes(".")) continue;
    for (const f of readdirSync(`scenes/fixtures/${g}`).sort())
      if (f.endsWith(".scene.json"))
        out.push({ id: `${g}/${f.replace(".scene.json", "")}`, scene: load(`scenes/fixtures/${g}/${f}`) });
  }
  for (const f of readdirSync("scenes/examples").sort())
    if (f.endsWith(".json") && f !== "index.json")
      out.push({ id: `exemplos/${f.replace(".json", "")}`, scene: load(`scenes/examples/${f}`) });
  return out;
}

const n = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : String(v));

export async function main(args: string[]) {
  const outPath = args[0] || "docs/decisoes/abuso.json";
  const filter = args[1] ?? "";
  const maxParts = process.env.ABUSE_MAX_PARTS ? Number(process.env.ABUSE_MAX_PARTS) : undefined;
  const sample = Number(process.env.ABUSE_SAMPLE ?? 12);
  const make = await loadBox2d();
  const report: SceneAbuse[] = [];
  for (const { id, scene } of scenes()) {
    if (filter && !id.includes(filter)) continue;
    const t0 = performance.now();
    const r = abuseScene(make, id, scene, { fastScene: isFastScene(id, scene), maxParts, sample });
    report.push(r);
    const fails = INVARIANTS.filter((i) => !r.results[i.id].pass);
    console.log(
      `${id}: ${r.parts} peças${r.sampled ? " (amostra)" : ""}, ${r.runs} execuções, ${((performance.now() - t0) / 1000).toFixed(1)} s` +
        (fails.length
          ? ` — FALHA: ${fails.map((i) => `${i.id} ${n(r.results[i.id].worst)} (${r.results[i.id].where})`).join("; ")}`
          : " — ok") +
        ` · penetração de 2 passos ${n(r.lasting.worst)}`,
    );
  }
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
}
