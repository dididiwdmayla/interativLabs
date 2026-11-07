import { readFileSync, mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { Scene } from "../../src/model/types";
import { pickTool, touchPath } from "./tools";

/**
 * Parte E2c, item 15.1: vista parada ao abrir e fechar as ferramentas,
 * cursor deslocado (segurar 300 ms) e a faixa presa à borda de baixo.
 */

type View = { zoom: number; tx: number; ty: number };
type W = {
  __IL__: {
    ui: {
      getState(): {
        current: { scene: Scene } | null;
        openScene(id: string, scene: Scene, figure: number): void;
        setActiveLayer(i: number): void;
      };
    };
    stage: {
      get(): {
        view(): View;
        worldToClient(p: [number, number]): [number, number];
        clientToWorld(x: number, y: number): [number, number];
      };
    };
  };
};
const DIR = "docs/capturas/fase-1/parte-e2c";

/** Placa larga fixa e uma barra solta por cima, sem encaixe: o ponto é o do cursor. */
function bench(): Scene {
  const s = JSON.parse(readFileSync("scenes/fixtures/fixacoes/trava.scene.json", "utf8")) as Scene;
  s.links = [];
  s.parts = [
    {
      ...s.parts[0]!,
      shape: {
        kind: "poly",
        outer: [
          [-50, -25],
          [50, -25],
          [50, 25],
          [-50, 25],
        ],
        holes: [],
      },
    },
    {
      ...s.parts[1]!,
      x: 20,
      y: 5,
      shape: {
        kind: "poly",
        outer: [
          [-12, -3],
          [12, -3],
          [12, 3],
          [-12, 3],
        ],
        holes: [],
      },
    },
  ];
  // uma segunda peça solta, longe: o enquadramento (peças móveis) mostra a placa toda
  s.parts.push({ ...structuredClone(s.parts[1]!), id: "far", ref: 9, x: -40, y: -20 });
  s.settings.gravity.on = false;
  s.settings.snap.on = false;
  s.meta.title = "Bancada do cursor";
  return s;
}

async function open(page: Page, scene: Scene, layer?: number) {
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(
    ([s, l]) => {
      const ui = (window as unknown as W).__IL__.ui.getState();
      ui.openScene("hand-e2c", s as Scene, 1);
      if (typeof l === "number") ui.setActiveLayer(l);
    },
    [scene, layer ?? null] as const,
  );
  await expect(page.getByRole("heading", { name: scene.meta.title })).toBeVisible();
}
const view = (page: Page) => page.evaluate(() => (window as unknown as W).__IL__.stage.get().view());
const current = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__IL__.ui.getState().current!.scene);
const toClient = (page: Page, p: [number, number]) =>
  page.evaluate((p) => (window as unknown as W).__IL__.stage.get().worldToClient(p), p);

