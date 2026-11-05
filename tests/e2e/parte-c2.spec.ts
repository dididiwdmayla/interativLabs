import { expect, test } from "@playwright/test";
import { CAPTURE_VIEWPORTS } from "./viewports";

/**
 * Capturas da Parte C2 (objeto padrão) no laboratório, em 390×844 e 1440×900:
 * o lançador de ferrolho parado, no meio do recuo, com a esfera saindo e com a
 * nova esfera entrando na câmara. Saída em docs/capturas/fase-1/parte-c2/.
 * Uso: npx playwright test --project=capture-c2
 */
const DIR = "docs/capturas/fase-1/parte-c2";
const ID = "exemplos/lancador-ferrolho";

/** Execução 1 (disparo): o sensor acende em 0,525 s; a esfera passa da boca em 0,542 s. */
const SHOTS: { name: string; run: number; t: number }[] = [
  { name: "repouso", run: 0, t: 1 },
  { name: "meio-do-recuo", run: 1, t: Number(process.env.C2_RECUO ?? 0.5333) },
  { name: "esfera-saindo", run: 1, t: Number(process.env.C2_SAINDO ?? 0.5417) },
  { name: "nova-esfera-entrando", run: 1, t: Number(process.env.C2_ENTRANDO ?? 0.6792) },
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
        await page.goto(`/#lab/${ID}`);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => (window as unknown as { __LAB__?: unknown }).__LAB__);
        await page.evaluate(
          ([run, t]) =>
            (
              window as unknown as { __LAB__: { show(a: string, b: number, c: number): Promise<void> } }
            ).__LAB__.show("exemplos/lancador-ferrolho", run as number, t as number),
          [s.run, s.t] as const,
        );
        await expect(page.locator(".lab__assert").first()).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${DIR}/lab-${s.name}-${vp.name}.png` });
      });
    }
  });
}
