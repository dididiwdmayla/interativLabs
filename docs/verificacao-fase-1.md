# Verificação — Fase 1 (fundação) · fechamento (Parte S + E3)

Data: 07/11/2026. Este documento consolida a fase: o que cada parte entregou, o que ficou de fora e por quê, as medidas pedidas e as falhas esperadas que continuam. O som (Parte S) tem o relatório próprio em [`verificacao-som-01.md`](verificacao-som-01.md). Cada parte tem o seu relatório com o detalhe dos itens, dos aceites e das capturas; aqui está o resumo e o caminho até ele.

## O que cada parte entregou

| Parte | Itens | O que entrou | Verificação |
| --- | --- | --- | --- |
| **A** | 1–2 | Projeto Vite + React + TypeScript estrito, ESLint, Prettier, Vitest, Playwright, tokens da Prancha índigo, fontes locais, casca sem rolagem lateral em 360, 390 e 412 px; formato de cena v1 (Zod, mensagens em português, ids) com migração do protótipo (as três cenas v0 migram e voltam sem perda). Commits `bfa7fe6`, `5117bd7` | sem relatório próprio: aceites do `docs/fases/fase-1.md` cobertos por `src/model/*.test.ts` e `check:overflow` |
| **B** | 3–4 | Geometria (Clipper2, furos, rasgos, decomposição convexa, engrenagem evolvente, catraca, cremalheira); comparativo de motores (Planck, Rapier, Box2D v3) com oito cenas de medição e a página `/#bench`. Commits `e71fd72`, `48e0f96` | [`decisoes/geometria.md`](decisoes/geometria.md) e [`decisoes/motor.md`](decisoes/motor.md) |
| **C** | 5 | Motor definitivo: Box2D v3 calibrado para gravidade real em mm, determinístico entre Node e Chromium; formato v2 (espessura por camada, densidades reais); parafuso, eixo, haste, cabo, suporte elástico e trilho; molas 2.0; furos e rasgos como guias; gás 2.0 (paredes móveis, respiros, portas, sensores com ações); cenas de teste e exemplos | [`verificacao-fase-1-parte-c.md`](verificacao-fase-1-parte-c.md) |
| **C2** | 12 | Objeto padrão: lançador de esferas de brinquedo com ferrolho que recua pelo gás, com ciclo completo medido | [`verificacao-fase-1-parte-c2.md`](verificacao-fase-1-parte-c2.md) |
| **D** | 6 | Palco vivo: renderizador definitivo na pele da Prancha índigo (contorno, parede, chanfro, sombra entre camadas, hachuras, ferragens e molas do lote 01, chamadas), modo Simular com câmera lenta e linha do tempo, arrasto com o dedo, física num Web Worker | [`verificacao-fase-1-parte-d.md`](verificacao-fase-1-parte-d.md) |
| **E1** | 10 | Pipeline de assets (`npm run assets`): manifesto, WebP 1x/2x, registro tipado com âncoras e mm por pixel, folhas de contato, conferência 3×3 das texturas. Commits `a647c5b` a `4d0a15d` | folhas de contato em `capturas/lote-01/`; sem relatório próprio |
| **E2a** | 7–9 | Editor tátil: comandos com desfazer e refazer, layout em paisagem e retrato, tela cheia e app instalável, menus circulares de borda, seleção com alças e encaixe, gaveta de peças prontas, pilha de camadas, projetos salvos | [`verificacao-fase-1-parte-e2a.md`](verificacao-fase-1-parte-e2a.md) |
| **F** | 14 | Correções do primeiro teste real: velocidades Lento, Normal e Real, câmera lenta com interpolação, mão com força limitada, teste de abuso em todas as cenas, Lançador de bancada como exemplo-vitrine | [`verificacao-fase-1-parte-f.md`](verificacao-fase-1-parte-f.md) |
| **E2b** | 13 | Formato v3 (perfis por camada, trava), Martelo (fixar, ligar, guiar, gás), cartões de ligação com predefinições e alças, peça multicamada, exemplo Roda e lingueta | [`verificacao-fase-1-parte-e2b.md`](verificacao-fase-1-parte-e2b.md) |
| **E2c** | 15 | Acertos do teste (vista parada, cursor deslocado, faixa presa à borda, câmara pela regra nova), Lápis (contorno, traço com largura, régua) e caneta | [`verificacao-fase-1-parte-e2c.md`](verificacao-fase-1-parte-e2c.md) |
| **E2d** | 16 | Camadas em cores (afastar e isolar), esconder peça, cartões "o que é" e rastro. Versão do Opus (PR #11); a do Astra (PR #10) foi revertida no PR #12 | [`verificacao-fase-1-parte-e2d.md`](verificacao-fase-1-parte-e2d.md) |
| **S** | 18 | Som mínimo: pipeline `npm run audio`, motor enxuto, sons da física e das ferramentas, faixa **Som** no menu Vista | [`verificacao-som-01.md`](verificacao-som-01.md) |
| **E3** | 11 | Esta verificação, as capturas finais e o README | este documento |

## O que ficou de fora e por quê

- **Medidas no celular do Will.** O comparativo de motores (item 4), o `/#perf` (item 6 e partes seguintes) e a escuta do som foram medidos no Node e no Chromium desta máquina (Linux, 4 núcleos, sem GPU), não no celular. As linhas do aparelho ficam para depois do merge, com o roteiro de cada parte.
- **Efeitos visuais** (pontilhado do gás, leque do escape, faíscas) e **falhas de tinta:** Fase 2.
- **Service worker (uso sem rede), GSAP e ícones definitivos do app:** o app roda sem eles (transições em CSS com os tokens; ícone provisório até o coordenador visual).
- **Os cinco efeitos sonoros da Mecânica 2.0** (estojo caindo, válvula, escape de relógio) e as ligações que o manifesto não cobre (trilho, rasgo, suporte, câmara e sensor ao cravar) ficam sem gatilho até a peça existir.
- **A oficina guiada** (antes o item 17) foi para a Fase 3, depois da Mecânica 2.0, para as receitas já usarem o ciclo, o escape e a bomba.
- **A versão em perspectiva do afastamento de camadas** (vista explodida) continua numa fase própria; o afastamento atual é 2,5D, só por `transform`.

## Medidas

### Comparativo de motores (item 4)

Completo em [`decisoes/motor.md`](decisoes/motor.md) (oito cenas, quatro motores, Node e Chromium, penetração, tremor, determinismo, tamanho). Resumo: em cena leve todos ficam abaixo de 0,2 ms por passo; na pilha de 200 caixas o Box2D é o mais rápido (0,15 ms no Node, 0,16 no Chromium; Rapier 0,27–0,30; Planck 0,65–1,09). Contato macio (Rapier e Box2D) afunda 1,35 mm numa pilha de 20 caixas em 3 s e 0,135 mm no pinhão; o Planck (contato rígido) passa nos dois, mas usa `Math.sin` e `Math.cos` por dentro e não pode garantir o mesmo hash entre aparelhos. **Decisão (04/11): Box2D v3 (`box2d3-wasm`), 1 mm por unidade, passo de 1/240 s**, calibrado na Parte C para gravidade real (pilha e corrente passam).

### Desempenho (item 6 e partes seguintes)

Meta: 60 quadros por segundo com 150 peças e 100 ligações. `/#perf`, Chromium 153 desta máquina (sem GPU), 1440×900:

| Momento | Variante | qps mediana · p5 | Física/quadro (mediana · p95) | Desenho/quadro (mediana · p95) |
| --- | --- | --- | --- | --- |
| Parte D (item 6.7) | 1×, 3 rodadas | 59,9 · 59,5 | 7,6–7,7 · 14,5–18,0 ms | 0,8 · 3,4–5,6 ms |
| Parte F | Lento · Normal · Real | 59,9 · 59,5–59,9 | 0,0–3,7 · 1,5–6,9 ms | 0,5 · 0,7–0,8 ms |
| Parte E2d | base, cores afastadas, rastro (Normal e Real) | sem perda | — | — |
| **Parte S (esta)** | **sem motor de som × som ligado** (Normal e Real, 2 rodadas) | **59,9 · 59,5 nos dois** | **Normal 1,4 · 2,2–2,6 ms; Real 5,1–5,2 · 7,6–9,3 ms** | **0,5–0,6 · 0,8–2,0 ms** |

Com o som ligado (música tocando, 20 efeitos carregados) não há perda: os quadros por segundo são idênticos e as demais medidas ficam dentro do ruído entre rodadas (`decisoes/perf-som-s.json`). Pacotes: o motor de som chega por `import()` dinâmico só depois do primeiro gesto; nenhum arquivo de `/audio/` é pedido antes disso (teste `sound-s`).

### Hashes (determinismo)

**33 cenas de teste, 33 hashes iguais entre Node e Chromium** (`npm run test:e2e`, projeto `determinism`; `scenes/fixtures/hashes.json`). Desde a Parte S nenhum hash mudou: o som é só saída (o evento da câmara ganhou a dose e o estado a vazão, ambos fora do hash de poses; um teste confere o hash de poses com o som ligado e sem ele). O código comum não usa as funções transcendentais do JS (usa `src/geometry/dmath.ts`, com portes do fdlibm), que era a causa do único hash diferente do comparativo (Box2D na cena 3, no item 4).

## Falhas esperadas que continuam

Nenhum aceite foi afrouxado. O que não passou continua marcado, com o motivo e os números (`it.fails` no Vitest: uma falha esperada que passa reprova o teste).

1. **Bancada antiga, catraca da cena migrada (3 motores) e razão das velocidades no Rapier** (as 4 falhas esperadas do Vitest, em `scenes/fixtures/bench/bench.test.ts`). Com contato exato, a lingueta da cena migrada desce até o batente de −25° antes de segurar: a catraca gira ~28° no Planck, ~34° no Rapier e ~35° no Box2D, contra o limite de 25,7°. No protótipo o Planck a 10 mm/un parava em 24° pela pele de 0,1 mm dos polígonos. O Rapier determinístico erra a razão das velocidades em 2,08% (limite 2%) com a densidade real do aço. É um problema da cena migrada, não do motor escolhido.
2. **Penetração no impacto entre peças móveis** (13 cenas no teste de abuso: pilha, corrente, pinhão, desempenho, cargas, sensor, recuo, camadas, cilindro, engrenagens, trava e os dois lançadores). O Box2D v3 só cria o contato a 0,1 mm (distância especulativa, 4 vezes a folga linear de 0,025 mm), e a 1/240 s uma peça a 0,5–2 m/s anda 2–8 mm por passo: na hora do choque elas se sobrepõem até ~2 mm e o contato desfaz no passo seguinte. No Lançador de bancada, as esferas do carregador sacudidas em Lento se sobrepõem 2,7 mm num passo (1,37 mm em dois). O conserto é passo menor ou distância especulativa maior, as duas decisões fechadas da calibração. Detalhe em [`decisoes/abuso.md`](decisoes/abuso.md).
3. **Pilha de 200 caixas e corrente de 40 elos** (cenas de estresse da calibração): tirada uma caixa do meio, a pilha desaba e as caixas se sobrepõem até 10 mm a 5,5 m/s (energia devolvida: 202%); a corrente chicoteada passa de 3 m/s e os eixos abrem 1,04 mm.
4. **Rasgo em camadas:** a própria cena solta a peça com pino de 392 mm de altura (2,8 m/s sem dedo); levantada pela mão, cai de 670 mm (3,4 m/s) e o choque devolve 0,0014 mJ (2,7% da energia que sobra).
5. **`/#perf` com 30 peças de dois perfis em Real** (Parte E2b): 30,0 qps na mediana nessa variante, contra 59,9 na cena de 150 peças sem perfis; o alvo não passou naquele ambiente e não foi relaxado (o resultado oscila entre cadências de 30 e 60 qps no Chromium sem GPU). Precisa de repetição no celular. As medidas das partes seguintes (E2d e S), na cena original, ficam em 59,9.
6. **Som (Parte S):** `sfx-pop-strong` (−22,0 LUFS contra o alvo de −18) e `sfx-impact-1/2/3` (−27,2, −26,0 e −27,7 contra −24) não chegam ao alvo de volume dentro do teto de pico de −1,5 dBTP; o ajuste fino é `gainDb` por asset (detalhes em [`verificacao-som-01.md`](verificacao-som-01.md)).

## Verificação padrão (Parte S + E3)

- `npm run lint`, `npm run typecheck`, `npm run build`: limpos, sem avisos.
- `npm test`: 56 arquivos e 856 testes Vitest passaram, mais as 4 falhas esperadas da bancada antiga (item 1 abaixo); 13 testes do pipeline de assets e 7 do pipeline de áudio.
- `npm run check:overflow`: 72 de 72 (66 anteriores e 6 novos: a faixa do Som aberta no Montar e no Testar, em 360×800, 844×390 e 640×360), sem rolagem lateral e com alvos de toque de 44 px.
- Playwright dos specs do editor: 95 de 95 (`roda-e2b` 2, `profiles-e2b` 3, `cards-e2b` 17, `drag-e2b` 11, `hammer-e2b` 11, `hand-e2c` 8, `pencil-e2c` 11, `understand-e2d` 12, `e2a` 5, `motor-e2b` 2, `lab` 6, `sound-s` 3 e `sound-fisica-s` 4). Ficaram de fora a bancada de 30 min (`bench`) e os perfs antigos, que não mudaram.
- Determinismo: 33 hashes iguais entre Node e Chromium.
- `/#perf` com o som ligado: sem perda (tabela acima).
- Depois dos specs, as capturas históricas que a regressão regrava foram restauradas (`git checkout`); só `docs/capturas/fase-1/final/` e `docs/capturas/som-01/` são novas.

## Capturas finais

Em [`capturas/fase-1/final/`](capturas/fase-1/final/), em 390×844, 844×390 e 1440×900 (`npx playwright test --project=capture-final`):

| Cena | Arquivos |
| --- | --- |
| Lançador no Montar | `lancador-montar-<tela>.png` |
| Lançador no Testar (Lento, gatilho puxado) | `lancador-testar-<tela>.png` |
| Roda e lingueta | `roda-e-lingueta-<tela>.png` |
| Martelo aberto | `martelo-aberto-<tela>.png` |
| Lápis aberto | `lapis-aberto-<tela>.png` |
| Camadas em cores, afastadas | `camadas-cores-afastadas-<tela>.png` |
| Faixa do Som | `faixa-do-som-<tela>.png` |

## O que o Will faz depois do merge, no celular

O roteiro do som está em [`verificacao-som-01.md`](verificacao-som-01.md#o-que-o-will-confere-no-ouvido). Para o fechamento da fase: abrir `/#perf` e colar o resultado de "Rodar 10 s" em Normal e em Real (a medição no aparelho que ficou pendente desde a Parte D), e repetir a variante com 30 peças de dois perfis em Real.
