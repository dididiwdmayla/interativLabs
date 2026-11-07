import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { insertLink } from "@/editor/hammerDrag";
import { fitAction, leftyAction, xrayAction } from "@/ui/actions";
import { useUiStore } from "@/editor/useUiStore";
import { loadScene } from "@/model/scene";
import type { Link, Scene } from "@/model/types";
import { sound, type SfxChoice } from "./index";
import type { Engine } from "./engine";
import { commitSound } from "./tools";

/** Um motor que só anota o que o app pediu. */
function spyEngine() {
  const plays: SfxChoice[] = [];
  const engine: Engine = {
    play: (c: SfxChoice) => void plays.push(c),
    setVent() {},
    setPrefs() {},
    setHidden() {},
    debug: () => null as never,
    dispose() {},
  };
  return { engine, plays };
}

const scene = (): Scene => {
  const r = loadScene(JSON.parse(readFileSync("scenes/examples/lancador-bancada.json", "utf8")));
  if (!r.ok) throw new Error("cena inválida");
  return r.scene;
};

const linkOf = (kind: Link["kind"], n: number): Link =>
  ({ id: `new-${n}`, ref: 900 + n, kind }) as unknown as Link;

let spy: ReturnType<typeof spyEngine>;
beforeEach(() => {
  spy = spyEngine();
  sound._use(spy.engine);
  useUiStore.getState().openScene("t", scene(), 1);
  spy.plays.length = 0;
});
afterEach(() => sound._use(null));

describe("som das ferramentas (ligado ao comando registrado)", () => {
  it.each([
    ["screw", "sfx-stamp"],
    ["lock", "sfx-stamp"],
    ["axle", "sfx-stamp-soft"],
    ["pin", "sfx-stamp-soft"],
    ["spring", "sfx-link"],
    ["rod", "sfx-link"],
    ["cable", "sfx-link"],
  ] as const)("cravar %s dispara %s uma vez", (kind, id) => {
    useUiStore.getState().commit(insertLink(linkOf(kind, 1)));
    expect(spy.plays).toEqual([id]);
  });

  it("ligações que não estão na tabela ficam em silêncio", () => {
    for (const kind of ["slider", "slot", "mount", "chamber", "sensor"] as const) {
      useUiStore.getState().commit(insertLink(linkOf(kind, 2)));
    }
    expect(spy.plays).toEqual([]);
  });

  it("desfazer e refazer não tocam", () => {
    const ui = useUiStore.getState();
    ui.commit(insertLink(linkOf("screw", 3)));
    spy.plays.length = 0;
    useUiStore.getState().undo();
    useUiStore.getState().redo();
    expect(spy.plays).toEqual([]);
  });

  it("um comando que não cria ligação não toca (renomear, mover, excluir)", () => {
    const s = scene();
    const a = commitSound(s, { ...s, links: s.links.slice(1) });
    expect(a).toBeNull();
    expect(commitSound(s, s)).toBeNull();
    // duplicar (uma peça nova) não carimba, mesmo com ligações novas
    expect(
      commitSound(
        { ...s, links: [] },
        { ...s, links: [linkOf("screw", 4)], parts: s.parts.concat(s.parts[0]!) },
      ),
    ).toBeNull();
  });

  it("alternar Montar/Testar toca sfx-mode a cada troca, e só quando o modo muda", () => {
    const ui = useUiStore.getState();
    ui.setMode("edit");
    expect(spy.plays).toEqual([]);
    for (let i = 0; i < 10; i++) useUiStore.getState().toggleMode();
    expect(spy.plays).toEqual(Array(10).fill("sfx-mode"));
  });

  it("abrir faixa de ferramenta ou cartão toca sfx-ui; trocar de ferramenta dentro da faixa, não", () => {
    const ui = () => useUiStore.getState();
    ui().setHammer("axle");
    expect(spy.plays).toEqual(["sfx-ui"]);
    ui().setHammer("pin");
    expect(spy.plays).toEqual(["sfx-ui"]);
    ui().setHammer(null);
    ui().setPencil(true);
    ui().setPencil(false);
    ui().setLook({ open: true });
    ui().setLook({ open: false });
    ui().setSoundBar(true);
    ui().setSoundBar(false);
    ui().setSheet("card");
    ui().setSheet("card");
    expect(spy.plays).toEqual(Array(5).fill("sfx-ui"));
  });

  it("navegação, menus e vista não tocam", () => {
    const ui = () => useUiStore.getState();
    ui().setEdgeMenu({ side: "left", cy: 100, hover: null });
    ui().setEdgeMenu(null);
    ui().select({ kind: "part", id: scene().parts[0]!.id });
    ui().setActiveLayer(0);
    ui().setXray(true);
    ui().setTrail(true);
    ui().setLefty(true);
    ui().setHint(false);
    ui().setSheet("main");
    ui().setSheet("layers");
    ui().setSheet(null);
    xrayAction();
    leftyAction();
    fitAction();
    expect(spy.plays).toEqual([]);
  });

  it("o menu Vista traz o item Som e as faixas se excluem", () => {
    const ui = () => useUiStore.getState();
    ui().setSoundBar(true);
    expect(ui().soundBar).toBe(true);
    ui().setHammer("axle");
    expect(ui().soundBar).toBe(false);
    ui().setSoundBar(true);
    expect(ui().hammer).toBeNull();
    ui().setLook({ open: true });
    expect(ui().soundBar).toBe(false);
  });
});
