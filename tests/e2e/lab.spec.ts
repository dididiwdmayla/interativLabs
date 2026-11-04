import { expect, test } from "@playwright/test";
import { CAPTURE_VIEWPORTS } from "./viewports";

/**
 * Capturas do laboratório (/#lab) em 390×844 e 1440×900, com a cena parada
 * no meio do movimento: uma mola, um rasgo e o cilindro de dois pistões.
 * Saída em docs/capturas/fase-1/parte-c/.
 */
const DIR = "docs/capturas/fase-1/parte-c";

const SHOTS: { name: string; id: string; run: number; t: number }[] = [
  { name: "mola-apoiada", id: "molas/apoiada", run: 1, t: 1.56 },
  { name: "rasgo-curvo", id: "rasgos/curvo", run: 0, t: 1.2 },
  {
    name: "cilindro-dois-pistoes",
    id: "exemplos/cilindro-dois-pistoes",
    run: 0,
    t: Number(process.env.LAB_T ?? 0.085),
  },
];

for (const vp of CAPTURE_VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    for (const s of SHOTS) {
      test(`${s.name} ${vp.name}`, async ({ page }) => {
        await page.goto(`/#lab/${s.id}`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => (window as unknown as { __LAB__?: unknown }).__LAB__);
        await page.evaluate(
          ([id, run, t]) =>
            (
              window as unknown as { __LAB__: { show(a: string, b: number, c: number): Promise<void> } }
            ).__LAB__.show(id as string, run as number, t as number),
          [s.id, s.run, s.t] as const,
        );
        await expect(page.locator(".lab__assert").first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${DIR}/lab-${s.name}-${vp.name}.png` });
      });
    }
  });
}
