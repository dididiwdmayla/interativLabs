import { readFileSync, readdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { parseScene } from "../../src/model/scene";
import type { LinkKind, Scene } from "../../src/model/types";

type W = {
  __IL__: {
    ui: {
      getState(): {
        current: { scene: Scene };
        history: { past: unknown[] };
        openScene(id: string, s: Scene, fig: number): void;
        select(s: { kind: "link"; id: string }): void;
        setSheet(s: string | null): void;
        undo(): void;
      };
    };
  };
};
const DIR = "docs/capturas/fase-1/parte-e2b";
function fixture(kind: LinkKind): { scene: Scene; id: string } {
  for (const group of readdirSync("scenes/fixtures")) {
    if (group.includes(".")) continue;
    for (const file of readdirSync(`scenes/fixtures/${group}`).filter((f) => f.endsWith(".scene.json"))) {
      const loaded = parseScene(readFileSync(`scenes/fixtures/${group}/${file}`, "utf8"));
      if (!loaded.ok) throw new Error(JSON.stringify(loaded.issues));
      const scene = loaded.scene;
      const link = scene.links.find((l) => l.kind === kind);
      if (!link) continue;
      if (link.kind === "axle") link.limit = { lower: -Math.PI / 4, upper: Math.PI / 4 };
      return { scene, id: link.id };
    }
  }
  throw new Error(`Sem cena para ${kind}`);
}
async function open(page: Page, kind: LinkKind) {
  const f = fixture(kind);

  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate((f) => {
    const ui = (window as unknown as W).__IL__.ui.getState();
    ui.openScene("card-e2b", f.scene, 1);
  }, f);
  await expect(page.getByRole("heading", { name: f.scene.meta.title, exact: true })).toBeVisible();
  await page.evaluate((f) => {
    const ui = (window as unknown as W).__IL__.ui.getState();
    ui.select({ kind: "link", id: f.id });
    ui.setSheet("card");
  }, f);
  await expect(page.locator(".card__title")).toBeVisible();
  return f;
}
const scene = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__IL__.ui.getState().current.scene);
test.describe("cartões 844x390", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  for (const kind of [
    "screw",
    "mount",
    "lock",
    "axle",
    "pin",
    "slot",
    "spring",
    "rod",
    "cable",
    "slider",
    "chamber",
    "sensor",
  ] as const)
    test(`${kind}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await open(page, kind);
      await page.screenshot({ animations: "disabled", path: `${DIR}/cartao-${kind}-844x390.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  test("trocas mantêm pontos e predefinições seguidas têm um desfazer", async ({ page }) => {
    const f = await open(page, "screw");
    const before = (await scene(page)).links.find((l) => l.id === f.id)!;
    await page.getByRole("button", { name: "Elástica", exact: true }).click();
    await expect(page.locator(".card__title")).toHaveText("Suporte elástico");
    const next = (await scene(page)).links.find((l) => l.id === f.id)!;
    if (before.kind !== "screw") throw new Error("Parafuso ausente");
    expect(next).toMatchObject({ a: before.a, b: before.b, at: before.at });
    const count = await page.evaluate(
      () => (window as unknown as W).__IL__.ui.getState().history.past.length,
    );
    await page.getByRole("button", { name: "Macio", exact: true }).click();
    await page.getByRole("button", { name: "Firme", exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().history.past.length)).toBe(
      count + 1,
    );
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    expect((await scene(page)).links.find((l) => l.id === f.id)).toEqual(next);
  });
});

test.describe("alças", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const kind of ["axle", "slider", "spring", "sensor"] as const)
    test(`${kind} altera e desfaz`, async ({ page }) => {
      const f = await open(page, kind);
      const before = await scene(page);
      const handle = page.locator("[data-link-handle] circle").first();
      await expect(handle).toBeVisible();
      const r = (await handle.boundingBox())!;
      const x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 15, y + 30, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(async () => JSON.stringify((await scene(page)).links.find((l) => l.id === f.id)))
        .not.toBe(JSON.stringify(before.links.find((l) => l.id === f.id)));
      await page.screenshot({ animations: "disabled", path: `${DIR}/alca-${kind}-1440.png` });
      await page.getByRole("button", { name: "Desfazer", exact: true }).click();
      expect(await scene(page)).toEqual(before);
    });
});
