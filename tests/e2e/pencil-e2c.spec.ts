import { readFileSync, mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { Scene } from "../../src/model/types";
import { pickTool, touchPath } from "./tools";

/**
 * Parte E2c, itens 15.2–15.4: o Lápis no palco, com mouse, dedo e caneta.
 * As contas de área e de ligações ficam nos testes de unidade
 * (src/editor/pencil.test.ts); aqui, o gesto chega ao comando certo.
 */

type W = {
  __IL__: {
    ui: {
      getState(): {
        current: { scene: Scene } | null;
        openScene(id: string, scene: Scene, figure: number): void;
        setActiveLayer(i: number): void;
        select(s: { kind: "part"; id: string } | null): void;
        setPencilTool(p: Record<string, unknown>): void;
        undo(): void;
      };
    };
    stage: {
      get(): {
        view(): { zoom: number; tx: number; ty: number };
        worldToClient(p: [number, number]): [number, number];
      };
    };
  };
};
const DIR = "docs/capturas/fase-1/parte-e2c";

/** Placa de 40×20 mm na camada 2, sobre uma base fixa, com uma barra solta longe (enquadramento). */
function plateScene(): Scene {
  const s = JSON.parse(readFileSync("scenes/fixtures/fixacoes/trava.scene.json", "utf8")) as Scene;
  s.links = [];
  const base = s.parts[0]!;
  const mov = s.parts[1]!;
  const rect = (w: number, h: number) => ({
    kind: "poly" as const,
    outer: [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ] as [number, number][],
    holes: [],
  });
  s.parts = [
    { ...base, shape: rect(120, 60) },
    { ...mov, id: "plate", ref: 3, name: "Placa 3", x: 0, y: 0, material: "steel", shape: rect(40, 20) },
    { ...mov, id: "far", ref: 9, name: "Peso", x: 45, y: 22, shape: rect(4, 4) },
    { ...mov, id: "far2", ref: 10, name: "Peso 2", x: -45, y: -22, shape: rect(4, 4) },
  ];
  s.settings.gravity.on = false;
  s.settings.snap.on = false;
  s.meta.title = "Bancada do Lápis";
  return s;
}

async function open(page: Page, scene = plateScene(), layer = 1) {
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(
    ([s, l]) => {
      const ui = (window as unknown as W).__IL__.ui.getState();
      ui.openScene("pencil-e2c", s as Scene, 1);
      ui.setActiveLayer(l as number);
    },
    [scene, layer] as const,
  );
  await expect(page.getByRole("heading", { name: scene.meta.title })).toBeVisible();
}
const current = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__IL__.ui.getState().current!.scene);
const toClient = (page: Page, p: [number, number]) =>
  page.evaluate((p) => (window as unknown as W).__IL__.stage.get().worldToClient(p), p);
const setTool = (page: Page, t: Record<string, unknown>) =>
  page.evaluate((t) => (window as unknown as W).__IL__.ui.getState().setPencilTool(t), t);

/** Laço em volta de um centro (mm), em px de tela. */
async function loopPx(page: Page, c: [number, number], r: number, n = 48) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push(await toClient(page, [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]));
  }
  return pts;
}

async function mouseDraw(page: Page, pts: [number, number][], before?: () => Promise<void>) {
  await page.mouse.move(...pts[0]!);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...p);
  await before?.();
  await page.mouse.up();
}

const polyOf = (s: Scene, id: string) => {
  const p = s.parts.find((q) => q.id === id)!;
  if (p.shape.kind !== "poly") throw new Error("esperava polígono");
  return p.shape;
};

