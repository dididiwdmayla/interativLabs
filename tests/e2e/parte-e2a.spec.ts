import { expect, test, type CDPSession, type Page } from "@playwright/test";

/**
 * Fase 1 · Parte E2a: o editor tátil só com toque emulado, em paisagem
 * (844×390). Os dedos vão pelo CDP (Input.dispatchTouchEvent), que gera os
 * eventos de toque e de ponteiro do Chromium, com vários dedos ao mesmo
 * tempo. Rodar: npx playwright test --project=e2a
 */

interface Pt {
  x: number;
  y: number;
  id?: number;
}

interface SceneLike {
  layers: { id: string; name: string }[];
  parts: {
    id: string;
    name: string;
    layer: string;
    fixed: boolean;
    x: number;
    y: number;
    source?: { params: Record<string, number> };
  }[];
  links: unknown[];
}

interface Hooks {
  ui: {
    getState(): {
      current: { id: string; scene: SceneLike } | null;
      history: { past: { label: string }[]; future: unknown[] };
      edgeMenu: { side: string } | null;
      sheet: string | null;
      selection: { kind: string; id: string } | null;
      activeLayer: number;
      notice: { text: string } | null;
    };
  };
  projects: { newProject(kind: "default" | "blank"): Promise<void>; flushAutosave(): Promise<void> };
}

const st = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __IL__: Hooks }).__IL__.ui.getState();
    return {
      scene: s.current ? JSON.stringify(s.current.scene) : "",
      parts: s.current?.scene.parts ?? [],
      layers: s.current?.scene.layers ?? [],
      id: s.current?.id ?? "",
      past: s.history.past.map((e) => e.label),
      future: s.history.future.length,
      edgeMenu: s.edgeMenu,
      sheet: s.sheet,
      selection: s.selection,
      active: s.activeLayer,
      notice: s.notice?.text ?? null,
    };
  });

class Fingers {
  constructor(private cdp: CDPSession) {}
  private pts = (p: Pt[]) => p.map((q, i) => ({ x: q.x, y: q.y, id: q.id ?? i }));
  start(p: Pt[]) {
    return this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: this.pts(p) });
  }
  move(p: Pt[]) {
    return this.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: this.pts(p) });
  }
  end(rest: Pt[] = []) {
    return this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: this.pts(rest) });
  }
  /** um dedo arrastando de a até b em n passos */
  async drag(a: Pt, b: Pt, n = 10, holdMs = 0) {
    await this.start([a]);
    for (let i = 1; i <= n; i++)
      await this.move([{ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }]);
    if (holdMs) await new Promise((r) => setTimeout(r, holdMs));
    await this.end();
    // o reconhecedor de gestos do Chromium descarta um toque logo depois de um arrasto emulado
    await new Promise((r) => setTimeout(r, 400));
  }
  /** toque curto com vários dedos parados */
  async tapMany(n: number, at: Pt) {
    const p = Array.from({ length: n }, (_, i) => ({ x: at.x + i * 60, y: at.y, id: 10 + i }));
    await this.start(p);
    await new Promise((r) => setTimeout(r, 60));
    await this.end();
    await new Promise((r) => setTimeout(r, 350));
  }
}

async function blankProject(page: Page) {
  await page.evaluate(() => (window as unknown as { __IL__: Hooks }).__IL__.projects.newProject("blank"));
  await page.waitForTimeout(300);
}

