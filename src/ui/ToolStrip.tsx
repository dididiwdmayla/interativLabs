import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import "./toolstrip.css";

/**
 * Faixa das ferramentas da mão (Martelo e Lápis; docs/arquitetura.md §6,
 * decidido em 07/11): presa à borda de baixo da prancha, entre o grupo do
 * desfazer e a pílula da camada (acima deles quando não cabe), uma linha de
 * ferramentas de até 56 px e a frase numa linha fina logo acima. Nunca no
 * meio da prancha, e abrir ou fechar a faixa não mexe na vista.
 *
 * Estilo da prancha: filete duplo como a moldura, rótulos em versalete,
 * ícones no traço da identidade, ouro só na ferramenta ativa. Quando não
 * cabe tudo, os grupos viram um seletor compacto na ponta da faixa
 * (`select`) ou cada grupo vira um botão que alterna (`cycle`); por último,
 * os rótulos saem e ficam os ícones.
 */

export interface StripItem {
  id: string;
  label: string;
  icon?: IconName;
  /** texto no lugar do ícone (larguras do traço) */
  glyph?: string;
  pressed?: boolean;
  disabled?: boolean;
  /** alerta (brasa): "vai sair" */
  warn?: boolean;
  /** nome completo para leitores de tela e o `title` (o rótulo visível fica curto) */
  hint?: string;
  onClick: () => void;
}

export interface StripGroup {
  name: string;
  items: StripItem[];
}

/** px: botão com rótulo, só ícone, separador, seletor, bordas e folga */
const W_LABEL = 56;
const W_ICON = 44;
const W_SEP = 9;
const W_SELECTOR = 50;
const W_PAD = 8;
const W_TEXT = 92;
const GAP = 8;

type Tier = "full" | "label" | "icon";

function widthOf(groups: StripGroup[], mode: "select" | "cycle", tier: Tier, current: number): number {
  if (tier === "full")
    return groups.reduce((s, g) => s + g.items.length * W_LABEL, 0) + (groups.length - 1) * W_SEP + W_PAD;
  const w = tier === "label" ? W_LABEL : W_ICON;
  if (mode === "cycle") return groups.length * w + (groups.length - 1) * W_SEP + W_PAD;
  return (groups[current]?.items.length ?? 0) * w + W_SELECTOR + W_SEP + W_PAD;
}

interface Slot {
  left: number;
  /** começo do espaço livre (a frase usa todo ele) */
  room: number;
  width: number;
  /** distância da borda de baixo do palco, px */
  bottom: number;
  above: boolean;
}

/**
 * Espaço entre os cantos de cima (faixa presa à borda de cima: no Testar, a
 * de baixo é da simulação). `bottom` aqui é a distância da borda de cima.
 */
function measureTop(el: HTMLElement): { avail: Slot; full: Slot } | null {
  const stage = el.closest(".stage");
  const bench = el.closest(".workbench");
  if (!stage || !bench) return null;
  const s = stage.getBoundingClientRect();
  const mid = s.left + s.width / 2;
  const frame = parseFloat(getComputedStyle(el).getPropertyValue("--strip-edge")) || 8;
  let left = s.left + 2 * frame;
  let right = s.right - 2 * frame;
  let cornerBottom = s.top;
  for (const c of bench.querySelectorAll<HTMLElement>(".corner--tl > *, .corner--tr > *")) {
    const r = c.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    cornerBottom = Math.max(cornerBottom, r.bottom);
    if (r.left + r.width / 2 < mid) left = Math.max(left, r.right + GAP);
    else right = Math.min(right, r.left - GAP);
  }
  return {
    avail: { left: left - s.left, room: left - s.left, width: right - left, bottom: frame, above: false },
    full: {
      left: 2 * frame,
      room: 2 * frame,
      width: s.width - 4 * frame,
      bottom: cornerBottom - s.top + GAP,
      above: true,
    },
  };
}

/** Espaço entre os cantos de baixo, medido no palco (px relativos a ele). */
function measure(el: HTMLElement): { avail: Slot; full: Slot } | null {
  const stage = el.closest(".stage");
  const bench = el.closest(".workbench");
  if (!stage || !bench) return null;
  const s = stage.getBoundingClientRect();
  const mid = s.left + s.width / 2;
  const frame = parseFloat(getComputedStyle(el).getPropertyValue("--strip-edge")) || 8;
  let left = s.left + 2 * frame;
  let right = s.right - 2 * frame;
  let cornerTop = s.bottom;
  // no Testar, a faixa da simulação ocupa a borda de baixo: a faixa sobe para cima dela
  for (const c of bench.querySelectorAll<HTMLElement>(".corner--bl > *, .corner--br > *, .testbar > *")) {
    const r = c.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    cornerTop = Math.min(cornerTop, r.top);
    if (r.left + r.width / 2 < mid) left = Math.max(left, r.right + GAP);
    else right = Math.min(right, r.left - GAP);
  }
  return {
    avail: { left: left - s.left, room: left - s.left, width: right - left, bottom: frame, above: false },
    full: {
      left: 2 * frame,
      room: 2 * frame,
      width: s.width - 4 * frame,
      bottom: s.bottom - cornerTop + GAP,
      above: true,
    },
  };
}

