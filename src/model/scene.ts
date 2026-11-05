import { z } from "zod";
import ptBR from "zod/v4/locales/pt-BR.js";
import { migrateV0ToV1, type MigrateOptions } from "./migrations/v0-to-v1";
import { migrateV1ToV2 } from "./migrations/v1-to-v2";
import { migrateV2ToV3 } from "./migrations/v2-to-v3";
import { SceneV2Schema } from "./schema-v2";
import { SceneSchema } from "./schema";
import { SceneV1Schema } from "./schema-v1";
import type { Scene, SceneV1 } from "./types";
import { looksLikeV0 } from "./v0";

export const CURRENT_VERSION = 3;

const localeError = ptBR().localeError;

export interface SceneIssue {
  /** Caminho do campo, como "parts[2].shape.r". Vazio = a cena inteira. */
  path: string;
  message: string;
}

export type LoadResult =
  { ok: true; scene: Scene; migratedFrom: number | null } | { ok: false; issues: SceneIssue[] };

export function formatPath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const k of path) {
    if (typeof k === "number") out += `[${k}]`;
    else out += out ? `.${String(k)}` : String(k);
  }
  return out;
}

function toIssues(err: z.ZodError): SceneIssue[] {
  return err.issues.map((i) => ({ path: formatPath(i.path), message: i.message }));
}

/** Valida uma cena v3 já em objeto (sem migrar). */
export function validateScene(data: unknown): LoadResult {
  const r = SceneSchema.safeParse(data, { error: localeError });
  return r.success
    ? { ok: true, scene: r.data, migratedFrom: null }
    : { ok: false, issues: toIssues(r.error) };
}

/** Valida uma cena v1 (formato antigo) e devolve o objeto tipado. */
export function validateSceneV1(
  data: unknown,
): { ok: true; scene: SceneV1 } | { ok: false; issues: SceneIssue[] } {
  const r = SceneV1Schema.safeParse(data, { error: localeError });
  return r.success ? { ok: true, scene: r.data } : { ok: false, issues: toIssues(r.error) };
}

function fromV1(v1: SceneV1, from: number): LoadResult {
  const r = validateScene(migrateV2ToV3(migrateV1ToV2(v1)));
  return r.ok ? { ...r, migratedFrom: from } : r;
}

/**
 * Abre uma cena de qualquer versão conhecida: v0 (protótipo) → v1 → v2 → v3.
 * Cada etapa passa pelo schema da sua versão; erros apontam o caminho do
 * campo na versão em que falharam.
 */
export function loadScene(data: unknown, opts: MigrateOptions = {}): LoadResult {
  if (looksLikeV0(data)) {
    let migrated: unknown;
    try {
      migrated = migrateV0ToV1(data, opts);
    } catch (e) {
      return {
        ok: false,
        issues: [{ path: "", message: `Cena do protótipo ilegível: ${(e as Error).message}` }],
      };
    }
    const r = validateSceneV1(migrated);
    return r.ok ? fromV1(r.scene, 0) : r;
  }
  if (data && typeof data === "object" && "version" in data) {
    const v = (data as { version: unknown }).version;
    if (typeof v === "number" && v > CURRENT_VERSION) {
      return {
        ok: false,
        issues: [
          {
            path: "version",
            message: `Cena feita numa versão mais nova (${v}); esta versão do app lê até a ${CURRENT_VERSION}`,
          },
        ],
      };
    }
    if (v === 2) {
      const old = SceneV2Schema.safeParse(data, { error: localeError });
      if (!old.success) return { ok: false, issues: toIssues(old.error) };
      const r = validateScene(migrateV2ToV3(old.data));
      return r.ok ? { ...r, migratedFrom: 2 } : r;
    }
    if (v === 1) {
      const r = validateSceneV1(data);
      return r.ok ? fromV1(r.scene, 1) : r;
    }
  }
  return validateScene(data);
}

/** Abre uma cena de qualquer versão, em objeto ou em texto JSON. */
export function parseScene(input: unknown, opts: MigrateOptions = {}): LoadResult {
  return typeof input === "string" ? parseSceneJson(input, opts) : loadScene(input, opts);
}

/** Lê texto JSON. Erro de sintaxe vira uma issue sem caminho. */
export function parseSceneJson(text: string, opts: MigrateOptions = {}): LoadResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, issues: [{ path: "", message: `JSON inválido: ${(e as Error).message}` }] };
  }
  return loadScene(data, opts);
}

/** Serializa a cena (formatação estável, 2 espaços). */
export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene, null, 2);
}
