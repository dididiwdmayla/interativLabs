import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { audio } from "../../src/assets/audio-registry";
import type { Scene } from "../../src/model/types";
import { rodaScene } from "../../scripts/fixtures/roda";

/**
 * Parte S · itens 18.3 e 18.4 no navegador: os eventos do worker chegam ao
 * som quando o desenho alcança o passo deles (Roda e lingueta e Lançador em
 * Real), e as ferramentas tocam pelo comando registrado.
 */

type Played = { id: string; gain: number; cents: number; at: number };
type Debug = { loaded: string[]; played: Played[]; voicesOf: Record<string, number> };
type Ctl = {
  setSpeed(s: number): void;
  dragAt(p: [number, number]): string | null;
  dragMove(p: [number, number]): void;
  dragEnd(): void;
  releaseAt(p: [number, number]): boolean;
};
type W = {
  __IL__: {
    sound: { debug(): Debug | null };
    openExample(id: string): Promise<void>;
    ui: {
      getState(): {
        current: { scene: Scene } | null;
        openScene(id: string, scene: Scene, figure: number): void;
        setHint(b: boolean): void;
        setMode(m: string): void;
        toggleMode(): void;
        setActiveLayer(i: number): void;
        setPencilTool(p: Record<string, unknown>): void;
      };
    };
    sim: { getState(): { ctl: Ctl | null } };
    stage: { get(): { worldToClient(p: [number, number]): [number, number] } };
  };
};

const played = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__IL__.sound.debug()?.played ?? []) as Promise<Played[]>;

async function start(page: Page) {
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setHint(false));
  // o primeiro toque acorda o som; os efeitos da Parte S chegam em tempo ocioso
  await page.mouse.click(720, 450);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as W).__IL__.sound.debug()?.loaded.length), {
      timeout: 20_000,
    })
    .toBe(20);
}

async function simulate(page: Page, speed = 1) {
  await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().setMode("simulate"));
  await page.waitForFunction(() => (window as unknown as W).__IL__.sim.getState().ctl);
  await page.evaluate((v) => (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(v), speed);
}

/** Volume que sai: LUFS do arquivo + ganho fino + ganho do toque. */
const level = (p: Played) => {
  const entry = audio[p.id as keyof typeof audio];
  return entry.measured.lufs! + 20 * Math.log10(p.gain);
};

test.use({ viewport: { width: 1440, height: 900 } });

test("Roda e lingueta em Real: os estalos da catraca saem como sfx-ratchet e não empilham", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.evaluate(async () => {
    const h = (window as unknown as W).__IL__;
    await h.openExample("roda-e-lingueta");
    h.ui.getState().setActiveLayer(2);
  });
  await simulate(page, 0.05);
  const r = rodaScene();
  const at: [number, number] = [
    r.pawl.x + Math.cos(r.pawl.angle) * r.lock.at[0] - Math.sin(r.pawl.angle) * r.lock.at[1],
    r.pawl.y + Math.sin(r.pawl.angle) * r.lock.at[0] + Math.cos(r.pawl.angle) * r.lock.at[1],
  ];
  const xy = await page.evaluate((p) => (window as unknown as W).__IL__.stage.get().worldToClient(p), at);
  await page.mouse.click(...xy);
  await page.waitForTimeout(150);
  await expect(page.locator(".link--lock g").first()).toHaveCSS("opacity", "0");
  const held = await page.evaluate(
    (p) => (window as unknown as W).__IL__.sim.getState().ctl!.dragAt(p),
    r.grip,
  );
  expect(held).toBe(r.pinion.id);
  // a manivela em Real (a trava soltou em câmera lenta, para pegar a manivela parada)
  await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.setSpeed(1));
  for (let i = 1; i <= 80; i++) {
    const a = r.pinion.angle + Math.PI / 2 + (i / 80) * Math.PI * 2;
    await page.evaluate((p) => (window as unknown as W).__IL__.sim.getState().ctl!.dragMove(p), [
      r.pinion.x + r.crankLength * Math.cos(a),
      r.pinion.y + r.crankLength * Math.sin(a),
    ] as [number, number]);
    await page.waitForTimeout(32);
  }
  await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.dragEnd());
  await page.waitForTimeout(400);
  const list = await played(page);
  const ratchet = list.filter((p) => p.id.startsWith("sfx-ratchet"));
  expect(ratchet.length).toBeGreaterThanOrEqual(4);
  // a trava soltou: um sfx-lock-release
  expect(list.filter((p) => p.id === "sfx-lock-release")).toHaveLength(1);
  // as variações da catraca não repetem a anterior
  for (let i = 1; i < ratchet.length; i++) expect(ratchet[i]!.id).not.toBe(ratchet[i - 1]!.id);
  // nunca mais de 4 efeitos de impacto numa janela de 50 ms
  const hits = list.filter((p) => /^sfx-(impact|ratchet)/.test(p.id));
  for (const h of hits)
    expect(hits.filter((x) => x.at > h.at - 0.05 && x.at <= h.at).length).toBeLessThanOrEqual(4);
  expect(errors).toEqual([]);
});

