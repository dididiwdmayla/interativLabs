import { writeFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";

/**
 * Parte S · item 11: /#perf (150 peças, 100 ligações, 1440×900) sem o motor de
 * som e com o som ligado (música e efeitos tocando); Normal e Real, duas
 * rodadas alternadas. Grava docs/decisoes/perf-som-s.json.
 */
const OUT = "docs/decisoes/perf-som-s.json";

async function run(page: Page, variant: "sem-motor" | "som", speed: string) {
  if (variant === "sem-motor") {
    // sem Web Audio, o motor não nasce (o grafo não é criado e nada é pedido)
    await page.addInitScript(() => {
      (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = undefined;
    });
  }
  await page.goto("/#perf");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.getByRole("button", { name: speed, exact: true }).click();
  await page.evaluate(() => delete (window as unknown as { __PERF__?: unknown }).__PERF__);
  // o clique em "Rodar" é o primeiro toque: com o som ligado, o motor acorda aqui
  await page.getByRole("button", { name: /Rodar/ }).click();
  await page.waitForFunction(() => (window as unknown as { __PERF__?: unknown }).__PERF__, null, {
    timeout: 60_000,
  });
  const sound = await page.evaluate(() => {
    const h = (window as unknown as { __IL_SOUND__?: { debug(): unknown } }).__IL_SOUND__;
    return h?.debug() ?? null;
  });
  const result = (await page.evaluate(
    () => (window as unknown as { __PERF__?: unknown }).__PERF__,
  )) as Record<string, unknown>;
  return { ...result, sound };
}

test("150 peças com o som ligado e sem o motor", async ({ browser }) => {
  test.setTimeout(900_000);
  const results: Record<string, unknown> = {};
  for (let round = 1; round <= 2; round++)
    for (const speed of ["Normal", "Real"])
      for (const variant of ["sem-motor", "som"] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        results[`${variant}-${speed}-${round}`] = await run(page, variant, speed);
        await context.close();
      }
  writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n");
});
