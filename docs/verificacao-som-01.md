# Verificação — Fase 1 · Parte S (som mínimo, lote som-01)

Data: 07/11/2026. Itens 18.1 a 18.4 (commits `27231cb`, `02e8c8a`, `a9b50aa`, `3d95b92`). O som é só saída: nada daqui entra na simulação, na gravação nem no hash (os 33 hashes das cenas de teste continuam iguais entre Node e Chromium).

## O que foi feito

- **18.1 · Pipeline `npm run audio`** (`scripts/audio/`). O zip do lote fica em `art/source/som-01/`, sem descompactar no repositório; o script extrai em `.cache/audio-src/` (ignorada), confere que o manifesto do zip e o `config.mjs` listam os mesmos IDs, aplica cortes e fades uma vez, normaliza pelo alvo de cada asset (loudnorm mede, um ganho linear aplica, pico real de −1,5 dBTP; os de 0,3 s pelo pico; `tic` e `tac` com o mesmo ganho, o do `tic`), converte e mede de novo. Saída: música em AAC `.m4a` 128 kbps, 48 kHz, estéreo, `faststart`; efeitos em WAV PCM 16 bits mono 48 kHz com dither triangular; `public/audio/`, `src/assets/audio-registry.ts` (tipado, com laço, alvo, volume medido, uso e "liga em") e `docs/capturas/som-01/medidas.md`. Opções `--registry-only` e `--only=`. ffmpeg pelo `ffmpeg-static` 5.3.0 (binário 7.0.2), ou `FFMPEG_BIN`.
- **18.2 · Motor enxuto** (`src/sound/`): barramentos de música e de efeitos sob um master, motor por `import()` dinâmico só depois do primeiro gesto, aba fora de foco cala e suspende, laço da música por trecho com crossfade de potência constante de 2 s, variações sem repetir a anterior, preferências no aparelho e a faixa **Som** no menu Vista (no mesmo `ToolStrip`).
- **18.3 · Sons da física:** eventos do motor (`impact`, `chamber-fired` com a dose, `lock-released`) e a vazão de gás (campo novo `flow` no estado da câmara) viajam do worker junto com os quadros e tocam quando o desenho chega ao passo deles.
- **18.4 · Sons das ferramentas:** ligados ao comando registrado, nunca ao clique.

Mudanças fora de `src/sound/`: `src/engine/chamber.ts` e `types.ts` (a dose no evento `chamber-fired` e a vazão `flow`, só leitura); `src/sim/session.ts` (`SoundEvent`, `drainSound`); o campo `sound` na resposta `frames` do worker e o laço do controlador; o item Som e a faixa na interface; `sound.play` no `commit` do store, em `setMode` e nas aberturas de faixa e cartão, e uma linha no Lápis do `Stage.tsx`. Nenhuma mensagem que já existia mudou de formato.

## Medidas do pipeline

Completas em [`docs/capturas/som-01/medidas.md`](capturas/som-01/medidas.md) (duração, LUFS, alvo, Δ, pico real, ganho aplicado, silêncio inicial, tamanho e sha256 de cada arquivo). Total: 3,69 MB em 26 arquivos (a música tem 2,45 MB; os 25 efeitos, 1,24 MB).

