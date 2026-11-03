import { expect, test } from "@playwright/test";
import { CAPTURE_DIR, CAPTURE_VIEWPORTS } from "./viewports";

/**
 * Capturas da casca em 390×844 e 1440×900 (tema único: índigo).
 * Saída em docs/capturas/fase-1/.
 */
for (const vp of CAPTURE_VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });

    test(`casca ${vp.name}`, async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".stage__svg")).toBeVisible();
      await page.screenshot({ path: `${CAPTURE_DIR}/item1-casca-${vp.name}.png` });
    });

    if (vp.mobile) {
      test(`casca ${vp.name} com folha aberta`, async ({ page }) => {
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        await page.getByRole("button", { name: /Camada/ }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${CAPTURE_DIR}/item1-casca-${vp.name}-folha.png` });
      });
    }
  });
}
