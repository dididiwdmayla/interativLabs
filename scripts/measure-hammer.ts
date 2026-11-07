import { readFileSync, writeFileSync } from "node:fs";
import type { ChamberLink, Scene } from "@/model/types";
import { hammerPoint } from "@/editor/hammer";
import { dragLink } from "@/editor/hammerDrag";
import { loadBox2d } from "@/engine/box2d/load";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture } from "@/sim/runner";
import { prepareScene } from "@/render/prepare";

/**
 * Recria a câmara dos exemplos com o Martelo (mesmo arraste, do fundo à boca)
 * e roda o ciclo de cada um com a geometria detectada; carga, respiros,
 * vedação e sensores vêm do exemplo (são ajustes do cartão).
 * Grava docs/decisoes/camara-e2c.json.
 */
async function rebuild(file: string, fixture: string, layer: number) {
  const scene = JSON.parse(readFileSync(file, "utf8")) as Scene;
  const original = scene.links.find((l) => l.kind === "chamber") as ChamberLink;
  const copy = structuredClone(scene);
  copy.links = copy.links.filter((l) => l.id !== original.id && l.kind !== "sensor");
  copy.settings.snap.on = false;
  const model = prepareScene(copy);
  const a = hammerPoint(model, "chamber", original.at, layer, 0.001);
  const b = hammerPoint(model, "chamber", [original.at[0] + original.length, original.at[1]], layer, 0.001);
  const found = dragLink(model, "chamber", a, b, layer)!;
  const link = found.link as ChamberLink;
  const rebuilt = structuredClone(scene);
  rebuilt.links = rebuilt.links.map((l) =>
    l.id === original.id
      ? {
          ...original,
          ...{ body: link.body, at: link.at, dir: link.dir, bore: link.bore, length: link.length },
          walls: link.walls.map((w) => ({
            ...w,
            seal: original.walls.find((o) => o.part === w.part)?.seal ?? w.seal,
          })),
        }
      : l,
  );
  const make = await loadBox2d();
  const f = FIXTURES.find((x) => x.id === fixture)!;
  const r = await runFixture(make(), f.script, rebuilt);
  const o = await runFixture(make(), f.script, scene);
  const originalExit =
    o.runs.flatMap((run) => run.assertions).find((x) => /sai pela boca/.test(x.label))?.value ?? null;
  const assertions = r.runs.flatMap((run) => run.assertions.map((x) => ({ ...x, runName: run.name })));
  const name = (id: string | null) => (id ? copy.parts.find((p) => p.id === id)?.name : "fundo");
  return {
    example: file,
    underStart: name(a.b?.part.id ?? null),
    original: {
      body: name(original.body),
      walls: original.walls.map((w) => name(w.part)),
      bore: original.bore,
      exit: originalExit,
    },
    detected: {
      body: name(link.body),
      walls: link.walls.map((w) => name(w.part)),
      bore: link.bore,
      at: link.at,
      dir: link.dir,
      length: link.length,
      warning: found.warning ?? null,
    },
    cycle: {
      /** primeira afirmação de saída pela boca (o pico da velocidade) */
      exit: assertions.find((x) => /sai pela boca/.test(x.label))?.value ?? null,
      passed: assertions.filter((x) => x.pass).length,
      total: assertions.length,
      failed: assertions.filter((x) => !x.pass).map((x) => `${x.runName}: ${x.label} (${x.value})`),
    },
  };
}

export async function main() {
  const out = [
    await rebuild("scenes/examples/lancador-bancada.json", "exemplos/lancador-bancada", 1),
    await rebuild("scenes/examples/cilindro-dois-pistoes.json", "exemplos/cilindro-dois-pistoes", 0),
  ];
  writeFileSync("docs/decisoes/camara-e2c.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 2));
}
