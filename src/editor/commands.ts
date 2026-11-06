import { surfaces, linkLayer, surfaceAt } from "@/model/profiles";
import { projectedPart, removeSurface } from "./profileOps";
import type { Draft } from "immer";
import { createIdGenerator, nextRef, type Random } from "@/model/ids";
import { DEFAULT_THICKNESS_MM } from "@/model/units";
import type { MaterialId } from "@/model/materials";
import type { Layer, Link, Part, Scene, Shape, Vec2 } from "@/model/types";
import type { Recipe } from "./history";
import { LINK_LABEL, linkName, linkParts, partName, plural } from "./names";

/**
 * Comandos do editor: cada um olha a cena atual, decide o nome legível e
 * devolve a receita do Immer que faz a mudança (ou null quando não há o
 * que fazer). Toda edição da interface passa por aqui, para desfazer e
 * refazer cobrirem tudo: peças, ligações, propriedades e camadas.
 * Sem DOM: roda no Node (src/editor/commands.test.ts).
 */

export interface Command {
  label: string;
  recipe: Recipe;
  /** aviso depois de aplicar ("Excluída Barra 3 e 2 ligações") */
  notice?: string;
  /** aviso de alerta (brasa) */
  warning?: string;
}

const MATERIAL_NAME: Record<MaterialId, string> = {
  steel: "aço",
  aluminum: "alumínio",
  brass: "latão",
  polymer: "polímero",
  rubber: "borracha",
  wood: "madeira",
};

const findPart = (s: Scene | Draft<Scene>, id: string) => s.parts.find((p) => p.id === id);
const findLink = (s: Scene | Draft<Scene>, id: string) => s.links.find((l) => l.id === id);
const layerIdx = (s: Scene | Draft<Scene>, id: string) => s.layers.findIndex((l) => l.id === id);

/** "Barra 3" da cena (ou o id, se a peça não existir mais). */
function nameOf(scene: Scene, id: string): string {
  const p = findPart(scene, id);
  return p ? partName(p) : id;
}

// ——— ids ———

/** Gerador de ids que nunca colide com a cena. */
export function idsFor(scene: Scene, random?: Random) {
  return createIdGenerator(
    [
      ...scene.layers.map((l) => l.id),
      ...scene.parts.flatMap((p) => surfaces(p).map((s) => s.id)),
      ...scene.links.map((l) => l.id),
    ],
    random,
  );
}

// ——— pontos de ligação presos à peça (no espaço local dela) ———

type AnchorRef = { get(): Vec2; set(v: Vec2): void; dir?: { get(): number; set(v: number): void } };

/** Os pontos (e direções) de ligação guardados no espaço local da peça. */
function anchorsOf(d: Draft<Scene>, partId: string, layer?: string): AnchorRef[] {
  const out: AnchorRef[] = [];
  const ref = (o: { at: Vec2 }): AnchorRef => ({ get: () => o.at, set: (v) => (o.at = v) });
  for (const l of d.links) {
    const part = d.parts.find((p) => p.id === partId);
    if (layer && part && surfaceAt(part, linkLayer(d, l)).layer !== layer) continue;
    switch (l.kind) {
      case "screw":
      case "lock":
      case "axle":
      case "mount":
        if (l.b === partId) out.push(ref(l));
        break;
      case "slider":
        if (l.b === partId) out.push({ ...ref(l), dir: { get: () => l.dir, set: (v) => (l.dir = v) } });
        break;
      case "pin":
      case "sensor":
        if (l.host === partId) out.push(ref(l));
        break;
      case "rod":
      case "cable":
      case "spring":
        if (l.a === partId) out.push({ get: () => l.atA, set: (v) => (l.atA = v) });
        if (l.b === partId) out.push({ get: () => l.atB, set: (v) => (l.atB = v) });
        break;
      case "chamber":
        if (l.body === partId) out.push({ ...ref(l), dir: { get: () => l.dir, set: (v) => (l.dir = v) } });
        break;
      case "slot":
        break;
    }
  }
  return out;
}

