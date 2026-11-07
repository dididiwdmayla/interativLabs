# Fase 1 · Parte E2d — verificação

Entender o mecanismo: camadas em cores, afastadas e isoladas, esconder peça, cartões "o que é" e rastro, mais os acertos da revisão da E2c. Branch da sessão, destinado a um único PR para o `main`: "Fase 1 · Parte E2d — entender o mecanismo". Nenhum asset gerado ou substituído; a paleta das camadas é provisória e vai para o coordenador visual.

| Item | Estado | Commit |
| --- | --- | --- |
| 16.1 — acertos da revisão da E2c | Feito; todos os aceites passaram | `286e925` |
| 16.2 — camadas em cores | Feito; todos os aceites passaram | `c3eba85` |
| 16.3 — esconder peça | Feito; todos os aceites passaram | `dc7046e` |
| 16.4 — cartões "o que é" e rastro | Feito; todos os aceites passaram | `6eddf79` |
| 16.5 — verificação | Este relatório | `Fase 1 · item 16.5` |

## 16.1 — Acertos da revisão da E2c

- **Frases** (`src/editor/phrases.ts`, teste `phrases.test.ts`): gênero pela primeira palavra do nome, artigo e contração. "Parafuso: a Base fica presa ao fundo", "Parafuso: a Placa 3 se une à Base", "Eixo: o Retém gira sobre o fundo", "Trava: a Lingueta fica presa à Base até soltar", "Mola: arraste do Ferrolho até a outra ponta", "Sensor na Placa de base: toque e depois escolha o alvo", "Tirar na Placa 3", "Borracha de 2,5 mm no Disco". O teste passa por todas as ferramentas com peças dos dois gêneros e reprova "a o", "de a", "em o" e espaços duplos. Os comprimentos passaram a usar vírgula ("12,5 mm").
- **"Esc sai"**: só depois de um ponteiro de mouse ou de uma tecla. Teste no navegador: com toque, "Eixo: toque sobre uma peça"; com mouse, "… · Esc sai".
- **Pílula da camada**: com uma faixa aberta, espaçamento menor, pilha em miniatura menor e o nome em até duas linhas de 10 px. "4 Gatilho" cabe inteiro em 844×390 e em 640×360 (medido: sem corte em largura nem em altura; a pílula não encosta na faixa). Se o nome ainda for cortado, o toque mostra "Camada N · Nome" num aviso. Capturas `pilula-camada-844x390.png` e `pilula-camada-640x360.png`.
- **"Dedo desenha"**: aparece na faixa do Lápis só depois que uma caneta toca a prancha. Teste com eventos `pen` e `touch`: antes de ligar, o laço com o dedo não muda a cena; ligado, o mesmo laço abre o furo; `il.fingerDraws` fica `1` e a escolha volta depois de recarregar.
- **Câmara do Lançador**: o dado passou a concordar com o desenho. A câmara é o tubo da Luva, onde o Êmbolo corre (Ø 4,1 mm); a esfera de 6 mm corre no cano, à frente. O Martelo detecta 4,05 mm (diferença de 0,05 mm). A dose subiu de 0,5 para 0,69 mmol para a saída continuar a mesma: **10,33 m/s** (antes, 10,34). A cena de teste do exemplo passa inteira (72 de 72), com o dado e com a geometria detectada (`docs/decisoes/camara-e2d.json`). Redesenhar o tubo para 6 mm não cabia: o vão entre o cano e o canal do carregador é de 6,3 mm e a Luva segura a coluna de esferas pela borda de baixo. Só o hash do Lançador de bancada mudou.

## 16.2 — Camadas em cores

Menu Vista: **Camadas em cores** (sai "Exemplos"; o menu tem no máximo 8 itens no Montar e no Testar, teste `look.test.ts`). A faixa mostra Cores, Afastar (com o deslizante), Isolar e Fechar; no Testar ela fica na borda de cima, porque a de baixo é da simulação.

**Paleta provisória** (`src/styles/tokens.css`), `oklch(46% 0.055 h)`, do fundo para o topo:

