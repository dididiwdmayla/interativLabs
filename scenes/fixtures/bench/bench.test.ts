import { beforeAll, describe, expect, it } from "vitest";
import { runScript } from "@/bench/runner";
import { benchCases } from "@/bench/scenes";
import { DEFAULT_UNIT_MM } from "@/bench/suite";
import type { SceneResult } from "@/bench/types";
import { engineEntry } from "@/engine/registry";

/**
 * Afirmações das cenas 1, 2 e 3 da bancada em cada motor (Planck e Rapier são
 * obrigatórios; o Box2D v3 entrou no comparativo e também roda aqui).
 * Falha esperada fica marcada com `it.fails` e o motivo: se o motor passar a
 * acertar, o teste avisa para tirar a marca.
 */

const ENGINES = ["planck", "rapier-det", "box2d"];
const SCENES = ["01-lancador", "02-trava", "03-engrenagens"];

const CATRACA = "contra, o conjunto para antes de girar um passo de dente da catraca (25,7°)";
const EXPECTED_FAILURES: Record<string, Record<string, string>> = {
  planck: {
    [CATRACA]:
      "com contato exato, a lingueta da cena migrada desce até o batente de −25° antes de segurar (catraca gira ~28°); no protótipo, a pele de 0,1 mm do Planck a 10 mm/un parava em 24°",
  },
  "rapier-det": {
    [CATRACA]: "a lingueta da cena migrada desce até o batente de −25° antes de segurar (catraca gira ~34°)",
  },
  box2d: {
    [CATRACA]: "a lingueta da cena migrada desce até o batente de −25° antes de segurar (catraca gira ~35°)",
  },
};

for (const engineId of ENGINES) {
  describe(`bancada · ${engineId}`, () => {
    for (const sceneId of SCENES) {
      const c = benchCases().find((x) => x.script.id === sceneId)!;
      describe(c.script.title, () => {
        let result: SceneResult;
        beforeAll(async () => {
          const make = await engineEntry(engineId)!.load();
          result = await runScript(make(), c.script, c.scene, {
            unitMm: DEFAULT_UNIT_MM,
            now: () => performance.now(),
            coarseTimer: false,
          });
        });

        const labels = [...new Set(c.script.runs.flatMap((r) => r.assertions.map((a) => a.label)))];
        for (const label of labels) {
          const reason = EXPECTED_FAILURES[engineId]?.[label];
          const check = () => {
            const a = result.assertions.find((x) => x.label === label)!;
            expect(a.pass, `${label}: ${a.value}`).toBe(true);
          };
          if (reason) it.fails(`${label} — falha esperada: ${reason}`, check);
          else it(label, check);
        }

        it("duas execuções dão o mesmo hash de poses", () => {
          expect(result.deterministic).toBe(true);
        });
      });
    }
  });
}
