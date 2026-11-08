import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { Scene } from "../../src/model/types";
import type { useSimStore } from "../../src/ui/sim/simStore";

/**
 * M1v: as capturas pedidas (resumo da comparação, torque da lingueta, velocidade na saída) e os casos
 * da verificação (números em pt-BR, tiques agrupados, pinça no gráfico com toque emulado).
 */
type Harness = {
  __IL__: {
    ui: {
      getState(): {
        openScene(id: string, scene: Scene, figure: number): void;
        setMode(mode: "simulate"): void;
        setProbes(probes: unknown[]): void;
        setGapTarget(id: string | null): void;
        setLook(patch: Record<string, unknown>): void;
        probes: { target: string; quantity: string; other?: string }[];
      };
    };
    sim: typeof useSimStore;
  };
};
const DIR = "docs/capturas/fase-2/m1v";
const VIEWPORTS = [
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
];

async function open(
  page: Page,
  example: string,
  viewport: { width: number; height: number },
  mode: "simulate" | "edit" = "simulate",
) {
  mkdirSync(DIR, { recursive: true });
  const scene = JSON.parse(readFileSync(`scenes/examples/${example}.json`, "utf8")) as Scene;
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.locator(".stage__sheet--static").first().waitFor();
  await page.evaluate(
    ({ scene, mode }) => {
      const ui = (window as unknown as Harness).__IL__.ui.getState();
      ui.openScene("capture-m1v", scene, 1);
      if (mode === "simulate") ui.setMode("simulate");
    },
    { scene, mode },
  );
  if (mode === "simulate")
    await page.waitForFunction(() => (window as unknown as Harness).__IL__.sim.getState().status === "ready");
  return scene;
}