| Camada | Matiz | Camada | Matiz | Camada | Matiz | Camada | Matiz |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 237° | 5 | 353° | 9 | 223° | 13 | 339° |
| 2 | 143° | 6 | 259° | 10 | 129° | 14 | 245° |
| 3 | 295° | 7 | 165° | 11 | 281° | 15 | 151° |
| 4 | 201° | 8 | 317° | 12 | 187° | 16 | 304° |

Matizes pela razão áurea entre 112° e 358°: pelo menos 48° do ouro (81°) e da brasa (41°), vizinhas a 94° ou mais. Contraste do ink sobre a face: 5,3 a 5,7 (AA). Teste `layerColors.test.ts` (luminosidade igual, croma moderado, distância dos acentos e das vizinhas, contraste). Revisão de arte: a primeira versão (48%, croma 0,07) deixava a placa de base azul demais, e os selos quadrados fora das peças entupiam a vista; ficaram o croma 0,055, o selo redondo de fio duplo de 13 px (cabe dentro de esferas de 6 mm) e a moldura tracejada de cada prancha no afastamento, que é o que faz as camadas lerem como chapas empilhadas.

**Afastamento**: folhas deslocadas só por `transform` (0,8; −0,6 por camada), 28 px no celular deitado e até 2,4× isso em telas mais altas; moldura e número de cada prancha; pinos e sensores entre camadas como hastes tracejadas; as chamadas saem e o manômetro vai para a folha da câmara. Enquadra o conjunto ao ligar (desviando também do deslizante) e volta à vista anterior ao desligar. O toque age na folha da camada ativa; no Testar e no esconder, tenta cada folha de cima para baixo.

**Isolar**: só a camada ativa e as ligações que tocam nela; o toque também.

Aceites:

- Capturas do Lançador e da Roda e lingueta, cores, afastadas e isolada, em 844×390 e 1440×900, no Montar e no meio de um ciclo do Testar (24 arquivos `cores-*`, `afastadas-*`, `isolada-*`). No Lançador, o ciclo é 3 passos depois do tiro; na Roda, a meio de meia volta da manivela com a trava solta.
- Hashes: a cena e a pilha de desfazer não mudam ao ligar e desligar o modo (teste no navegador); os 33 hashes das cenas de teste continuam conferidos pelo Vitest.
- `/#perf` (150 peças, 100 ligações, 1440×900, Chromium desta sessão, duas rodadas; `docs/decisoes/perf-e2d.json`):

| Variante | Normal: qps mediana · p5 | Real: qps mediana · p5 | Desenho por quadro (mediana · p95) |
| --- | --- | --- | --- |
| Antes (sem nada) | 59,9 · 59,5–59,9 | 59,9 · 59,5–59,9 | 0,4–0,6 · 0,7–0,9 ms |
| Cores e afastadas | 59,9 · 59,5–59,9 | 59,9 · 59,9 | 0,6 · 0,8–1,2 ms |
| Rastro | 59,9 · 59,5 | 59,9 · 59,9 | 0,4–0,6 · 0,7–0,9 ms |

Perda de qps: nenhuma (o limite era 10%).

## 16.3 — Esconder peça

- **Ferrolho escondido no Testar**: com o modo pelo menu Vista, um toque no Ferrolho, na pose do meio do recuo, o esconde; o percussor, o retém e a mola do percussor ficam à vista (`esconder-antes-…` e `esconder-depois-lancador-testar-844x390.png`). A simulação de novo, com ele escondido, manda ao motor a **mesma cena, byte a byte**, que a de antes (o motor é determinístico pela cena e pelas entradas: o hash é o mesmo). O teste intercepta o `postMessage` de início do worker.
- **Sem toque**: escondido o Gatilho, o toque no mesmo ponto escolhe a peça de baixo; cena e desfazer não mudam.
- **Lista**: a pílula "1 escondida" abre a lista com miniatura, número e nome; um toque traz de volta; com três escondidas, "Mostrar todas" traz todas (`esconder-pilula-…`, `esconder-lista-844x390.png`).
- **Com o projeto**: depois de recarregar a página, o projeto volta com o Gatilho escondido; abrir um exemplo começa sem nada escondido.

