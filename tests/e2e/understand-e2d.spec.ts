import { readFileSync, mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { Scene } from "../../src/model/types";
import { touchPath } from "./tools";

/**
 * Parte E2d: acertos da revisão da E2c (16.1), camadas em cores (16.2),
 * esconder peça (16.3), cartões "o que é" e rastro (16.4).
 */

type View = { zoom: number; tx: number; ty: number };
type UiState = {
  current: { scene: Scene } | null;
  mode: "edit" | "simulate";
  openScene(id: string, scene: Scene, figure: number): void;
  setActiveLayer(i: number): void;
  setMode(m: "edit" | "simulate"): void;
  setHammer(t: string | null): void;
  setPencil(on: boolean): void;
  setPencilTool(p: Record<string, unknown>): void;
  select(s: { kind: "part" | "link"; id: string } | null): void;
  setHint(on: boolean): void;
  history: { past: unknown[] };
  setFingerDraws(on: boolean): void;
  fingerDraws: boolean;
  penSeen: boolean;
};
type W = {
  __IL__: {
    ui: { getState(): UiState };
    sim: {
      getState(): { status: string; ctl: { preview(t: number): void; setSpeed(s: string): void } | null };
    };
    stage: {
      get(): {
        view(): View;
        worldToClient(p: [number, number]): [number, number];
      };
    };
  };
};
const DIR = "docs/capturas/fase-1/parte-e2d";
mkdirSync(DIR, { recursive: true });

const sceneOf = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Scene;
const LANCADOR = "scenes/examples/lancador-bancada.json";

async function open(page: Page, scene: Scene, layer?: number) {
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(
    ([s, l]) => {
      const ui = (window as unknown as W).__IL__.ui.getState();
      ui.openScene("e2d", s as Scene, 1);
      if (typeof l === "number") ui.setActiveLayer(l);
    },
    [scene, layer ?? null] as const,
  );
  await expect(page.getByRole("heading", { name: scene.meta.title })).toBeVisible();
  // a dica some para a captura ficar limpa
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setHint(false));
}
const ui = (page: Page) => page.evaluate(() => (window as unknown as W).__IL__.ui.getState());
const current = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__IL__.ui.getState().current!.scene);
const toClient = (page: Page, p: [number, number]) =>
  page.evaluate((p) => (window as unknown as W).__IL__.stage.get().worldToClient(p), p);

// ——— 16.1 ———

test.describe("16.1 — pílula da camada com a faixa aberta", () => {
  for (const vp of [
    { width: 844, height: 390 },
    { width: 640, height: 360 },
  ]) {
    test.describe(`${vp.width}×${vp.height}`, () => {
      test.use({ viewport: vp, hasTouch: true });
      test("o nome da camada cabe (ou aparece inteiro ao tocar)", async ({ page }) => {
        const scene = sceneOf(LANCADOR);
        await open(page, scene, 3);
        await page.getByRole("button", { name: "Martelo", exact: true }).click();
        const name = page.locator(".pill__name");
        await expect(name).toHaveText("Gatilho");
        const fits = await name.evaluate(
          (el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
        );
        // a pílula não encosta na faixa
        const pill = (await page.locator(".corner--br .pill").boundingBox())!;
        const row = (await page.locator(".toolstrip__row").boundingBox())!;
        const overlapX = Math.min(pill.x + pill.width, row.x + row.width) - Math.max(pill.x, row.x);
        const overlapY = Math.min(pill.y + pill.height, row.y + row.height) - Math.max(pill.y, row.y);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
        await page.screenshot({ path: `${DIR}/pilula-camada-${vp.width}x${vp.height}.png` });
        if (vp.width >= 844) expect(fits).toBe(true);
        if (!fits) {
          await page.locator(".corner--br .pill").tap();
          await expect(page.locator(".toast")).toContainText("Camada 4 · Gatilho");
        }
      });
    });
  }
});

test.describe("16.1 — Esc sai só com teclado ou mouse", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  test("toque: a frase termina antes; mouse: com Esc sai", async ({ page }) => {
    await open(page, sceneOf(LANCADOR), 3);
    await page.getByRole("button", { name: "Martelo", exact: true }).tap();
    const phrase = page.locator(".toolstrip__phrase");
    await expect(phrase).toHaveText("Eixo: toque sobre uma peça");
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await page.getByRole("button", { name: "Martelo", exact: true }).click();
    await expect(phrase).toHaveText("Eixo: toque sobre uma peça · Esc sai");
  });
});

