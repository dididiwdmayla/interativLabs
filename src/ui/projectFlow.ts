import { create } from "zustand";
import { createIdGenerator } from "@/model/ids";
import { G_REAL } from "@/model/units";
import type { Scene } from "@/model/types";
import {
  deleteProject,
  getLast,
  getProject,
  listProjects,
  newProjectId,
  putProject,
  setLast,
  storageAvailable,
  type Project,
  type ProjectMeta,
} from "@/editor/projects";
import { dropHistory, loadHistory, saveHistory } from "@/editor/sessionHistory";
import { useUiStore } from "@/editor/useUiStore";
import { prepareScene } from "@/render/prepare";
import { thumbnailSvg } from "@/render/thumbnail";
import { DEFAULT_EXAMPLE, EXAMPLES, loadExample } from "./scenes/examples";

/**
 * Projetos na interface: abrir, criar (do objeto padrão ou em branco),
 * duplicar, renomear, excluir, exemplos como cópia, exportar e importar,
 * e o autosave a cada comando (espera de 500 ms). A cena aberta é sempre
 * um projeto; o exemplo original nunca é sobrescrito.
 */

export const FIRST_PROJECT = "Meu primeiro mecanismo";
const AUTOSAVE_MS = 500;
const THUMB = { width: 120, height: 80 };

interface ProjectsState {
  list: ProjectMeta[];
  /** false: sem IndexedDB (o projeto vive só na memória) */
  stored: boolean;
  refresh(): Promise<void>;
}

export const useProjects = create<ProjectsState>()((set) => ({
  list: [],
  stored: true,
  refresh: async () => {
    const [list, stored] = await Promise.all([listProjects(), storageAvailable()]);
    set({ list, stored });
  },
}));

/** Cena em branco com três camadas: Fundo, Meio e Frente. */
export function blankScene(title: string): Scene {
  const ids = createIdGenerator();
  const now = new Date().toISOString();
  return {
    version: 2,
    meta: { title, createdAt: now, updatedAt: now },
    settings: { gravity: { on: true, g: G_REAL }, snap: { grid: 2, on: true } },
    layers: ["Fundo", "Meio", "Frente"].map((name) => ({
      id: ids.next("layer"),
      name,
      visible: true,
      locked: false,
      thickness: 3,
    })),
    parts: [],
    links: [],
  };
}

export function thumbFor(scene: Scene): string {
  try {
    return thumbnailSvg(prepareScene(scene), { ...THUMB, pad: 6, uid: "pt" });
  } catch {
    return "";
  }
}

/** Número da figura: a ordem de criação do projeto. */
function figureOf(list: ProjectMeta[], id: string): number {
  const asc = list.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const i = asc.findIndex((p) => p.id === id);
  return i < 0 ? asc.length + 1 : i + 1;
}

function show(p: Project, list: ProjectMeta[]): void {
  const scene: Scene = { ...p.scene, meta: { ...p.scene.meta, title: p.name } };
  useUiStore.getState().openScene(p.id, scene, figureOf(list, p.id), loadHistory(p.id, scene) ?? undefined);
  void setLast(p.id);
}

/** Cria e abre um projeto com esta cena. */
export async function createProject(scene: Scene, name: string): Promise<string> {
  const now = new Date().toISOString();
  const p: Project = {
    id: newProjectId(),
    name,
    scene: { ...scene, meta: { ...scene.meta, title: name, createdAt: now, updatedAt: now } },
    thumb: thumbFor(scene),
    createdAt: now,
    updatedAt: now,
  };
  await putProject(p);
  await useProjects.getState().refresh();
  show(p, useProjects.getState().list.length ? useProjects.getState().list : [p]);
  return p.id;
}

export async function openProject(id: string): Promise<boolean> {
  await flushAutosave();
  const p = await getProject(id);
  if (!p) return false;
  const list = await listProjects();
  show(p, list);
  return true;
}

/** Primeira vez: cria "Meu primeiro mecanismo" (cópia do objeto padrão). Depois: o último aberto. */
export async function boot(): Promise<void> {
  await useProjects.getState().refresh();
  const last = await getLast();
  if (last && (await openProject(last))) return;
  const list = useProjects.getState().list;
  const recent = list[0];
  if (recent && (await openProject(recent.id))) return;
  const scene = await loadExample(DEFAULT_EXAMPLE);
  await createProject(scene, FIRST_PROJECT);
  if (!useProjects.getState().stored)
    useUiStore
      .getState()
      .notify("Sem armazenamento neste navegador: o projeto não fica salvo", { warn: true });
}

