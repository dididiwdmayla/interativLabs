import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * Determinismo entre plataformas: todas as cenas de scenes/fixtures/ rodadas
 * no Chromium (página /#lab) dão o mesmo hash de poses que o Node
 * (scenes/fixtures/hashes.json, conferido pelo Vitest). Grava também o tempo
 * de passo no Chromium em docs/decisoes/fixtures-chromium.json.
 */
test("hash Node = Chromium em todas as cenas de teste", async ({ page }) => {
  test.setTimeout(20 * 60_000);
  const expected = JSON.parse(readFileSync("scenes/fixtures/hashes.json", "utf8")) as Record<string, string>;
  await page.goto("/#lab");
  await page.waitForFunction(() => (window as unknown as { __LAB__?: unknown }).__LAB__, null, {
    timeout: 60_000,
  });
  const report = await page.evaluate(async () => {
    const lab = (window as unknown as { __LAB__: { runAll(): Promise<unknown> } }).__LAB__;
    return lab.runAll();
  });
  const r = report as {
    userAgent: string;
    results: Record<string, { hash: string; stepMedian: number; stepP95: number }>;
  };
  writeFileSync("docs/decisoes/fixtures-chromium.json", JSON.stringify(r, null, 2) + "\n");
  const got = Object.fromEntries(Object.entries(r.results).map(([k, v]) => [k, v.hash]));
  expect(Object.keys(got).sort()).toEqual(Object.keys(expected).sort());
  expect(got).toEqual(expected);
});
