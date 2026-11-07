import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, parsePrefs } from "./prefs";

describe("preferências de som", () => {
  it("o padrão é música e efeitos ligados", () => {
    expect(parsePrefs(null)).toEqual({ music: true, effects: true });
    expect(DEFAULT_PREFS).toEqual({ music: true, effects: true });
  });

  it("música e efeitos são separados", () => {
    expect(parsePrefs('{"music":false,"effects":true}')).toEqual({ music: false, effects: true });
    expect(parsePrefs('{"music":true,"effects":false}')).toEqual({ music: true, effects: false });
  });

  it("conteúdo estragado volta ao padrão, campo a campo", () => {
    expect(parsePrefs("não é json")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"music":"não"}')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{"effects":false}')).toEqual({ music: true, effects: false });
    expect(parsePrefs("null")).toEqual(DEFAULT_PREFS);
  });
});
