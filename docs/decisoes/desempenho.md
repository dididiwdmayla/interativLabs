# Desempenho do palco (Fase 1 · item 6.7)

Meta do `AGENTS.md`: 60 quadros por segundo com 150 peças e 100 ligações num celular intermediário. Medido na página `/#perf`, com a cena sintética `scenes/fixtures/desempenho/desempenho.scene.json` (gerada por `npm run fixtures -- desempenho`): 150 peças e 100 ligações de todos os tipos em 4 camadas, com hachuras de todos os materiais, ferragens, molas e uma câmara. A página roda a cena no palco real a 1× por 10 s, com um arrasto roteirizado de 2 s a 8 s, e descarta o primeiro segundo (aquecimento).

- **Quadros por segundo:** mediana e p5 de 1000 / intervalo entre quadros (`requestAnimationFrame`).
- **Física por quadro:** tempo de passos + snapshots no worker que chegou naquele quadro.
- **Desenho por quadro:** escrita dos `transform` e das ligações no SVG (só JavaScript; a pintura do navegador entra nos quadros por segundo).

## Resultados

Chromium 153 headless desta sessão (Linux, 4 núcleos, sem GPU: rasterização por software), densidade 1, três rodadas cada.

| Aparelho | Janela | qps mediana | qps p5 | Quadros > 20 ms | Física/quadro (mediana · p95) | Desenho/quadro (mediana · p95) |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium da sessão | 390×844 | 59,9 | 59,5–59,9 | 0–1 de 541 | 6,3–6,5 ms · 9,8–10,4 ms | 0,8 ms · 1,2–1,3 ms |
| Chromium da sessão | 1440×900 | 59,9 | 59,5 | 16–25 de ~520 | 7,6–7,7 ms · 14,5–18,0 ms | 0,8 ms · 3,4–5,6 ms |
| Celular do Will | — | — | — | — | — | — |
| Computador do Will | — | — | — | — | — | — |

As linhas do Will ficam para depois do merge: abrir `/#perf`, tocar em "Rodar 10 s" e colar o resultado ("Copiar resultado") no chat.

### Com a interpolação (Parte F, item 14.2)

A página `/#perf` ganhou a escolha da velocidade (Real, o padrão da medição; Normal; Lento) e a linha "interpolação por quadro" (média, porque o relógio do navegador tem 0,1 ms de resolução). Chromium headless desta sessão, 1440×900, densidade 1 (`tests/e2e/parte-f.spec.ts`, `docs/decisoes/perf-parte-f.json`):

| Velocidade | qps mediana · p5 | Quadros > 20 ms | Passos por quadro | Física/quadro (mediana · p95) | Desenho/quadro (mediana · p95) | Interpolação/quadro (média · p95) |
| --- | --- | --- | --- | --- | --- | --- |
| Lento (1/20) | 59,9 · 59,5 | 1 de 541 | 0,2 | 0,0 · 1,5 ms | 0,5 · 0,7 ms | 0,008 · 0,0 ms |
| Normal (¼) | 59,9 · 59,9 | 0 de 541 | 1,0 | 1,1 · 1,5 ms | 0,5 · 0,8 ms | 0,004 · 0,0 ms |
| Real (1×) | 59,9 · 59,5 | 0 de 541 | 4,0 | 3,7 · 6,9 ms | 0,5 · 0,7 ms | 0,004 · 0,0 ms |

Em Lento o desenho agora roda em todo quadro (antes, só nos quadros em que chegava um passo, ~1 em 5): o custo é a escrita dos `transform` (0,5 ms de mediana), igual à de Normal.

## Instrumentos e comparação (Fase 2 · M1v)

`/#perf` ganhou duas opções: **4 sondas** (as quatro leituras mais caras da cena: folga entre formas, força de contato de um rasgo, torque de um eixo com motor e força de um trilho, com o painel Instrumentos aberto) e **Comparação e fantasma** (as duas variantes repetidas com as mesmas entradas, o fantasma da B desenhado sobre a A e o painel com as curvas das duas; a B tem o motor do eixo 20% mais rápido). Chromium headless desta sessão, 1440×900, densidade 1, 150 peças e 100 ligações, 10 s com arrasto, duas rodadas alternadas, uma página nova a cada rodada (`tests/e2e/perf-m1v.spec.ts`, `docs/decisoes/perf-m1v.json`). Aceite: perda abaixo de 10%.

| Situação | Velocidade | qps mediana | qps p5 | Quadros > 20 ms | Física/quadro (mediana · p95), ms | Desenho/quadro (mediana · p95), ms |
| --- | --- | --- | --- | --- | --- | --- |
| Sem sondas | Normal | 59,9 | 59,9 | 0 de ~542 | 1,3–1,4 · 1,8–1,9 | 0,6–0,8 · 0,9–1,1 |
| Sem sondas | Real | 59,9 | 59,9 | 0 de ~542 | 4,4 · 7,0–7,7 | 0,6 · 0,9 |
| 4 sondas | Normal | 59,9 | 59,5–59,9 | 0–5 de ~541 | 1,3–1,6 · 2,0–3,7 | 0,6–0,8 · 0,9–1,5 |
| 4 sondas | Real | 59,9 | 59,9 | 0 de ~542 | 4,9 · 7,1–7,6 | 0,6 · 0,9–1,1 |
| Comparação e fantasma | Normal | 59,9 | 59,9 | 1–3 de ~538 | — (repetida antes) | 0,8 · 1,2–1,3 |
| Comparação e fantasma | Real | 59,9 | 59,5 | 0–1 de ~538 | — (repetida antes) | 0,9–1,2 · 1,3–1,5 |

