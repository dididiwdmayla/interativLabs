import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { useUiStore } from "./useUiStore";
import { blankScene } from "@/ui/projectFlow";
import { closeDb, getProject, putProject } from "./projects";
it("cria, troca, renomeia e apaga sem misturar os desfazeres", () => {
  const ui = () => useUiStore.getState();
  ui().openScene("test", blankScene("Teste"), 1);
  ui().commit({
    label: "A",
    recipe: (d) => {
      d.meta.title = "Cena A";
    },
  });
  expect(ui().createVariant()).toBe("B");
  ui().commit({
    label: "B",
    recipe: (d) => {
      d.meta.title = "Cena B";
    },
  });
  ui().setMode("simulate");
  ui().switchVariant("A");
  expect(ui().mode).toBe("edit");
  expect(ui().current?.scene.meta.title).toBe("Cena A");
  ui().undo();
  expect(ui().current?.scene.meta.title).toBe("Teste");
  ui().switchVariant("B");
  expect(ui().current?.scene.meta.title).toBe("Cena B");
  ui().undo();
  expect(ui().current?.scene.meta.title).toBe("Cena A");
  ui().renameVariant("B", "Dura");
  expect(ui().variants[1]?.name).toBe("Dura");
  expect(ui().createVariant()).toBe("C");
  expect(ui().createVariant()).toBe("D");
  expect(ui().createVariant()).toBeNull();
  ui().deleteVariant("A");
  expect(ui().variants.length).toBe(4);
  ui().deleteVariant("D");
  expect(ui().activeVariant).toBe("A");
});
it("reabre variantes e suas histórias no IndexedDB; projeto antigo começa em A", async () => {
  const scene = blankScene("Antigo");
  useUiStore.getState().openScene("old", scene, 1);
  expect(useUiStore.getState().variants.map((v) => v.id)).toEqual(["A"]);
  useUiStore.getState().createVariant();
  const s = useUiStore.getState();
  const variants = s.variantSnapshot();
  expect(
    await putProject({
      id: "variants",
      name: "Teste",
      scene,
      variants,
      activeVariant: "B",
      thumb: "",
      createdAt: "",
      updatedAt: "",
      view: { hidden: ["absent"], probes: [] },
    }),
  ).toBe(true);
  await closeDb();
  const p = (await getProject("variants"))!;
  expect(p.variants).toEqual(variants);
  useUiStore
    .getState()
    .openScene(p.id, p.variants![1]!.scene, 1, p.variants![1]!.history, p.view, p.variants, p.activeVariant);
  expect(useUiStore.getState().activeVariant).toBe("B");
  expect(useUiStore.getState().hidden).toEqual(["absent"]);
});
