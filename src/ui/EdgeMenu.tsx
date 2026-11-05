import { useId, useLayoutEffect, useMemo } from "react";
import { MENUS, menuAt, menuItems, sideOf } from "@/editor/menus";
import { radialLayout } from "@/editor/radial";
import { useUiStore } from "@/editor/useUiStore";
import { setShownMenu, useMenuContext } from "./edgeMenuState";
import { Icon, type IconName } from "./icons";
import { runMenuItem } from "./menuActions";
import type { Insets } from "./useSafeArea";

/**
 * Menu circular de borda: os itens num arco voltado para o meio da tela.
 * Escolha deslizando até o item e soltando (o palco passa o dedo para cá
 * por `hitEdgeMenu`) ou tocando depois de aberto; tocar fora fecha.
 */

export function EdgeMenu({ width, height, insets }: { width: number; height: number; insets: Insets }) {
  const uid = useId();
  const m = useUiStore((s) => s.edgeMenu);
  const setEdgeMenu = useUiStore((s) => s.setEdgeMenu);
  const ctx = useMenuContext();
  const id = m ? menuAt(m.side, ctx.lefty) : null;
  const items = useMemo(() => (id ? menuItems(id, ctx) : []), [id, ctx]);
  const layout = useMemo(
    () =>
      m && width > 0
        ? radialLayout({ side: m.side, cy: m.cy, width, height, insets, count: items.length })
        : null,
    [m, width, height, insets, items.length],
  );
  useLayoutEffect(() => {
    setShownMenu(layout ? { layout, items } : null);
    return () => setShownMenu(null);
  }, [layout, items]);

  if (!m || !id || !layout) return null;
  const def = MENUS[id];
  const half = (layout.span / 2) * (Math.PI / 180);
  const sx = m.side === "right" ? -1 : 1;
  const a0: [number, number] = [
    layout.cx + sx * layout.r * Math.cos(half),
    layout.cy - layout.r * Math.sin(half),
  ];
  const a1: [number, number] = [
    layout.cx + sx * layout.r * Math.cos(half),
    layout.cy + layout.r * Math.sin(half),
  ];
  const sweep = m.side === "right" ? 0 : 1;
  return (
    <div className="edgemenu" data-side={m.side} role="menu" aria-label={def.title}>
      <div className="edgemenu__backdrop" onPointerDown={() => setEdgeMenu(null)} aria-hidden="true" />
      <svg className="edgemenu__arc" width={width} height={height} aria-hidden="true">
        <path
          d={`M${a0[0]} ${a0[1]}A${layout.r} ${layout.r} 0 0 ${sweep} ${a1[0]} ${a1[1]}`}
          className="edgemenu__guide"
        />
        <circle cx={layout.cx} cy={layout.cy} r={5} className="edgemenu__hub" />
        <text
          x={layout.cx + sx * 16}
          y={layout.cy + 4}
          textAnchor={m.side === "right" ? "end" : "start"}
          className="edgemenu__title"
        >
          {def.title}
        </text>
      </svg>
      {items.map((it, i) => {
        const p = layout.items[i];
        if (!p) return null;
        const on = it.on?.(ctx) ?? false;
        return (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            className="edgemenu__item"
            data-hover={m.hover === it.id}
            aria-pressed={it.on ? on : undefined}
            style={{ transform: `translate(${p.x}px, ${p.y}px)`, animationDelay: `${i * 24}ms` }}
            onClick={() => runMenuItem(it.id)}
          >
            <span className="edgemenu__disc">
              <Icon name={it.icon as IconName} uid={`${uid}${it.id}`} />
            </span>
            <span className="edgemenu__label">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Abas discretas no meio das bordas: abrem o mesmo menu com um toque. */
export function EdgeTabs({ height }: { height: number }) {
  const mode = useUiStore((s) => s.mode);
  const lefty = useUiStore((s) => s.lefty);
  const open = useUiStore((s) => s.edgeMenu);
  const setEdgeMenu = useUiStore((s) => s.setEdgeMenu);
  return (
    <>
      {(["view", "insert"] as const).map((id) => {
        const def = MENUS[id];
        if (!def.modes.includes(mode)) return null;
        const side = sideOf(id, lefty);
        return (
          <button
            key={id}
            type="button"
            className="edgetab"
            data-side={side}
            aria-label={`Menu ${def.title}`}
            aria-expanded={open?.side === side}
            onClick={() => setEdgeMenu(open?.side === side ? null : { side, cy: height / 2, hover: null })}
          >
            <span className="edgetab__mark" aria-hidden="true">
              {def.title}
            </span>
          </button>
        );
      })}
    </>
  );
}
