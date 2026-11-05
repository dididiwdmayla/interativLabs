import { useId } from "react";
import { assets } from "@/assets/registry";
import { MATERIAL_IDS, MATERIALS, type MaterialId } from "@/model/materials";
import { HATCHES } from "@/render/hatch";

/** As seis hachuras como amostras (o material é a hachura, nunca a cor). */
export function Swatches({ value, onPick }: { value: MaterialId; onPick: (m: MaterialId) => void }) {
  const uid = useId().replace(/:/g, "");
  const wood = assets["hatch-wood"];
  const woodSrc = wood.tints.find((t) => t.token === "ink-2")?.src ?? wood.src;
  return (
    <div className="swatches" role="radiogroup" aria-label="Material">
      {MATERIAL_IDS.map((m) => {
        const h = m === "wood" ? null : HATCHES[m];
        const pid = `${uid}${m}`;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            className="swatch"
            onClick={() => onPick(m)}
          >
            <svg className="swatch__art" width="40" height="28" viewBox="0 0 40 28" aria-hidden="true">
              <defs>
                {h ? (
                  <pattern
                    id={pid}
                    patternUnits="userSpaceOnUse"
                    width={h.w}
                    height={h.h}
                    patternTransform={h.angled ? "rotate(45)" : undefined}
                  >
                    {h.lines.map((l, i) => (
                      <path key={i} d={l.d} className="hatch" strokeWidth={l.w} strokeDasharray={l.dash} />
                    ))}
                  </pattern>
                ) : (
                  <pattern id={pid} patternUnits="userSpaceOnUse" width="64" height="64">
                    <image href={woodSrc.x1} width="64" height="64" preserveAspectRatio="none" />
                  </pattern>
                )}
              </defs>
              <rect x="1" y="1" width="38" height="26" className="swatch__face" />
              <rect x="1" y="1" width="38" height="26" fill={`url(#${pid})`} />
              <rect x="1" y="1" width="38" height="26" className="swatch__edge" />
            </svg>
            <span className="swatch__name">{MATERIALS[m].label}</span>
          </button>
        );
      })}
    </div>
  );
}