for (const viewport of [
  { width: 844, height: 390 },
  { width: 640, height: 360 },
]) {
  test(`abrir e fechar o Martelo dez vezes não mexe na vista (${viewport.width}×${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const s = JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene;
    await open(page, s);
    await page.waitForTimeout(200);
    const before = await view(page);
    const button = page.getByRole("button", { name: "Martelo", exact: true });
    for (let i = 0; i < 10; i++) {
      await button.click();
      await expect(page.locator(".toolstrip")).toBeVisible();
      expect(await view(page)).toEqual(before);
      await button.click();
      await expect(page.locator(".toolstrip")).toHaveCount(0);
      expect(await view(page)).toEqual(before);
    }
  });
}

test.describe("cursor deslocado (toque)", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test("segurar 300 ms e arrastar crava no cursor, 64 px acima do dedo", async ({ page }) => {
    await open(page, bench(), 0);
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await pickTool(page, "Parafuso");
    const c = await toClient(page, [20, 5]);
    const a: [number, number] = [c[0] - 160, c[1] + 70];
    const b: [number, number] = [a[0] + 40, a[1] + 10];
    let attrs: { point: string | null; finger: string | null } = { point: null, finger: null };
    await touchPath(page, [a, [a[0] + 20, a[1] + 5], b], {
      holdMs: 450,
      stepMs: 30,
      beforeEnd: async () => {
        const pv = page.locator("[data-hammer-preview]");
        await expect(pv).toHaveAttribute("data-cursor", "lit");
        attrs = { point: await pv.getAttribute("data-point"), finger: await pv.getAttribute("data-finger") };
        mkdirSync(DIR, { recursive: true });
        await page.screenshot({ path: `${DIR}/cursor-aceso-844x390.png` });
      },
    });
    const [px, py] = attrs.point!.split(" ").map(Number) as [number, number];
    const [fx, fy] = attrs.finger!.split(" ").map(Number) as [number, number];
    expect(Math.abs(fx - px)).toBeLessThan(1);
    expect(Math.abs(fy - py - 64)).toBeLessThan(1);
    await expect.poll(async () => (await current(page)).links.length).toBe(1);
    const link = (await current(page)).links[0]!;
    expect(link.kind).toBe("screw");
    // o ponto cravado, de volta à tela: 64 px acima do dedo, erro abaixo de 1 px
    const at = await toClient(page, (link as { at: [number, number] }).at);
    expect(Math.abs(at[0] - b[0])).toBeLessThan(1);
    expect(Math.abs(at[1] - (b[1] - 64))).toBeLessThan(1);
  });

  test("toque rápido crava sob o dedo", async ({ page }) => {
    await open(page, bench(), 0);
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await pickTool(page, "Parafuso");
    const c = await toClient(page, [20, 5]);
    const a: [number, number] = [c[0] - 160, c[1] + 70];
    await page.touchscreen.tap(...a);
    await expect.poll(async () => (await current(page)).links.length).toBe(1);
    const at = await toClient(page, ((await current(page)).links[0] as { at: [number, number] }).at);
    expect(Math.hypot(at[0] - a[0], at[1] - a[1])).toBeLessThan(1);
  });

  test("mola arrastada com o cursor tem as duas pontas no cursor", async ({ page }) => {
    await open(page, bench(), 1);
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await pickTool(page, "Mola");
    // começo: o cursor sobre a barra solta; fim: o cursor na placa de baixo
    const bar = await toClient(page, [20, 5]);
    const a: [number, number] = [bar[0], bar[1] + 64];
    const b: [number, number] = [a[0] - 160, a[1] + 20];
    await touchPath(page, [a, [a[0] - 60, a[1] + 8], b], { holdMs: 450, stepMs: 30 });
    await expect.poll(async () => (await current(page)).links.length).toBe(1);
    const link = (await current(page)).links[0]!;
    if (link.kind !== "spring") throw new Error(`esperava mola, veio ${link.kind}`);
    expect(link.a).toBe(bench().parts[1]!.id);
    expect(link.b).toBe(bench().parts[0]!.id);
    const sa = await toClient(page, [20 + link.atA[0], 5 + link.atA[1]]);
    const sb = await toClient(page, link.atB);
    expect(Math.hypot(sa[0] - bar[0], sa[1] - bar[1])).toBeLessThan(1);
    expect(Math.hypot(sb[0] - b[0], sb[1] - (b[1] - 64))).toBeLessThan(1);
  });
});

/** Caixa da faixa e da frase contra o retângulo central de 60% e os cantos. */
async function stripClear(page: Page, width: number, height: number) {
  const boxes = [
    (await page.locator(".toolstrip__row").boundingBox())!,
    (await page.locator(".toolstrip__phrase").boundingBox())!,
  ];
  const centre = { x: width * 0.2, y: height * 0.2, width: width * 0.6, height: height * 0.6 };
  const apart = (a: typeof centre, b: typeof centre) =>
    a.x >= b.x + b.width - 0.01 ||
    a.x + a.width <= b.x + 0.01 ||
    a.y >= b.y + b.height - 0.01 ||
    a.y + a.height <= b.y + 0.01;
  for (const box of boxes) {
    expect(apart(box, centre), `faixa ${JSON.stringify(box)} no centro ${JSON.stringify(centre)}`).toBe(true);
    for (const corner of await page
      .locator(".corner--tl > *,.corner--tr > *,.corner--bl > *,.corner--br > *")
      .all()) {
      const r = await corner.boundingBox();
      if (r) expect(apart(box, r), `faixa ${JSON.stringify(box)} no canto ${JSON.stringify(r)}`).toBe(true);
    }
  }
  return boxes;
}

for (const viewport of [
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`faixa do Martelo fora do centro e dos cantos (${viewport.width}×${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const s = JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene;
    await open(page, s);
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await expect(page.locator(".toolstrip")).toHaveAttribute("data-placed", "true");
    await stripClear(page, viewport.width, viewport.height);
    mkdirSync(DIR, { recursive: true });
    await page.screenshot({ path: `${DIR}/martelo-faixa-${viewport.width}x${viewport.height}.png` });
  });
}
