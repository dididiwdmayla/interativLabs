import { test, type Page } from "@playwright/test";

/**
 * Capturas da Fase 1 · Parte E2a em docs/capturas/fase-1/parte-e2a/, nos
 * tamanhos 844×390 (celular deitado), 390×844, 1180×820 e 1440×900
 * (densidade 2). Rodar: npx playwright test --project=capture-e2a
 */

const DIR = "docs/capturas/fase-1/parte-e2a";
const SIZES = [
  { name: "844x390", width: 844, height: 390, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "1180x820", width: 1180, height: 820, mobile: false },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
];

type Win = {
  __IL__: {
    ui: { getState(): Record<string, (...a: unknown[]) => void> & { current: { scene: Scene } } };
    openExample(id: string): Promise<void>;
    projects: { newProject(k: string): Promise<void> };
    stage: { get(): { worldToClient(p: [number, number]): [number, number] } | null };
  };
};
interface Scene {
  parts: { id: string; name: string; x: number; y: number; layer: string }[];
  links: { kind: string; b?: string; at?: [number, number] }[];
  layers: { id: string }[];
}

async function open(page: Page, id: string) {
  await page.evaluate((x) => (window as unknown as Win).__IL__.openExample(x), id);
  await page.waitForTimeout(500);
}

async function ui(page: Page, fn: string, ...args: unknown[]) {
  await page.evaluate(
    ([f, a]) => (window as unknown as Win).__IL__.ui.getState()[f as string]!(...(a as unknown[])),
    [fn, args] as const,
  );
  await page.waitForTimeout(350);
}

async function selectByName(page: Page, name: string) {
  await page.evaluate((n) => {
    const s = (window as unknown as Win).__IL__.ui.getState();
    const p = s.current.scene.parts.find((x) => x.name === n) ?? s.current.scene.parts.at(-1)!;
    const li = s.current.scene.layers.findIndex((l) => l.id === p.layer);
    s.setActiveLayer!(li);
    s.select!({ kind: "part", id: p.id });
  }, name);
  await page.waitForTimeout(350);
}

for (const vp of SIZES) {
  test.describe(vp.name, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });

    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".stage__sheet--static").first().waitFor();
      await ui(page, "setHint", false);
    });

    test("engrenagens enquadradas", async ({ page }) => {
      await open(page, "engrenagens");
      await page.screenshot({ path: `${DIR}/engrenagens-${vp.name}.png` });
    });

    test("menu da direita aberto", async ({ page }) => {
      await open(page, "engrenagens");
      await selectByName(page, "Intermediária");
      await ui(page, "setEdgeMenu", { side: "right", cy: vp.height / 2, hover: "parts" });
      await page.screenshot({ path: `${DIR}/menu-direita-${vp.name}.png` });
    });

    test("menu da esquerda aberto", async ({ page }) => {
      await open(page, "engrenagens");
      await ui(page, "setEdgeMenu", { side: "left", cy: vp.height / 2, hover: null });
      await page.screenshot({ path: `${DIR}/menu-esquerda-${vp.name}.png` });
    });

    test("anel do segurar pela metade", async ({ page }) => {
      await open(page, "engrenagens");
      const y = Math.round(vp.height * 0.72);
      await page.mouse.move(vp.width * 0.5, y);
      await page.mouse.down();
      await page.mouse.move(vp.width * 0.7, y, { steps: 6 });
      const x = (vp.width >= 1100 ? vp.width - 340 : vp.width) * 0.93;
      await page.mouse.move(x, y, { steps: 6 });
      await page.waitForTimeout(470);
      await page.screenshot({ path: `${DIR}/anel-segurar-${vp.name}.png` });
      await page.mouse.up();
    });

    test("gaveta", async ({ page }) => {
      await open(page, "engrenagens");
      await ui(page, "setSheet", "drawer");
      await page.screenshot({ path: `${DIR}/gaveta-${vp.name}.png` });
    });

    test("peça arrastada com a guia de encaixe", async ({ page }) => {
      await open(page, "engrenagens");
      await selectByName(page, "Intermediária");
      // a Intermediária, levada para o alinhamento do eixo do motor (reta vertical pelo eixo)
      const pts = await page.evaluate(() => {
        const w = window as unknown as Win;
        const s = w.__IL__.ui.getState().current.scene;
        const p = s.parts.find((x) => x.name === "Intermediária")!;
        const api = w.__IL__.stage.get()!;
        const from = api.worldToClient([p.x, p.y]);
        // fora do lugar em x e quase alinhada em y: encaixa na reta dos eixos (guia tracejada)
        const to = api.worldToClient([p.x - 9, p.y + 0.6]);
        return { from, to };
      });
      await page.mouse.move(pts.from[0] + 12, pts.from[1] + 12);
      await page.mouse.down();
      await page.mouse.move(pts.to[0] + 12, pts.to[1] + 12, { steps: 12 });
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${DIR}/arrasto-encaixe-${vp.name}.png` });
      await page.mouse.up();
    });

    test("cartão rápido", async ({ page }) => {
      await open(page, "engrenagens");
      await selectByName(page, "Intermediária");
      await ui(page, "setSheet", "card");
      await page.screenshot({ path: `${DIR}/cartao-${vp.name}.png` });
      await ui(page, "setDetails", true);
      await page.screenshot({ path: `${DIR}/cartao-detalhes-${vp.name}.png` });
    });

    test("pilha de pranchas", async ({ page }) => {
      await open(page, "trava");
      await ui(page, "setSheet", "layers");
      await page.screenshot({ path: `${DIR}/pilha-${vp.name}.png` });
    });

    test("lista de projetos", async ({ page }) => {
      await open(page, "trava");
      await open(page, "biela-manivela");
      await ui(page, "setMainTab", "projects");
      await ui(page, "setSheet", "main");
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${DIR}/projetos-${vp.name}.png` });
    });
  });
}
