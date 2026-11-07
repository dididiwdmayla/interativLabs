import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test, type Page } from "@playwright/test";

/**
 * Parte E2d: /#perf (150 peças, 100 ligações, 1440×900) sem nada, com as
 * camadas em cores e afastadas, e com o rastro; Normal e Real. Grava
 * docs/decisoes/perf-e2d.json (acrescenta às medidas já gravadas).
 * PERF_VARIANTS=base,cores,rastro escolhe as variantes.
 */
const OUT = "docs/decisoes/perf-e2d.json";
const VARIANTS = (process.env.PERF_VARIANTS ?? "base,cores,rastro").split(",");

async function run(page: Page, variant: string, speed: string) {
  await page.goto("/#perf");
  await page.locator(".stage__sheet--static").first().waitFor();
  if (variant === "cores") await page.getByRole("checkbox", { name: "Camadas em cores e afastadas" }).check();
  if (variant === "rastro") await page.getByRole("checkbox", { name: "Rastro" }).check();
  await page.getByRole("button", { name: speed, exact: true }).click();
  await page.evaluate(() => delete (window as unknown as { __PERF__?: unknown }).__PERF__);
  await page.getByRole("button", { name: /Rodar/ }).click();
  await page.waitForFunction(() => (window as unknown as { __PERF__?: unknown }).__PERF__, null, {
    timeout: 60_000,
  });
  return page.evaluate(() => (window as unknown as { __PERF__?: unknown }).__PERF__);
}

test("150 peças: base, camadas em cores e afastadas, rastro", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const results: Record<string, unknown> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  // duas rodadas por variante, alternadas, para não pegar só um momento ruim da máquina
  for (let round = 1; round <= 2; round++)
    for (const speed of ["Normal", "Real"])
      for (const variant of VARIANTS)
        results[`${variant}-${speed}-${round}`] = await run(page, variant, speed);
  writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n");
});