Perda: **0%** nos quadros por segundo (mediana 59,9 nas três situações) e no máximo 1% dos quadros acima de 20 ms (5 de 539 no pior caso). As 4 sondas custam ~0,1–0,5 ms de física por quadro (as leituras de contato e de distância, uma vez por passo). Na comparação a física não aparece por quadro porque as duas variantes são repetidas antes de a reprodução começar; para 2 × 2 400 passos desta cena isso leva alguns segundos (não medido à parte) e o painel mostra "Preparando comparação…" até acabar.

**O que a medida achou e foi corrigido.** A primeira rodada da comparação deu p5 de 30 qps e 31–50 quadros acima de 20 ms de ~500 (6–10%): ligar ou desligar o fantasma quase não mudava isso, e o culpado era o painel. A cada quadro o gráfico montava o texto do traço com **todos** os pontos da execução (2 400 por sonda, duas curvas) e só então recortava pela janela de 0,5 s. Agora ele monta só o trecho visível (mais um ponto de cada lado) e acha a escala e os extremos numa passada só. Depois disso: 0–5 quadros acima de 20 ms de ~540. A opção `window.__PERF_GHOST__ = false` na página mede a comparação sem o fantasma, para separar os custos.

**Memória das amostras (execução longa).** Cada sonda guarda exatas as amostras dos últimos 10 s (o que o palco ainda tem de poses) e, antes disso, só o mínimo e o máximo de cada 12 passos, afinados de novo acima de 6 000 pontos. Numa execução de 60 s do Lançador com as 4 sondas prontas ficam 18 404 amostras, de 57 604 (32%); o teto é de ~8 700 por sonda, por mais longa que seja a execução.

## Onde o tempo ia e o que foi corrigido

Primeira medida, com a física no thread principal e uma folha SVG só: **mediana 59,9, p5 29,9**, 155 de 377 quadros acima de 20 ms (1440×900). Medido por partes:

1. **Física no thread principal.** O Box2D calibrado (16 subpassos) custa ~1,5 ms por passo nesta cena; a 1× são 4 passos por quadro (~6–9 ms). Com a câmera lenta em 0,05× (física quase parada), o desenho sozinho dava 59,9 / 59,5. **Correção:** a sessão roda num Web Worker (`src/ui/sim/sim.worker.ts`); o thread principal pede os passos do quadro, recebe os quadros de cada passo, espelha a gravação e só desenha. O determinismo e a volta pela linha do tempo não mudam (a SimSession é a mesma, testada em `src/sim/session.test.ts`).
2. **Repintura das peças fixas.** Mexer numa peça invalidava a folha inteira, e as placas grandes com hachura eram rasterizadas de novo a cada quadro (escondê-las dava 59,9 / 59,5). **Correção:** a cena é montada em folhas `<svg>` compostas à parte (`will-change: transform`), uma com o que fica parado e outra com o que se move por camada, mais as folhas de definições e de chamadas. As fixas ficam em cache no compositor.
3. **Parede das peças móveis.** Depois de 1 e 2, a 0,25× ainda sobravam ~60 quadros longos; escondendo só a parede das peças móveis, 8–24. É uma segunda cópia com traço de cada peça móvel, repintada a cada quadro. **Correção:** orçamento de pintura (`WALL_BUDGET` em `src/render/SceneSvg.tsx`): com mais de 40 peças móveis, a parede delas não é desenhada no Simular. No Editar e nas peças fixas ela continua; os cinco exemplos têm menos de 10 peças móveis e não são afetados.

Também saiu do pacote principal o que não precisa estar nele (ver abaixo).

## Pacotes

Build de produção (`vite build`), gzip nível 9.

| Pacote | Quando carrega | Bruto | gzip |
| --- | --- | --- | --- |
| `index` (app principal: casca, renderizador, geometria com Clipper2) | ao abrir | 353,5 KB | 108,4 KB |
| `index` no `main` antes desta parte (casca vazia) | — | 231,3 KB | 71,8 KB |
| `index.css` | ao abrir | 27,5 KB | 5,9 KB |
| `scene` (schema Zod e migrações) | junto com a primeira cena | 115,4 KB | 33,2 KB |
| `controller` (laço, linha do tempo) | ao entrar no Simular | 7,4 KB | 2,6 KB |
| `sim.worker` + adaptador + runtime + `engine-box2d` | ao entrar no Simular (worker) | 6,0 + 11,4 + 95,4 + 30,1 KB | 2,2 + 4,1 + 30,6 + 11,1 KB |
| `Box2D.compat.wasm` | ao entrar no Simular | 597,6 KB | 207,8 KB |
| `PerfPage` | só em `/#perf` | 4,8 KB | 2,1 KB |

O renderizador usa `shapeOutline` (`src/geometry/outline.ts`), que dá o mesmo contorno e a mesma massa de `shapeGeometry` sem a decomposição convexa: o earcut não entra no pacote principal.

## Pendências

- Medir no celular do Will. Se o p5 ficar abaixo de 50, os próximos candidatos são: baixar o orçamento da parede, trocar a hachura das peças móveis por tom liso durante o Simular e diminuir a densidade de pixels das folhas móveis.
- O tempo de física (~1,5 ms por passo nesta cena) é o do Box2D calibrado com 16 subpassos; não mudou nesta parte. No celular, se o worker não der conta de 4 passos por quadro, a simulação a 1× fica mais lenta que o tempo real (o acumulador descarta o atraso acima de 40 passos), mas o desenho continua fluido.
