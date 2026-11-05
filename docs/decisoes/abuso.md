# Teste de abuso (Fase 1 · Parte F, item 14.4)

Data: 05/11/2026. O dedo maltrata cada peça móvel de cada cena de `scenes/fixtures/` (fora a bancada) e de cada exemplo, nas três velocidades (Lento, Normal, Real), como a pessoa faria no celular, e cada passo confere os invariantes da física. Código em `src/sim/abuse.ts`; modo completo por `npm run abuse` (grava `docs/decisoes/abuso.json`); modo rápido no Vitest (`src/sim/abuse.test.ts`, ~22 s: a peça mais pesada e a mais leve, Normal e Real, duas manobras, 1 s parado).

## Roteiro

Em tempo de tela, quadros de 60 Hz; o tempo simulado anda pela velocidade (o `Pacer` do app), e o dedo entra antes dos passos de cada quadro, como no app. A cena acomoda 0,2 s antes do dedo. Para cada peça móvel (uma por corpo; cenas com mais de 12 corpos usam uma amostra de 12, da mais pesada à mais leve: pilha, corrente, desempenho e o lançador de ferrolho):

1. **fora e volta**: o dedo vai até 3 vezes o tamanho da cena para fora (do centro da cena para a peça) em 0,5 s e volta em 0,5 s; solta;
2. **sacudida**: círculo de 8 Hz com raio de ¼ da cena, por 1 s; solta;
3. **soltura no meio**: o dedo dispara para fora e solta com 0,15 s de movimento.

Depois de soltar, 2 s simulados parados. São 3 velocidades × 3 manobras por peça: 837 execuções no total.

## Invariantes (a cada passo)

| Invariante | Como é medido |
| --- | --- |
| Eixo, haste, trilho, rasgo em junta e solda rígida abrem ≤ 0,5 mm | `gap` do eixo, `|deviation|` do rasgo, `|comprimento − desenhado|` da haste, desvio transversal e passagem do curso do trilho e do rasgo (diagnóstico do motor), `offset` do suporte de 0 Hz. O parafuso soma as peças num corpo só: não abre por construção |
| Cabo ≤ comprimento + 0,5 mm | `length − maxLength` |
| Suporte elástico ≤ 5 × deflexão estática + 2 mm | `offset` dividido pelo limite da ligação (deflexão estática: média de 1,5 a 2 s sem dedo); a tabela mostra a razão (≤ 1) |
| Pino em rasgo por contato não sai do furo | o centro do pino não passa da parede: `−(folga + r)` ≤ 0 |
| Penetração entre peças < 0,3 mm | contato mais fundo do passo (`contactsDepthMax`), com as duas peças |
| Velocidade ≤ 2 000 mm/s | maior velocidade do centro de massa das peças móveis dentro da caixa da cena com meio tamanho de margem (a que caiu da cena está em queda livre para sempre: não há chão fora dela). Não se aplica às cenas com gás e à da bala |
| Energia sem fonte não cresce mais de 2% em 1 s | depois de soltar, em cenas sem motor e sem gás: energia cinética + potencial (gravidade e todas as molas: Hooke com o modo, trilho, torção e a mola macia da junta soldada do suporte), crescimento sobre o mínimo da janela de 1 s, relativo à energia acima da menor potencial vista, com piso de ruído de 0,05 mm contra o peso e contra as molas |
| Sem NaN | poses e estado dos corpos |

A coluna "Penetração de 2 passos" não é invariante: é a sobreposição que dura dois passos seguidos, para separar o impacto (um passo) do aperto que fica.

## Resultado: antes → depois

"Antes" é o motor no começo desta parte, com o arrasto antigo (`docs/decisoes/abuso-antes.json`, rodado com o mesmo roteiro); "depois" é com a mão nova (item 14.3) e as correções abaixo (`docs/decisoes/abuso.json`). Uma célula só com um número não mudou. ✗ = falha.

