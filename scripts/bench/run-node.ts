/**
 * Comparativo de motores no Node. Grava docs/decisoes/bench-node.json.
 * Uso: npm run bench [-- --only 01-lancador,02-trava] [-- --engines planck,box2d] [-- --unit 1] [-- --out arquivo]
 */
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { ENGINES } from "@/engine/registry";
import { runSuite } from "@/bench/suite";
import { reportTable } from "@/bench/table";

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function main(args: string[]) {
  const only = arg(args, "only")?.split(",");
  const engineIds = arg(args, "engines")?.split(",");
  const unit = arg(args, "unit");
  const out = arg(args, "out") ?? "docs/decisoes/bench-node.json";
  const engines = engineIds ? ENGINES.filter((e) => engineIds.includes(e.id)) : ENGINES;
  const report = await runSuite({
    engines,
    ...(unit ? { unitMm: Number(unit) } : {}),
    now: () => performance.now(),
    environment: "node",
    userAgent: `Node ${process.version} (${process.platform} ${process.arch}) · ${cpus()[0]?.model ?? "?"}`,
    hardwareConcurrency: cpus().length,
    ...(only ? { only } : {}),
    onProgress: (p) => {
      if (p.result)
        console.log(
          `${p.done}/${p.total} ${p.engine} ${p.scene} @${p.unitMm} → ${p.result.pass ? "passa" : "FALHA"} (${(p.result.wallMs / 1000).toFixed(1)} s)`,
        );
    },
  });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log("\n" + reportTable(report));
  console.log(`\nGravado em ${out}`);
}
