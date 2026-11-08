import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrateV3ToV4 } from "./migrations/v3-to-v4";
import { CURRENT_VERSION, parseScene, serializeScene, validateScene } from "./scene";
import type { Scene, SceneV3 } from "./types";

/** Uma cápsula solta (estojo e esfera) e um cano com a câmara que recebe cápsula. */
function base(): Scene {
  return {
    version: 4,
    meta: { title: "Cápsula", createdAt: "", updatedAt: "" },
    settings: { gravity: { on: true, g: 9810 }, snap: { on: true, grid: 1 } },
    layers: [{ id: "L1", name: "L1", visible: true, locked: false, thickness: 4 }],
    parts: [
      {
        id: "case",
        ref: 1,
        name: "Cápsula",
        layer: "L1",
        x: 0,
        y: 0,
        angle: 0,
        fixed: false,
        fast: false,
        material: "brass",
        shape: {
          kind: "poly",
          outer: [
            [-11, -4],
            [11, -4],
            [11, 4],
            [-11, 4],
          ],
          holes: [],
        },
        capsule: {
          charge: 0.5,
          projectile: "ball",
          base: [-8.5, 0],
          mouth: [11, 0],
          bore: 6.2,
          primer: [-11, 0],
          minStrike: 300,
        },
      },
      {
        id: "ball",
        ref: 2,
        name: "Esfera",
        layer: "L1",
        x: 10,
        y: 0,
        angle: 0,
        fixed: false,
        fast: true,
        material: "steel",
        shape: { kind: "circle", r: 3, holes: [] },
      },
      {
        id: "barrel",
        ref: 3,
        name: "Cano",
        layer: "L1",
        x: 40,
        y: 0,
        angle: 0,
        fixed: true,
        fast: false,
        material: "steel",
        shape: { kind: "circle", r: 2, holes: [] },
      },
    ],
    links: [
      {
        id: "chamber",
        ref: 4,
        kind: "chamber",
        mode: "capsule",
        seat: 1.5,
        body: "barrel",
        at: [-51, 0],
        dir: 0,
        bore: 8.2,
        length: 80,
        walls: [],
        vents: [],
        ports: [],
        gas: { model: "adiabatic", gamma: 1.4, p0: 101.325 },
      },
    ],
  };
}

describe("formato v4: cápsula e câmara de cápsula", () => {
  it("aceita a cena com cápsula e câmara que recebe cápsula", () => {
    const r = validateScene(base());
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    expect(r.scene.parts[0]!.capsule?.projectile).toBe("ball");
  });

  it("a cápsula sem projétil (estojo vazio) e a câmara de carga sem modo continuam válidas", () => {
    const s = base();
    delete s.parts[0]!.capsule!.projectile;
    expect(validateScene(s).ok).toBe(true);
  });

  type Mutate = (s: Scene) => void;
  const cap = (s: Scene) => s.parts[0]!.capsule!;
  const chamber = (s: Scene) => {
    const l = s.links[0]!;
    if (l.kind !== "chamber") throw new Error("câmara");
    return l;
  };
  const invalid: [string, string, Mutate][] = [
    ["parts[0].capsule.projectile", "Peça inexistente", (s) => void (cap(s).projectile = "nada")],
    ["parts[0].capsule.projectile", "a própria cápsula", (s) => void (cap(s).projectile = "case")],
    [
      "parts[0].capsule.projectile",
      "esfera",
      (s) =>
        void (s.parts[1]!.shape = {
          kind: "poly",
          outer: [
            [-3, -3],
            [3, -3],
            [3, 3],
          ],
          holes: [],
        }),
    ],
    ["parts[0].capsule.mouth", "pontos diferentes", (s) => void (cap(s).mouth = [-8.5, 0])],
    ["parts[0].capsule.bore", "maior que zero", (s) => void (cap(s).bore = 0)],
    ["parts[0].capsule.bore", "maior que zero", (s) => void (cap(s).bore = -1)],
    ["parts[0].capsule.minStrike", "maior que zero", (s) => void (cap(s).minStrike = 0)],
    ["parts[0].capsule.charge", "negativo", (s) => void (cap(s).charge = -0.1)],
    [
      "parts[0].capsule.projectile",
      "camada da cápsula",
      (s) => {
        s.layers.push({ id: "L2", name: "L2", visible: true, locked: false, thickness: 4 });
        s.parts[1]!.layer = "L2";
      },
    ],
    ["parts[0].capsule.projectile", "peça móvel", (s) => void (s.parts[1]!.fixed = true)],
    [
      "parts[3].capsule.projectile",
      "já está na cápsula 1",
      (s) => {
        const other = structuredClone(s.parts[0]!);
        other.id = "case2";
        other.ref = 9;
        s.parts.push(other);
      },
    ],
    ["parts[0].capsule", "extra", (s) => void Object.assign(cap(s), { extra: 1 })],
    [
      "links[0].gas.charge",
      "não tem carga própria",
      (s) => void (chamber(s).gas.charge = { amount: 0.5, burnMs: 1 }),
    ],
    ["links[0].walls", "não tem paredes", (s) => void (chamber(s).walls = [{ part: "ball", seal: 10 }])],
    ["links[0].vents", "respiros", (s) => void (chamber(s).vents = [{ at: 4, d: 1, open: true }])],
    ["links[0].seat", "negativo", (s) => void (chamber(s).seat = -1)],
    ["links[0].mode", "Modo da câmara inválido", (s) => void Object.assign(chamber(s), { mode: "gás" })],
    [
      "links[0].seat",
      "só vale na câmara que recebe cápsula",
      (s) => {
        const c = chamber(s);
        delete c.mode;
        c.walls = [{ part: "ball", seal: 10 }];
      },
    ],
  ];
  it.each(invalid)("recusa %s (%s), apontando o campo", (path, message, mutate) => {
    const s = base();
    mutate(s);
    const r = validateScene(s);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const hit = r.issues.find((i) => i.path === path);
    expect(hit, JSON.stringify(r.issues)).toBeTruthy();
    if (message) expect(hit!.message).toContain(message);
  });

  it("os campos novos não existem na v3: uma cena v3 com cápsula é recusada", () => {
    const s = { ...base(), version: 3 };
    const r = parseScene(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.find((i) => i.path === "parts[0]")?.message).toContain("capsule");
  });

  it("abre até a v4, recusa versão mais nova e exporta em v4", () => {
    expect(CURRENT_VERSION).toBe(4);
    const r = parseScene(serializeScene(base()));
    expect(r).toMatchObject({ ok: true, migratedFrom: null });
    if (r.ok) expect(JSON.parse(serializeScene(r.scene)).version).toBe(4);
    const newer = parseScene({ ...base(), version: 5 });
    expect(!newer.ok && newer.issues[0]?.message).toContain("lê até a 4");
  });
});

