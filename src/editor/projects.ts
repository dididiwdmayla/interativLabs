import type { HistoryState } from "./history";
import type { Scene } from "@/model/types";
import type { ProjectView } from "./useUiStore";

/**
 * Projetos salvos no aparelho (docs/arquitetura.md §7), em IndexedDB:
 * por projeto, id, nome, a cena v2, a miniatura SVG gerada pelo
 * renderizador e as datas. Todo acesso fica em try/catch: sem IndexedDB
 * (janela privada, armazenamento bloqueado), as funções devolvem vazio e o
 * app segue com o projeto só na memória.
 *
 * API usada (padrão IndexedDB 3.0): indexedDB.open com onupgradeneeded,
 * transações readonly/readwrite, IDBObjectStore get/put/delete/getAll.
 */

export interface ProjectMeta {
  id: string;
  name: string;
  /** SVG da miniatura (src/render/thumbnail.ts) */
  thumb: string;
  /** ISO 8601 */
  createdAt: string;
  updatedAt: string;
}

export interface Variant {
  id: string;
  name: string;
  scene: Scene;
  history: HistoryState;
}

export interface Project extends ProjectMeta {
  variants?: Variant[];
  activeVariant?: string;
  scene: Scene;
  /** estado de vista (peças escondidas): fora da cena, do hash e do desfazer */
  view?: ProjectView;
}

const DB = "interativlabs";
const VERSION = 1;
const PROJECTS = "projects";
const META = "meta";

let dbp: Promise<IDBDatabase | null> | null = null;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, ko) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

function done(t: IDBTransaction): Promise<void> {
  return new Promise((ok, ko) => {
    t.oncomplete = () => ok();
    t.onerror = () => ko(t.error);
    t.onabort = () => ko(t.error);
  });
}

/** Abre (ou cria) o banco. null sem IndexedDB. */
export function openDb(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const r = indexedDB.open(DB, VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

/** Fecha e esquece a conexão (testes). */
export async function closeDb(): Promise<void> {
  const db = await dbp;
  db?.close();
  dbp = null;
}

export async function storageAvailable(): Promise<boolean> {
  return (await openDb()) !== null;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  try {
    const db = await openDb();
    if (!db) return [];
    const all = await req(db.transaction(PROJECTS, "readonly").objectStore(PROJECTS).getAll());
    return (all as Project[])
      .map(({ id, name, thumb, createdAt, updatedAt }) => ({ id, name, thumb, createdAt, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const p = await req(db.transaction(PROJECTS, "readonly").objectStore(PROJECTS).get(id));
    return (p as Project | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function putProject(p: Project): Promise<boolean> {
  try {
    const db = await openDb();
    if (!db) return false;
    const t = db.transaction(PROJECTS, "readwrite");
    t.objectStore(PROJECTS).put(p);
    await done(t);
    return true;
  } catch {
    return false;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    const db = await openDb();
    if (!db) return false;
    const t = db.transaction(PROJECTS, "readwrite");
    t.objectStore(PROJECTS).delete(id);
    await done(t);
    return true;
  } catch {
    return false;
  }
}

/** Último projeto aberto (o app abre nele). */
export async function getLast(): Promise<string | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const v = await req(db.transaction(META, "readonly").objectStore(META).get("last"));
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export async function setLast(id: string): Promise<boolean> {
  try {
    const db = await openDb();
    if (!db) return false;
    const t = db.transaction(META, "readwrite");
    t.objectStore(META).put(id, "last");
    await done(t);
    return true;
  } catch {
    return false;
  }
}

/** Id novo de projeto (não precisa ser legível). */
export function newProjectId(): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `P${Date.now().toString(36)}${r}`;
}
