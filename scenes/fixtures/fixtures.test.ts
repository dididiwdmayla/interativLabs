import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadBox2d } from "@/engine/box2d/load";
import type { EngineAdapter } from "@/engine/types";
import { FIXTURES } from "@/sim/fixtures";
import { runFixture, type FixtureResult } from "@/sim/runner";

/**
 * Cenas de teste do motor do app (Box2D calibrado): cada afirmação vira um
 * teste. Falha esperada fica marcada com `it.fails` e o motivo (se o motor
 * passar a acertar, o teste avisa para tirar a marca). O hash das poses de
 * cada cena precisa bater com scenes/fixtures/hashes.json, que o Chromium
 * também confere (tests/e2e/determinism.spec.ts).
 */

const HASHES = JSON.parse(readFileSync("scenes/fixtures/hashes.json", "utf8")) as Record<string, string>;

let make: () => EngineAdapter;
beforeAll(async () => {
  make = await loadBox2d();
});

for (const f of FIXTURES) {
  describe(f.script.title, () => {
    let result: FixtureResult;
    beforeAll(async () => {
      result = await runFixture(make(), f.script, await f.load());
    });

    f.script.runs.forEach((run, ri) => {
      const multi = f.script.runs.length > 1;
      run.assertions.forEach((a, ai) => {
        const check = () => {
          const r = result.runs[ri]!.assertions[ai]!;
          expect(r.pass, `${r.label}: ${r.value}`).toBe(true);
        };
        const name = multi ? `${run.name}: ${a.label}` : a.label;
        if (a.expectedFailure) it.fails(`${name} — falha esperada: ${a.expectedFailure}`, check);
        else it(name, check);
      });
    });

    it("hash das poses igual ao gravado (o mesmo no Chromium)", () => {
      expect(result.hash).toBe(HASHES[f.id]);
    });
  });
}