for (const viewport of [
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`faixa do Lápis fora do centro e dos cantos (${viewport.width}×${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const s = JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")) as Scene;
    await open(page, s, 1);
    const before = await page.evaluate(() => (window as unknown as W).__IL__.stage.get().view());
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await expect(page.locator(".toolstrip")).toHaveAttribute("data-placed", "true");
    expect(await page.evaluate(() => (window as unknown as W).__IL__.stage.get().view())).toEqual(before);
    const boxes = [
      (await page.locator(".toolstrip__row").boundingBox())!,
      (await page.locator(".toolstrip__phrase").boundingBox())!,
    ];
    const { width, height } = viewport;
    const centre = { x: width * 0.2, y: height * 0.2, width: width * 0.6, height: height * 0.6 };
    const apart = (a: typeof centre, b: typeof centre) =>
      a.x >= b.x + b.width - 0.01 ||
      a.x + a.width <= b.x + 0.01 ||
      a.y >= b.y + b.height - 0.01 ||
      a.y + a.height <= b.y + 0.01;
    for (const box of boxes) {
      expect(apart(box, centre)).toBe(true);
      for (const corner of await page
        .locator(".corner--tl > *,.corner--tr > *,.corner--bl > *,.corner--br > *")
        .all()) {
        const r = await corner.boundingBox();
        if (r) expect(apart(box, r)).toBe(true);
      }
    }
    mkdirSync(DIR, { recursive: true });
    await page.screenshot({ path: `${DIR}/lapis-faixa-${viewport.width}x${viewport.height}.png` });
    // ligar o Martelo desliga o Lápis
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lápis", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
}

test.describe("Lápis com mouse (1440×900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("laço recorta a placa; desfazer volta", async ({ page }) => {
    await open(page);
    const initial = await current(page);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await setTool(page, { form: "contour", op: "cut", ruler: false });
    const pts = await loopPx(page, [4, 2], 5);
    await mouseDraw(page, pts, async () => {
      mkdirSync(DIR, { recursive: true });
      await page.screenshot({ path: `${DIR}/lapis-laco-recortando-1440.png` });
    });
    await expect.poll(async () => polyOf(await current(page), "plate").holes.length).toBe(1);
    await page.screenshot({ path: `${DIR}/lapis-laco-recortado-1440.png` });
    await page.getByRole("button", { name: "Desfazer", exact: true }).click();
    expect(await current(page)).toEqual(initial);
  });

  test("traço de borda a borda: o lado menor em brasa, trocar lado e cravar", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await setTool(page, { form: "contour", op: "cut", ruler: false });
    const a = await toClient(page, [8, -16]);
    const b = await toClient(page, [8, 16]);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++)
      pts.push([a[0] + (b[0] - a[0]) * (i / 20) + Math.sin(i) * 1.5, a[1] + (b[1] - a[1]) * (i / 20)]);
    await mouseDraw(page, pts);
    const preview = page.locator("[data-pencil-preview]");
    await expect(preview).toHaveAttribute("data-pending", "sides");
    const first = await preview.getAttribute("data-pick");
    await expect(page.locator(".pencilpreview__out")).toHaveCount(1);
    await page.screenshot({ path: `${DIR}/lapis-borda-a-borda-1440.png` });
    await page.getByRole("button", { name: "Trocar lado", exact: true }).click();
    await expect(preview).not.toHaveAttribute("data-pick", first!);
    await page.getByRole("button", { name: "Trocar lado", exact: true }).click();
    await page.getByRole("button", { name: "Cravar corte", exact: true }).click();
    await expect(preview).toHaveAttribute("data-pending", "none");
    const shape = polyOf(await current(page), "plate");
    const xs = shape.outer.map((p) => p[0]);
    // o lado menor (x > 8) saiu
    expect(Math.max(...xs)).toBeLessThan(8.5);
    expect(Math.min(...xs)).toBeCloseTo(-20, 1);
  });

  test("Somar no vazio cria a peça na camada ativa", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await setTool(page, { form: "contour", op: "add", ruler: false });
    await mouseDraw(page, await loopPx(page, [-35, 10], 6));
    await expect.poll(async () => (await current(page)).parts.length).toBe(5);
    const made = (await current(page)).parts[4]!;
    expect(made).toMatchObject({ layer: "L2", material: "steel", fixed: false });
  });
});

test.describe("Lápis com o dedo (844×390)", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  test("laço com o dedo recorta a placa", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await setTool(page, { form: "contour", op: "cut", ruler: false });
    await touchPath(page, await loopPx(page, [-6, 0], 5), { stepMs: 8 });
    await expect.poll(async () => polyOf(await current(page), "plate").holes.length).toBe(1);
  });
});

test.describe("régua e pincel (1440×900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("rasgo pela régua, pino do Martelo e o pino correndo no Testar", async ({ page }) => {
    const s = plateScene();
    // a barra que vai correr, sobre a placa de base, longe da Placa 3
    s.parts.push({
      ...s.parts[2]!,
      id: "slider",
      ref: 20,
      name: "Corrediça",
      x: -25,
      y: -8,
      shape: s.parts[2]!.shape,
    });
    s.settings.gravity.on = true;
    await open(page, s, 0);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await setTool(page, { form: "stroke", op: "cut", width: 3, ruler: true });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++)
      pts.push(await toClient(page, [-25 + 0.8 * Math.sin(i * 1.7), -12 + i * (22 / 30)]));
    await mouseDraw(page, pts);
    await expect.poll(async () => polyOf(await current(page), "p1").holes.length).toBe(1);
    // Martelo, camada 2, pino na corrediça: rasgo reto (joint)
    await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setActiveLayer(1));
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await pickTool(page, "Pino");
    await page.mouse.click(...(await toClient(page, [-25, -8])));
    await expect.poll(async () => (await current(page)).links.length).toBe(2);
    expect((await current(page)).links[1]).toMatchObject({ kind: "slot", mode: "joint", guide: "p1" });
    await page.keyboard.press("Escape");
    const bar = page.locator('.stage__sheets [data-part="slider"]').first();
    const y0 = (await bar.boundingBox())!.y;
    await page.getByRole("button", { name: "Testar: ligar a física" }).click();
    await expect.poll(async () => (await bar.boundingBox())!.y - y0, { timeout: 8000 }).toBeGreaterThan(20);
    await page.screenshot({ path: `${DIR}/lapis-rasgo-regua-pino-1440.png` });
  });

  test("alavanca desenhada à mão com o pincel", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await setTool(page, { form: "stroke", op: "add", width: 5, ruler: false });
    // um braço com um cotovelo, traçado tremido como o dedo
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const p: [number, number] =
        t < 0.6 ? [-38 + t * 25, 26 - t * 14] : [-23 + (t - 0.6) * 20, 17.6 + (t - 0.6) * 20];
      const c = await toClient(page, p);
      pts.push([c[0] + Math.sin(i * 2.3) * 1.2, c[1] + Math.cos(i * 1.9) * 1.2]);
    }
    await mouseDraw(page, pts, async () => {
      await page.screenshot({ path: `${DIR}/lapis-pincel-desenhando-1440.png` });
    });
    await expect.poll(async () => (await current(page)).parts.length).toBe(5);
    await page.mouse.click(1300, 120);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await page.screenshot({ path: `${DIR}/lapis-peca-a-mao-1440.png` });
  });
});
