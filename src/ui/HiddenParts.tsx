import { useUiStore } from "@/editor/useUiStore";
import { localBox } from "@/editor/handles";
import type { SceneModel } from "@/render/prepare";

export function HiddenParts({ model }: { model: SceneModel | null }) {
  const ui = useUiStore();
  const parts = model?.partList.filter((m) => !m.profile && ui.hiddenParts.includes(m.part.id)) ?? [];
  if (!parts.length) return null;
  return (
    <div className="hidden-parts">
      <button className="pill" aria-expanded={ui.hiddenList} onClick={() => ui.setHiddenList(!ui.hiddenList)}>
        {parts.length} escondidas
      </button>
      {ui.hiddenList && (
        <section className="hidden-parts__list" aria-label="Peças escondidas">
          <h3>Peças escondidas</h3>
          <p>Toque para trazer de volta</p>
          {parts.map((m) => {
            const b = localBox(m);
            return (
              <button key={m.part.id} className="hidden-parts__row" onClick={() => ui.showPart(m.part.id)}>
                <svg
                  viewBox={`${b.x0 - 2} ${b.y0 - 2} ${b.x1 - b.x0 + 4} ${b.y1 - b.y0 + 4}`}
                  aria-hidden="true"
                >
                  <path d={m.d} fillRule="evenodd" />
                </svg>
                <span>{m.part.name || `Peça ${m.part.ref}`}</span>
              </button>
            );
          })}
          <button className="btn btn--outline" onClick={() => ui.showPart()}>
            Mostrar todas
          </button>
          <button className="btn btn--outline" onClick={() => ui.setHiddenList(false)}>
            Fechar
          </button>
        </section>
      )}
    </div>
  );
}