- **Dentro de ±1 LU do alvo, ou pelo pico nos curtos:** 22 dos 26. Os efeitos de 0,3 s (`sfx-ui`, `sfx-ratchet-*`, `sfx-clock-*`) e os dois de madeira (cortados em 0,25 s, abaixo do mínimo de 0,4 s do medidor) saem pelo pico: `sfx-ui` e `tic` em −14,0 dBTP, `ratchet` em −10,0 dBTP, `tac` 3,3 dB abaixo do `tic`, o mesmo ganho para o par (a diferença de picos do original, −8,9 contra −12,2 dBTP, sobrevive).
- **Falhas esperadas (o teto de pico impede o alvo; nada foi afrouxado):**

  | Asset | Alvo | Medido | Pico | Motivo |
  | --- | --- | --- | --- | --- |
  | `sfx-pop-strong` | −18 LUFS | −22,0 | −1,6 dBTP | o original tem pico de −2,5 dBTP com −22,9 LUFS: chegar a −18 pediria +4,9 dB, que passaria o teto em 3,4 dB |
  | `sfx-impact-1` | −24 | −27,2 | −1,6 | tique de aço: pico alto para o volume (crista); o ganho para no teto |
  | `sfx-impact-2` | −24 | −26,0 | −1,6 | idem |
  | `sfx-impact-3` | −24 | −27,7 | −1,6 | idem |

  O que ficou limitado pelo pico mas dentro de 1 LU: `sfx-stamp` (−20,0), `sfx-stamp-soft` (−24,9). Para o estouro forte continuar acima do sopro, `sfx-gas` toca 3 dB abaixo (`gainDb: -3` no `config.mjs`, aplicado no motor): no ar, o `pop-strong` fica em −22,0 e o `gas` médio em −23,0 LUFS. Alternativa se o Will quiser o `pop-strong` mais alto de verdade: um limitador no pipeline, que muda o som (decisão do coordenador sonoro).
- **Repetibilidade:** `npm run audio` duas vezes seguidas dá a mesma saída (sha256 dos 26 arquivos, do registro e das medidas idênticos; `bitexact` no ffmpeg). Outro binário do ffmpeg pode dar bytes diferentes: a saída é versionada por isso.
- **Emendas de laço** (diferença de energia ao redor do ponto, janela de 250 ms na música e 50 ms na vazão):

  | Laço | Antes | Depois | Salto | Oscilação do crossfade |
  | --- | --- | --- | --- | --- |
  | `music-bench`, 50,62 → 130,66 s (no arquivo convertido) | −24,7 dB | −24,4 dB | **0,29 dB** | 3,45 dB |
  | `sfx-vent-loop`, 0,5 → 1,5 s | −27,5 dB | −27,1 dB | **0,37 dB** | 0,16 dB |

  O critério é salto ≤ 1,5 dB. A oscilação da música (3,45 dB) é o inchaço de um crossfade de potência constante entre duas partes quase idênticas (a teoria dá +3 dB no meio do fade para sinais iguais): o laço é periódico, então as duas partes batem, e o crossfade soma em vez de mascarar. Se o Will ouvir a emenda como "respiro", o conserto é um crossfade de amplitude (soma 1) para esse caso: é uma linha em `loop.ts`.

## Mapeamento dos gatilhos

**Física** (só na execução para a frente; voltar ou arrastar a régua não toca nada; em Lento e Normal o som acompanha o tempo da simulação: o impacto toca quando o quadro dele aparece):

| Evento do motor | Efeito | Volume e tom |
| --- | --- | --- |
| `impact` entre duas peças, ≥ 150 mm/s | pela família: borracha → `sfx-impact-rubber`; madeira ou polímero → `sfx-impact-wood-1/2`; metal pesado (≥ 25 g) → `sfx-impact-heavy-1/2`; metal leve → `sfx-impact-1/2/3` | volume de 0,1 a 1 e tom de −100 a +100 centésimos de semitom, pela velocidade (150 a 6 000 mm/s, escala do log) |
| `impact` com peça de perfil `ratchet` | `sfx-ratchet-1/2`, no lugar do impacto | volume de 0,55 a 0,9 (varia pouco) |
| `chamber-fired`, carga ≤ 0,85 mmol | `sfx-gas` (fraca 0,1 → 0,67; média 0,5 → 1,0) | |
| `chamber-fired`, carga > 0,85 mmol (forte: 1,2) | `sfx-pop-strong` (0,85 a 1,0) | |
| vazão por respiro aberto ou porta ≥ 0,02 mmol/s | `sfx-vent-loop` em laço | volume de 0,2 a 1 pela vazão (cheio a 8 mmol/s), 0,1 s de fade ao parar |
| `lock-released` (toque, sensor ou fusível) | `sfx-lock-release` | |

