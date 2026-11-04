import factory from "box2d3-wasm/compat";
import { CALIBRATED_TUNING, createBox2dAdapter } from "@/engine/box2d/box2dAdapter";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";
export async function main(args: string[]) {
  const B = await factory();
  const ids = (args[1] ?? "calibracao/corrente").split(",");
  for (const t of JSON.parse(args[0]!)) {
    const out: string[] = [];
    for (const id of ids) {
      const f = FIXTURES.find((x) => x.id === id)!;
      const r = await runFixture(
        createBox2dAdapter(B as never, { ...CALIBRATED_TUNING, ...t }),
        f.script,
        await f.load(),
        { now: () => performance.now() },
      );
      out.push(
        `${id.split("/")[1]}: ${r.pass ? "ok" : "FALHA"} ${r.runs[0]!.assertions.map((a) => a.value).join(" ")} (${r.runs[0]!.stepMedian.toFixed(3)} ms)`,
      );
    }
    console.log(JSON.stringify(t), "|", out.join(" | "), "| engrenagens:", await gears(t));
  }
}
import { runScript } from "@/bench/runner";
import { benchCases } from "@/bench/scenes";
export async function gears(t: object) {
  const B = await factory();
  const c = benchCases().find((x) => x.script.id === "03-engrenagens")!;
  const r = await runScript(
    createBox2dAdapter(B as never, { ...CALIBRATED_TUNING, ...t }),
    c.script,
    c.scene,
    { unitMm: 1, now: () => performance.now(), coarseTimer: false },
  );
  return r.assertions.map((a) => a.value).join(" ");
}
