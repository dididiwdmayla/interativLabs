import { readFileSync, mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { Scene } from "../../src/model/types";

type Hooks = {
  __IL__: {
    ui: {
      getState(): {
        current: { scene: Scene } | null;
        openScene(id: string, scene: Scene, figure: number): void;
      };
    };
    stage: { get(): { worldToClient(p: [number, number]): [number, number] } };
  };
};
const DIR = "docs/capturas/fase-1/parte-e2b";
function fixture(): Scene {
  const s = JSON.parse(readFileSync("scenes/fixtures/fixacoes/trava.scene.json", "utf8")) as Scene;
  s.links = [];
  s.parts = s.parts.slice(0, 2);
  const p = s.parts[1]!;
  p.x = 0;
  p.y = 0;
  p.shape = { kind: "gear", module: 1, teeth: 24, pressureAngle: Math.PI / 9, profile: "involute", bore: 0 };
  s.meta.title = "Bancada do Martelo";
  s.settings.gravity.on = false;
  return s;
}
async function open(page: Page, scene = fixture()) {
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(
    (s) => (window as unknown as Hooks).__IL__.ui.getState().openScene("hammer-test", s, 1),
    scene,
  );
  await expect(page.getByRole("heading", { name: scene.meta.title })).toBeVisible();
  await page.getByRole("button", { name: "Martelo", exact: true }).click();
}
async function at(page: Page, point: [number, number]) {
  return page.evaluate((p) => (window as unknown as Hooks).__IL__.stage.get().worldToClient(p), point);
}
async function current(page: Page) {
  return page.evaluate(() => (window as unknown as Hooks).__IL__.ui.getState().current!.scene);
}
for (const viewport of [
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: viewport.width < 1000 });
    test("faixa fora dos cantos e eixo no centro", async ({ page }) => {
      await open(page);
      const bar = page.getByRole("complementary", { name: "Ferramentas do Martelo" });
      const rect = (await bar.boundingBox())!;
      for (const corner of await page.locator(".corner--tl,.corner--tr,.corner--bl,.corner--br").all()) {
        const r = (await corner.boundingBox())!;
        expect(
          rect.x >= r.x + r.width ||
            rect.x + rect.width <= r.x ||
            rect.y >= r.y + r.height ||
            rect.y + rect.height <= r.y,
        ).toBe(true);
      }
      mkdirSync(DIR, { recursive: true });
      await page.screenshot({ path: `${DIR}/martelo-faixa-${viewport.width}x${viewport.height}.png` });
      const p = await at(page, [3.6, 0]);
      const initial = await current(page);
      if (viewport.width < 1000) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: p[0], y: p[1] }],
        });
        await expect(page.locator("[data-hammer-preview]")).toHaveAttribute("data-touch-offset", "-64");
        await page.screenshot({ path: `${DIR}/martelo-previa-${viewport.width}x${viewport.height}.png` });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await page.mouse.move(...p);
        await expect(page.locator("[data-hammer-preview]")).toHaveAttribute("data-touch-offset", "0");
        await page.mouse.click(...p);
      }
      await expect.poll(async () => (await current(page)).links.length).toBe(1);
      const stamped = await current(page);
      expect(stamped.links[0]).toMatchObject({ kind: "axle", at: [0, 0] });
      await page.screenshot({ path: `${DIR}/martelo-axle-${viewport.width}.png` });
      await page.getByRole("button", { name: "Desfazer", exact: true }).click();
      expect(await current(page)).toEqual(initial);
      await page.getByRole("button", { name: "Refazer", exact: true }).click();
      expect(await current(page)).toEqual(stamped);
      await page.keyboard.press("Escape");
      await expect(bar).not.toBeVisible();
    });
  });
}

for (const width of [844, 1440]) {
  test.describe(`Fixar ${width}`, () => {
    test.use({ viewport: { width, height: width === 844 ? 390 : 900 }, hasTouch: width === 844 });
    for (const [tool, label] of [
      ["screw", "Parafuso"],
      ["pin", "Pino"],
      ["lock", "Trava"],
    ] as const) {
      test(`${label}: cravar, selecionar, desfazer e refazer`, async ({ page }) => {
        let scene = fixture();
        if (tool === "screw") scene.parts = scene.parts.slice(1);
        if (tool === "pin") {
          scene = JSON.parse(
            readFileSync("scenes/fixtures/multicamada/rasgo-no-perfil.scene.json", "utf8"),
          ) as Scene;
          scene.links = [];
        }
        await open(page, scene);
        await page.getByRole("button", { name: label, exact: true }).click();
        const p = await at(page, [0, 0]);
        const initial = await current(page);
        if (width === 844) await page.touchscreen.tap(...p);
        else await page.mouse.click(...p);
        await expect.poll(async () => (await current(page)).links.length).toBe(tool === "pin" ? 2 : 1);
        const stamped = await current(page);
        expect(stamped.links[0]!.kind).toBe(tool);
        if (tool === "pin")
          expect(stamped.links[1]).toMatchObject({ kind: "slot", mode: "joint", profile: "guide-profile" });
        if (tool === "screw") expect(stamped.links[0]).toMatchObject({ a: null });
        await page.screenshot({ path: `${DIR}/martelo-${tool}-${width}.png` });
        await page.getByRole("button", { name: "Desfazer", exact: true }).click();
        expect(await current(page)).toEqual(initial);
        await page.getByRole("button", { name: "Refazer", exact: true }).click();
        expect(await current(page)).toEqual(stamped);
        const q = await at(page, [0, 0]);
        if (width === 844) await page.touchscreen.tap(...q);
        else await page.mouse.click(...q);
        expect(await current(page)).toEqual(stamped);
        await expect(page.getByRole("button", { name: "Detalhes", exact: true })).toBeVisible();
        if (tool === "lock") {
          const close = page.getByRole("button", { name: "Fechar", exact: true });
          if (await close.isVisible()) await close.click();
          await page.getByRole("button", { name: "Testar: ligar a física" }).click();
          await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
          await page.waitForFunction(
            () =>
              (
                window as unknown as { __IL__: { sim: { getState(): { ctl: unknown } } } }
              ).__IL__.sim.getState().ctl !== null,
          );
          const release = await at(page, [0, 0]);
          if (width === 844) await page.touchscreen.tap(...release);
          else await page.mouse.click(...release);
          await expect(page.locator(".link--lock g").first()).toHaveCSS("opacity", "0");
        }
      });
    }
    test("pino sobre material avisa e não crava", async ({ page }) => {
      await open(page);
      await page.getByRole("button", { name: "Pino", exact: true }).click();
      const p = await at(page, [0, 0]);
      if (width === 844) await page.touchscreen.tap(...p);
      else await page.mouse.click(...p);
      await expect(page.getByText(/O pino nasceria dentro de material/)).toBeVisible();
      expect((await current(page)).links).toHaveLength(0);
    });
  });
}
