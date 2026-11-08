import { addLayer, insertPart, type Command } from "@/editor/commands";
import { run } from "@/editor/history";
import type { Scene } from "@/model/types";
import type { Draft } from "immer";
import { idsFor } from "@/editor/commands";
import { nextPartName } from "@/editor/names";
import { nextRef } from "@/model/ids";
import type { Link, Part } from "@/model/types";
import { capsuleGeometry } from "./capsule";
import { EXTRACTOR_AXLE, buildPart, capsuleParams, generator, paramsOf, type BuildOptions } from ".";

/** Compound presets create their missing upper layer in the same undo step. */
export function buildInsertion(
  scene: Scene,
  id: string,
  options: BuildOptions,
): { command: Command; id: string } | null {
  let working = scene;
  const g = generator(id),
    index = scene.layers.findIndex((l) => l.id === options.layer);
  const extra =
    g?.compound && !scene.layers[index + 1]
      ? addLayer(scene, { above: index, random: options.random })
      : null;
  if (g?.compound && !scene.layers[index + 1] && !extra) return null;
  if (extra) working = run(scene, extra.command.label, extra.command.recipe)!.scene;
  const part = buildPart(working, id, options),
    insert = insertPart(working, part);
  const extras = cycleExtras(working, part, options);
  return {
    id: part.id,
    command: {
      label: insert.label,
      recipe: (d) => {
        extra?.command.recipe(d);
        insert.recipe(d);
        extras(d);
      },
    },
  };
}

/**
 * Peças do ciclo que entram com companhia: a cápsula traz a esfera presa na
 * boca; o extrator já vem cravado (eixo com mola de torção) na peça embaixo do
 * furo dele, ou no fundo.
 */
function cycleExtras(scene: Scene, part: Part, o: BuildOptions): (d: Draft<Scene>) => void {
  const g = paramsOf(part);
  if (g?.g.id === "capsule" && part.capsule) {
    const geo = capsuleGeometry(capsuleParams(g.params));
    const ids = idsFor({ ...scene, parts: [...scene.parts, part] }, o.random);
    const ball: Part = {
      id: ids.next("part"),
      ref: nextRef({ ...scene, parts: [...scene.parts, part] }),
      name: nextPartName(scene, "Esfera"),
      layer: part.layer,
      x: part.x + geo.ball.at[0],
      y: part.y + geo.ball.at[1],
      angle: 0,
      shape: { kind: "circle", r: geo.ball.r, holes: [] },
      material: "steel",
      fixed: false,
      fast: true,
    };
    part.capsule.projectile = ball.id;
    return (d) => {
      d.parts.push(ball as Draft<Part>);
    };
  }
  if (g?.g.id === "extractor") {
    const li = scene.layers.findIndex((l) => l.id === part.layer);
    // a peça mais alta embaixo do eixo, na camada do extrator ou nas de baixo (o ferrolho)
    const under = [...scene.parts].reverse().find((p) => {
      const pi = scene.layers.findIndex((l) => l.id === p.layer);
      if (pi < 0 || pi > li || p.id === part.id) return false;
      const dx = part.x - p.x;
      const dy = part.y - p.y;
      const c = Math.cos(-p.angle);
      const n = Math.sin(-p.angle);
      const lx = dx * c - dy * n;
      const ly = dx * n + dy * c;
      const s = p.shape;
      if (s.kind === "circle") return lx * lx + ly * ly <= s.r * s.r;
      if (s.kind === "gear") return lx * lx + ly * ly <= ((s.module * s.teeth) / 2) ** 2;
      let inside = false;
      for (let i = 0, j = s.outer.length - 1; i < s.outer.length; j = i++) {
        const a = s.outer[j]!;
        const b = s.outer[i]!;
        if (a[1] > ly !== b[1] > ly && lx < ((b[0] - a[0]) * (ly - a[1])) / (b[1] - a[1]) + a[0])
          inside = !inside;
      }
      return inside;
    });
    const withPart = { ...scene, parts: [...scene.parts, part] };
    const ids = idsFor(withPart, o.random);
    const axle: Link = {
      id: ids.next("link"),
      ref: nextRef(withPart),
      kind: "axle",
      a: under?.id ?? null,
      b: part.id,
      at: [0, 0],
      torsion: { ...EXTRACTOR_AXLE.torsion },
      limit: { ...EXTRACTOR_AXLE.limit },
    };
    return (d) => {
      d.links.push(axle as Draft<Link>);
    };
  }
  return () => {};
}
