import { EXPLAIN } from "@/editor/explain";
import { useUiStore } from "@/editor/useUiStore";
import { ExplainArt } from "./ExplainArt";
import { Sheet } from "./Sheet";

/** Cartão "o que é" da ligação escolhida: a animação e até três frases. */
export function ExplainCard() {
  const kind = useUiStore((s) => s.explain);
  const close = useUiStore((s) => s.setExplain);
  if (!kind) return null;
  const e = EXPLAIN[kind];
  return (
    <Sheet title={`O que é: ${e.title}`} side="menu" className="sheet--explain" onClose={() => close(null)}>
      <div className="explain" data-kind={kind}>
        <ExplainArt kind={kind} />
        {e.text.map((t) => (
          <p key={t} className="explain__text">
            {t}
          </p>
        ))}
      </div>
    </Sheet>
  );
}