/** Escala os pontos de ligação da peça junto com a forma (eixos locais). */
function scaleAnchors(d: Draft<Scene>, partId: string, sx: number, sy: number, layer?: string) {
  for (const a of anchorsOf(d, partId, layer)) {
    const [x, y] = a.get();
    a.set([x * sx, y * sy]);
  }
}

// ——— formas ———

const scaleRing = (r: Vec2[], sx: number, sy: number): Vec2[] => r.map(([x, y]) => [x * sx, y * sy]);

/** Forma escalada nos eixos locais (círculo e engrenagem só uniforme: média dos dois). */
export function scaleShape(shape: Shape, sx: number, sy: number): Shape {
  switch (shape.kind) {
    case "poly": {
      const flip = sx * sy < 0;
      const ring = (r: Vec2[]) => (flip ? scaleRing(r, sx, sy).reverse() : scaleRing(r, sx, sy));
      return { kind: "poly", outer: ring(shape.outer), holes: shape.holes.map(ring) };
    }
    case "circle": {
      const k = (Math.abs(sx) + Math.abs(sy)) / 2;
      return { kind: "circle", r: shape.r * k, holes: shape.holes.map((h) => scaleRing(h, k, k)) };
    }
    case "gear": {
      const k = (Math.abs(sx) + Math.abs(sy)) / 2;
      return { ...shape, module: shape.module * k, bore: shape.bore * k };
    }
  }
}

/** Forma espelhada no eixo y local (x → −x). */
export function mirrorShape(shape: Shape): Shape {
  switch (shape.kind) {
    case "poly":
      return scaleShape(shape, -1, 1);
    case "circle":
      return { ...shape, holes: shape.holes.map((h) => scaleRing(h, -1, 1).reverse()) };
    case "gear":
      // evolvente é simétrica; a catraca espelhada não cabe na forma de engrenagem
      return shape;
  }
}

// ——— peças ———

export function insertPart(_scene: Scene, part: Part): Command {
  return {
    label: `Inserir ${partName(part)}`,
    recipe: (d) => {
      d.parts.push(part as Draft<Part>);
    },
  };
}

export function movePart(scene: Scene, id: string, x: number, y: number): Command | null {
  const p = findPart(scene, id);
  if (!p || (p.x === x && p.y === y)) return null;
  return {
    label: `Mover ${partName(p)}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (q) {
        q.x = x;
        q.y = y;
      }
    },
  };
}

/** Pose inteira (girar em volta de um ponto muda x, y e ângulo). */
export function setPose(
  scene: Scene,
  id: string,
  pose: { x: number; y: number; angle: number },
  verb = "Girar",
): Command | null {
  const p = findPart(scene, id);
  if (!p || (p.x === pose.x && p.y === pose.y && p.angle === pose.angle)) return null;
  return {
    label: `${verb} ${partName(p)}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (q) Object.assign(q, pose);
    },
  };
}

export function rotate90(scene: Scene, id: string): Command | null {
  const p = findPart(scene, id);
  if (!p) return null;
  let a = p.angle + Math.PI / 2;
  if (a > Math.PI) a -= 2 * Math.PI;
  return setPose(scene, id, { x: p.x, y: p.y, angle: a }, "Girar 90°");
}

export function renamePart(scene: Scene, id: string, name: string): Command | null {
  const p = findPart(scene, id);
  if (!p || p.name === name) return null;
  return {
    label: `Renomear ${partName(p)}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (q) q.name = name;
    },
  };
}

export function setMaterial(scene: Scene, id: string, material: MaterialId, layer?: string): Command | null {
  const owner = findPart(scene, id);
  const p = owner && projectedPart(owner, layer);
  if (!p || p.material === material) return null;
  return {
    label: `Trocar ${partName(p)} para ${MATERIAL_NAME[material]}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (q) (q.profiles?.find((s) => s.layer === layer) ?? q).material = material;
    },
  };
}

