// Configuração por asset do pipeline de áudio (npm run audio). Tudo aqui é transcrito
// de art/source/som-01/sound-manifest.md (dentro do zip), a fonte da verdade do lote.
// Tempos em segundos, no arquivo ORIGINAL; o script desconta o corte inicial.

/** Pico real máximo da saída, dBTP. */
export const TRUE_PEAK = -1.5;

/** Margem do conversor: o efeito (PCM) quase não passa do pedido; o AAC passa um pouco. */
export const PEAK_MARGIN = { sfx: 0.1, music: 0.5 };

/** Alvos de volume integrado (LUFS) por classe do manifesto. */
export const TARGETS = {
  background: -24, // fundo baixo (música)
  medium: -20, // médio
  ceiling: -18, // teto (sfx-pop-strong)
  subtle: -24, // sutil
  minimum: -28, // sutil (mínimo)
};

/** Alvos de pico (dBTP) dos efeitos de 0,3 s, curtos demais para LUFS integrado. */
export const PEAK_TARGETS = {
  subtle: -10,
  minimum: -14,
};

export const FORMATS = {
  music: { codec: "aac", bitrate: "128k", sampleRate: 48000, channels: 2, ext: "m4a" },
  sfx: { codec: "pcm_s16le", sampleRate: 48000, channels: 1, ext: "wav" },
};

/** Crossfades (s) nas emendas de laço. */
export const CROSSFADE = { music: 2, vent: 0.02 };

/** Janelas de conferência das emendas de laço (s). */
export const SEAM = { window: 0.25, maxDiffDb: 1.5 };

const lot = "som-01";
const zip = "interativlabs-som01.zip";

/**
 * Campos:
 *  id, kind ("music" | "sfx"), level (classe de volume) ou peak (classe de pico),
 *  cut: { start, end } em s do original; fadeOut em s (aplicado no fim do trecho mantido);
 *  loop: { start, end, crossfade } em s do original; matchGainOf: usa o ganho de outro asset;
 *  use: uso; on: "liga em" ("S" tem gatilho agora; M2, M3, M4 ficam para a Mecânica 2.0);
 *  gainDb: ganho fino, aplicado no motor (0 por padrão).
 */
export const AUDIO = [
  {
    id: "music-bench",
    kind: "music",
    level: "background",
    cut: { start: 0.13 },
    loop: { start: 50.75, end: 130.79, crossfade: CROSSFADE.music },
    use: "Fundo da bancada, no Montar e no Testar",
    on: "S",
  },
  {
    id: "sfx-stamp",
    kind: "sfx",
    level: "medium",
    cut: { end: 0.47 },
    fadeOut: 0.01,
    use: "Cravar parafuso e trava",
    on: "S",
  },
  { id: "sfx-stamp-soft", kind: "sfx", level: "subtle", use: "Cravar eixo e pino", on: "S" },
  { id: "sfx-link", kind: "sfx", level: "minimum", use: "Ligar mola, haste ou cabo", on: "S" },
  { id: "sfx-lock-release", kind: "sfx", level: "medium", use: "Soltar a trava no Testar", on: "S" },
  {
    id: "sfx-mode",
    kind: "sfx",
    level: "subtle",
    fadeOut: 0.08,
    use: "Trocar entre Montar e Testar",
    on: "S",
  },
  { id: "sfx-cut", kind: "sfx", level: "subtle", use: "Lápis recortando ou somando", on: "S" },
  { id: "sfx-ui", kind: "sfx", peak: "minimum", use: "Abrir faixa de ferramenta ou cartão", on: "S" },
  { id: "sfx-impact-1", kind: "sfx", level: "subtle", use: "Impacto de metal pequeno", on: "S" },
  { id: "sfx-impact-2", kind: "sfx", level: "subtle", use: "Impacto de metal pequeno", on: "S" },
  { id: "sfx-impact-3", kind: "sfx", level: "subtle", use: "Impacto de metal pequeno", on: "S" },
  { id: "sfx-impact-heavy-1", kind: "sfx", level: "subtle", use: "Impacto de metal pesado", on: "S" },
  { id: "sfx-impact-heavy-2", kind: "sfx", level: "subtle", use: "Impacto de metal pesado", on: "S" },
  {
    id: "sfx-impact-wood-1",
    kind: "sfx",
    level: "subtle",
    cut: { end: 0.25 },
    fadeOut: 0.03,
    use: "Impacto de madeira e polímero",
    on: "S",
  },
  {
    id: "sfx-impact-wood-2",
    kind: "sfx",
    level: "subtle",
    cut: { end: 0.25 },
    fadeOut: 0.03,
    use: "Impacto de madeira e polímero",
    on: "S",
  },
  { id: "sfx-impact-rubber", kind: "sfx", level: "subtle", use: "Impacto de borracha", on: "S" },
  {
    id: "sfx-ratchet-1",
    kind: "sfx",
    peak: "subtle",
    use: "Lingueta caindo num dente de catraca",
    on: "S",
  },
  {
    id: "sfx-ratchet-2",
    kind: "sfx",
    peak: "subtle",
    use: "Lingueta caindo num dente de catraca",
    on: "S",
  },
  {
    id: "sfx-gas",
    kind: "sfx",
    level: "medium",
    // O teto de pico (−1,5 dBTP) deixa o sfx-pop-strong em −22 LUFS, abaixo do alvo de −18.
    // Para a carga forte continuar acima da média no ouvido, o motor toca o gás 3 dB abaixo.
    gainDb: -3,
    use: "Câmara acendendo, carga fraca e média",
    on: "S",
  },
  { id: "sfx-pop-strong", kind: "sfx", level: "ceiling", use: "Câmara com carga forte", on: "S" },
  {
    id: "sfx-vent-loop",
    kind: "sfx",
    level: "subtle",
    loop: { start: 0.5, end: 1.5, crossfade: CROSSFADE.vent },
    use: "Gás saindo por respiro ou porta",
    on: "S",
  },
  {
    id: "sfx-case-drop-1",
    kind: "sfx",
    level: "subtle",
    use: "Cápsula vazia caindo depois da ejeção",
    on: "M2",
  },
  {
    id: "sfx-case-drop-2",
    kind: "sfx",
    level: "subtle",
    use: "Cápsula vazia caindo depois da ejeção",
    on: "M2",
  },
  { id: "sfx-valve", kind: "sfx", level: "subtle", use: "Válvula de retenção assentando", on: "M3" },
  {
    id: "sfx-clock-tic",
    kind: "sfx",
    peak: "minimum",
    use: "Escape de relógio, batida ímpar",
    on: "M4",
  },
  {
    id: "sfx-clock-tac",
    kind: "sfx",
    peak: "minimum",
    matchGainOf: "sfx-clock-tic",
    use: "Escape de relógio, batida par",
    on: "M4",
  },
].map((a) => ({
  ...a,
  source: { lot, zip, entry: `${a.id}.${a.kind === "music" ? "m4a" : "wav"}` },
  gainDb: a.gainDb ?? 0,
}));