test.describe("16.1 — Dedo desenha (caneta e dedo)", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  /** Placa de 40×20 mm solta na camada 2 sobre uma base fixa. */
  function plate(): Scene {
    const s = sceneOf("scenes/fixtures/fixacoes/trava.scene.json");
    s.links = [];
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
      { ...s.parts[0]!, shape: rect(120, 60) },
      { ...s.parts[1]!, id: "plate", ref: 3, name: "Placa 3", x: 0, y: 0, shape: rect(40, 20) },
    ];
    s.settings.gravity.on = false;
    s.settings.snap.on = false;
    s.meta.title = "Bancada do dedo";
    return s;
  }
  const holes = (s: Scene) => {
    const p = s.parts.find((q) => q.id === "plate")!;
    return p.shape.kind === "poly" ? p.shape.holes.length : 0;
  };
  /** um laço de raio 5 mm em volta de (4, 0), com o dedo */
  const loop = async (page: Page) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI + (2 * Math.PI * i) / 40;
      pts.push(await toClient(page, [4 + 5 * Math.cos(a), 5 * Math.sin(a)]));
    }
    await touchPath(page, pts, { stepMs: 4 });
  };

  test("o botão só aparece depois da caneta, liga e desliga e fica salvo", async ({ page }) => {
    await open(page, plate(), 1);
    await page.getByRole("button", { name: "Lápis", exact: true }).click();
    await page.evaluate(() =>
      (window as unknown as W).__IL__.ui
        .getState()
        .setPencilTool({ form: "contour", op: "cut", ruler: false }),
    );
    const strip = page.locator(".toolstrip");
    await expect(strip.locator('[data-tool="finger"]')).toHaveCount(0);
    // a caneta toca a prancha (um toque, no fundo)
    const cdp = await page.context().newCDPSession(page);
    for (const type of ["mousePressed", "mouseReleased"] as const)
      await cdp.send("Input.dispatchMouseEvent", {
        type,
        x: 760,
        y: 120,
        button: "left",
        buttons: type === "mousePressed" ? 1 : 0,
        clickCount: 1,
        pointerType: "pen",
      });
    // o toque da caneta no Contorno escolhe a base: volta para a placa
    await page.evaluate(() => {
      const s = (window as unknown as W).__IL__.ui.getState();
      s.setActiveLayer(1);
      s.select({ kind: "part", id: "plate" });
    });
    const finger = strip.locator('[data-tool="finger"]');
    await expect(finger).toHaveCount(1);
    await expect(finger).toHaveAttribute("aria-pressed", "false");
    // desligado: o dedo só move a vista
    const before = await current(page);
    await loop(page);
    expect(await current(page)).toEqual(before);
    // ligado: o dedo desenha de novo
    // (o toque logo depois de um gesto emulado se perde no Chromium: uma pausa curta)
    await page.waitForTimeout(500);
    await finger.tap();
    await expect(finger).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${DIR}/lapis-dedo-desenha-844x390.png` });
    await loop(page);
    await expect.poll(async () => holes(await current(page))).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("il.fingerDraws"))).toBe("1");
    // a escolha fica no aparelho
    await page.reload();
    await page.locator(".stage__sheet--static").first().waitFor();
    expect((await ui(page)).fingerDraws).toBe(true);
    await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setFingerDraws(false));
  });
});

// ——— 16.2 ———

type Sim = {
  ctl: {
    preview(t: number): void;
    scrub(t: number): void;
    setSpeed(s: number): void;
    dragAt(p: [number, number]): string | null;
    dragMove(p: [number, number]): void;
    dragEnd(): void;
    releaseAt(p: [number, number]): boolean;
    timeline(): { latest: number; events: number[] };
  } | null;
  status: string;
};

const setLook = (page: Page, patch: Record<string, unknown>) =>
  page.evaluate((p) => {
    const s = (window as unknown as W).__IL__.ui.getState() as unknown as {
      setLook(p: Record<string, unknown>): void;
    };
    s.setLook(p);
  }, patch);

const VARIANTS: { name: string; patch: Record<string, unknown> }[] = [
  { name: "cores", patch: { open: true, colors: true, spread: false, isolate: false } },
  { name: "afastadas", patch: { open: true, colors: true, spread: true, isolate: false } },
  { name: "isolada", patch: { open: true, colors: true, spread: false, isolate: true } },
];

/** Puxa o gatilho do Lançador em Real e devolve o instante do tiro (s). */
async function fireLancador(page: Page): Promise<number> {
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __IL__: { sim: { getState(): Sim } } }).__IL__.sim.getState().status,
      ),
    )
    .toBe("ready");
  return page.evaluate(async () => {
    const ctl = (window as unknown as { __IL__: { sim: { getState(): Sim } } }).__IL__.sim.getState().ctl!;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(300);
    ctl.setSpeed(1);
    const t0 = ctl.timeline().latest;
    ctl.dragAt([16, 35.5]);
    for (let i = 1; i <= 12; i++) {
      await wait(16);
      ctl.dragMove([16 - (18 * i) / 12, 35.5 - i / 12]);
    }
    await wait(700);
    ctl.dragEnd();
    await wait(300);
    ctl.setSpeed(0.05);
    return Math.min(...ctl.timeline().events.filter((e) => e > t0));
  });
}

/** Solta a trava da Roda e gira a manivela meia volta; devolve um instante no meio do giro. */
async function turnRoda(page: Page, scene: Scene): Promise<number> {
  const lock = scene.links.find((l) => l.kind === "lock") as { b: string; at: [number, number] };
  const host = scene.parts.find((p) => p.id === lock.b)!;
  const c = Math.cos(host.angle);
  const s = Math.sin(host.angle);
  const at: [number, number] = [
    host.x + lock.at[0] * c - lock.at[1] * s,
    host.y + lock.at[0] * s + lock.at[1] * c,
  ];
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __IL__: { sim: { getState(): Sim } } }).__IL__.sim.getState().status,
      ),
    )
    .toBe("ready");
  return page.evaluate(async (at) => {
    const ctl = (window as unknown as { __IL__: { sim: { getState(): Sim } } }).__IL__.sim.getState().ctl!;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(300);
    ctl.setSpeed(1);
    ctl.releaseAt(at);
    await wait(100);
    // a manivela gira em volta do pinhão (-24, 0), raio 18
    const p = (a: number): [number, number] => [-24 + 18 * Math.cos(a), 18 * Math.sin(a)];
    const a0 = Math.PI * 0.72;
    ctl.dragAt(p(a0));
    let mid = 0;
    for (let i = 1; i <= 40; i++) {
      await wait(16);
      ctl.dragMove(p(a0 + (i / 40) * Math.PI));
      if (i === 24) mid = ctl.timeline().latest;
    }
    ctl.dragEnd();
    await wait(200);
    return mid;
  }, at);
}

for (const vp of [
  { name: "844x390", width: 844, height: 390, mobile: true },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
]) {
  test.describe(`16.2 — camadas em cores ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      hasTouch: vp.mobile,
      isMobile: vp.mobile,
    });
    for (const ex of [
      { id: "lancador", file: LANCADOR },
      { id: "roda", file: "scenes/examples/roda-e-lingueta.json" },
    ]) {
      test(`${ex.id}: cores, afastadas e isolada, no Montar e no meio do ciclo`, async ({ page }) => {
        test.setTimeout(120_000);
        const scene = sceneOf(ex.file);
        await open(page, scene);
        const before = await current(page);
        for (const v of VARIANTS) {
          await setLook(page, v.patch);
          await page.waitForTimeout(700);
          await page.screenshot({ path: `${DIR}/${v.name}-${ex.id}-montar-${vp.name}.png` });
        }
        await setLook(page, { open: false });
        // modo de vista: a cena (e o hash dela) não muda, nem a pilha de desfazer
        expect(await current(page)).toEqual(before);
        expect(
          await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().history.past.length),
        ).toBe(0);
        await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setMode("simulate"));
        const t = ex.id === "lancador" ? (await fireLancador(page)) + 3 / 240 : await turnRoda(page, scene);
        await page.evaluate(
          (x) =>
            (window as unknown as { __IL__: { sim: { getState(): Sim } } }).__IL__.sim
              .getState()
              .ctl!.scrub(x),
          t,
        );
        for (const v of VARIANTS) {
          await setLook(page, v.patch);
          await page.waitForTimeout(700);
          await page.screenshot({ path: `${DIR}/${v.name}-${ex.id}-testar-${vp.name}.png` });
        }
      });
    }
  });
}
