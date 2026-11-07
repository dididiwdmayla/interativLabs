import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { EXPLAIN } from "@/editor/explain";
import { LINK_LABEL } from "@/editor/names";
import { useUiStore } from "@/editor/useUiStore";
import type { LinkKind } from "@/model/types";
import "./explain.css";

const coil = "M70 90h8l5-13 10 26 10-26 10 26 10-26 10 26 10-26 10 26 5-13h12";

/** Schematic ink diagrams: all motion belongs to transform/opacity groups. */
export function ExplainArt({ kind }: { kind: LinkKind }) {
  return (
    <svg
      className={`explain-art explain-art--${kind}`}
      viewBox="0 0 260 180"
      role="img"
      aria-label={`Como funciona: ${LINK_LABEL[kind]}`}
    >
      <path className="explain-art__datum" d="M20 140H240M130 22V155" />
      <text x="22" y="25" className="explain-art__fig">
        Fig. {Object.keys(EXPLAIN).indexOf(kind) + 1}
      </text>
      {kind === "axle" && (
        <>
          <path d="M110 140V90a20 20 0 0 1 40 0v50Z" />
          <g className="explain-art__rotate">
            <rect x="65" y="81" width="130" height="18" rx="9" />
            <path d="M75 86h110M75 94h110" />
          </g>
          <circle cx="130" cy="90" r="9" />
          <path d="M124 90h12M130 84v12" />
        </>
      )}
      {kind === "screw" && (
        <g className="explain-art__together">
          <rect x="65" y="70" width="130" height="24" rx="4" />
          <rect x="90" y="88" width="105" height="24" rx="4" />
          <circle cx="145" cy="91" r="12" />
          <path d="m137 99 16-16M100 103h26" />
        </g>
      )}
      {kind === "pin" && (
        <>
          <path d="m55 108 90 24 65-50-90-24ZM55 83l90 24 65-50-90-24" />
          <g className="explain-art__pin">
            <ellipse cx="130" cy="53" rx="10" ry="5" />
            <path d="M120 53v56q10 10 20 0V53M120 72q10 10 20 0" />
          </g>
        </>
      )}
      {(kind === "slider" || kind === "slot") && (
        <>
          <rect x="40" y="72" width="180" height="36" rx={kind === "slot" ? 18 : 0} />
          <path d="M49 78v24M211 78v24M40 114h180" />
          <g className="explain-art__slide">
            {kind === "slot" ? (
              <>
                <circle cx="65" cy="90" r="10" />
                <circle cx="65" cy="90" r="3" />
              </>
            ) : (
              <>
                <rect x="50" y="64" width="30" height="52" rx="2" />
                <path d="m55 108 20-32M55 93l15-24" />
              </>
            )}
          </g>
        </>
      )}
      {kind === "rod" && (
        <>
          <circle cx="65" cy="90" r="17" />
          <g className="explain-art__rod">
            <rect x="65" y="82" width="125" height="16" rx="8" />
            <circle cx="72" cy="90" r="4" />
            <circle cx="182" cy="90" r="4" />
          </g>
        </>
      )}
      {kind === "cable" && (
        <>
          <circle cx="55" cy="75" r="7" />
          <circle cx="205" cy="75" r="7" />
          <path className="explain-art__taut" d="M62 75H198" />
          <path className="explain-art__slack" d="M62 75Q130 170 198 75" />
        </>
      )}
      {kind === "mount" && (
        <>
          <path d="M60 130h140M80 125v-20m100 20v-20" />
          <g className="explain-art__mount">
            <rect x="75" y="75" width="110" height="24" />
            <path d="M85 105l10 10 10-10 10 10 10-10 10 10 10-10 10 10 10-10" />
          </g>
        </>
      )}
      {kind === "spring" && (
        <>
          <path d="M64 110V65M54 72l10-7M54 85l10-7M54 98l10-7" />
          <g className="explain-art__spring">
            <path d={coil} />
            <path d="M85 82l10 17m10-17 10 17m10-17 10 17m10-17 10 17" />
          </g>
          <g className="explain-art__seat">
            <path d="M180 65v45M180 90h30" />
          </g>
        </>
      )}
      {kind === "lock" && (
        <>
          <rect x="50" y="90" width="105" height="26" />
          <g className="explain-art__release">
            <rect x="145" y="90" width="70" height="26" />
          </g>
          <g className="explain-art__lock">
            <path d="M128 94V62h34v32h-10V72h-14v22Z" />
            <circle cx="133" cy="97" r="5" />
          </g>
        </>
      )}
      {kind === "chamber" && (
        <>
          <path d="M40 60H220M40 120H220" />
          <g className="explain-art__gas">
            <path d="M105 90h-20l8-6m-8 6 8 6M155 90h20l-8-6m8 6-8 6" />
            <circle cx="130" cy="78" r="2" />
            <circle cx="119" cy="105" r="2" />
            <circle cx="146" cy="101" r="2" />
          </g>
          <g className="explain-art__wall-a">
            <rect x="83" y="61" width="12" height="58" />
            <path d="M83 90H45" />
          </g>
          <g className="explain-art__wall-b">
            <rect x="165" y="61" width="12" height="58" />
            <path d="M177 90h38" />
          </g>
        </>
      )}
      {kind === "sensor" && (
        <>
          <circle className="explain-art__zone" cx="130" cy="90" r="34" />
          <circle cx="130" cy="90" r="7" />
          <g className="explain-art__detect">
            <circle cx="60" cy="90" r="10" />
          </g>
          <path className="explain-art__signal" d="m130 46 8-12-4 0 8-12" />
        </>
      )}
    </svg>
  );
}

export function ExplainCard() {
  const kind = useUiStore((s) => s.explain);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!kind) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      previous?.focus();
    };
  }, [kind]);
  if (!kind) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className="explain-card"
      onCancel={() => useUiStore.getState().setExplain(null)}
      aria-labelledby="explain-title"
    >
      <div className="explain-card__heading">
        <span>O que é</span>
        <button className="btn btn--outline" onClick={() => useUiStore.getState().setExplain(null)} autoFocus>
          Fechar
        </button>
      </div>
      <h2 id="explain-title">{LINK_LABEL[kind]}</h2>
      <ExplainArt kind={EXPLAIN[kind].animation} />
      <p>{EXPLAIN[kind].text}</p>
    </dialog>,
    document.body,
  );
}
