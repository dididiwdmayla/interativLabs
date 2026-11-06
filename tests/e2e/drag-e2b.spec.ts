import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { Scene } from "../../src/model/types";

type W = {
  __IL__: {
    ui: {
      getState(): {
        current: { scene: Scene };
        openScene(id: string, scene: Scene, fig: number): void;
        setActiveLayer(i: number): void;
      };
    };
    stage: { get(): { worldToClient(p: [number, number]): [number, number] } };
    sim: { getState(): { ctl: unknown } };
  };
};
const DIR = "docs/capturas/fase-1/parte-e2b";
function scene(): Scene {
  const s = JSON.parse(readFileSync("scenes/fixtures/multicamada/perfis.scene.json", "utf8")) as Scene;
  const p = s.parts[0]!;
  p.profiles = [];
  p.shape = { kind: "circle", r: 4, holes: [] };
  p.layer = s.layers[1]!.id;
  p.x = -15;
  p.y = 0;
  s.parts = [p, { ...structuredClone(p), id: "second", ref: 80, x: 15 }];
  s.links = [];
  s.settings.gravity.on = false;
  s.meta.title = "Ligar no Martelo";
  return s;
}
async function open(page: Page, s = scene()) {
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate((s) => {
    const ui = (window as unknown as W).__IL__.ui.getState();
    ui.openScene("drag-e2b", s, 1);
    ui.setActiveLayer(1);
  }, s);
  await expect(page.getByRole("heading", { name: s.meta.title })).toBeVisible();
  await page.getByRole("button", { name: "Martelo", exact: true }).click();
}
const current = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__IL__.ui.getState().current.scene);
const at = (page: Page, p: [number, number]) =>
  page.evaluate((p) => (window as unknown as W).__IL__.stage.get().worldToClient(p), p);
for (const width of [844, 1440])
  test.describe(`${width}`, () => {
    test.use({ viewport: { width, height: width === 844 ? 390 : 900 }, hasTouch: width === 844 });
    for (const [tool, label, group] of [
      ["spring", "Mola", "Ligar"],
      ["rod", "Haste", "Ligar"],
      ["cable", "Cabo", "Ligar"],
      ["slider", "Trilho", "Guiar"],
    ] as const)
      test(`${label}: desenhar e desfazer`, async ({ page }) => {
        await open(page);
        await page.getByRole("button", { name: group, exact: true }).click();
        await page.getByRole("button", { name: label, exact: true }).click();
        const initial = await current(page),
          from = await at(page, [-15, 0]),
          to = await at(page, tool === "slider" ? [5, 0] : [15, 0]);
        if (width === 844) {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: from[0], y: from[1] }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: to[0], y: to[1] }],
          });
          await page.screenshot({ path: `${DIR}/martelo-${tool}-previa-${width}.png` });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await page.mouse.move(...from);
          await page.mouse.down();
          await page.mouse.move(...to, { steps: 8 });
          await page.screenshot({ path: `${DIR}/martelo-${tool}-previa-${width}.png` });
          await page.mouse.up();
        }
        await expect.poll(async () => (await current(page)).links.length).toBe(1);
        const stamped = await current(page),
          link = stamped.links[0]!;
        expect(link.kind).toBe(tool);
        if (link.kind === "spring") expect(link.freeLength).toBeCloseTo(30, 1);
        if (link.kind === "slider") {
          expect(link.travel[0]).toBe(0);
          expect(link.travel[1]).toBeCloseTo(20, 1);
        }
        await page.getByRole("button", { name: "Desfazer", exact: true }).click();
        expect(await current(page)).toEqual(initial);
        await page.getByRole("button", { name: "Refazer", exact: true }).click();
        expect(await current(page)).toEqual(stamped);
      });
    test("sensor escolhe a trava e a solta no Testar", async ({ page }) => {
      const s = JSON.parse(readFileSync("scenes/fixtures/fixacoes/trava.scene.json", "utf8")) as Scene;
      s.links = s.links.filter((l) => l.kind !== "sensor");
      await open(page, s);
      await page.getByRole("button", { name: "Gás", exact: true }).click();
      await page.getByRole("button", { name: "Sensor", exact: true }).click();
      const tap = async (p: [number, number]) => {
        const q = await at(page, p);
        if (width === 844) await page.touchscreen.tap(...q);
        else await page.mouse.click(...q);
      };
      await tap([15, 0]);
      await expect(page.getByText(/Sensor: toque numa câmara/)).toBeVisible();
      await tap([-15, 0]);
      await page.getByRole("button", { name: "Soltar trava", exact: true }).click();
      const made = (await current(page)).links.find((l) => l.kind === "sensor");
      expect(made).toMatchObject({ actions: [{ do: "release" }] });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Testar: ligar a física" }).click();
      await page.waitForFunction(() => (window as unknown as W).__IL__.sim.getState().ctl !== null);
      await expect(page.locator(".link--lock g").first()).toHaveCSS("opacity", "0");
    });
  });

test("câmara detecta duas paredes e a largura livre de 6 mm", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const s = scene();
  const wall = s.parts[0]!;
  wall.x = -15;
  wall.shape = { kind: "circle", r: 2.8, holes: [] };
  s.parts[1]!.shape = { kind: "circle", r: 2.8, holes: [] };
  s.parts.push({
    ...structuredClone(wall),
    id: "cylinder",
    ref: 81,
    name: "Cilindro",
    x: 0,
    fixed: true,
    shape: {
      kind: "poly",
      outer: [
        [-25, -6],
        [25, -6],
        [25, 6],
        [-25, 6],
      ],
      holes: [
        [
          [-20, -3],
          [-20, 3],
          [20, 3],
          [20, -3],
        ],
      ],
    },
  });
  s.settings.snap.on = false;
  await open(page, s);
  await page.getByRole("button", { name: "Gás", exact: true }).click();
  await page.getByRole("button", { name: "Câmara", exact: true }).click();
  const a = await at(page, [-19, 0]),
    b = await at(page, [19, 0]);
  await page.mouse.move(...a);
  await page.mouse.down();
  await page.mouse.move(...b, { steps: 12 });
  await page.screenshot({ path: `${DIR}/martelo-camara-previa-1440.png` });
  await page.mouse.up();
  await expect.poll(async () => (await current(page)).links.length).toBe(1);
  const c = (await current(page)).links[0]!;
  expect(c).toMatchObject({
    kind: "chamber",
    body: "cylinder",
    bore: 6,
    walls: [{ part: "second" }, { part: wall.id }],
  });
});