| Cena | Peças | Juntas ≤ 0,5 mm | Cabo | Suporte ≤ 1 | Pino no furo | Penetração < 0,3 | Velocidade ≤ 2 000 | Energia ≤ 2% | NaN | Penetração de 2 passos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| calibracao/bala | 1 | — | — | — | — | 0,052 → 0,000 | — | 0,00 | não | 0,025 → 0,000 |
| calibracao/corrente | 12 (amostra) | 1,976 ✗ → 1,044 ✗ | — | — | — | 5,560 ✗ → 4,460 ✗ | 4 856 ✗ → 3 295 ✗ | 252,27 ✗ → 7,90 ✗ | não | 4,384 → 3,215 |
| calibracao/pilha | 12 (amostra) | — | — | — | — | 11,708 ✗ → 10,002 ✗ | 18 512 ✗ → 5 478 ✗ | 72,18 ✗ → 202,32 ✗ | não | 10,329 → 9,498 |
| calibracao/pinhao | 2 | 0,158 → 0,138 | — | — | — | 1,432 ✗ → 1,253 ✗ | 5 921 ✗ → 808 | — | não | 1,325 → 0,559 |
| desempenho/desempenho | 12 (amostra) | 3,620 ✗ → 0,074 | 0,631 ✗ → 0,113 | 0,000 | 0,000 | 5,258 ✗ → 4,062 ✗ | — | — | não | 2,849 → 2,854 |
| fixacoes/biela | 2 | 0,028 → 0,004 | — | — | — | 0,000 | 101 → 98 | — | não | 0,000 → 0,000 |
| fixacoes/cabo | 1 | — | 0,341 → 0,003 | — | — | 0,000 | 9 878 ✗ → 646 | 0,51 → 0,89 | não | 0,000 → 0,000 |
| fixacoes/parafuso-suporte | 1 | — | — | 6,747 ✗ → 0,971 | — | 0,000 | 8 947 ✗ → 665 | 5,21 ✗ → 0,00 | não | 0,000 → 0,000 |
| fixacoes/pendulo | 1 | 0,051 → 0,003 | — | — | — | 0,000 | 7 499 ✗ → 1 231 | 0,20 → 0,21 | não | 0,000 → 0,000 |
| gas/cargas | 3 | 0,033 → 0,250 | — | — | — | 4,997 ✗ → 2,079 ✗ | — | — | não | 1,069 → 0,673 |
| gas/lei | 1 | 0,033 → 0,250 | — | — | — | 0,000 | — | — | não | 0,000 → 0,000 |
| gas/portas | 2 | 0,033 → 0,132 | — | — | — | 0,000 | — | — | não | 0,000 → 0,000 |
| gas/recuo | 2 | 1,506 ✗ → 0,010 | — | — | — | 9,508 ✗ → 0,188 | — | — | não | 8,874 → 0,049 |
| gas/sensor | 3 | 0,033 → 0,250 | — | — | — | 4,997 ✗ → 2,079 ✗ | — | — | não | 1,069 → 0,673 |
| molas/apoiada | 2 | 0,017 → 0,004 | — | — | — | 0,000 | 5 238 ✗ → 973 | 1,65 → 0,56 | não | 0,000 → 0,000 |
| molas/guia | 1 | 0,019 → 0,005 | — | — | — | 0,000 | 8 109 ✗ → 967 | 0,00 | não | 0,000 → 0,000 |
| molas/pre-carga | 1 | 0,022 → 0,012 | — | — | — | 0,000 | 1 296 → 664 | 0,00 → 0,11 | não | 0,000 → 0,000 |
| molas/rigida | 1 | 0,022 → 0,250 | — | — | — | 0,000 | 6 722 ✗ → 1 049 | 0,00 | não | 0,000 → 0,000 |
| molas/solido | 1 | 0,016 → 0,002 | — | — | — | 0,000 | 4 979 ✗ → 918 | 0,00 → 0,44 | não | 0,000 → 0,000 |
| rasgos/camadas | 2 | — | — | — | — | 3,791 ✗ → 0,624 ✗ | 22 611 ✗ → 3 383 ✗ | 10,75 ✗ → 2,67 ✗ | não | 0,162 → 0,021 |
| rasgos/curvo | 1 | — | — | — | 0,000 | 0,415 ✗ → 0,200 | 9 575 ✗ → 1 122 | 1,75 → 1,78 | não | 0,194 → 0,134 |
| rasgos/mancal | 1 | — | — | — | 0,000 | 0,382 ✗ → 0,221 | 3 210 ✗ → 1 117 | 0,00 | não | 0,341 → 0,111 |
| rasgos/reto | 1 | 0,620 ✗ → 0,012 | — | — | — | 0,000 | 8 416 ✗ → 1 369 | 0,36 → 0,31 | não | 0,000 → 0,000 |
| exemplos/biela-manivela | 2 | 0,026 → 0,004 | — | — | — | 0,000 | 95 → 49 | — | não | 0,000 → 0,000 |
| exemplos/cilindro-dois-pistoes | 3 | 3,900 ✗ → 0,010 | — | — | — | 11,555 ✗ → 0,131 | — | — | não | 8,961 → 0,070 |
| exemplos/engrenagens | 4 | 0,004 → 0,015 | — | — | — | 0,575 ✗ → 0,394 ✗ | 110 → 220 | — | não | 0,120 → 0,081 |
| exemplos/lancador-ferrolho | 12 (amostra) | 5,805 ✗ → 2,901 ✗ | — | — | 0,000 | 5,846 ✗ → 5,390 ✗ | — | — | não | 5,578 → 5,124 |
| exemplos/lancador | 4 | 21,065 ✗ → 0,025 | — | — | — | 1,739 ✗ → 0,934 ✗ | — | — | não | 1,525 → 0,458 |
| exemplos/trava | 2 | 0,105 → 0,015 | — | — | — | 1,834 ✗ → 0,649 ✗ | 3 696 ✗ → 712 | 2,28 ✗ → 0,00 | não | 0,598 → 0,307 |