**Ferramentas** (pelo comando registrado; desfazer e refazer não tocam):

| Quando | Efeito |
| --- | --- |
| ligação nova: parafuso, trava | `sfx-stamp` |
| ligação nova: eixo, pino | `sfx-stamp-soft` |
| ligação nova: mola, haste, cabo | `sfx-link` |
| Lápis conclui um corte ou uma soma | `sfx-cut` (uma vez por comando) |
| Montar ⇄ Testar | `sfx-mode` (uma voz por vez: a nova toma o lugar da anterior) |
| abrir a faixa do Martelo, do Lápis, das camadas, do esconder ou do Som; abrir o cartão da peça ou da ligação; abrir o "o que é" | `sfx-ui` |

Sem som, por não estarem na tabela do manifesto: trilho, rasgo, suporte elástico, câmara e sensor ao serem cravados. Os cinco efeitos da Mecânica 2.0 (`sfx-case-drop-1/-2`, `sfx-valve`, `sfx-clock-tic/-tac`) estão convertidos e no registro, sem gatilho e sem serem carregados.

## Limiares que escolhi

| O quê | Valor | Por quê |
| --- | --- | --- |
| Massa do metal pesado | **25 g** | nos exemplos, as placas de alumínio (49–165 g), a roda (37 g) e a manivela (30 g) ficam acima; cano, ferrolho, esferas e lingueta (≤ 16 g) ficam abaixo |
| Carga forte livre | **> 0,85 mmol** | entre a média (0,5) e a forte (1,2) das predefinições do cartão da câmara |
| Impacto mínimo | **150 mm/s** | acima do limiar de 100 mm/s com que o motor emite o evento; abaixo disso é toque de repouso |
| Impacto cheio | 6 000 mm/s | a esfera sai do cano a ~5 000 mm/s no Lançador |
| Teto por janela | **4 efeitos de impacto por 50 ms** | a catraca estala sem virar ruído; no máximo 24 vozes ao todo |
| Vazão mínima e cheia | 0,02 e 8 mmol/s | o tiro do Lançador chega a 65 mmol/s por 0,1 s; o vazamento depois, a 0,03 |

## Testes

- Vitest (`src/sound/`): laço (pontos e crossfade do manifesto, potência constante, variações nunca repetidas), mapeamento (material, massa e velocidade → família, volume e tom; teto por janela; gás; vazão), motor com Web Audio de mentira (música do começo do arquivo, emenda a `fim − 2 s` com o outro tocador em `início − 2 s`, aba escondida, efeitos desligados, vazão, uma voz de `sfx-mode`), sessão do Lançador com cargas de 0,1, 0,5 e 1,2 mmol (fraca e média → `sfx-gas`, forte → `sfx-pop-strong`, ganho medido da forte acima da fraca em mais de 4 dB), Roda e lingueta (os estalos da catraca saem como `sfx-ratchet`), hash de poses igual com o som ligado e sem ele, e os gatilhos das ferramentas (cada comando dispara o ID certo uma vez; desfazer, refazer, menus, vista e seleção não tocam).
- Playwright `sound-s`: nenhuma requisição a `/audio/` antes do primeiro toque; depois do toque a música toca (e os 20 efeitos da Parte S chegam, sem os da Mecânica 2.0); a aba escondida suspende o contexto e a volta retoma; música e efeitos separados, preferências de volta depois de recarregar.
- Playwright `sound-fisica-s`: no navegador, com o worker de verdade, a Roda e lingueta em Real (estalos como `sfx-ratchet`, variações sem repetir, nunca mais de 4 numa janela de 50 ms, uma soltura de trava) e o Lançador em Real (fraca soa `sfx-gas`, forte `sfx-pop-strong`, 4 dB acima em volume medido); Montar/Testar dez vezes sem acumular (no máximo uma voz de `sfx-mode`); o Lápis toca `sfx-cut` uma vez por corte e desfazer não toca.