async function center(page: Page, sel: string) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`sem ${sel}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test.describe("editor tátil em 844×390", () => {
  let f: Fingers;
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".stage__sheet--defs").first().waitFor({ state: "attached" });
    f = new Fingers(await page.context().newCDPSession(page));
    await blankProject(page);
  });

  test("o menu de borda abre segurando 1 s e não abre com 0,6 s", async ({ page }) => {
    await f.drag({ x: 420, y: 200 }, { x: 800, y: 200 }, 8, 600);
    expect((await st(page)).edgeMenu).toBeNull();
    await f.drag({ x: 420, y: 200 }, { x: 800, y: 200 }, 8, 1150);
    expect((await st(page)).edgeMenu?.side).toBe("right");
    // a vista voltou para onde estava
    await page.screenshot({ path: "test-results/e2a-menu-direita.png" });
  });

  test("escolha por deslizar e soltar", async ({ page }) => {
    await f.start([{ x: 420, y: 200 }]);
    for (let i = 1; i <= 8; i++) await f.move([{ x: 420 + (380 * i) / 8, y: 200 }]);
    await page.waitForTimeout(1150);
    expect((await st(page)).edgeMenu?.side).toBe("right");
    const item = await center(page, '.edgemenu__item:has-text("Peças prontas")');
    for (let i = 1; i <= 6; i++)
      await f.move([{ x: 800 + ((item.x - 800) * i) / 6, y: 200 + ((item.y - 200) * i) / 6 }]);
    await page.waitForTimeout(50);
    await expect(page.locator('.edgemenu__item[data-hover="true"]')).toHaveCount(1);
    await f.end();
    const s = await st(page);
    expect(s.edgeMenu).toBeNull();
    expect(s.sheet).toBe("drawer");
  });

  test("roteiro: placa na camada 1, barra na 2, troca de camada, esticar, desfazer e refazer tudo", async ({
    page,
  }) => {
    const s0 = await st(page);
    expect(s0.layers.map((l) => l.name)).toEqual(["Fundo", "Meio", "Frente"]);
    const initial = s0.scene;

    // camada 1 ativa pela pílula e pela pilha
    await page.tap(".pill");
    await page.tap('.lrow__pick[aria-label^="Ativar a camada 1"]');
    expect((await st(page)).active).toBe(0);
    await page.tap(".sheet .sheet__close");

    // gaveta pela aba da direita; arrasta a placa para a prancha
    await page.tap('.edgetab[aria-label="Menu Inserir"]');
    await page.tap('.edgemenu__item:has-text("Peças prontas")');
    const plate = await center(page, '.tile:has-text("Placa")');
    await f.drag(plate, { x: 330, y: 210 }, 14);
    await page.waitForTimeout(150);
    let s = await st(page);
    expect(s.parts.length).toBe(1);
    expect(s.parts[0]).toMatchObject({ name: "Placa 1", layer: s.layers[0]!.id, fixed: true });
    expect(s.past).toEqual(["Inserir Placa 1"]);
    expect(s.selection?.id).toBe(s.parts[0]!.id);
    const afterPlate = s.scene;

    // camada 2 e a barra
    await page.tap(".pill");

    await page.tap('.lrow__pick[aria-label^="Ativar a camada 2"]');
    await page.tap(".sheet .sheet__close");
    await page.tap('.edgetab[aria-label="Menu Inserir"]');
    await page.tap('.edgemenu__item:has-text("Peças prontas")');
    const bar = await center(page, '.tile:has-text("Barra")');
    await f.drag(bar, { x: 520, y: 150 }, 14);
    await page.waitForTimeout(150);
    s = await st(page);
    expect(s.parts.length).toBe(2);
    const barPart = s.parts[1]!;
    expect(barPart).toMatchObject({ name: "Barra 1", layer: s.layers[1]!.id, fixed: false });
    expect(s.past).toEqual(["Inserir Placa 1", "Inserir Barra 1"]);
    const afterBar = s.scene;

    // muda a barra de camada pelo cartão (botão da peça → Subir)
    await page.tap(".partbtn");
    await expect(page.locator(".sheet--card")).toBeVisible();
    await page.tap('.card__layer:has-text("Subir")');
    s = await st(page);
    expect(s.parts[1]!.layer).toBe(s.layers[2]!.id);
    expect(s.active).toBe(2);
    expect(s.past.at(-1)).toBe("Mudar Barra 1 para a camada 3");
    await page.tap(".sheet .sheet__close");

    // estica a barra pela alça do comprimento
    const l0 = barPart.source!.params.l!;
    const dot = await center(page, ".handles__dot");
    await f.drag(dot, { x: dot.x + 60, y: dot.y }, 10);
    await page.waitForTimeout(150);
    s = await st(page);
    expect(s.parts[1]!.source!.params.l!).toBeGreaterThan(l0 + 10);
    expect(s.past.at(-1)).toBe("Esticar Barra 1");
    const final = s.scene;
    const steps = s.past.length;
    expect(steps).toBe(4);

    // desfaz tudo com dois dedos, conferindo cada passo
    const backs = [afterBar, afterPlate, initial];
    await f.tapMany(2, { x: 200, y: 320 });
    await f.tapMany(2, { x: 200, y: 320 });
    expect((await st(page)).scene).toBe(afterBar);
    expect((await st(page)).notice).toMatch(/^Desfeito: /);
    await f.tapMany(2, { x: 200, y: 320 });
    expect((await st(page)).scene).toBe(backs[1]);
    await f.tapMany(2, { x: 200, y: 320 });
    s = await st(page);
    expect(s.scene).toBe(initial);
    expect(s.future).toBe(4);

    // refaz tudo com três dedos
    for (let i = 0; i < 4; i++) await f.tapMany(3, { x: 200, y: 320 });
    s = await st(page);
    expect(s.scene).toBe(final);
    expect(s.future).toBe(0);
  });

  test("desfazer com dois dedos", async ({ page }) => {
    await page.tap('.edgetab[aria-label="Menu Inserir"]');
    await page.tap('.edgemenu__item:has-text("Peças prontas")');
    await page.tap('.tile:has-text("Disco")');
    expect((await st(page)).parts.length).toBe(1);
    await f.tapMany(2, { x: 150, y: 300 });
    const s = await st(page);
    expect(s.parts.length).toBe(0);
    expect(s.notice).toBe("Desfeito: inserir Disco 1");
  });

  test("o projeto sobrevive a recarregar, com a pilha de desfazer da sessão", async ({ page }) => {
    await page.tap('.edgetab[aria-label="Menu Inserir"]');
    await page.tap('.edgemenu__item:has-text("Peças prontas")');
    await page.tap('.tile:has-text("Bloco")');
    await page.waitForTimeout(800);
    const before = await st(page);
    await page.reload();
    await page.locator(".stage__sheet--defs").first().waitFor({ state: "attached" });
    await page.waitForTimeout(500);
    const after = await st(page);
    expect(after.id).toBe(before.id);
    // a cena é a mesma (só a data de alteração do salvamento muda)
    expect(after.parts).toEqual(before.parts);
    expect(after.layers).toEqual(before.layers);
    expect(after.past).toEqual(["Inserir Bloco 1"]);
  });
});
