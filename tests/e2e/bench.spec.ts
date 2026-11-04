import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { CAPTURE_DIR } from "./viewports";

/**
 * Roda a bancada de motores no Chromium headless (/#bench), espera o fim e
 * grava docs/decisoes/bench-chromium.json. Aproveita a página pronta para as
 * capturas em 1440×900 e 390×844.
 */
test("bancada no Chromium", async ({ page }) => {
  test.setTimeout(30 * 60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#bench");
  await expect(page.getByRole("heading", { name: "Bancada de motores" })).toBeVisible();
  await page.waitForFunction(
    () => (window as unknown as { __BENCH_REPORT__?: unknown }).__BENCH_REPORT__,
    null,
    {
      timeout: 28 * 60_000,
      polling: 2000,
    },
  );
  const report = await page.evaluate(
    () => (window as unknown as { __BENCH_REPORT__?: unknown }).__BENCH_REPORT__,
  );
  writeFileSync("docs/decisoes/bench-chromium.json", JSON.stringify(report, null, 2) + "\n");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${CAPTURE_DIR}/item4-bench-1440x900.png` });
  await page.setViewportSize({ width: 1440, height: 2000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${CAPTURE_DIR}/item4-bench-1440-inteira.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${CAPTURE_DIR}/item4-bench-390x844.png` });
  await page.setViewportSize({ width: 390, height: 2600 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${CAPTURE_DIR}/item4-bench-390-inteira.png` });
});
