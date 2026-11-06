import { mkdirSync, writeFileSync } from "node:fs";
import type { Vec2 } from "@/geometry/vec";
import type { MaterialId } from "@/model/materials";
import { serializeScene, validateScene } from "@/model/scene";
import type { Link, Part, Scene, Shape } from "@/model/types";
import type { FixtureScript } from "@/sim/script";

/** Construtor de cenas v2 para as cenas de teste e os exemplos (determinístico). */

export const NOW = "2026-11-04T00:00:00.000Z";
export const G = 9810;

/** Número com vírgula decimal, para as notas. */
export const br = (v: number, d = 4) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");

/** Arredonda para 4 casas (arquivos estáveis e legíveis). */
export const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;

type LinkInput = Link extends infer L ? (L extends Link ? Omit<L, "id" | "ref"> : never) : never;

export class Builder {
  scene: Scene;
  private ref = 0;
  private n = 0;
  constructor(title: string, gravity = G) {
    this.scene = {
      version: 3,
      meta: { title, createdAt: NOW, updatedAt: NOW },
      settings: { gravity: { on: gravity > 0, g: gravity > 0 ? gravity : G }, snap: { grid: 1, on: true } },
      layers: [],
      parts: [],
      links: [],
    };
  }
  layer(name: string, thickness = 3): string {
    const id = `L${this.scene.layers.length + 1}`;
    this.scene.layers.push({ id, name, visible: true, locked: false, thickness });
    return id;
  }
  part(p: {
    name: string;
    layer: string;
    x: number;
    y: number;
    angle?: number;
    material: MaterialId;
    fixed?: boolean;
    fast?: boolean;
    shape: Shape;
  }): Part {
    const part: Part = {
      id: `p${++this.n}`,
      ref: ++this.ref,
      name: p.name,
      layer: p.layer,
      x: r4(p.x),
      y: r4(p.y),
      angle: r4(p.angle ?? 0),
      shape: p.shape,
      material: p.material,
      fixed: p.fixed ?? false,
      fast: p.fast ?? false,
    };
    this.scene.parts.push(part);
    return part;
  }
  rect(
    name: string,
    layer: string,
    x: number,
    y: number,
    w: number,
    h: number,
    material: MaterialId,
    opts: { fixed?: boolean; angle?: number; holes?: Vec2[][] } = {},
  ) {
    const outer: Vec2[] = [
      [r4(-w / 2), r4(-h / 2)],
      [r4(w / 2), r4(-h / 2)],
      [r4(w / 2), r4(h / 2)],
      [r4(-w / 2), r4(h / 2)],
    ];
    return this.part({
      name,
      layer,
      x,
      y,
      material,
      fixed: opts.fixed ?? false,
      ...(opts.angle !== undefined ? { angle: opts.angle } : {}),
      shape: {
        kind: "poly",
        outer,
        holes: (opts.holes ?? []).map((h) => h.map(([a, b]) => [r4(a), r4(b)] as Vec2)),
      },
    });
  }
  poly(
    name: string,
    layer: string,
    x: number,
    y: number,
    outer: Vec2[],
    material: MaterialId,
    opts: { fixed?: boolean; holes?: Vec2[][] } = {},
  ) {
    return this.part({
      name,
      layer,
      x,
      y,
      material,
      fixed: opts.fixed ?? false,
      shape: {
        kind: "poly",
        outer: outer.map(([a, b]) => [r4(a), r4(b)] as Vec2),
        holes: (opts.holes ?? []).map((h) => h.map(([a, b]) => [r4(a), r4(b)] as Vec2)),
      },
    });
  }
  circle(
    name: string,
    layer: string,
    x: number,
    y: number,
    r: number,
    material: MaterialId,
    opts: { fixed?: boolean; fast?: boolean } = {},
  ) {
    return this.part({
      name,
      layer,
      x,
      y,
      material,
      fixed: opts.fixed ?? false,
      fast: opts.fast ?? false,
      shape: { kind: "circle", r, holes: [] },
    });
  }
  link<L extends LinkInput>(l: L): L & { id: string; ref: number } {
    const link = { id: `k${++this.n}`, ref: ++this.ref, ...l } as unknown as Link;
    this.scene.links.push(link);
    return link as unknown as L & { id: string; ref: number };
  }
}

export function validated(name: string, scene: Scene): Scene {
  const v = validateScene(scene);
  if (!v.ok) throw new Error(`${name}: ${JSON.stringify(v.issues)}`);
  return v.scene;
}

/** Grava a cena e o roteiro em scenes/fixtures/<grupo>/. */
export function writeFixture(
  group: string,
  name: string,
  scene: Scene,
  script: Omit<FixtureScript, "scene" | "group" | "id">,
): void {
  const dir = `scenes/fixtures/${group}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.scene.json`, serializeScene(validated(name, scene)) + "\n");
  const full: FixtureScript = { id: `${group}/${name}`, group, ...script, scene: `${name}.scene.json` };
  writeFileSync(`${dir}/${name}.test.json`, JSON.stringify(full, null, 2) + "\n");
  console.log(`${group}/${name}: ${scene.parts.length} peças, ${scene.links.length} ligações`);
}

/** Exemplo: a cena vai para scenes/examples/ e o roteiro para scenes/fixtures/exemplos/. */
export function writeExample(
  name: string,
  scene: Scene,
  script: Omit<FixtureScript, "scene" | "group" | "id">,
): void {
  mkdirSync("scenes/examples", { recursive: true });
  mkdirSync("scenes/fixtures/exemplos", { recursive: true });
  writeFileSync(`scenes/examples/${name}.json`, serializeScene(validated(name, scene)) + "\n");
  const full: FixtureScript = {
    id: `exemplos/${name}`,
    group: "exemplos",
    ...script,
    scene: `../../examples/${name}.json`,
  };
  writeFileSync(`scenes/fixtures/exemplos/${name}.test.json`, JSON.stringify(full, null, 2) + "\n");
  console.log(`exemplos/${name}: ${scene.parts.length} peças, ${scene.links.length} ligações`);
}