export function setFixed(scene: Scene, id: string, fixed: boolean): Command | null {
  const p = findPart(scene, id);
  if (!p || p.fixed === fixed) return null;
  return {
    label: `${fixed ? "Fixar" : "Soltar"} ${partName(p)}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (q) q.fixed = fixed;
    },
  };
}

/** Campos simples da peça (detalhes): posição, ângulo, número de chamada, detecção contínua. */
export function setPartFields(
  scene: Scene,
  id: string,
  fields: Partial<Pick<Part, "x" | "y" | "angle" | "ref" | "fast">>,
): Command | null {
  const p = findPart(scene, id);
  if (!p) return null;
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter((k) => fields[k] !== p[k]);
  if (changed.length === 0) return null;
  return {
    label: `Editar ${partName(p)}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (q) for (const k of changed) (q as Record<string, unknown>)[k] = fields[k];
    },
  };
}

/** Troca a forma (e os parâmetros da peça paramétrica), escalando os pontos de ligação. */
export function setShape(
  scene: Scene,
  id: string,
  shape: Shape,
  opts: {
    params?: Record<string, number | string>;
    anchorScale?: [number, number];
    verb?: string;
    layer?: string;
  } = {},
): Command | null {
  const p = findPart(scene, id);
  if (!p) return null;
  return {
    label: `${opts.verb ?? "Esticar"} ${partName(p)}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (!q) return;
      const surface = q.profiles?.find((p) => p.layer === opts.layer) ?? q;
      surface.shape = shape as Draft<Shape>;
      if (opts.params && surface.source) surface.source.params = { ...opts.params };
      if (opts.anchorScale) scaleAnchors(d, id, opts.anchorScale[0], opts.anchorScale[1], opts.layer);
    },
  };
}

/** Escala uniforme ou por eixo de uma peça não paramétrica. */
export function scalePart(scene: Scene, id: string, sx: number, sy: number, layer?: string): Command | null {
  const owner = findPart(scene, id);
  const p = owner && projectedPart(owner, layer);
  if (!p || (sx === 1 && sy === 1) || !(sx > 0) || !(sy > 0)) return null;
  const uniform = p.shape.kind !== "poly";
  const kx = uniform ? (sx + sy) / 2 : sx;
  const ky = uniform ? (sx + sy) / 2 : sy;
  return setShape(scene, id, scaleShape(p.shape, kx, ky), { anchorScale: [kx, ky], layer });
}

/**
 * Espelha a peça no eixo y local. Peça paramétrica guarda `mirror` nos
 * parâmetros (o gerador refaz a forma espelhada); a forma vem de quem chama.
 */
export function mirrorPart(scene: Scene, id: string, shape?: Shape, layer?: string): Command | null {
  const owner = findPart(scene, id);
  const p = owner && projectedPart(owner, layer);
  if (!p) return null;
  const next = shape ?? mirrorShape(p.shape);
  return {
    label: `Espelhar ${partName(p)}`,
    recipe: (d) => {
      const q = findPart(d, id);
      if (!q) return;
      const surface = q.profiles?.find((s) => s.layer === layer) ?? q;
      surface.shape = next as Draft<Shape>;
      if (surface.source)
        surface.source.params = {
          ...surface.source.params,
          mirror: surface.source.params.mirror === 1 ? 0 : 1,
        };
      for (const a of anchorsOf(d, id, layer)) {
        const [x, y] = a.get();
        a.set([-x, y]);
        if (a.dir) a.dir.set(Math.PI - a.dir.get());
      }
    },
  };
}

export function duplicatePart(
  scene: Scene,
  id: string,
  opts: { random?: Random; offset?: number; name?: string } = {},
): { command: Command; newId: string } | null {
  const p = findPart(scene, id);
  if (!p) return null;
  const ids = idsFor(scene, opts.random);
  const newId = ids.next("part");
  const off = opts.offset ?? 6;
  const copy: Part = {
    ...structuredClone(p),
    id: newId,
    ref: nextRef(scene),
    name: opts.name ?? `${partName(p)} (cópia)`,
    x: p.x + off,
    y: p.y + off,
  };
  if (copy.profiles) for (const s of copy.profiles) s.id = ids.next("part");
  return {
    newId,
    command: {
      label: `Duplicar ${partName(p)}`,
      recipe: (d) => {
        d.parts.push(copy as Draft<Part>);
      },
    },
  };
}

/**
 * Ligações que ficariam sem referência ao remover estas peças e ligações:
 * as que tocam uma peça removida e os rasgos cujo pino sai.
 */
export function dependentLinks(
  scene: Scene,
  partIds: Set<string>,
  linkIds: Set<string> = new Set(),
): Set<string> {
  const out = new Set(linkIds);
  for (const l of scene.links)
    if (linkParts(l).some((id) => id !== null && partIds.has(id) && !(l.kind === "spring" && l.guide === id)))
      out.add(l.id);
  for (let changed = true; changed;) {
    changed = false;
    for (const l of scene.links)
      if (!out.has(l.id) && l.kind === "slot" && out.has(l.pin)) {
        out.add(l.id);
        changed = true;
      }
  }
  return out;
}

/** Remove peças e ligações, limpando o que apontava para elas (guia da mola, ações, portas). */
function removeAll(d: Draft<Scene>, parts: Set<string>, links: Set<string>) {
  d.parts = d.parts.filter((p) => !parts.has(p.id));
  d.links = d.links.filter((l) => !links.has(l.id));
  for (const l of d.links) {
    if (l.kind === "spring" && l.guide !== undefined && parts.has(l.guide)) delete l.guide;
    if (l.kind === "sensor") l.actions = l.actions.filter((a) => !links.has(a.target));
    if (l.kind === "chamber") l.ports = l.ports.filter((p) => !links.has(p.to));
  }
}

export function deleteParts(scene: Scene, ids: string[]): Command | null {
  const set = new Set(ids.filter((id) => findPart(scene, id)));
  if (set.size === 0) return null;
  const links = dependentLinks(scene, set);
  const first = nameOf(scene, [...set][0] ?? "");
  const what = set.size === 1 ? first : plural(set.size, "peça", "peças");
  const tail = links.size ? ` e ${plural(links.size, "ligação", "ligações")}` : "";
  return {
    label: `Excluir ${what}`,
    notice: `Excluída ${what}${tail}`,
    recipe: (d) => removeAll(d, set, links),
  };
}

// ——— ligações ———

export function deleteLink(scene: Scene, id: string): Command | null {
  const l = findLink(scene, id);
  if (!l) return null;
  const links = dependentLinks(scene, new Set(), new Set([id]));
  const extra = links.size - 1;
  return {
    label: `Excluir ${linkName(l)}`,
    notice: `Excluído ${linkName(l)}${extra ? ` e ${plural(extra, "ligação", "ligações")}` : ""}`,
    recipe: (d) => removeAll(d, new Set(), links),
  };
}

/** Type changes remove release actions whose target is no longer a lock. */
export function linksWithReplacement(scene: Scene, next: Link): Link[] {
  return scene.links.map((l) => {
    if (l.id === next.id) return next;
    if (
      l.kind === "sensor" &&
      next.kind !== "lock" &&
      l.actions.some((a) => a.do === "release" && a.target === next.id)
    )
      return { ...l, actions: l.actions.filter((a) => !(a.do === "release" && a.target === next.id)) };
    return l;
  });
}

/** Troca a ligação inteira (formulário de detalhes, já validado). */
export function setLink(scene: Scene, id: string, next: Link): Command | null {
  const l = findLink(scene, id);
  if (!l || JSON.stringify(l) === JSON.stringify(next)) return null;
  const replacements = linksWithReplacement(scene, next);
  const changedActions = scene.links.some(
    (link, i) => link.id !== next.id && link.kind === "sensor" && replacements[i] !== link,
  );
  return {
    label: `Editar ${linkName(l)}`,
    notice: changedActions
      ? "As ações de soltar foram retiradas porque a fixação deixou de ser trava"
      : undefined,
    recipe: (d) => {
      for (let i = 0; i < replacements.length; i++)
        if (replacements[i] !== scene.links[i]) d.links[i] = replacements[i] as Draft<Link>;
    },
  };
}

// ——— camadas ———

/** Pinos e sensores que não alcançam mais a camada da peça hospedeira depois da mudança. */
function pinWarnings(scene: Scene): string[] {
  const out: string[] = [];
  for (const l of scene.links) {
    if (l.kind !== "pin" && l.kind !== "sensor") continue;
    const host = findPart(scene, l.host);
    if (!host) continue;
    const a = layerIdx(scene, l.layers[0]);
    const b = layerIdx(scene, l.layers[1]);
    const h = layerIdx(scene, host.layer);
    if (h < Math.min(a, b) || h > Math.max(a, b))
      out.push(`O ${linkName(l)} não alcança mais a camada ${h + 1}`);
  }
  for (const l of scene.links) {
    if (l.kind !== "slot") continue;
    const pin = findLink(scene, l.pin);
    const guide = findPart(scene, l.guide);
    if (!pin || pin.kind !== "pin" || !guide) continue;
    const a = layerIdx(scene, pin.layers[0]);
    const b = layerIdx(scene, pin.layers[1]);
    const g = layerIdx(scene, guide.profiles?.find((s) => s.id === l.profile)?.layer ?? guide.layer);
    if (g < Math.min(a, b) || g > Math.max(a, b))
      out.push(`O ${linkName(pin)} não alcança mais a camada ${g + 1}`);
  }
  return out;
}

/** Simula a receita para saber os avisos (sem tocar na cena). */
function warningsAfter(scene: Scene, recipe: Recipe): string | undefined {
  const draft = structuredClone(scene) as Draft<Scene>;
  recipe(draft);
  const before = new Set(pinWarnings(scene));
  const w = pinWarnings(draft as Scene).filter((x) => !before.has(x));
  return w.length ? w.join(" · ") : undefined;
}

export function partLayerReason(scene: Scene, id: string, delta: number): string | undefined {
  const p = findPart(scene, id);
  if (!p) return "Peça ausente";
  if (
    surfaces(p).some((s) => {
      const i = layerIdx(scene, s.layer) + delta;
      return i < 0 || i >= scene.layers.length;
    })
  )
    return "Um perfil sairia da pilha de camadas";
  return undefined;
}

export function setPartLayer(scene: Scene, ids: string[], layerId: string): Command | null {
  const li = layerIdx(scene, layerId);
  const moving = ids.filter((id) => {
    const p = findPart(scene, id);
    return p && p.layer !== layerId;
  });
  if (li < 0 || moving.length === 0) return null;
  const L = scene.layers[li];
  if (
    !L ||
    moving.some((id) => partLayerReason(scene, id, li - layerIdx(scene, findPart(scene, id)?.layer ?? "")))
  )
    return null;
  const what = moving.length === 1 ? nameOf(scene, moving[0] ?? "") : plural(moving.length, "peça", "peças");
  const recipe: Recipe = (d) => {
    for (const id of moving) {
      const q = findPart(d, id);
      if (q) {
        const delta = li - layerIdx(scene, q.layer);
        for (const s of q.profiles ?? []) {
          const layer = scene.layers[layerIdx(scene, s.layer) + delta];
          if (layer) s.layer = layer.id;
        }
        q.layer = layerId;
      }
    }
  };
  return {
    label: `Mudar ${what} para a camada ${li + 1}`,
    notice: `${what} na camada ${li + 1} · ${L.name}`,
    warning: warningsAfter(scene, recipe),
    recipe,
  };
}

/** Camada nova logo acima de `above` (índice), ou no topo. */
export function addLayer(
  scene: Scene,
  opts: { name?: string; above?: number; random?: Random } = {},
): { command: Command; id: string } | null {
  if (scene.layers.length >= 16) return null;
  const id = idsFor(scene, opts.random).next("layer");
  const at = Math.min(scene.layers.length, (opts.above ?? scene.layers.length - 1) + 1);
  const layer: Layer = {
    id,
    name: opts.name ?? `Camada ${scene.layers.length + 1}`,
    visible: true,
    locked: false,
    thickness: DEFAULT_THICKNESS_MM,
  };
  return {
    id,
    command: {
      label: `Nova camada ${layer.name}`,
      recipe: (d) => {
        d.layers.splice(at, 0, layer);
      },
    },
  };
}

export function setLayerFields(
  scene: Scene,
  id: string,
  fields: Partial<Pick<Layer, "name" | "visible" | "locked" | "thickness">>,
): Command | null {
  const i = layerIdx(scene, id);
  const L = scene.layers[i];
  if (!L) return null;
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter((k) => fields[k] !== L[k]);
  if (changed.length === 0) return null;
  const verb =
    changed[0] === "name"
      ? "Renomear"
      : changed[0] === "visible"
        ? fields.visible
          ? "Mostrar"
          : "Ocultar"
        : changed[0] === "locked"
          ? fields.locked
            ? "Travar"
            : "Destravar"
          : "Espessura da";
  return {
    label: `${verb} camada ${L.name}`,
    recipe: (d) => {
      const q = d.layers[i];
      if (q) for (const k of changed) (q as Record<string, unknown>)[k] = fields[k];
    },
  };
}

/** Move a camada do índice `from` para o índice `to` (0 = fundo). */
export function moveLayer(scene: Scene, from: number, to: number): Command | null {
  const n = scene.layers.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return null;
  const L = scene.layers[from];
  if (!L) return null;
  const recipe: Recipe = (d) => {
    const [x] = d.layers.splice(from, 1);
    if (x) d.layers.splice(to, 0, x);
  };
  return {
    label: `Mover camada ${L.name} para a posição ${to + 1}`,
    warning: warningsAfter(scene, recipe),
    recipe,
  };
}

export function deleteLayer(scene: Scene, id: string): Command | null {
  const i = layerIdx(scene, id);
  if (i < 0 || scene.layers.length <= 1) return null;
  const L = scene.layers[i];
  if (!L) return null;
  const parts = new Set(scene.parts.filter((p) => p.layer === id && !p.profiles?.length).map((p) => p.id));
  const links = dependentLinks(scene, parts);
  // pinos e sensores com a faixa presa nesta camada: a ponta passa para a vizinha dentro da faixa
  const order = scene.layers.map((l) => l.id);
  const fixRange = (range: [string, string], hostLayer: string): [string, string] => {
    const a = order.indexOf(range[0]);
    const b = order.indexOf(range[1]);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const rest = order.slice(lo, hi + 1).filter((x) => x !== id);
    if (rest.length === 0) return [hostLayer, hostLayer];
    return [rest[0] ?? hostLayer, rest[rest.length - 1] ?? hostLayer];
  };
  const tail = parts.size ? ` e ${plural(parts.size, "peça", "peças")}` : "";
  return {
    label: `Excluir camada ${L.name}`,
    notice: `Excluída a camada ${L.name}${tail}${links.size ? ` (${plural(links.size, "ligação", "ligações")})` : ""}`,
    recipe: (d) => {
      removeAll(d, parts, links);
      for (const p of d.parts) if (surfaces(p).some((s) => s.layer === id)) removeSurface(d, p.id, id);
      for (const l of d.links)
        if ((l.kind === "pin" || l.kind === "sensor") && l.layers.includes(id)) {
          const host = findPart(d, l.host);
          l.layers = fixRange(l.layers as [string, string], host?.layer ?? order[0] ?? id);
        }
      d.layers.splice(i, 1);
    },
  };
}

export { LINK_LABEL };
