import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { seededRandom, type Random } from "@/model/ids";
import { loadScene, validateScene } from "@/model/scene";
import type { Scene } from "@/model/types";
import { MATERIAL_IDS } from "@/model/materials";
import {
  addLayer,
  deleteLayer,
  deleteLink,
  deleteParts,
  dependentLinks,
  duplicatePart,
  insertPart,
  mirrorPart,
  moveLayer,
  movePart,
  renamePart,
  rotate90,
  scalePart,
  setFixed,
  setLayerFields,
  setLink,
  setMaterial,
  setPartFields,
  setPartLayer,
  setPose,
  type Command,
} from "./commands";
import { emptyHistory, push, redo, run, undo, HISTORY_LIMIT, type HistoryState } from "./history";
import { buildPart, GENERATORS, mirroredShape, regenerate } from "@/parts";

const hash = (s: Scene) => createHash("sha256").update(JSON.stringify(s)).digest("hex");

function example(id: string): Scene {
  const r = loadScene(JSON.parse(readFileSync(`scenes/examples/${id}.json`, "utf8")));
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join("; "));
  return r.scene;
}

const pick = <T>(rnd: Random, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

/** Uma edição aleatória, de qualquer tipo desta parte. */
function randomCommand(scene: Scene, rnd: Random): Command | null {
  const part = scene.parts.length ? pick(rnd, scene.parts) : null;
  const layer = pick(rnd, scene.layers);
  const k = Math.floor(rnd() * 19);
  switch (k) {
    case 0: {
      const g = pick(rnd, GENERATORS);
      const p = buildPart(scene, g.id, { x: rnd() * 100, y: rnd() * 60, layer: layer.id, random: rnd });
      return insertPart(scene, p);
    }
    case 1:
      return part && movePart(scene, part.id, part.x + rnd() * 20 - 10, part.y + rnd() * 20 - 10);
    case 2:
      return part && setPose(scene, part.id, { x: part.x, y: part.y, angle: rnd() * 6 - 3 });
    case 3:
      return part && rotate90(scene, part.id);
    case 4:
      return part && scalePart(scene, part.id, 0.8 + rnd() * 0.5, 0.8 + rnd() * 0.5);
    case 5: {
      if (!part?.source) return part && mirrorPart(scene, part.id);
      const g = GENERATORS.find((x) => x.id === part.source!.generator)!;
      const prm = g.params[0]!;
      const v = prm.min + rnd() * (prm.max - prm.min);
      return regenerate(scene, part.id, { [prm.key]: prm.integer ? Math.round(v) : v });
    }
    case 6:
      return part && deleteParts(scene, [part.id]);
    case 7:
      return scene.links.length ? deleteLink(scene, pick(rnd, scene.links).id) : null;
    case 8:
      return part && (duplicatePart(scene, part.id, { random: rnd })?.command ?? null);
    case 9:
      return part && mirrorPart(scene, part.id, mirroredShape(part));
    case 10:
      return part && setPartLayer(scene, [part.id], layer.id);
    case 11:
      return (
        addLayer(scene, { random: rnd, above: Math.floor(rnd() * scene.layers.length) })?.command ?? null
      );
    case 12:
      return setLayerFields(scene, layer.id, {
        name: `C${Math.floor(rnd() * 99)}`,
        visible: rnd() > 0.3,
        locked: rnd() > 0.7,
        thickness: 1 + Math.round(rnd() * 8),
      });
    case 13:
      return moveLayer(
        scene,
        Math.floor(rnd() * scene.layers.length),
        Math.floor(rnd() * scene.layers.length),
      );
    case 14:
      return deleteLayer(scene, layer.id);
    case 15:
      return part && setMaterial(scene, part.id, pick(rnd, MATERIAL_IDS));
    case 16:
      return part && setFixed(scene, part.id, !part.fixed);
    case 17:
      return (
        part &&
        (rnd() > 0.5
          ? renamePart(scene, part.id, `P${Math.floor(rnd() * 999)}`)
          : setPartFields(scene, part.id, { fast: !part.fast }))
      );
    case 18: {
      const l = scene.links.find((x) => x.kind === "axle" || x.kind === "spring");
      if (!l) return null;
      if (l.kind === "axle") return setLink(scene, l.id, { ...l, friction: Math.round(rnd() * 100) / 10 });
      if (l.kind === "spring") return setLink(scene, l.id, { ...l, k: Math.round(rnd() * 1000) / 1000 });
      return null;
    }
  }
  return null;
}

describe("desfazer e refazer", () => {
  for (const [id, seed] of [
    ["engrenagens", 1],
    ["cilindro-dois-pistoes", 2],
    ["trava", 3],
    ["lancador", 4],
    ["biela-manivela", 5],
  ] as const)
    it(`50 edições aleatórias em ${id}: desfeitas voltam ao início, refeitas chegam ao fim`, () => {
      const rnd = seededRandom(seed);
      const start = example(id);
      const h0 = hash(start);
      let scene = start;
      let h: HistoryState = emptyHistory();
      let applied = 0;
      for (let tries = 0; applied < 50 && tries < 2000; tries++) {
        const cmd = randomCommand(scene, rnd);
        if (!cmd) continue;
        const r = run(scene, cmd.label, cmd.recipe);
        if (!r) continue;
        scene = r.scene;
        h = push(h, r.entry);
        applied++;
        expect(cmd.label.length).toBeGreaterThan(3);
      }
      expect(applied).toBe(50);
      // toda edição deixa a cena válida pelo schema
      const v = validateScene(JSON.parse(JSON.stringify(scene)));
      expect(v.ok ? [] : v.issues).toEqual([]);
      const hEnd = hash(scene);
      for (let i = 0; i < 50; i++) {
        const r = undo(scene, h)!;
        scene = r.scene;
        h = r.history;
      }
      expect(undo(scene, h)).toBeNull();
      expect(hash(scene)).toBe(h0);
      for (let i = 0; i < 50; i++) {
        const r = redo(scene, h)!;
        scene = r.scene;
        h = r.history;
      }
      expect(redo(scene, h)).toBeNull();
      expect(hash(scene)).toBe(hEnd);
    });

  it("guarda no máximo 200 passos e limpa o refazer ao editar", () => {
    let scene = example("engrenagens");
    let h = emptyHistory();
    const id = scene.parts[1]!.id;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      const r = run(scene, "Mover", movePart(scene, id, i, i)!.recipe)!;
      scene = r.scene;
      h = push(h, r.entry);
    }
    expect(h.past.length).toBe(HISTORY_LIMIT);
    const u = undo(scene, h)!;
    expect(u.history.future.length).toBe(1);
    const r = run(u.scene, "Mover", movePart(u.scene, id, -5, -5)!.recipe)!;
    expect(push(u.history, r.entry).future).toEqual([]);
  });

  it("comando sem mudança não entra na pilha", () => {
    const scene = example("engrenagens");
    const p = scene.parts[0]!;
    expect(movePart(scene, p.id, p.x, p.y)).toBeNull();
    expect(run(scene, "nada", () => {})).toBeNull();
  });
});

