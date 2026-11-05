import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

test("150 peças: base e 30 peças com dois perfis", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const results: Record<string, unknown> = {};
  for (const profiles of [false, true]) {
    for (const speed of ["Lento", "Normal", "Real"]) {
      await page.goto("/#perf");
      await page.locator(".stage__sheet--static").first().waitFor();
      if (profiles) {
        await page.getByRole("checkbox", { name: "30 peças com dois perfis" }).check();
        await expect(page.locator(".part")).toHaveCount(180);
      }
      await page.getByRole("button", { name: speed, exact: true }).click();
      await page.evaluate(() => delete (window as unknown as { __PERF__?: unknown }).__PERF__);
      await page.getByRole("button", { name: /Rodar/ }).click();
      await page.waitForFunction(() => (window as unknown as { __PERF__?: unknown }).__PERF__, null, {
        timeout: 60_000,
      });
      results[`${profiles ? "perfis" : "base"}-${speed}`] = await page.evaluate(
        () => (window as unknown as { __PERF__?: unknown }).__PERF__,
      );
    }
  }
  writeFileSync("docs/decisoes/perf-e2b.json", JSON.stringify(results, null, 2) + "\n");
});

test.use({ hasTouch: true });

test("toque de 44 px solta a trava antes de arrastar", async ({ page }) => {
  const { readFileSync, mkdirSync } = await import("node:fs");
  const scene = JSON.parse(readFileSync("scenes/fixtures/fixacoes/trava.scene.json", "utf8"));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await page.waitForFunction(() => "__IL__" in window);
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate((scene) => {
    const ui = (
      window as unknown as {
        __IL__: {
          ui: {
            getState(): {
              openScene(id: string, scene: unknown, figure: number): void;
              setMode(mode: string): void;
            };
          };
        };
      }
    ).__IL__.ui.getState();
    ui.openScene("lock-e2b", scene, 1);
    ui.setMode("simulate");
  }, scene);
  const lock = page.locator(".link--lock");
  await expect(lock).toBeVisible();
  await page.waitForTimeout(200);
  const point = await page.evaluate(() =>
    (
      window as unknown as {
        __IL__: { stage: { get(): { worldToClient(p: [number, number]): [number, number] } } };
      }
    ).__IL__.stage
      .get()
      .worldToClient([-15, 0]),
  );
  await page.touchscreen.tap(point[0] + 18, point[1]);
  await expect(lock.locator("g").first()).toHaveCSS("opacity", "0");
  mkdirSync("docs/capturas/fase-1/parte-e2b", { recursive: true });
  await page.screenshot({ path: "docs/capturas/fase-1/parte-e2b/trava-solta-844x390.png" });
});
