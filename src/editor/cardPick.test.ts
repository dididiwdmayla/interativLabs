import { expect, it } from "vitest";
import { Builder } from "../../scripts/fixtures/builder";
import { prepareScene } from "@/render/prepare";
import { validateScene } from "@/model/scene";
import { pickLinkEdit } from "./cardPick";
import { run, undo, push, emptyHistory } from "./history";
import { setLink } from "./commands";

it("picks chamber walls, vents, ports and sensor targets with undo", () => {
  const b = new Builder("Listas do cartão"),
    layer = b.layer("Móveis");
  const p = b.circle("Parede", layer, 30, 0, 2, "steel");
  const q = b.circle("Outra parede", layer, 20, 0, 2, "steel");
  const chamber = b.link({
    kind: "chamber",
    body: null,
    at: [0, 0],
    dir: 0,
    bore: 4,
    length: 40,
    walls: [{ part: p.id, seal: 40 }],
    vents: [{ at: 5, d: 1, open: false }],
    ports: [],
    gas: { model: "isothermal", gamma: 1.4, p0: 101.325 },
  });
  const other = b.link({ ...chamber, at: [0, 20], walls: [{ part: q.id, seal: 40 }], id: "other", ref: 90 });
  // Builder generates IDs, so add the distinct chamber explicitly.
  other.id = "other";
  const lock = b.link({ kind: "lock", a: null, b: q.id, at: [0, 0] });
  const sensor = b.link({
    kind: "sensor",
    host: p.id,
    at: [0, 0],
    r: 1,
    layers: [layer, layer],
    minSpeed: 0,
    actions: [],
  });
  const model = prepareScene(b.scene);
  const cases = [
    {
      pick: { kind: "wall" as const, link: chamber.id },
      point: [20, 0] as [number, number],
      field: "walls",
      value: { part: q.id, seal: 40 },
    },
    {
      pick: { kind: "vent" as const, link: chamber.id },
      point: [12, 0] as [number, number],
      field: "vents",
      value: { at: 12, d: 1, open: true },
    },
    {
      pick: { kind: "port" as const, link: chamber.id },
      point: [10, 20] as [number, number],
      field: "ports",
      value: { to: other.id, at: 10, d: 1 },
    },
    {
      pick: { kind: "action" as const, link: sensor.id, action: "release" as const },
      point: [20, 0] as [number, number],
      field: "actions",
      value: { do: "release", target: lock.id },
    },
    {
      pick: { kind: "action" as const, link: sensor.id, action: "open" as const },
      point: [5, 0] as [number, number],
      field: "actions",
      value: { do: "open", target: chamber.id, vent: 0 },
    },
  ];
  for (const c of cases) {
    const result = pickLinkEdit(model, c.pick, c.point, 0.1);
    expect(result.error).toBeUndefined();
    expect(result.link).toMatchObject({ [c.field]: expect.arrayContaining([c.value]) });
    const command = setLink(b.scene, c.pick.link, result.link!)!;
    const edited = run(b.scene, command.label, command.recipe)!;
    expect(validateScene(edited.scene).ok).toBe(true);
    expect(undo(edited.scene, push(emptyHistory(), edited.entry))!.scene).toEqual(b.scene);
  }
  expect(pickLinkEdit(model, { kind: "vent", link: chamber.id }, [10, 10], 0.1).error).toBe(
    "Toque na linha do furo",
  );
});
