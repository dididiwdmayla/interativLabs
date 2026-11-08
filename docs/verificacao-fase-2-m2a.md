# Verificação da Fase 2 · M2a — cápsula, extrator e ejetor

Sessão de 08/11/2026. Itens 8 a 12 de `docs/fases/fase-2.md`. Branch `ccr-4390794e-pn3pwt`.

## O que foi feito

| Item | Commit | Resumo |
| --- | --- | --- |
| 8 · Formato v4 | `dc6f61e` | `Part.capsule`, `chamber.mode` e `chamber.seat`; migração `v3 → v4` só troca a versão; `parseScene` abre v0 a v4 e exporta v4; os 33 hashes antigos iguais (`src/model/v4.test.ts`) |
| 9 · Motor da cápsula | `2e3c0f1` | golpe na espoleta, câmara no estojo, furo continuado pelo cano assentado, soltura da esfera, estado deflagrado, evento, sonda, sons e desenho; `ciclo/capsula-livre`, `capsula-no-cano`, `capsula-empurrada` |
| 11 · Extração e ejeção | `80f3170` | `ciclo/extrator`, `ciclo/ejetor` (com 20 variações) e `ciclo/disparo-extracao` (o ciclo numa cena só), instrumentos prontos |
| 10 · Peças do ciclo | `c12bf5b` | gaveta "Ciclo" (Cápsula, Extrator, Ejetor), cartão da cápsula com "O que é?", câmara "recebe cápsula" com a alça do assento |
| 12 · Verificação | este commit | correção da leitura de contato (queda do laboratório), rolagem lateral com a gaveta Ciclo, capturas, arquitetura §3.3 e §4 |

O item 11 entrou antes do 10 porque as peças da gaveta reaproveitam a geometria que as cenas de extração validaram.

## Como o motor faz (resumo; o detalhe está em `docs/arquitetura.md` §4, "Cápsula")

- **Golpe:** duas leituras. O evento de impacto do Box2D (≥ 100 mm/s, ponto a até metade do furo da espoleta, acima de `minStrike`) e a leitura de contato: nos contatos que começam a cada passo do motor, os pontos do estojo perto da espoleta, com a velocidade de aproximação medida antes do passo. A segunda pega o percussor que sai do repouso e bate dentro do mesmo passo. Golpe mínimo padrão 500 mm/s (a mão do app chega a 600).
- **Furo:** a cápsula é uma câmara no estojo (fundo interno atrás, esfera à frente). Assentada numa câmara `capsule` (fundo do estojo a até `seat` do fundo dela, eixo a até 0,5 mm e 3°), o furo vai até a boca do cano; solta, até a boca do estojo. A regra vale a cada passo: se o estojo sai do assento na queima, o furo volta à boca dele e o gás escapa se a esfera já passou.
- **Esfera presa:** solda rígida até o golpe, destruída no mesmo passo em que a carga acende; presa, a esfera não é bala, e volta para a boca se a colisão contínua do estojo a separar.
- **Subpassos:** o tiro e a ejeção cabem em um ou dois passos de 1/240 s; enquanto acontecem, o passo vira 8 passos do motor. Cenas sem cápsula não mudam.

## Números das cenas de ciclo (Node e Chromium iguais)

| Cena | Medida | Valor |
| --- | --- | --- |
| `capsula-livre` | v_estojo / v_esfera (esperado −m_esfera/m_estojo = −0,487) | −0,4745 (2,6% fora do exato; aceite ±5%) |
| | esfera saindo da boca do estojo, carga média | 8,97 m/s |
| `capsula-no-cano` | esfera na boca, cano de 40 mm × 10 mm | 20,16 m/s × 17,92 m/s |
| | golpe de novo na deflagrada | nada (pressão em 101,325 kPa, um só `capsule-fired`) |
| `capsula-empurrada` | abertura da solda da esfera até o golpe (a 600 mm/s) | ≤ 0,006 mm |
| | esfera na boca depois do golpe (ferrolho solto) | 17,26 m/s |
| `extrator` (500 mm/s) | diferença de deslocamento estojo × ferrolho até o ejetor | ≤ 0,056 mm |
| `ejetor` (500 mm/s) | velocidade do estojo depois do ejetor; subida acima do eixo | 0,98 m/s; 15,3 mm |
| `ejetor`, 20 variações (300–600 mm/s × início 0,05–0,17 s) | pior diferença até o ejetor; menor ejeção; menor subida | 0,38 mm (limite 0,5); 0,59 m/s (piso do aceite 0,25); 11,0 mm (piso 8) |
| `disparo-extracao` | esfera na boca | 18,20 m/s |
| | recuo do ferrolho (passa do ejetor aos 22 mm) | 23,87 mm; fecha de volta em 58 ms |
| | ejeção do estojo; subida; posição final | 0,89 m/s; 21,3 mm; deitado sobre o ferrolho, fora da caixa |
| | eixo do extrator (abertura) | 0,026 mm |
| | instrumentos: pressão da cápsula (amostrada por passo), força no eixo do extrator | pico 668 kPa; 0,23 N |

## Verificação padrão

| Verificação | Resultado |
| --- | --- |
| `npm run lint`, `npm run typecheck` | limpos, sem avisos |
| `npm test` | Vitest 1 118 passaram e 4 "expected fail" (71 arquivos); assets e áudio passam |
| `npm run build` | limpo |
| `npm run check:overflow` | 91 de 91 (com a rota `/#lab/ciclo/disparo-extracao`, a gaveta rolada até o grupo Ciclo e o "o que é" da cápsula) |
| Determinismo (`test:e2e`) | 39 hashes iguais no Node e no Chromium (os 33 antigos sem mudança, mais as 6 cenas de `ciclo/`) |
| Specs do editor | `cards-e2b` 17, `drag-e2b` 11, `hammer-e2b` 11, `hand-e2c` 8, `pencil-e2c` 11, `profiles-e2b` 3, `understand-e2d` 12, `e2a` 5, `lab` 6: todos passam |
| Capturas M2a (`capture-m2a`) | 7 de 7 |
| Abuso (modo rápido, no Vitest) | as 6 cenas de ciclo passam; `capsula-livre`, `capsula-no-cano` e `capsula-empurrada` sem marca; três falhas esperadas novas abaixo |