export function ToolStrip({
  label,
  groups,
  mode,
  actions,
  phrase,
  popover,
  edge = "bottom",
}: {
  /** borda onde a faixa fica presa (no Testar, a de cima: a de baixo é da simulação) */
  edge?: "bottom" | "top";
  label: string;
  groups: StripGroup[];
  mode: "select" | "cycle";
  /** botões que tomam o lugar das ferramentas (escolher ação, trocar lado) */
  actions?: StripItem[];
  phrase?: string;
  /** painel pequeno acima da frase (detalhes) */
  popover?: ReactNode;
}) {
  const uid = useId();
  const ref = useRef<HTMLElement>(null);
  const pressedGroup = groups.findIndex((g) => g.items.some((i) => i.pressed));
  const [chosen, setChosen] = useState<number | null>(null);
  const current = chosen ?? Math.max(0, pressedGroup);
  const [slot, setSlot] = useState<{ slot: Slot; tier: Tier } | null>(null);

  const need = (tier: Tier) =>
    actions?.length ? actions.length * W_TEXT + W_PAD : widthOf(groups, mode, tier, current);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const m = edge === "top" ? measureTop(el) : measure(el);
      if (!m) return;
      const tiers: Tier[] = ["full", "label", "icon"];
      for (const where of [m.avail, m.full]) {
        const tier = tiers.find((t) => need(t) <= where.width);
        if (tier) {
          const w = Math.min(where.width, need(tier));
          // centrada no palco quando cabe; senão, encostada no espaço livre
          const stage = el.closest(".stage")?.getBoundingClientRect();
          const centre = stage ? stage.width / 2 - w / 2 : where.left;
          const left = Math.round(Math.max(where.left, Math.min(where.left + where.width - w, centre)));
          setSlot((prev) => {
            const next = { slot: { ...where, left }, tier };
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
          });
          return;
        }
      }
      setSlot({ slot: { ...m.full }, tier: "icon" });
    };
    place();
    const ro = new ResizeObserver(place);
    const bench = el.closest(".workbench");
    if (bench) {
      ro.observe(bench);
      for (const c of bench.querySelectorAll(".corner--bl, .corner--br, .testbar")) ro.observe(c);
    }
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  });

  const tier = slot?.tier ?? "icon";
  const button = (it: StripItem, withLabel: boolean, key?: string) => (
    <button
      type="button"
      key={key ?? it.id}
      className={`toolstrip__tool${it.warn ? " is-warn" : ""}`}
      aria-pressed={it.pressed}
      aria-label={withLabel && !it.hint ? undefined : (it.hint ?? it.label)}
      title={it.hint ?? it.label}
      disabled={it.disabled}
      onClick={it.onClick}
      data-tool={it.id}
    >
      {it.icon ? (
        <Icon name={it.icon} uid={`${uid}${key ?? it.id}`} size={20} />
      ) : (
        <span className="toolstrip__glyph">{it.glyph}</span>
      )}
      {withLabel && <span className="toolstrip__label">{it.label}</span>}
    </button>
  );

  let row: ReactNode;
  if (actions?.length) {
    row = (
      <div className="toolstrip__group toolstrip__group--actions">
        {actions.map((a) => (
          <button
            type="button"
            key={a.id}
            className={`toolstrip__action${a.warn ? " is-warn" : ""}`}
            aria-pressed={a.pressed}
            disabled={a.disabled}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </div>
    );
  } else if (tier === "full") {
    row = groups.map((g, gi) => (
      <div className="toolstrip__group" role="group" aria-label={g.name} key={g.name} data-first={gi === 0}>
        {g.items.map((it) => button(it, true))}
      </div>
    ));
  } else if (mode === "cycle") {
    // cada grupo vira um botão: mostra a escolha atual e passa para a próxima
    row = groups.map((g, gi) => {
      const i = Math.max(
        0,
        g.items.findIndex((it) => it.pressed),
      );
      const it = g.items[i];
      const next = g.items[(i + 1) % g.items.length];
      if (!it || !next) return null;
      const single = g.items.length === 1;
      const cycled: StripItem = single
        ? it
        : {
            ...it,
            hint: `${it.label} · tocar: ${next.label.toLocaleLowerCase("pt-BR")}`,
            pressed: undefined,
            onClick: next.onClick,
          };
      return (
        <div className="toolstrip__group" role="group" aria-label={g.name} key={g.name} data-first={gi === 0}>
          {button(cycled, tier === "label", `${g.name}-cycle`)}
        </div>
      );
    });
  } else {
    const g = groups[current];
    row = (
      <>
        <div className="toolstrip__group" role="group" aria-label={g?.name} data-first>
          {g?.items.map((it) => button(it, tier === "label"))}
        </div>
        <div className="toolstrip__group">
          <button
            type="button"
            className="toolstrip__selector"
            aria-label={`Grupo: ${g?.name}. Tocar para o próximo`}
            title="Trocar de grupo"
            onClick={() => setChosen((current + 1) % groups.length)}
          >
            <span className="toolstrip__label">{g?.name}</span>
            <span className="toolstrip__dots" aria-hidden="true">
              {groups.map((x, i) => (
                <i key={x.name} data-on={i === current} />
              ))}
            </span>
          </button>
        </div>
      </>
    );
  }

  const style = slot
    ? ({
        "--strip-left": `${slot.slot.left}px`,
        "--strip-bottom": `${slot.slot.bottom}px`,
        "--strip-room": `${slot.slot.width}px`,
        "--strip-room-left": `${slot.slot.room - slot.slot.left}px`,
      } as React.CSSProperties)
    : undefined;
  return (
    <aside
      ref={ref}
      className="toolstrip stage__ui"
      aria-label={label}
      data-keeps-sheet
      data-tier={tier}
      data-above={slot?.slot.above ?? false}
      data-placed={slot !== null}
      data-edge={edge}
      style={style}
    >
      {popover && <div className="toolstrip__popover">{popover}</div>}
      <p className="toolstrip__phrase" aria-live="polite" title={phrase}>
        {phrase}
      </p>
      <div className="toolstrip__row">{row}</div>
    </aside>
  );
}