## O que falhava, a causa e a correção

| Cena · invariante | Antes | Causa | Correção | Depois |
| --- | --- | --- | --- | --- |
| Cabo · velocidade | 9 878 mm/s | força do arrasto ~98 vezes a do protótipo (12 N num peso de 20 g) e o alvo seguindo o dedo sem limite | a mão (14.3): 10 × peso, alvo a ≤ 600 mm/s | 646 mm/s |
| Parafusado × suporte elástico · suporte | 6,75 × o limite (barra arrancada) | a mesma força | teto do suporte elástico na mão | 0,97 |
| Pêndulo, molas, rasgos · velocidade | 3 a 9 m/s | a mesma força, sem limite de velocidade | a mão | 0,9 a 1,4 m/s |
| Rasgo reto · junta | 0,62 mm | a mesma força | a mão | 0,012 mm |
| Recuo do fundo · junta e penetração | 1,51 mm · 9,5 mm | a mesma força | a mão | 0,010 mm · 0,19 mm |
| Cilindro de dois pistões · junta e penetração | 3,9 mm · 11,6 mm | **bug do gás**: o pistão que sai do cilindro e cai continuava sendo parede da câmara; quando a projeção dele no eixo voltava para dentro do furo, o volume ficava minúsculo e a mola do gás o puxava de volta de metros de distância (com a mão nova, o pistão arrastado subia de 3,6 m a 27 m/s) | parede com a face a mais de 1,5 raio da linha do eixo saiu do cilindro: a câmara fica aberta, sem força nem rigidez (`ChamberSim.breached`, teste em `src/engine/chamber.test.ts`) | 0,011 mm · 0,13 mm |
| Lançador (protótipo) · junta | 21 mm | a força do arrasto arrancava a esfera | a mão | 0,025 mm |
| Desempenho · junta e cabo | 3,62 mm · 0,63 mm | a força do arrasto | a mão | 0,074 mm · 0,11 mm |
| Desempenho · penetração em repouso | 1,41 mm parada, sem dedo | **parâmetro da cena**: o motor do braço com 40 N·mm empurrava o pino contra um bloco de 0,35 g (3 N; o contato macio do Box2D é proporcional à massa e afunda) | motor de 2 N·mm (o braço com a engrenagem pesa ~0,4 N·mm) | 0 parada |
| Corrente · junta (durante a correção) | — | a peça na mão virava "bala" do Box2D (14.3); a colisão contínua de bala não respeita as juntas e prendia o elo no vizinho: 13,9 mm | a mão não usa mais bala | 1,04 mm (antes da mão: 1,98) |
| Trava · energia | 2,28% | a força do arrasto | a mão | 0,001% |