### `/#perf`

150 peças e 100 ligações, 1440×900, Chromium headless sem GPU, 10 s com arrasto, duas rodadas (`docs/decisoes/perf-m2a.json`). Perda: **0%**.

| Velocidade | qps mediana (M1v → M2a) | qps p5 | Quadros > 20 ms | Física, mediana por quadro |
| --- | --- | --- | --- | --- |
| Normal | 59,9 → 59,9 | 59,9 | 0 | 1,3–1,4 → 1,0–1,1 ms |
| Real | 59,9 → 59,9 | 59,5–59,9 | 0 | 4,4 → 3,5 ms |

## Achados e correções durante a verificação

- **Queda do laboratório** em `/#lab/ciclo/…` com câmara de cápsula (a página morria). Causa: a primeira leitura de contato do golpe pegava os contatos por corpo (`b2Body_GetContactData`) e chamava o motor no meio da lista; o binding devolve a lista apontando para memória que essas chamadas reaproveitam, e com dois mundos vivos (o laboratório anima um e mede o outro) o outro mundo era corrompido. Reproduzido no Node e corrigido: a leitura passou para os eventos de início de toque do mundo, copiados para valores JS antes de qualquer outra chamada. Os hashes das cenas não mudaram.
- **Golpe com o dedo:** com o golpe mínimo de 1 000 mm/s (o primeiro valor), a mão do app (600 mm/s) nunca dispararia uma cápsula. Baixou para 500 mm/s, com um rebaixo na face do ferrolho que alimenta (ele empurra só pelo aro) e o percussor da empurrada guiado com mola de retorno (não chega na espoleta por inércia). `src/engine/capsule.test.ts` arrasta um bloco com a mão contra a espoleta e confere o disparo.
- **Leitura de velocidade ao decidir os subpassos:** usava o cache do passo anterior e não via a velocidade que o roteiro ou a mão acabavam de impor.

## Falhas esperadas novas (abuso, `src/sim/abuse.test.ts`)

| Cena | Invariante | Medido | Motivo |
| --- | --- | --- | --- |
| `ciclo/extrator`, `ciclo/ejetor` | penetração | 0,311 mm, um passo (0,16 mm o que dura) | garra contra o estojo com o ferrolho sacudido a 8 Hz |
| `ciclo/disparo-extracao` | penetração | 0,313 mm, um passo | idem |

Juntas (eixo, trilho, solda da esfera) ficam abaixo de 0,03 mm em todas; nenhuma energia sem fonte cresce (a cápsula com carga conta como fonte, como a câmara).

## Capturas

Em `docs/capturas/fase-2/m2a/`:

- `gaveta-ciclo-844x390.png`, `cartao-capsula-844x390.png`, `o-que-e-capsula-844x390.png`;
- `capsula-carregada.png` (a carga em pontilhado de brasa) e `capsula-deflagrada.png` (o estojo ejetado, sem a brasa, com a marca na espoleta e o traço apagado);
- `sequencia-1-disparo.png` a `sequencia-4-ejecao.png` (Lento: o disparo, a extração, o estojo girando no ejetor e saindo pela janela);
- `instrumentos-disparo-extracao-844x390.png` e `-1440x900.png`.

## O que ficou de fora e por quê

- **Gás da cápsula desenhado durante o tiro:** a câmara do estojo não tem polígono de gás no palco (a carga some no disparo; o manômetro da câmara de cápsula mostra a pressão da cápsula assentada). Fica para a M2b, junto com o Lançador de cápsulas.
- **Respiros e portas na câmara de cápsula** (a tomada de gás): o formato aceita a câmara, mas a validação recusa respiros e portas nela até a M2b.
- **Voltar de "recebe cápsula" para "carga própria"** no cartão: a câmara perde as paredes ao virar câmara de cápsula; para voltar, refaz-se a câmara com o Martelo (o cartão avisa).
- **Medida no celular:** só o Chromium desta sessão, sem GPU.

## Riscos e pendências

- **Aro e garra:** a extração depende de duas escolhas geométricas medidas: o eixo do extrator abaixo da linha da garra e o rebaixo de 5° no aro. Sem o rebaixo (face reta) as 21 execuções também passam; acima de 0,15 (≈ 8,5°) a garra segura demais e o estojo trava nela ao girar. Um extrator desenhado à mão com o eixo acima da garra tende a soltar o aro no tranco (é física de verdade, mas vai surpreender).
- **Ejeção com gravidade:** num puxão lento o estojo sobe pouco (11 mm no pior caso) e cai deitado sobre o ferrolho. Na janela de cima de um plano vertical, uma ejeção fraca pode cair de volta no vão diante do ferrolho recuado (aconteceu em 2 de 21 execuções numa versão intermediária); a versão final passa nas 21, mas a margem é física, não garantida.
- **Subpassos:** cenas com muitas peças encostadas em cápsulas pagam 8× o passo enquanto elas andam rápido; não medido numa cena grande com cápsulas (o Lançador de cápsulas da M2b é o caso).
- **Energia do gás:** mesmo com 8 subpassos, a mola do gás é relinearizada por subpasso; a velocidade de saída é plausível e monotônica no comprimento do cano, não exata.
