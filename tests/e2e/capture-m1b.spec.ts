import { mkdirSync, readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import type { Scene } from "../../src/model/types";
import type { useSimStore } from "../../src/ui/sim/simStore";
type Harness = {
  __IL__: {
    ui: {
      getState(): {
        openScene(id: string, scene: Scene, figure: number): void;
        setMode(mode: "simulate"): void;
      };
    };
    sim: typeof useSimStore;
  };
};
const DIR = "docs/capturas/fase-2/m1b";
for (const viewport of [
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`Lançador · comparação · ${viewport.width}×${viewport.height}`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true });
    const scene = JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene;
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator(".stage__sheet--static").first().waitFor();
    await page.evaluate((scene) => {
      const ui = (window as unknown as Harness).__IL__.ui.getState();
      ui.openScene("capture-m1b", scene, 1);
      ui.setMode("simulate");
    }, scene);
    await page.waitForFunction(() => (window as unknown as Harness).__IL__.sim.getState().status === "ready");
    await page.getByRole("button", { name: "Experimente comparar", exact: true }).click();
    await page.locator(".comparison-ghost").first().waitFor();
    await page.evaluate(() => (window as unknown as Harness).__IL__.sim.getState().ctl!.scrub(0.58));
    await expect(page.locator(".instrument-chart__curve--other")).toHaveCount(4);
    await expect(page.locator(".comparison-summary")).toContainText("Recuo A");
    if (viewport.height <= 500) {
      const panel = await page.getByRole("region", { name: "Instrumentos" }).boundingBox();
      expect(panel!.height).toBeLessThanOrEqual(viewport.height * 0.3 + 1);
    }
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${DIR}/lancador-comparacao-${viewport.width}x${viewport.height}.png` });
    console.log(await page.locator(".comparison-summary").getAttribute("title"));
  });
}