describe("comandos", () => {
  it("excluir uma peça remove as ligações que ficariam sem referência e diz quantas", () => {
    const scene = example("engrenagens");
    const gear = scene.parts.find(
      (p) => scene.links.filter((l) => l.kind === "axle" && l.b === p.id).length,
    )!;
    const deps = dependentLinks(scene, new Set([gear.id]));
    expect(deps.size).toBeGreaterThan(0);
    const cmd = deleteParts(scene, [gear.id])!;
    expect(cmd.notice).toMatch(/^Excluída .+ e \d+ ligaç(ão|ões)$/);
    const next = run(scene, cmd.label, cmd.recipe)!.scene;
    expect(next.links.length).toBe(scene.links.length - deps.size);
    expect(validateScene(next).ok).toBe(true);
  });

  it("mudar de camada avisa quando um pino deixa de alcançar a peça", () => {
    const scene = example("trava");
    const pin = scene.links.find((l) => l.kind === "pin");
    if (!pin || pin.kind !== "pin") return;
    const top = scene.layers[scene.layers.length - 1]!;
    const a = scene.layers.findIndex((l) => l.id === pin.layers[0]);
    const b = scene.layers.findIndex((l) => l.id === pin.layers[1]);
    const outside = scene.layers.find((_, i) => i < Math.min(a, b) || i > Math.max(a, b)) ?? top;
    const cmd = setPartLayer(scene, [pin.host], outside.id);
    if (!cmd) return;
    expect(cmd.warning ?? "").toMatch(/não alcança mais a camada/);
  });

  it("dá nomes legíveis", () => {
    const scene = example("engrenagens");
    const p = scene.parts[1]!;
    expect(movePart(scene, p.id, 1, 2)!.label).toBe(`Mover ${p.name}`);
    const l = scene.links[0]!;
    expect(deleteLink(scene, l.id)!.label).toBe(`Excluir eixo ${l.ref}`);
  });
});
