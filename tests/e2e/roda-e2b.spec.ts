import { expect, test } from "@playwright/test";
import { rodaScene } from "../../scripts/fixtures/roda";
type W = {
  __IL__: {
    openExample(id: string): Promise<void>;
    ui: {
      getState(): {
        setHint(b: boolean): void;
        setActiveLayer(i: number): void;
        setXray(b: boolean): void;
        setMode(m: string): void;
      };
    };
    sim: {
      getState(): {
        ctl: {
          setSpeed(s: number): void;
          dragAt(p: [number, number]): string | null;
          dragMove(p: [number, number]): void;
          dragEnd(): void;
          timeline(): { latest: number };
        } | null;
      };
    };
    stage: { get(): { worldToClient(p: [number, number]): [number, number] } };
  };
};
// capturas da E2b ficam como estão: reexecuções gravam fora de docs/
const DIR = "test-results/capturas-e2b";
for (const vp of [
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
])
  test.describe(`${vp.width}`, () => {
    test.use({ viewport: vp, hasTouch: vp.width === 844 });
    test("Roda e lingueta: composição, toque na trava e manivela", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      await page.locator(".stage__sheet--static").first().waitFor();
      await page.evaluate(async () => {
        const h = (window as unknown as W).__IL__;
        await h.openExample("roda-e-lingueta");
        h.ui.getState().setHint(false);
        h.ui.getState().setActiveLayer(2);
      });
      await expect(page.getByRole("heading", { name: "Roda e lingueta", exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${DIR}/roda-montar-${vp.width}.png`, animations: "disabled" });
      await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setXray(true));
      await page.screenshot({ path: `${DIR}/roda-raio-x-${vp.width}.png`, animations: "disabled" });
      await page.evaluate(() => {
        const h = (window as unknown as W).__IL__;
        h.ui.getState().setXray(false);
        h.ui.getState().setMode("simulate");
      });
      await page.waitForFunction(() => (window as unknown as W).__IL__.sim.getState().ctl);
      await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(0.05));
      const r = rodaScene(),
        at: [number, number] = [
          r.pawl.x + Math.cos(r.pawl.angle) * r.lock.at[0] - Math.sin(r.pawl.angle) * r.lock.at[1],
          r.pawl.y + Math.sin(r.pawl.angle) * r.lock.at[0] + Math.cos(r.pawl.angle) * r.lock.at[1],
        ];
      const xy = await page.evaluate((p) => (window as unknown as W).__IL__.stage.get().worldToClient(p), at);
      if (vp.width === 844) await page.touchscreen.tap(...xy);
      else await page.mouse.click(...xy);
      await page.waitForTimeout(80);
      await page.screenshot({ path: `${DIR}/roda-trava-saltando-${vp.width}.png` });
      await expect(page.locator(".link--lock g").first()).toHaveCSS("opacity", "0");
      const held = await page.evaluate(
        (p) => (window as unknown as W).__IL__.sim.getState().ctl!.dragAt(p),
        r.grip,
      );
      expect(held).toBe(r.pinion.id);
      await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(1));
      for (let i = 1; i <= 60; i++) {
        const a = r.pinion.angle + Math.PI / 2 + (i / 60) * Math.PI * 2;
        await page.evaluate((p) => (window as unknown as W).__IL__.sim.getState().ctl!.dragMove(p), [
          r.pinion.x + r.crankLength * Math.cos(a),
          r.pinion.y + r.crankLength * Math.sin(a),
        ] as [number, number]);
        await page.waitForTimeout(32);
        if (i === 30) await page.screenshot({ path: `${DIR}/roda-lingueta-${vp.width}.png` });
      }
      await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.dragEnd());
      expect(errors).toEqual([]);
    });
  });