/** Os hashes das 33 cenas de teste da v3, antes do formato v4 (scenes/fixtures/hashes.json). */
const V3_HASHES: Record<string, string> = {
  "exemplos/biela-manivela": "06233377c0f61c00",
  "exemplos/cilindro-dois-pistoes": "713887709959157d",
  "exemplos/engrenagens": "13a3c088813ef6f7",
  "exemplos/lancador": "21535b84262b88a3",
  "exemplos/lancador-bancada": "337a239173c64de4",
  "exemplos/trava": "1eb2b45e72a5bdfd",
  "fixacoes/biela": "04c4dd6669ae4005",
  "fixacoes/cabo": "be117b5930a8450c",
  "fixacoes/parafuso-suporte": "5caf1dfca5a5b187",
  "fixacoes/pendulo": "d891a728a66ded89",
  "fixacoes/trava": "3b3d161d6eb1e33a",
  "multicamada/perfis": "2ac2b4c5807dce24",
  "multicamada/rasgo-no-perfil": "4a79463a93e3e449",
  "molas/apoiada": "d5fc8fd0daabea53",
  "molas/guia": "cd3ff889ff5ebae2",
  "molas/pre-carga": "8f16d7c59e297704",
  "molas/rigida": "73e67c05ca70fe24",
  "molas/solido": "67192bf5236e8f72",
  "rasgos/camadas": "2715fe333fb90818",
  "rasgos/curvo": "d2fc99a0997ccf29",
  "rasgos/mancal": "ae41078adbd76643",
  "rasgos/reto": "d7d931baa3aeb1eb",
  "gas/cargas": "7ed7269ed31a6be1",
  "gas/lei": "3ccb69e5d0a855ec",
  "gas/portas": "601b21bd9b52d1aa",
  "gas/recuo": "fff6cd4b873b09d4",
  "gas/sensor": "3b23804483e2d92f",
  "calibracao/bala": "20103ec8b4211e99",
  "calibracao/corrente": "007c1ccfc0ee15e4",
  "calibracao/pilha": "7801499766c01642",
  "calibracao/pinhao": "753fcbe7b0464bd4",
  "desempenho/desempenho": "1d244d257b98cd16",
  "exemplos/roda-e-lingueta": "e9abd8e9599f3d4c",
};

describe("migração v3 → v4: nenhum hash antigo muda", () => {
  const hashes = JSON.parse(readFileSync("scenes/fixtures/hashes.json", "utf8")) as Record<string, string>;

  it("as 33 cenas da v3 mantêm o hash gravado (o teste das cenas confere o hash rodando em v4)", () => {
    expect(Object.keys(V3_HASHES)).toHaveLength(33);
    for (const [id, h] of Object.entries(V3_HASHES)) expect(hashes[id], id).toBe(h);
  });

  const files = [
    ...readdirSync("scenes/examples")
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      .map((f) => `scenes/examples/${f}`),
    ...readdirSync("scenes/fixtures", { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "bench")
      .flatMap((d) =>
        readdirSync(`scenes/fixtures/${d.name}`)
          .filter((f) => f.endsWith(".scene.json"))
          .map((f) => `scenes/fixtures/${d.name}/${f}`),
      ),
  ];
  it.each(files)("%s aberta como v3 vira a mesma cena v4", (file) => {
    const v4 = JSON.parse(readFileSync(file, "utf8")) as Scene;
    if (v4.parts.some((p) => p.capsule) || v4.links.some((l) => l.kind === "chamber" && l.mode)) return;
    const v3 = { ...v4, version: 3 } as unknown as SceneV3;
    const r = parseScene(JSON.stringify(v3));
    expect(r).toMatchObject({ ok: true, migratedFrom: 3 });
    if (r.ok) expect(r.scene).toEqual(v4);
    expect(migrateV3ToV4(v3)).toEqual(v4);
  });
});
