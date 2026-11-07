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
const DIR = "docs/capturas/fase-2/m1a";
for (const viewport of [
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  for (const example of ["lancador-bancada", "roda-e-lingueta"]) {
    test(`${example} · ${viewport.width}×${viewport.height}`, async ({ page }) => {
      mkdirSync(DIR, { recursive: true });
      const scene = JSON.parse(readFileSync(`scenes/examples/${example}.json`, "utf8")) as Scene;
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.locator(".stage__sheet--static").first().waitFor();
      await page.evaluate((scene) => {
        const ui = (window as unknown as Harness).__IL__.ui.getState();
        ui.openScene("capture-m1a", scene, 1);
        ui.setMode("simulate");
      }, scene);
      await page.waitForFunction(
        () => (window as unknown as Harness).__IL__.sim.getState().status === "ready",
      );
      await page.getByRole("button", { name: "Ver instrumentos", exact: true }).click();
      await page.evaluate(
        async ({ example, scene }) => {
          const h = (window as unknown as Harness).__IL__;
          const ctl = h.sim.getState().ctl!;
          h.sim.getState().set({ paused: true });
          ctl.restart();
          await new Promise((r) => setTimeout(r, 100));
          if (example === "roda-e-lingueta") {
            const pawl = scene.parts.find((p) => p.id === "p4")!;
            const link = scene.links.find((l) => l.id === "k8")!;
            if (link.kind === "lock") {
              const [x, y] = link.at;
              ctl.releaseAt([
                pawl.x + x * Math.cos(pawl.angle) - y * Math.sin(pawl.angle),
                pawl.y + x * Math.sin(pawl.angle) + y * Math.cos(pawl.angle),
              ]);
            }
          }
          const pinion = scene.parts.find((p) => p.id === "p3")!;
          const length = example === "lancador-bancada" ? 432 : 528;
          for (let i = 0; i < length; i++) {
            if (example === "lancador-bancada") {
              if (i === 72 && ctl.dragAt([16, 35.5]) !== "p19") throw new Error("Gatilho não selecionado");
              if (i > 72 && i <= 101)
                ctl.dragMove([16 - 18 * Math.min(1, (i - 72) / 28.8), 35.5 - Math.min(1, (i - 72) / 28.8)]);
              if (i === 360) ctl.dragEnd();
            } else {
              const angle =
                pinion.angle + Math.PI / 2 + Math.max(0, Math.min(1, (i - 24) / 480)) * 2 * Math.PI;
              const point: [number, number] = [
                pinion.x + 18 * Math.cos(angle),
                pinion.y + 18 * Math.sin(angle),
              ];
              if (i === 24 && ctl.dragAt(point) !== "p3") throw new Error("Manivela não selecionada");
              if (i > 24 && i <= 504) ctl.dragMove(point);
            }
            ctl.stepOnce();
            const until = performance.now() + 3000;
            while (ctl.timeline().latest * 240 < i + 1 - 0.01) {
              if (performance.now() > until) throw new Error(`Passo ${i + 1} não chegou`);
              await new Promise((r) => setTimeout(r, 0));
            }
          }
          ctl.dragEnd();
          ctl.scrub(example === "lancador-bancada" ? 0.58 : 1.1);
        },
        { example, scene },
      );
      await expect(page.locator(".instrument-chart")).toHaveCount(example === "lancador-bancada" ? 4 : 2);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${DIR}/${example}-${viewport.width}x${viewport.height}.png` });
    });
  }
}
