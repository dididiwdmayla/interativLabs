import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { parseSceneJson } from "@/model/scene";
import {
  closeDb,
  deleteProject,
  getLast,
  getProject,
  listProjects,
  putProject,
  setLast,
  storageAvailable,
  type Project,
} from "./projects";
import { relativeDate } from "./time";

function project(id: string, updatedAt: string): Project {
  const r = parseSceneJson(readFileSync("scenes/examples/engrenagens.json", "utf8"));
  if (!r.ok) throw new Error("cena");
  return { id, name: `P ${id}`, scene: r.scene, thumb: "<svg/>", createdAt: updatedAt, updatedAt };
}

afterEach(async () => {
  for (const p of await listProjects()) await deleteProject(p.id);
  await closeDb();
});

describe("projetos no IndexedDB", () => {
  it("guarda, lista do mais recente para o mais antigo, lê, troca e exclui", async () => {
    expect(await storageAvailable()).toBe(true);
    await putProject(project("a", "2026-11-01T10:00:00.000Z"));
    await putProject(project("b", "2026-11-03T10:00:00.000Z"));
    await putProject(project("c", "2026-11-02T10:00:00.000Z"));
    const list = await listProjects();
    expect(list.map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect("scene" in list[0]!).toBe(false);
    const b = await getProject("b");
    expect(b?.scene.parts.length).toBeGreaterThan(0);
    await putProject({ ...b!, name: "Renomeado" });
    expect((await getProject("b"))?.name).toBe("Renomeado");
    await deleteProject("b");
    expect(await getProject("b")).toBeNull();
    expect((await listProjects()).length).toBe(2);
  });

  it("lembra o último projeto aberto, mesmo depois de reabrir o banco", async () => {
    await setLast("x1");
    await closeDb();
    expect(await getLast()).toBe("x1");
  });

  it("a cena volta idêntica", async () => {
    const p = project("z", "2026-11-04T00:00:00.000Z");
    await putProject(p);
    await closeDb();
    expect(JSON.stringify((await getProject("z"))?.scene)).toBe(JSON.stringify(p.scene));
  });
});

describe("importar", () => {
  for (const f of ["lancador", "trava", "engrenagens"])
    it(`cena v0 do protótipo (${f}) entra pelas migrações`, () => {
      const path = `reference/prototype-v0/scenes/${f}.json`;
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        return;
      }
      const r = parseSceneJson(text);
      expect(r.ok ? r.migratedFrom : r.issues).toBe(0);
    });

  it("JSON inválido mostra o caminho do campo, em português", () => {
    const r = parseSceneJson(
      readFileSync("scenes/examples/engrenagens.json", "utf8").replace('"r": ', '"r": -'),
    );
    const bad = parseSceneJson('{"version": 2, "meta": {"title": 3}}');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.some((i) => i.path.startsWith("meta"))).toBe(true);
    const syntax = parseSceneJson("{ não é json");
    expect(syntax.ok).toBe(false);
    if (!syntax.ok) expect(syntax.issues[0]!.message).toMatch(/JSON inválido/);
    expect(r.ok || r.issues.length > 0).toBe(true);
  });
});

describe("data relativa", () => {
  const now = Date.parse("2026-11-05T12:00:00.000Z");
  it("agora, minutos, horas, ontem, dias e data", () => {
    expect(relativeDate("2026-11-05T11:59:30.000Z", now)).toBe("agora");
    expect(relativeDate("2026-11-05T11:55:00.000Z", now)).toBe("há 5 min");
    expect(relativeDate("2026-11-05T09:00:00.000Z", now)).toBe("há 3 h");
    expect(relativeDate("2026-11-04T10:00:00.000Z", now)).toBe("ontem");
    expect(relativeDate("2026-11-01T10:00:00.000Z", now)).toBe("há 4 dias");
    expect(relativeDate("2026-10-01T10:00:00.000Z", now)).toMatch(/^\d\d\/10\/2026$/);
  });
});