async function fireLauncher(page: Page, amount: number): Promise<Played[]> {
  await page.evaluate(async (amount) => {
    const h = (window as unknown as W).__IL__;
    await h.openExample("lancador-bancada");
    const scene = structuredClone(h.ui.getState().current!.scene) as Scene;
    for (const l of scene.links)
      if (l.kind === "chamber" && l.gas?.charge) l.gas = { ...l.gas, charge: { ...l.gas.charge, amount } };
    h.ui.getState().openScene("sound-s", scene, 1);
  }, amount);
  const before = (await played(page)).length;
  await simulate(page);
  // o gatilho, como no roteiro do Lançador (arrasto de p19 por 0,12 s)
  const trigger = await page.evaluate(() =>
    (window as unknown as W).__IL__.sim.getState().ctl!.dragAt([16, 35.5]),
  );
  expect(trigger).toBe("p19");
  for (let i = 1; i <= 8; i++) {
    await page.evaluate((p) => (window as unknown as W).__IL__.sim.getState().ctl!.dragMove(p), [
      16 - (18 * i) / 8,
      35.5 - i / 8,
    ] as [number, number]);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(1800);
  await page.evaluate(() => (window as unknown as W).__IL__.sim.getState().ctl!.dragEnd());
  await page.waitForTimeout(300);
  return (await played(page)).slice(before);
}

test("Lançador em Real: a câmara forte soa acima da fraca (ganho medido)", async ({ page }) => {
  await start(page);
  const weak = await fireLauncher(page, 0.1);
  const weakGas = weak.find((p) => p.id === "sfx-gas" || p.id === "sfx-pop-strong");
  expect(weakGas?.id).toBe("sfx-gas");
  const strong = await fireLauncher(page, 1.2);
  const strongGas = strong.find((p) => p.id === "sfx-gas" || p.id === "sfx-pop-strong");
  expect(strongGas?.id).toBe("sfx-pop-strong");
  expect(level(strongGas!)).toBeGreaterThan(level(weakGas!) + 4);
  // o chiado, os impactos e a esfera saindo: há impactos com família e volume
  expect(strong.some((p) => p.id.startsWith("sfx-impact"))).toBe(true);
});

test("Montar/Testar dez vezes seguidas não acumula sons (uma voz de sfx-mode por vez)", async ({ page }) => {
  await start(page);
  const voices: number[] = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => (window as unknown as W).__IL__.ui.getState().toggleMode());
    voices.push(
      await page.evaluate(() => (window as unknown as W).__IL__.sound.debug()?.voicesOf["sfx-mode"] ?? 0),
    );
  }
  expect(Math.max(...voices)).toBeLessThanOrEqual(1);
  expect((await played(page)).filter((p) => p.id === "sfx-mode")).toHaveLength(10);
});

test("o Lápis toca sfx-cut uma vez por corte; desfazer não toca; abrir a faixa toca sfx-ui", async ({
  page,
}) => {
  await start(page);
  const base = JSON.parse(readFileSync("scenes/fixtures/fixacoes/trava.scene.json", "utf8")) as Scene;
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
  const [b0, b1] = [base.parts[0]!, base.parts[1]!];
  const scene: Scene = {
    ...base,
    links: [],
    parts: [
      { ...b0, shape: rect(120, 60) },
      { ...b1, id: "plate", ref: 3, name: "Placa 3", x: 0, y: 0, material: "steel", shape: rect(40, 20) },
      { ...b1, id: "far", ref: 9, name: "Peso", x: 45, y: 22, shape: rect(4, 4) },
      { ...b1, id: "far2", ref: 10, name: "Peso 2", x: -45, y: -22, shape: rect(4, 4) },
    ],
    settings: { ...base.settings, gravity: { ...base.settings.gravity, on: false } },
    meta: { ...base.meta, title: "Bancada do Lápis" },
  };
  await page.evaluate((s) => {
    const ui = (window as unknown as W).__IL__.ui.getState();
    ui.openScene("sound-s", s, 1);
    ui.setActiveLayer(1);
  }, scene);
  await expect(page.getByRole("heading", { name: "Bancada do Lápis" })).toBeVisible();
  const n = async (id: string) => (await played(page)).filter((p) => p.id === id).length;
  const ui0 = await n("sfx-ui");
  await page.getByRole("button", { name: "Lápis", exact: true }).click();
  expect(await n("sfx-ui")).toBe(ui0 + 1);
  await page.evaluate(() =>
    (window as unknown as W).__IL__.ui.getState().setPencilTool({ form: "contour", op: "cut", ruler: false }),
  );
  const c: [number, number] = [4, 2];
  const pts: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (2 * Math.PI * i) / 48;
    pts.push(
      await page.evaluate((p) => (window as unknown as W).__IL__.stage.get().worldToClient(p), [
        c[0] + 5 * Math.cos(a),
        c[1] + 5 * Math.sin(a),
      ] as [number, number]),
    );
  }
  const cuts0 = await n("sfx-cut");
  await page.mouse.move(...pts[0]!);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...p);
  await page.mouse.up();
  await expect.poll(() => n("sfx-cut")).toBe(cuts0 + 1);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await n("sfx-cut")).toBe(cuts0 + 1);
});