export async function newProject(kind: "default" | "blank"): Promise<void> {
  await flushAutosave();
  if (kind === "blank") await createProject(blankScene("Novo mecanismo"), "Novo mecanismo");
  else {
    const ex = EXAMPLES.find((e) => e.id === DEFAULT_EXAMPLE);
    await createProject(await loadExample(DEFAULT_EXAMPLE), ex?.title ?? "Objeto padrão");
  }
}

/** Abrir um exemplo cria um projeto novo, cópia dele. */
export async function openExampleAsProject(id: string): Promise<void> {
  await flushAutosave();
  const ex = EXAMPLES.find((e) => e.id === id);
  await createProject(await loadExample(id), ex?.title ?? id);
}

export async function duplicateProject(id: string): Promise<void> {
  await flushAutosave();
  const p = await getProject(id);
  if (!p) return;
  await createProject(structuredClone(p.scene), `${p.name} (cópia)`);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const t = name.trim();
  if (!t) return;
  const ui = useUiStore.getState();
  if (ui.current?.id === id) {
    await flushAutosave();
    // o nome não entra na pilha de desfazer: é do projeto, não do desenho
    useUiStore.setState({
      current: {
        ...ui.current,
        scene: { ...ui.current.scene, meta: { ...ui.current.scene.meta, title: t } },
      },
    });
  }
  const p = await getProject(id);
  if (p) await putProject({ ...p, name: t, scene: { ...p.scene, meta: { ...p.scene.meta, title: t } } });
  await useProjects.getState().refresh();
}

export async function removeProject(id: string): Promise<void> {
  const ui = useUiStore.getState();
  const wasOpen = ui.current?.id === id;
  if (wasOpen) cancelAutosave();
  await deleteProject(id);
  dropHistory(id);
  await useProjects.getState().refresh();
  if (!wasOpen) return;
  const next = useProjects.getState().list[0];
  if (next) await openProject(next.id);
  else await createProject(blankScene("Novo mecanismo"), "Novo mecanismo");
}

// ——— autosave ———

let timer = 0;
let pending: (() => Promise<void>) | null = null;

async function save(id: string, scene: Scene): Promise<void> {
  const p = await getProject(id);
  const now = new Date().toISOString();
  await putProject({
    id,
    name: scene.meta.title,
    scene: { ...scene, meta: { ...scene.meta, updatedAt: now } },
    thumb: thumbFor(scene),
    createdAt: p?.createdAt ?? now,
    updatedAt: now,
  });
  await useProjects.getState().refresh();
}

export async function flushAutosave(): Promise<void> {
  window.clearTimeout(timer);
  const job = pending;
  pending = null;
  if (job) await job();
}

function cancelAutosave(): void {
  window.clearTimeout(timer);
  pending = null;
}

/** Salva a cena a cada comando (espera de 500 ms) e a pilha de desfazer na sessão. Devolve o desligar. */
export function startAutosave(): () => void {
  const off = useUiStore.subscribe((s, prev) => {
    const c = s.current;
    if (!c) return;
    if (c.id === prev.current?.id && s.history !== prev.history) saveHistory(c.id, c.scene, s.history);
    if (c.id !== prev.current?.id || c.scene === prev.current?.scene) return;
    const id = c.id;
    const scene = c.scene;
    pending = () => save(id, scene);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void flushAutosave(), AUTOSAVE_MS);
  });
  const hide = () => {
    if (document.visibilityState === "hidden") void flushAutosave();
  };
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("pagehide", hide);
  return () => {
    off();
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("pagehide", hide);
  };
}

// ——— exportar e importar ———

export function exportJson(): string {
  const scene = useUiStore.getState().current?.scene;
  return scene ? JSON.stringify(scene, null, 2) : "";
}

export function exportFileName(): string {
  const t = useUiStore.getState().current?.scene.meta.title ?? "cena";
  const slug = t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "cena"}.json`;
}

export type ImportResult = { ok: true } | { ok: false; issues: { path: string; message: string }[] };

/** Importa texto JSON (v0, v1 ou v2) como projeto novo. Erros com o caminho do campo. */
export async function importText(text: string, fallbackName = "Importado"): Promise<ImportResult> {
  const { parseSceneJson } = await import("@/model/scene");
  const r = parseSceneJson(text);
  if (!r.ok) return { ok: false, issues: r.issues.slice(0, 8) };
  await flushAutosave();
  const name = r.scene.meta.title.trim() || fallbackName;
  await createProject(r.scene, name);
  const from = r.migratedFrom;
  useUiStore
    .getState()
    .notify(from === null ? `Importado: ${name}` : `Importado de uma cena v${from}: ${name}`);
  return { ok: true };
}