/** Plays the example's gesture step by step, as the M1a captures do, and leaves the ruler at `at` seconds. */
async function play(page: Page, example: string, scene: Scene, at: number) {
  await page.evaluate(
    async ({ example, scene, at }) => {
      const h = (window as unknown as Harness).__IL__;
      const ctl = h.sim.getState().ctl!;
      h.sim.getState().set({ paused: true });
      ctl.restart();
      await new Promise((r) => setTimeout(r, 100));
      if (example === "roda-e-lingueta") {
        const pawl = scene.parts.find((p) => p.id === "p4")!;
        const link = scene.links.find((l) => l.id === "k8")!;
        if (link.kind === "lock") {
          const [x, y] = link.at;
          ctl.releaseAt([
            pawl.x + x * Math.cos(pawl.angle) - y * Math.sin(pawl.angle),
            pawl.y + x * Math.sin(pawl.angle) + y * Math.cos(pawl.angle),
          ]);
        }
      }
      const pinion = scene.parts.find((p) => p.id === "p3")!;
      const length = example === "lancador-bancada" ? 432 : 528;
      for (let i = 0; i < length; i++) {
        if (example === "lancador-bancada") {
          if (i === 72 && ctl.dragAt([16, 35.5]) !== "p19") throw new Error("Gatilho não selecionado");
          if (i > 72 && i <= 101)
            ctl.dragMove([16 - 18 * Math.min(1, (i - 72) / 28.8), 35.5 - Math.min(1, (i - 72) / 28.8)]);
          if (i === 360) ctl.dragEnd();
        } else {
          const angle = pinion.angle + Math.PI / 2 + Math.max(0, Math.min(1, (i - 24) / 480)) * 2 * Math.PI;
          const point: [number, number] = [pinion.x + 18 * Math.cos(angle), pinion.y + 18 * Math.sin(angle)];
          if (i === 24 && ctl.dragAt(point) !== "p3") throw new Error("Manivela não selecionada");
          if (i > 24 && i <= 504) ctl.dragMove(point);
        }
        ctl.stepOnce();
        const until = performance.now() + 3000;
        while (ctl.timeline().latest * 240 < i + 1 - 0.01) {
          if (performance.now() > until) throw new Error(`Passo ${i + 1} não chegou`);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      ctl.dragEnd();
      ctl.scrub(at);
    },
    { example, scene, at },
  );
  await page.waitForTimeout(250);
}

for (const viewport of VIEWPORTS) {
  const tag = `${viewport.width}x${viewport.height}`;

  test(`resumo da comparação · ${tag}`, async ({ page }) => {
    await open(page, "lancador-bancada", viewport);
    await page.getByRole("button", { name: "Experimente comparar", exact: true }).click();
    await page.locator(".comparison-ghost").first().waitFor();
    await page.evaluate(() => (window as unknown as Harness).__IL__.sim.getState().ctl!.scrub(0.58));
    const lines = page.locator(".comparison-summary span");
    await expect(lines).toHaveCount(2);
    // the numbers the unit test measures: B recoils about as far but returns sooner
    await expect(lines.nth(0)).toHaveText("Recuo A 15 · B 14,86 mm");
    await expect(lines.nth(1)).toHaveText("Ciclo A 0,24 · B 0,17 s");
    for (const line of await lines.all()) {
      const box = await line.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      expect(box.scroll, "linha do resumo cortada").toBeLessThanOrEqual(box.client + 1);
    }
    // pt-BR everywhere in the panel: never a dot between digits
    const text = await page.getByRole("region", { name: "Instrumentos" }).innerText();
    expect(text).not.toMatch(/\d\.\d{1,2}(?!\d)/);
    expect(text).toMatch(/\d,\d/);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${DIR}/lancador-resumo-comparacao-${tag}.png` });
  });

  test(`torque da lingueta · ${tag}`, async ({ page }) => {
    const scene = await open(page, "roda-e-lingueta", viewport);
    await page.getByRole("button", { name: "Ver instrumentos", exact: true }).click();
    await play(page, "roda-e-lingueta", scene, 1.1);
    const chart = page.locator(".instrument-chart", { hasText: "Lingueta · torque" });
    await expect(chart).toHaveCount(1);
    // the pawl pushed by the ratchet reads a torque, not the old zero
    const peak = await chart.locator("small").first().innerText();
    expect(peak).toMatch(/(mín|pico) /);
    expect(peak).not.toMatch(/pico 0$/);
    await page.screenshot({ path: `${DIR}/roda-torque-lingueta-${tag}.png` });
  });

  test(`velocidade na saída e tiques agrupados · ${tag}`, async ({ page }) => {
    const scene = await open(page, "lancador-bancada", viewport);
    await page.getByRole("button", { name: "Ver instrumentos", exact: true }).click();
    await play(page, "lancador-bancada", scene, 0.58);
    const chart = page.locator(".instrument-chart", { hasText: "Esfera · velocidade" });
    await expect(chart.locator(".instrument-chart__at")).toHaveText("na saída 10,59 m/s");
    await expect(chart.locator("small").first()).toHaveText("pico 10,96");
    await page.screenshot({ path: `${DIR}/lancador-velocidade-saida-${tag}.png` });

    // the burst of events at ignition is one marker with a count; a tap opens the list
    const group = page.locator(".timeline__event--group").first();
    await expect(group).toBeVisible();
    const count = Number(await group.locator("text").textContent());
    expect(count).toBeGreaterThanOrEqual(4);
    await group.dispatchEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "touch" });
    const list = page.getByRole("menu", { name: "Eventos neste ponto" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("menuitem")).toHaveCount(count);
    const first = await list.getByRole("menuitem").first().innerText();
    expect(first).toMatch(/\d,\d{3} s/);
    await page.screenshot({ path: `${DIR}/lancador-tiques-agrupados-${tag}.png` });
    // choosing one moves the cursor to it and names it
    await list.getByRole("menuitem", { name: /Parede saiu do furo/ }).click();
    await expect(list).toBeHidden();
    await expect(page.locator(".timeline__event-name")).toHaveText("Parede saiu do furo");
    await expect(page.locator(".timeline__time")).toHaveText("t = 0,383 s");
  });
}

test("pinça no gráfico com toque emulado muda a janela do cursor", async ({ page }) => {
  const viewport = { width: 844, height: 390 };
  const scene = await open(page, "lancador-bancada", viewport);
  await page.getByRole("button", { name: "Ver instrumentos", exact: true }).click();
  await play(page, "lancador-bancada", scene, 0.58);
  const svg = page.locator(".instrument-chart svg").first();
  const span = async () => {
    const [a, b] = await svg.locator("text").allTextContents();
    const n = (t: string) => Number(t.replace(" s", "").replace(".", "").replace(",", "."));
    return n(b ?? "0") - n(a ?? "0");
  };
  const before = await span();
  const box = (await svg.boundingBox())!;
  const y = box.y + box.height / 2;
  const cx = box.x + box.width / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 30, y, id: 1 },
      { x: cx + 30, y, id: 2 },
    ],
  });
  for (let i = 1; i <= 6; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: cx - 30 - i * 10, y, id: 1 },
        { x: cx + 30 + i * 10, y, id: 2 },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  const zoomed = await span();
  expect(before).toBeCloseTo(0.5, 1);
  // fingers apart: the window narrows (more detail)
  expect(zoomed).toBeLessThan(before * 0.8);
  // and fingers together widen it again
  const cdp2 = await page.context().newCDPSession(page);
  await cdp2.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 90, y, id: 1 },
      { x: cx + 90, y, id: 2 },
    ],
  });
  for (let i = 1; i <= 6; i++)
    await cdp2.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: cx - 90 + i * 12, y, id: 1 },
        { x: cx + 90 - i * 12, y, id: 2 },
      ],
    });
  await cdp2.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp2.detach();
  expect(await span()).toBeGreaterThan(zoomed * 1.2);
});

test("medir não muda a simulação no Chromium: as peças ficam onde estariam sem nenhuma sonda", async ({
  page,
}) => {
  const scene = await open(page, "lancador-bancada", { width: 844, height: 390 });
  await page.getByRole("button", { name: "Ver instrumentos", exact: true }).click();
  const poses = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-part]"))
        .map(
          (el) =>
            `${el.getAttribute("data-part")}:${Array.from(el.children)
              .map((c) => c.getAttribute("transform") ?? "")
              .join(",")}`,
        )
        .join("|"),
    );
  const at = async (seconds: number) => {
    await page.evaluate((t) => (window as unknown as Harness).__IL__.sim.getState().ctl!.scrub(t), seconds);
    await page.waitForTimeout(100);
    return poses();
  };
  // the default Lançador instruments: 4 probes, one with an event reading
  await play(page, "lancador-bancada", scene, 0.58);
  await expect(page.locator(".instrument-chart")).toHaveCount(4);
  const measured = [await at(0.58), await at(1.7)];
  expect(measured[0]).toContain("p10:");
  // the same gesture with every probe removed
  await page.evaluate(() => (window as unknown as Harness).__IL__.ui.getState().setProbes([]));
  await play(page, "lancador-bancada", scene, 0.58);
  const bare = [await at(0.58), await at(1.7)];
  expect(measured).toEqual(bare);
  expect(measured[0]).not.toEqual(measured[1]);
});

test("folga com as camadas afastadas escolhe a peça da camada certa", async ({ page }) => {
  await open(page, "lancador-bancada", { width: 1440, height: 900 }, "edit");
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const ui = (window as unknown as Harness).__IL__.ui.getState();
    ui.setLook({ open: true, spread: true });
    ui.setGapTarget("p4");
  });
  await page.waitForTimeout(500);
  // the ball (layer 2) is drawn shifted by the spread: tap where it is drawn, not where it is in the world
  const ball = await page.locator('[data-part="p10"] .part__face').first().boundingBox();
  expect(ball).not.toBeNull();
  await page.mouse.click(ball!.x + ball!.width / 2, ball!.y + ball!.height / 2);
  const probes = await page.evaluate(() => (window as unknown as Harness).__IL__.ui.getState().probes);
  expect(probes).toEqual([expect.objectContaining({ target: "p4", quantity: "clearance", other: "p10" })]);
});
