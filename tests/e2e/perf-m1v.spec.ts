import { writeFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";

/**
 * M1v: /#perf (150 peças, 100 ligações, 1440×900) sem sondas, com 4 sondas e com a comparação e o
 * fantasma ligados; Normal e Real, duas rodadas alternadas. Grava docs/decisoes/perf-m1v.json.
 * PERF_VARIANTS=base,sondas,comparacao escolhe as variantes.
 */
const OUT = "docs/decisoes/perf-m1v.json";
const VARIANTS = (process.env.PERF_VARIANTS ?? "base,sondas,comparacao").split(",");

async function run(page: Page, variant: string, speed: string) {
  // a page of its own each time: the options of the last run would otherwise stay checked
  await page.goto("about:blank");
  await page.goto("/#perf");
  await page.locator(".stage__sheet--static").first().waitFor();
  if (variant === "sondas") await page.getByRole("checkbox", { name: "4 sondas" }).check();
  if (variant === "comparacao") await page.getByRole("checkbox", { name: "Comparação e fantasma" }).check();
  await page.getByRole("button", { name: speed, exact: true }).click();
  await page.evaluate(() => delete (window as unknown as { __PERF__?: unknown }).__PERF__);
  await page.getByRole("button", { name: /Rodar/ }).click();
  await page.waitForFunction(() => (window as unknown as { __PERF__?: unknown }).__PERF__, null, {
    timeout: 120_000,
  });
  return page.evaluate(() => (window as unknown as { __PERF__?: unknown }).__PERF__);
}

test("150 peças: sem sondas, com 4 sondas, com comparação e fantasma", async ({ page }) => {
  test.setTimeout(1_200_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const results: Record<string, unknown> = {};
  for (let round = 1; round <= 2; round++)
    for (const speed of ["Normal", "Real"])
      for (const variant of VARIANTS)
        results[`${variant}-${speed}-${round}`] = await run(page, variant, speed);
  writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n");
});
