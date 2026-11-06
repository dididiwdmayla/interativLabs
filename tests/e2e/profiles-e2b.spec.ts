import { test, expect, type Page } from "@playwright/test";
import { profilesScene } from "../../scripts/fixtures/multicamada";
import { buildPart } from "../../src/parts/index";
import type { Scene } from "../../src/model/types";
type State = {
  current: { scene: Scene };
  activeLayer: number;
  openScene(id: string, s: Scene, fig: number): void;
  setActiveLayer(i: number): void;
  setXray(on: boolean): void;
  setSheet(s: string | null): void;
  select(s: { kind: "part"; id: string }): void;
  undo(): void;
  redo(): void;
};
type W = {
  __IL__: {
    ui: { getState(): State };
    stage: { get(): { worldToClient(p: [number, number]): [number, number] } };
  };
};
const DIR = "docs/capturas/fase-1/parte-e2b";
async function open(page: Page) {
  const { scene, piece } = profilesScene();
  scene.parts = [piece];
  scene.links = [];
  scene.meta.title = "Peça em três planos";
  piece.shape = buildPart(scene, "gear", { x: 0, y: 0, layer: "L1", params: { teeth: 36, module: 1 } }).shape;
  piece.profiles![0]!.shape = buildPart(scene, "ratchet", {
    x: 0,
    y: 0,
    layer: "L3",
    params: { d: 24, teeth: 24 },
  }).shape;
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(
    ({ scene, id }) => {
      const ui = (window as unknown as W).__IL__.ui.getState();
      ui.openScene("profile-e2b", scene, 1);
      ui.setActiveLayer(0);
      ui.select({ kind: "part", id });
    },
    { scene, id: piece.id },
  );
  await expect(page.getByRole("heading", { name: scene.meta.title, exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setSheet("card"));
  await expect(page.getByRole("heading", { name: "Camadas desta peça", exact: true })).toBeVisible();
  return piece.id;
}
const scene = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__IL__.ui.getState().current.scene);
for (const width of [844, 1440])
  test.describe(`${width}`, () => {
    test.use({ viewport: { width, height: width === 844 ? 390 : 900 }, hasTouch: width === 844 });
    test("extend, resize, separate, merge and undo", async ({ page }) => {
      const id = await open(page),
        initial = await scene(page);
      await page.getByRole("button", { name: "Estender para outra camada", exact: true }).click();
      await page.getByLabel("Camada de destino", { exact: true }).selectOption("L2");
      await page.getByLabel("Forma do perfil", { exact: true }).selectOption("disc");
      await page.getByRole("button", { name: "Criar perfil", exact: true }).click();
      await expect.poll(async () => (await scene(page)).parts[0]!.profiles?.length).toBe(2);
      const added = await scene(page);
      await page.getByRole("heading", { name: "Camadas desta peça", exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${DIR}/cartao-camadas-${width}.png`, animations: "disabled" });
      await page.getByRole("button", { name: "Aumentar diâmetro", exact: true }).click();
      const resized = await scene(page);
      expect(resized.parts[0]!.shape).toEqual(initial.parts[0]!.shape);
      expect(resized.parts[0]!.profiles!.find((p) => p.layer === "L2")!.shape).not.toEqual(
        added.parts[0]!.profiles!.find((p) => p.layer === "L2")!.shape,
      );
      await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().undo());
      expect(await scene(page)).toEqual(added);
      await page.getByRole("button", { name: "Separar em peça", exact: true }).click();
      await expect.poll(async () => (await scene(page)).parts.length).toBe(2);
      await page.getByRole("button", { name: "Fundir peças aparafusadas", exact: true }).click();
      await expect.poll(async () => (await scene(page)).parts.length).toBe(1);
      await page.evaluate(() => {
        const ui = (window as unknown as W).__IL__.ui.getState();
        ui.undo();
        ui.undo();
      });
      expect(await scene(page)).toEqual(added);
      await page.evaluate(
        ({ id }) => {
          const ui = (window as unknown as W).__IL__.ui.getState();
          ui.select({ kind: "part", id });
          ui.setSheet(null);
          ui.setActiveLayer(2);
        },
        { id },
      );
      await page.screenshot({ path: `${DIR}/perfis-montar-${width}.png`, animations: "disabled" });
      await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setXray(true));
      await page.screenshot({ path: `${DIR}/perfis-raio-x-${width}.png`, animations: "disabled" });
      await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().undo());
      expect(await scene(page)).toEqual(initial);
    });
  });

test("touching a profile selects its owner and activates its layer", async ({ page }) => {
  const { scene: s, piece } = profilesScene();
  s.parts = [piece];
  s.links = [];
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate((s) => {
    const ui = (window as unknown as W).__IL__.ui.getState();
    ui.openScene("profile-hit", s, 1);
    ui.setActiveLayer(0);
  }, s);
  await expect(page.getByRole("heading", { name: s.meta.title, exact: true })).toBeVisible();
  const point = await page.evaluate(() => (window as unknown as W).__IL__.stage.get().worldToClient([8, 0]));
  await page.mouse.click(...point);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as W).__IL__.ui.getState().activeLayer))
    .toBe(2);
});
