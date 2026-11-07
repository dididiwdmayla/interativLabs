import { expect, it } from "vitest";
import { hiddenLinkState } from "./hiddenParts";
import { useUiStore } from "./useUiStore";
import { profilesScene } from "../../scripts/fixtures/multicamada";
it("hiding changes only project view and can reveal every piece", () => {
  const { scene, piece } = profilesScene();
  const ui = useUiStore.getState();
  ui.openScene("view", scene, 1);
  const history = useUiStore.getState().history;
  ui.hidePart(piece.id);
  expect(useUiStore.getState().current?.scene).toBe(scene);
  expect(useUiStore.getState().history).toBe(history);
  expect(useUiStore.getState().hiddenParts).toEqual([piece.id]);
  ui.showPart();
  expect(useUiStore.getState().hiddenParts).toEqual([]);
  ui.hidePart(piece.id);
  ui.openScene("example", scene, 1);
  expect(useUiStore.getState().hiddenParts).toEqual([]);
});
it("retains mixed links and hides links with no visible piece", () => {
  const { scene } = profilesScene();
  const link = { kind: "screw", id: "s", ref: 9, a: "a", b: "b", at: [0, 0] } as const;
  const l = { ...link, at: [0, 0] as [number, number] };
  expect(hiddenLinkState(l, ["a"], scene)).toBe("partial");
  expect(hiddenLinkState(l, ["a", "b"], scene)).toBe("hidden");
});
