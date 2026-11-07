import { describe, expect, it } from "vitest";
import { prepareScene } from "@/render/prepare";
import { profilesScene } from "../../scripts/fixtures/multicamada";
import { hammerPoint, HAMMER_GROUPS } from "./hammer";
import { dragPhrase, genderOf, hammerPhrase, idlePhrase, pencilPhrase, the, toThe, withEsc } from "./phrases";

const p = (name: string, ref = 1) => ({ name, ref });

describe("frases das ferramentas (artigo e concordância)", () => {
  it("gênero pela primeira palavra do nome", () => {
    for (const n of [
      "Base",
      "Placa 3",
      "Placa de base",
      "Lingueta",
      "Engrenagem",
      "Ação",
      "Haste-guia",
      "Mola",
    ])
      expect(genderOf(n), n).toBe("f");
    for (const n of [
      "Ferrolho",
      "Êmbolo",
      "Retém",
      "Pinhão",
      "Suporte traseiro",
      "Disco 2",
      "Came",
      "Fundo móvel",
    ])
      expect(genderOf(n), n).toBe("m");
    expect(the(p(""))).toBe("a peça 1");
    expect(toThe(p("Ferrolho"))).toBe("ao Ferrolho");
  });

  it("parafuso: presa ao fundo; une-se à outra", () => {
    expect(hammerPhrase("screw", p("Base"), null)).toBe("Parafuso: a Base fica presa ao fundo");
    expect(hammerPhrase("screw", p("Placa 3"), p("Base"))).toBe("Parafuso: a Placa 3 se une à Base");
    expect(hammerPhrase("screw", p("Disco 2"), null)).toBe("Parafuso: o Disco 2 fica preso ao fundo");
    expect(hammerPhrase("screw", p("Luva"), p("Ferrolho"))).toBe("Parafuso: a Luva se une ao Ferrolho");
  });

  it("as outras ferramentas, sem 'liga a o'", () => {
    expect(hammerPhrase("axle", p("Alavanca 7"), p("Placa de base 1"))).toBe(
      "Eixo: a Alavanca 7 gira sobre a Placa de base 1",
    );
    expect(hammerPhrase("axle", p("Retém"), null)).toBe("Eixo: o Retém gira sobre o fundo");
    expect(hammerPhrase("lock", p("Lingueta"), p("Base"))).toBe(
      "Trava: a Lingueta fica presa à Base até soltar",
    );
    expect(hammerPhrase("pin", p("Barra do gatilho"), null)).toBe(
      "Pino: preso à Barra do gatilho, atravessa para a camada vizinha",
    );
    expect(hammerPhrase("spring", p("Ferrolho"), null)).toBe("Mola: arraste do Ferrolho até a outra ponta");
    expect(hammerPhrase("slider", p("Corrediça"), null)).toBe(
      "Trilho: a Corrediça corre; arraste na direção do curso",
    );
    expect(hammerPhrase("sensor", p("Placa de base"), null)).toBe(
      "Sensor na Placa de base: toque e depois escolha o alvo",
    );
    for (const g of HAMMER_GROUPS)
      for (const tool of g.tools) {
        for (const b of [p("Base"), p("Ferrolho"), null])
          for (const a of [p("Placa"), p("Êmbolo"), null]) {
            const s = hammerPhrase(tool, b, a);
            expect(s).not.toMatch(/\b(a o|a a|de o|de a|em o|em a)\b/);
            expect(s).not.toMatch(/\s{2}|undefined|null/);
          }
        expect(idlePhrase(tool)).toMatch(/^[A-ZÁÂÃÉÊÍÓÔÕÚÇ]/);
      }
  });

  it("número com vírgula e 'Esc sai' só com teclado ou mouse", () => {
    expect(dragPhrase("spring", 12.46)).toBe("Mola: 12,5 mm · solte para cravar");
    expect(withEsc("Eixo: toque sobre uma peça", true)).toBe("Eixo: toque sobre uma peça · Esc sai");
    expect(withEsc("Eixo: toque sobre uma peça", false)).toBe("Eixo: toque sobre uma peça");
  });

  it("Lápis: 'na Placa', 'no Disco'", () => {
    const t = { form: "contour" as const, op: "cut" as const, width: 2, ruler: false };
    expect(pencilPhrase(t, p("Placa 3"))).toBe("Tirar na Placa 3: feche um laço, ou corte de borda a borda");
    expect(pencilPhrase({ ...t, form: "stroke", width: 2.5 }, p("Disco"))).toBe(
      "Borracha de 2,5 mm no Disco · um toque faz furo",
    );
    expect(pencilPhrase({ ...t, op: "add" }, null)).toBe("Somar: feche um laço; no vazio, vira peça nova");
  });

  it("hammerPoint usa as frases novas", () => {
    const { scene, piece } = profilesScene();
    piece.name = "Base";
    piece.shape = { kind: "circle", r: 10, holes: [] };
    piece.profiles = [];
    scene.links = [];
    scene.parts = [piece];
    const hit = hammerPoint(prepareScene(scene), "screw", [3, 0], 0, 0.1);
    expect(hit.phrase).toBe("Parafuso: a Base fica presa ao fundo");
  });
});
