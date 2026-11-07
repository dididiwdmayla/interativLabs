import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { useUiStore } from "../../src/editor/useUiStore";
import type { useSimStore } from "../../src/ui/sim/simStore";

type W = {
  __IL__: { ui: typeof useUiStore; sim: typeof useSimStore; openExample(id: string): Promise<void> };
};
const DIR = "docs/capturas/fase-1/parte-e2d";
async function shot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}
async function open(page: Page, id: string) {
  await page.evaluate(async (id) => {
    const h = (window as unknown as W).__IL__;
    h.ui.getState().setMode("edit");
    h.ui.getState().setLayerView({ layerColors: false, layerSpread: 0, layerIsolate: false });
    await h.openExample(id);
    h.ui.getState().setHint(false);
  }, id);
  await page.waitForTimeout(500);
}
for (const viewport of [
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`pranchas E2d ${viewport.width}×${viewport.height}`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true });
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator(".stage__sheet--static").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const id of ["lancador-bancada", "roda-e-lingueta"]) {
      await open(page, id);
      await page.evaluate(() =>
        (window as unknown as W).__IL__.ui.getState().setLayerView({ layerColors: true, layerSpread: 12 }),
      );
      for (const mode of ["edit", "simulate"] as const) {
        await page.evaluate((mode) => {
          const ui = (window as unknown as W).__IL__.ui.getState();
          ui.setMode(mode);
          ui.setLayerView({ layerIsolate: false });
        }, mode);
        if (mode === "simulate")
          await page.waitForFunction(() => (window as unknown as W).__IL__.sim.getState().status === "ready");
        await shot(page, `${id}-${mode}-afastadas-${viewport.width}`);
        await page.evaluate(() =>
          (window as unknown as W).__IL__.ui.getState().setLayerView({ layerIsolate: true }),
        );
        await shot(page, `${id}-${mode}-isolada-${viewport.width}`);
      }
    }
    await open(page, "lancador-bancada");
    await page.evaluate(() => {
      const ui = (window as unknown as W).__IL__.ui.getState();
      ui.setHammer("screw");
      ui.noteInput("touch");
    });
    await shot(page, `pilula-martelo-${viewport.width}`);
    await page.evaluate(() => {
      const ui = (window as unknown as W).__IL__.ui.getState();
      const bolt = ui.current!.scene.parts.find((p) => /ferrolho/i.test(p.name));
      if (!bolt) throw new Error("Ferrolho não encontrado");
      ui.setMode("simulate");
      ui.hidePart(bolt.id);
      ui.setHiddenList(true);
    });
    await page.waitForFunction(() => (window as unknown as W).__IL__.sim.getState().status === "ready");
    await expect(page.getByRole("region", { name: "Peças escondidas" })).toBeVisible();
    await shot(page, `ferrolho-escondido-${viewport.width}`);
    await page.evaluate(() => {
      const ui = (window as unknown as W).__IL__.ui.getState();
      ui.showPart();
      ui.setHiddenList(false);
      ui.setTrails(true);
      (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(0.05);
    });
    for (const name of ["ferrolho", "esfera"]) {
      const point = await page.evaluate((name) => {
        const h = (window as unknown as W).__IL__;
        const p = h.ui.getState().current!.scene.parts.find((p) => p.name.toLowerCase().includes(name));
        if (!p) throw new Error(`Peça ${name} não encontrada`);
        h.ui.getState().select({ kind: "part", id: p.id });
        h.sim.getState().ctl!.dragAt([p.x, p.y]);
        return [p.x, p.y] as [number, number];
      }, name);
      for (let i = 1; i <= 10; i++) {
        await page.evaluate(
          ([x, y]) => (window as unknown as W).__IL__.sim.getState().ctl!.dragMove([x, y]),
          [point[0] + i * 2, point[1]] as [number, number],
        );
        await page.waitForTimeout(35);
      }
      await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.dragEnd());
    }
    await shot(page, `rastro-lento-${viewport.width}`);
    for (const kind of ["axle", "spring", "lock", "chamber"] as const) {
      await page.evaluate((kind) => (window as unknown as W).__IL__.ui.getState().setExplain(kind), kind);
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, `o-que-e-${kind}-${viewport.width}`);
      await page.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();
    }
  });
}