## Desempenho (`/#perf`, 150 peças e 100 ligações, 1440×900, Chromium desta sessão)

Sem o motor de som (Web Audio desligado: o motor não nasce) e com o som ligado (música tocando; os 20 efeitos carregados), duas rodadas alternadas (`docs/decisoes/perf-som-s.json`):

| Velocidade | Variante | qps mediana · p5 | Física/quadro (mediana · p95) | Desenho/quadro (mediana · p95) | Quadros > 20 ms |
| --- | --- | --- | --- | --- | --- |
| Normal | sem motor | 59,9 · 59,5 | 1,4 · 2,2 ms | 0,5–0,6 · 1,1–2,0 ms | 9 e 4 de ~535 |
| Normal | som | 59,9 · 59,5 | 1,4–1,5 · 2,2–2,6 ms | 0,5–0,6 · 1,0–1,3 ms | 9 e 11 |
| Real | sem motor | 59,9 · 59,5 | 5,1 · 8,6–9,2 ms | 0,5–0,6 · 0,8–0,9 ms | 1 e 0 |
| Real | som | 59,9 · 59,5–59,9 | 5,1–5,2 · 7,6–9,3 ms | 0,5–0,6 · 0,9 ms | 0 e 0 |

Sem perda: os quadros por segundo são idênticos e as demais medidas ficam dentro do ruído entre rodadas (muito menos que 10%). Nessa cena sintética nenhum choque passa de 150 mm/s, então nenhum efeito tocou: o custo de tocar um efeito (mapear o evento, criar uma fonte e um ganho) foi medido nos testes do Lançador e da Roda no navegador, que rodaram a 60 qps com os efeitos soando.

## O que o Will confere no ouvido

1. **Primeiro toque:** nada soa antes dele, e depois a música entra sem estalo (2 s de fade).
2. **Emenda da música:** deixar tocar ~2 min 11 s. A primeira volta acontece sem salto (a respiração de 111 a 124 s é da música, não defeito). Se a emenda "inchar", ver a oscilação de 3,45 dB acima.
3. **Impactos:** no Lançador e na Roda e lingueta em Real, os impactos acompanham a força, a catraca estala sem empilhar e a câmara forte soa acima da fraca.
4. **Montar/Testar:** alternar várias vezes não acumula sons.
5. **Volume:** nenhum efeito cobre a música. O `sfx-pop-strong` é o mais alto (em pico empata com os que param no teto; em volume integrado ele fica em −22 LUFS, 1 dB acima do `sfx-gas` tocado a −3 dB), e o `sfx-ui` quase não se nota.
6. **Escuta pendente (manifesto):** `sfx-impact-heavy-1/-2` (podem soar como madeira) e `sfx-pop-strong` (pode soar fino). O que não servir volta para o coordenador sonoro: a troca entra só com o arquivo novo e uma linha do manifesto, sem mexer em código.

## Riscos e pendências

- **iPhone:** o contexto e os dois `<audio>` nascem dentro do manipulador do primeiro gesto, com um WAV mudo para "acordar" os tocadores. Não pude testar no Safari; é o ponto a olhar primeiro se a música não entrar no iPhone.
- **Estouro forte e impactos:** `sfx-pop-strong` e `sfx-impact-1/2/3` não chegam ao alvo de volume dentro do teto de pico (tabela acima); o ajuste fino, se for preciso, é `gainDb` por asset no `config.mjs` (e `npm run audio -- --registry-only`).
- **Vazão:** o chiado também cobre a cauda de vazamento muito baixa depois do tiro (0,03 mmol/s, volume 0,25 por ~1,5 s). Se incomodar, subir `SOUND_FLOW_MIN`.
- **Sem som por ora:** cravar trilho, rasgo, suporte, câmara e sensor; o desligar de um sensor; a faísca e o estouro de câmara sem carga (não existem no manifesto).
- A faixa do Som usa os ícones provisórios `sound`, `music` e `effects` desenhados no projeto, no traço da identidade; o coordenador visual pode refinar.