## 16.4 — Cartões "o que é" e rastro

- 12 tipos com texto e animação (`src/ui/explain.test.tsx`): até três frases, uma frase por item, um exemplo "É o/a …", e cada cena tem pelo menos um elemento animado; os keyframes só mexem em `transform` e `opacity`, e param em `prefers-reduced-motion`.
- Capturas: eixo, mola e câmara pelo "O que é?" do cartão da ligação; trava pelo toque longo na faixa do Martelo (`o-que-e-*.png`).
- Rastro em Lento no Lançador: três quadros (`rastro-lento-quadro-1…3-844x390.png`) com o recuo do Ferrolho, a esfera saindo pela boca e a coluna do carregador subindo. Os 78 caminhos existem desde o início; só o `d` muda.
- `/#perf` com rastro: sem perda (tabela acima).

## Verificação

- `npm run lint`, `npm run typecheck`, `npm run build`: limpos.
- `npm test`: 804 testes Vitest passaram e 4 falhas esperadas (as herdadas da bancada antiga); 13 testes de assets.
- `npm run check:overflow`: 66 de 66, com a faixa das camadas aberta (afastadas, com o deslizante) no Montar e no Testar, o modo Esconder, a lista de escondidas aberta e o cartão "o que é", em 360×800, 844×390 e 640×360.
- Playwright: `understand-e2d` (12 testes, todos os aceites acima) e `perf-e2d`. Como o palco mudou (folhas, toque, modelo de toque), rodei a regressão do navegador (todas as suítes menos a bancada de 30 min, o perf antigo e o determinismo, que rodou à parte): 147 de 149 na primeira rodada; as duas falhas eram o `drag-e2b` procurando a frase antiga do sensor ("toque numa câmara"), revista no 16.1. Com o teste atualizado, 11 de 11.
- Determinismo: 33 hashes iguais entre Node e Chromium. Só o do Lançador de bancada mudou (`34f8c08bb29bdc52` → `337a239173c64de4`), pela câmara do 16.1; os outros 32 ficaram iguais.
- As capturas históricas que a regressão regrava foram restauradas.

## Roteiro do Will depois do merge

1. No Lançador, menu Vista → **Camadas em cores**; na faixa, **Afastar**. Testar, Lento, puxar o gatilho: as quatro pranchas se mexem afastadas, o pino da barra do gatilho como haste entre elas.
2. Menu Vista → **Esconder peças**, tocar no Ferrolho, **Pronto**: o retém e o percussor trabalham à vista. A pílula "1 escondida" traz de volta.
3. Montar, Martelo, segurar **Mola** na faixa (ou tocar numa mola e **O que é?** no cartão).
4. Testar, menu Vista → **Rastro**, puxar o gatilho em Lento.
5. Com o Martelo aberto, conferir a pílula "4 Gatilho" inteira; com a caneta, desenhar uma vez no Lápis e ligar **Dedo desenha**.

## Riscos e pendências

- A paleta é provisória (tokens `--layer-1…16`); a definitiva é do coordenador visual. O afastamento usa só a direção (0,8; −0,6); a vista explodida em perspectiva continua numa fase própria.
- No afastamento, as chamadas saem (não acompanham as folhas) e o fio do arrasto no Testar segue a folha da camada ativa, não a da peça arrastada.
- Os selos giram com a peça (ficam no grupo dela, sem custo por quadro): numa peça girada o número fica inclinado.
- A faixa das camadas (e a de esconder) cobre um pedaço da borda de baixo no Montar, como a do Martelo; o enquadramento só desvia dela ao ligar o Afastar ou em "Enquadrar".
- O toque logo depois de um gesto emulado se perdia no Chromium do teste ("Dedo desenha"); com 500 ms de pausa passa. Não reproduzi com toque real.
- Desempenho medido no Chromium desta sessão (CPU, 1440×900), não no celular do Will.
