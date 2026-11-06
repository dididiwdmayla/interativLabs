import { useEffect, useState } from "react";
import { useUiStore, type Selection } from "@/editor/useUiStore";
import type { SceneModel } from "@/render/prepare";
import { Sheet } from "../Sheet";
import { stageApi } from "../stageApi";
import { LinkCard } from "./LinkCard";
import { PartCard } from "./PartCard";

/** O cartão da seleção (peça ou ligação), ou null sem seleção. */
export function CardBody({ model }: { model: SceneModel }) {
  const sel = useUiStore((s) => s.selection);
  const layer = useUiStore((s) => s.activeLayer);
  if (sel?.kind === "part") {
    const m =
      model.partList.find((m) => m.part.id === sel.id && m.layer === layer) ?? model.parts.get(sel.id);
    return m ? <PartCard key={m.part.id} model={model} m={m} /> : null;
  }
  if (sel?.kind === "link") {
    const lm = model.linkById.get(sel.id);
    return lm ? <LinkCard key={lm.link.id} model={model} lm={lm} /> : null;
  }
  return null;
}

/**
 * Cartão rápido em folha lateral (celular e tablet). Não fecha ao tocar na
 * prancha: tocar em outra peça troca o cartão; tocar no fundo limpa a
 * seleção e fecha.
 */
export function CardSheet({ model }: { model: SceneModel }) {
  const sel = useUiStore((s) => s.selection);
  if (!sel) return null;
  return <CardSheetFor key={sel.id} model={model} sel={sel} />;
}

function CardSheetFor({ model, sel }: { model: SceneModel; sel: NonNullable<Selection> }) {
  // o cartão abre do lado oposto ao da seleção, para a peça continuar à vista
  // (decidido ao escolher; não pula de lado enquanto a peça anda)
  const [place] = useState<"left" | "right" | undefined>(() => {
    const at = sel.kind === "part" ? model.parts.get(sel.id)?.part : model.linkById.get(sel.id)?.world;
    const api = stageApi.get();
    if (!at || !api) return undefined;
    const p = api.worldToClient(Array.isArray(at) ? at : [at.x, at.y]);
    return p[0] > window.innerWidth / 2 ? "left" : "right";
  });
  // em retrato o cartão é a folha de baixo: a vista sobe a peça para a parte livre da prancha
  useEffect(() => {
    if (!window.matchMedia("(orientation: portrait) and (max-width: 700px)").matches) return;
    const at = sel.kind === "part" ? model.parts.get(sel.id)?.part : model.linkById.get(sel.id)?.world;
    const api = stageApi.get();
    if (!at || !api) return;
    const p = api.worldToClient(Array.isArray(at) ? at : [at.x, at.y]);
    const free = window.innerHeight * 0.38;
    if (p[1] > free - 40) api.panBy(0, free * 0.55 - p[1]);
    // só ao abrir o cartão desta seleção
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Sheet
      title={sel.kind === "link" ? "Ligação" : "Peça"}
      side="tools"
      modal={false}
      className="sheet--card"
      place={place}
    >
      <CardBody model={model} />
    </Sheet>
  );
}
