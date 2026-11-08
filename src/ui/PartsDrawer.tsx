import { useMemo, useRef, useState } from "react";
import { run } from "@/editor/history";
import { buildInsertion } from "@/parts/insert";
import { useUiStore } from "@/editor/useUiStore";
import type { Scene } from "@/model/types";
import { GENERATORS, buildPart, type Generator } from "@/parts";
import { prepareScene } from "@/render/prepare";
import { thumbnailSvg } from "@/render/thumbnail";
import { Sheet } from "./Sheet";
import { stageApi } from "./stageApi";

/**
 * Gaveta de peças prontas (docs/arquitetura.md §6, "Inserir e conectar").
 * Cada peça aparece como miniatura gravada pelo renderizador. Arrastar da
 * gaveta para a prancha leva um fantasma com o encaixe ativo; ao soltar, a
 * peça entra na camada ativa (um comando só), já escolhida. Tocar sem
 * arrastar põe a peça no centro da vista.
 */

const DRAG_PX = 6;

/** Cena de uma peça só, para a miniatura. */
function sample(g: Generator): Scene {
  const layer = { id: "L", name: "", visible: true, locked: false, thickness: 3 };
  const base: Scene = {
    version: 4,
    meta: { title: g.name, createdAt: "", updatedAt: "" },
    settings: { gravity: { on: true, g: 9810 }, snap: { grid: 1, on: false } },
    layers: [layer],
    parts: [],
    links: [],
  };
  const three = { ...base, layers: [layer, { ...layer, id: "L2" }, { ...layer, id: "L3" }] };
  if (g.id === "capsule") {
    // a cápsula aparece com a esfera presa na boca
    const ins = buildInsertion(three, g.id, { x: 0, y: 0, layer: "L2" });
    const sc = ins && run(three, ins.command.label, ins.command.recipe)?.scene;
    if (sc)
      return {
        ...base,
        layers: [layer, { ...layer, id: "L3" }],
        parts: sc.parts.map((p) => ({ ...p, layer: "L" })),
      };
  }
  const part = buildPart(three, g.id, { x: 0, y: 0, layer: "L2" });
  return { ...base, layers: [layer, { ...layer, id: "L3" }], parts: [{ ...part, layer: "L" }] };
}

function Tile({
  g,
  onPlace,
}: {
  g: Generator;
  onPlace: (g: Generator, at: { x: number; y: number } | null) => void;
}) {
  const svg = useMemo(() => {
    const m = prepareScene(sample(g));
    return thumbnailSvg(m, { width: 72, height: 52, pad: 6, uid: `g${g.id}` });
  }, [g]);
  const drag = useRef<{ x0: number; y0: number; on: boolean; id: number } | null>(null);
  /** fim do último arrasto (o clique que vem depois não insere de novo) */
  const dragged = useRef(0);
  const setAway = useUiStore((s) => s.setDrawerAway);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    drag.current = { x0: e.clientX, y0: e.clientY, on: false, id: e.pointerId };
    const shape = buildPart(sample(g), g.id, { x: 0, y: 0, layer: "L" }).shape;
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || ev.pointerId !== d.id) return;
      if (!d.on && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) > DRAG_PX) {
        d.on = true;
        setAway(true);
      }
      if (d.on) {
        ev.preventDefault();
        stageApi.get()?.insertPreview(shape, ev.clientX, ev.clientY);
      }
    };
    const up = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || ev.pointerId !== d.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      drag.current = null;
      const api = stageApi.get();
      if (!d.on) return; // toque: o clique põe no centro
      dragged.current = ev.timeStamp;
      const pose =
        ev.type === "pointerup" ? (api?.insertPreview(shape, ev.clientX, ev.clientY) ?? null) : null;
      api?.insertPreview(null);
      setAway(false);
      if (pose) onPlace(g, pose);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <li>
      <button
        type="button"
        className="tile"
        aria-label={`${g.name}: ${g.blurb}. Toque para pôr no centro ou arraste para a prancha`}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          if (e.timeStamp - dragged.current > 400) onPlace(g, null);
        }}
      >
        <span className="tile__art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="tile__name">{g.name}</span>
      </button>
    </li>
  );
}

export function PartsDrawer() {
  const away = useUiStore((s) => s.drawerAway);
  const [error, setError] = useState<string | null>(null);
  const place = (g: Generator, at: { x: number; y: number } | null) => {
    const ui = useUiStore.getState();
    const scene = ui.current?.scene;
    const L = scene?.layers[ui.activeLayer];
    if (!scene || !L) return;
    const c = at ?? stageApi.get()?.center() ?? [0, 0];
    const xy = Array.isArray(c) ? { x: c[0], y: c[1] } : c;
    const grid = scene.settings.snap;
    const snap = (v: number) => (at || !grid.on ? v : Math.round(v / grid.grid) * grid.grid);
    const insertion = buildInsertion(scene, g.id, { x: snap(xy.x), y: snap(xy.y), layer: L.id });
    if (!insertion) {
      setError("Não cabe outra camada na pilha (máximo 16)");
      return;
    }
    if (ui.commit(insertion.command, { selection: { kind: "part", id: insertion.id } })) {
      const part = useUiStore.getState().current?.scene.parts.find((p) => p.id === insertion.id);
      if (!part) return;
      ui.setSheet(null);
      ui.notify(
        L.locked
          ? `${part.name} entrou na camada ${ui.activeLayer + 1}, que está travada`
          : `${part.name} na camada ${ui.activeLayer + 1} · ${L.name}${part.fixed ? " (fixa: é o fundo)" : ""}`,
        { warn: L.locked },
      );
      setError(null);
    } else setError("Não deu para inserir a peça");
  };
  return (
    <Sheet title="Peças prontas" side="tools" className={`sheet--drawer${away ? " is-away" : ""}`}>
      <p className="sheet__lede">
        Arraste para a prancha ou toque para pôr no centro. Entra na camada ativa.
      </p>
      <ul className="tiles">
        {GENERATORS.filter((g) => !g.category).map((g) => (
          <Tile key={g.id} g={g} onPlace={place} />
        ))}
      </ul>
      <h3 className="sheet__group">Ciclo</h3>
      <p className="sheet__lede">
        Cápsula com a esfera presa, extrator que já entra cravado e ejetor fixo. Gás didático, proporções
        inventadas.
      </p>
      <ul className="tiles" aria-label="Ciclo">
        {GENERATORS.filter((g) => g.category === "ciclo").map((g) => (
          <Tile key={g.id} g={g} onPlace={place} />
        ))}
      </ul>
      {error && <p className="menu__error">{error}</p>}
    </Sheet>
  );
}
