import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUiStore } from "@/editor/useUiStore";
import type { StageNodes } from "@/render/nodes";
import { prepareScene } from "@/render/prepare";
import { CardSheet } from "./card/SelectionCard";
import { Corners } from "./Corners";
import { EdgeMenu, EdgeTabs } from "./EdgeMenu";
import { InstallSheet } from "./InstallSheet";
import { MainSheet } from "./MainSheet";
import { PartsDrawer } from "./PartsDrawer";
import { LayerStack } from "./LayerStack";
import { SidePanel } from "./Panel";
import {
  boot,
  exportJson,
  flushAutosave,
  importText,
  newProject,
  openExampleAsProject,
  openProject,
  startAutosave,
  useProjects,
} from "./projectFlow";
import { Sheet } from "./Sheet";
import { stageApi } from "./stageApi";
import { useSimStore } from "./sim/simStore";
import { useSimulation } from "./sim/useSimulation";
import { Stage } from "./Stage";
import { TestBar } from "./TestBar";
import { Toast } from "./Toast";
import { WIDE_QUERY, useMedia } from "./useMedia";
import { useElementSize } from "./useElementSize";
import { useSafeArea } from "./useSafeArea";
import { useShortcuts } from "./useShortcuts";

// A bancada de motores, o laboratório e a página de desempenho são
// carregados sob demanda: não entram no pacote principal.
const BenchPage = lazy(() => import("./bench/BenchPage"));
const LabPage = lazy(() => import("./lab/LabPage"));
const PerfPage = lazy(() => import("./perf/PerfPage"));

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

/** px reservados pelos cantos e pelas abas (o enquadramento não põe peça embaixo deles) */
const CORNER = 60;
const TAB = 40;
const TESTBAR = 84;

function Workbench() {
  const current = useUiStore((s) => s.current);
  const mode = useUiStore((s) => s.mode);
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  const activeLayer = useUiStore((s) => s.activeLayer);
  const xray = useUiStore((s) => s.xray);
  const lefty = useUiStore((s) => s.lefty);
  const sheet = useUiStore((s) => s.sheet);
  const hint = useUiStore((s) => s.hint);
  const edgeOpen = useUiStore((s) => s.edgeMenu !== null);
  const wide = useMedia(WIDE_QUERY);
  const sa = useSafeArea();
  const portrait = useMedia("(orientation: portrait) and (max-width: 700px)");
  const [nodes, setNodes] = useState<StageNodes | null>(null);
  const bench = useRef<HTMLDivElement>(null);
  const size = useElementSize(bench);
  // no computador o painel fica à direita: a borda direita do palco não tem entalhe
  const menuInsets = useMemo(() => (wide ? { ...sa, right: 0 } : sa), [sa, wide]);
  const [error, setError] = useState<string | null>(null);
  const model = useMemo(() => (current ? prepareScene(current.scene) : null), [current]);

  // abre o último projeto (na primeira vez, "Meu primeiro mecanismo", cópia do objeto padrão)
  useEffect(() => {
    if (!useUiStore.getState().current) boot().catch((e: Error) => setError(e.message));
    return startAutosave();
  }, []);

  useSimulation(mode === "simulate", nodes);
  useShortcuts();

  // gancho dos testes automatizados (tests/e2e): estados da interface e da simulação
  useEffect(() => {
    (window as unknown as { __IL__?: unknown }).__IL__ = {
      ui: useUiStore,
      sim: useSimStore,
      openExample: openExampleAsProject,
      projects: { useProjects, newProject, openProject, importText, exportJson, flushAutosave },
      stage: stageApi,
    };
  }, []);

  const fitPad = useMemo(() => {
    // em retrato, o nome e a dica ficam embaixo da fileira de cantos
    const top = sa.top + CORNER + (portrait ? 30 : 0) + (hint ? (portrait ? 34 : 14) : 0);
    const l = sa.left + TAB;
    const r = sa.right + TAB;
    return {
      edit: [top, r, sa.bottom + CORNER, l] as [number, number, number, number],
      sim: [sa.top + CORNER, r, sa.bottom + TESTBAR, l] as [number, number, number, number],
    };
  }, [sa, hint, portrait]);

  const onFirstTouch = useCallback(() => {
    const ui = useUiStore.getState();
    if (ui.hint && ui.mode === "edit") ui.setHint(false);
  }, []);

  return (
    <div className="shell" data-mode={mode} data-lefty={lefty} data-wide={wide} data-edgemenu={edgeOpen}>
      <div className="workbench" ref={bench}>
        <Stage
          model={model}
          figure={current?.figure ?? 1}
          serial={current?.serial ?? 0}
          mode={mode}
          selection={selection}
          activeLayer={activeLayer}
          layerMode={xray ? "xray" : mode === "simulate" ? "all" : "focus"}
          onSelect={select}
          onNodes={setNodes}
          fitPad={fitPad}
          onFirstTouch={onFirstTouch}
        />
        <Corners model={model} wide={wide} />
        {mode === "simulate" && <TestBar />}
        <EdgeTabs height={size.height} />
        <EdgeMenu width={size.width} height={size.height} insets={menuInsets} />
      </div>
      {wide && <SidePanel model={model} />}
      {sheet === "main" && <MainSheet />}
      {sheet === "install" && <InstallSheet />}
      {sheet === "drawer" && mode === "edit" && <PartsDrawer />}
      {sheet === "card" && !wide && model && <CardSheet model={model} />}
      {sheet === "layers" && !wide && model && (
        <Sheet title="Camadas" side="tools" className="sheet--layers">
          <LayerStack model={model} />
        </Sheet>
      )}
      <Toast />
      {error && <p className="shell__error">{error}</p>}
    </div>
  );
}

export function App() {
  const route = useHashRoute();
  if (route === "#bench") {
    return (
      <Suspense fallback={<p className="route-missing">Carregando a bancada…</p>}>
        <BenchPage />
      </Suspense>
    );
  }
  if (route === "#lab" || route.startsWith("#lab/")) {
    return (
      <Suspense fallback={<p className="route-missing">Carregando o laboratório…</p>}>
        <LabPage />
      </Suspense>
    );
  }
  if (route === "#perf") {
    return (
      <Suspense fallback={<p className="route-missing">Carregando a medição…</p>}>
        <PerfPage />
      </Suspense>
    );
  }
  return <Workbench />;
}