## Falhas esperadas (sem conserto nesta parte)

1. **Penetração no impacto entre peças móveis** (pilha, corrente, pinhão, desempenho, cargas, sensor, camadas, engrenagens, trava, os dois lançadores). O Box2D v3 só cria o ponto de contato quando as peças estão a 0,1 mm (a distância especulativa é 4 vezes a folga linear, 0,025 mm com `lengthUnits` 5, escolhida pelas engrenagens de módulo 1). Com o passo de 1/240 s, uma peça a 0,5 m/s anda 2 mm por passo: no passo do choque elas se sobrepõem quase isso, e o contato desfaz no passo seguinte. Medido à parte, uma esfera de 6 mm caindo sobre outra: de 20 mm (0,63 m/s) sobrepõe 1,87 mm; de 50 mm (0,99 m/s), 3,34 mm; de 100 mm (1,4 m/s), 4,47 mm. A colisão contínua do Box2D só vale contra peças fixas (ou para "bala" contra peças comuns, que não respeita as juntas). Para ficar abaixo de 0,3 mm no choque, as peças precisariam se aproximar a menos de ~100 mm/s; o conserto é um passo menor ou uma distância especulativa maior, as duas decisões fechadas da calibração (`docs/decisoes/motor.md`). A coluna de 2 passos mostra que, fora a pilha e a corrente (abaixo), o que fica é pequeno.
2. **Pilha e corrente** (cenas de estresse da calibração). Tirar uma caixa do meio da pilha de 200 derruba a pilha: caixas caindo de até 200 mm se chocam a 1–2 m/s e se sobrepõem até 10 mm (2 passos: 9,5 mm, quase atravessando a de 10 mm), e o contato, ao desfazer a sobreposição, devolve energia (202%). Velocidade de 5,5 m/s: queda livre de caixas. A corrente de 40 elos chicoteada pela mão: a ponta passa de 3 m/s (o chicote concentra a energia), os eixos abrem 1,04 mm e os elos se chocam (4,5 mm). As duas existem para medir o motor no limite; com o dedo, passam do limite.
3. **Rasgo em camadas · velocidade e energia.** A própria cena solta a peça com pino de 392 mm de altura (2,8 m/s sem dedo); levantada pela mão, ela cai de 670 mm (3,4 m/s). O choque da queda (0,6 mm de sobreposição) devolve 0,0014 mJ, 2,7% da energia que sobra.
4. **Lançador de ferrolho · junta 2,9 mm** (a barra do gatilho sacudida emperra o pino no rasgo do corpo). O exemplo é substituído pelo lançador de bancada no item 14.5.

## Rodar

- Rápido (Vitest, ~22 s): `npx vitest run src/sim/abuse.test.ts`.
- Completo (~6 min): `npm run abuse` (ou `npm run abuse -- saída.json filtro`; `ABUSE_SAMPLE=n` muda a amostra das cenas grandes).
