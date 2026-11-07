# Fase 1 · Parte E2c — verificação

Acertos do teste do Will no celular (vista parada, cursor deslocado que crava de verdade, faixa presa à borda, câmara), o Lápis e a caneta. Branch da sessão, destinado a um único PR para o `main`: "Fase 1 · Parte E2c — acertos do teste, Lápis e caneta". Nenhum asset gerado ou substituído.

| Item | Estado | Commit |
| --- | --- | --- |
| 15.1 — acertos do teste da E2b | Feito; todos os aceites passaram | `f604817` |
| 15.2 — Lápis: botão, contorno e peça nova | Feito; todos os aceites passaram | `9118c5e` |
| 15.3 — traço com largura e régua | Feito; todos os aceites passaram | `c4a859b` |
| 15.4 — caneta, forma livre, multicamada e física | Feito; ressalva no abuso (abaixo) | `bec8963` |
| 15.5 — verificação | Este relatório | `Fase 1 · item 15.5` |

## 15.1 — Acertos do teste da E2b

**Vista parada.** O enquadramento não depende mais do Martelo (nem do Lápis). Teste `hand-e2c`: abrir e fechar o Martelo dez vezes em 844×390 e 640×360 deixa `zoom`, `tx` e `ty` idênticos (igualdade exata).

**Cursor deslocado.** `src/editor/offsetCursor.ts` (sem DOM, 5 testes de unidade) e o palco. Medido no navegador (toque por CDP, 844×390): segurar 450 ms e arrastar, o ponto antes do encaixe fica a 64 px acima do dedo com erro abaixo de 1 px, e o parafuso cravado, levado de volta à tela, também (erro abaixo de 1 px). Toque rápido crava sob o dedo (erro abaixo de 1 px). Mola arrastada com o cursor aceso: as duas pontas no cursor (erro abaixo de 1 px). Vibração de 8 ms ao acender (só Chrome Android). A movimentação de ligação usa o mesmo cursor.

**Faixa.** `src/ui/ToolStrip.tsx`, uma para o Martelo e o Lápis. Caixas medidas da fileira e da frase contra o retângulo central de 60% e os quatro cantos: nenhuma interseção em 640×360, 844×390 e 1440×900, para as duas ferramentas. Em 640×360 a faixa usa a forma só com ícones e o seletor de grupo; em 844×390, rótulos com seletor (Martelo) ou botões que alternam (Lápis); em 1440×900, tudo à vista.

**Câmara.** Regra de 07/11 (descrita em `docs/arquitetura.md` §6, Parte E2c). O aceite antigo de reconstrução exata saiu das falhas esperadas; o teste novo (`src/editor/chamberDetect.test.ts`) afirma a regra e roda o ciclo do exemplo com a geometria detectada. Carga, respiros, vedação e sensores são ajustes do cartão e vêm do exemplo.

| Exemplo | Sob o começo | Detectado | Exemplo | Ciclo |
| --- | --- | --- | --- | --- |
| Lançador de bancada | Luva (solta, aparafusada ao Ferrolho) | corpo = fundo; paredes Êmbolo (frente) e Ferrolho (trás); 4,05 mm | fundo; Êmbolo e Ferrolho; 6 mm | 72 de 72 afirmações |
| Cilindro de dois pistões | Fundo móvel | corpo = fundo; Pistão (frente) e Fundo móvel (trás); 9,8 mm | fundo; Pistão e Fundo móvel; 10 mm | 4 de 4 |

O diâmetro difere do declarado pelo autor: 4,05 mm é a face do Êmbolo dentro do tubo da Luva (vão de 4,1 mm); os 6 mm do exemplo são o diâmetro da esfera. Com 6,5 mm (a cabeça inteira do Êmbolo, sem descontar o tubo) o ciclo travava no terceiro disparo; com 4,05 mm passa inteiro. Dados em `docs/decisoes/camara-e2c.json` (`scripts/measure-hammer.ts`). O registro da E2b (`camara-e2b.json`) ficou como estava.

## 15.2 — Lápis: botão, contorno e peça nova

Testes de geometria (`src/geometry/stroke.test.ts`) e de comando (`src/editor/pencil.test.ts`), todos com desfazer e refazer conferidos por hash:

| Aceite | Medido |
| --- | --- |
| Laço de raio 5 mm dentro da placa de 40×20 | área tirada igual à do laço desenhado, erro abaixo de 2% |
| Traço de borda a borda | sai o lado menor (12×20 mm); trocar lado tira o outro |
| Corte em duas partes soltas | duas peças; eixo à esquerda e parafuso à direita, cada um na sua parte; o pino que ficou no vão sai no mesmo comando, com aviso ("pino 62") |
| Somar no vazio | peça nova na camada ativa: aço, solta, número de chamada novo, "Peça à mão 1" |
| Desfazer | volta ao hash anterior em todos; refazer, ao novo |
| Placa recortada no motor | sem aviso de compilação; massa nova na proporção da área (2 casas) |

No navegador (`pencil-e2c`): laço com mouse e com o dedo recorta; borda a borda mostra o lado em brasa, "Trocar lado" inverte e "Cravar corte" corta; Somar no vazio cria a peça; ligar o Martelo desliga o Lápis.

## 15.3 — Traço com largura e régua

`src/editor/pencilStroke.test.ts`:

| Aceite | Medido |
| --- | --- |
| Borracha de 2 mm num traço de 30 mm | 60 mm² ±5% descontadas as pontas redondas |
| Toque com borracha de 3 mm | furo de Ø 3 ±0,05 mm (largura, altura e diâmetro pela área) |
| Traço tremido de ±1 mm com régua | rasgo reto reconhecido por `straightSlot` (meia largura 1,5 mm); o Martelo põe pino `joint`; no motor, sem aviso, a barra corre pelo menos 8 mm rasgo abaixo com desvio lateral abaixo de 0,3 mm |
| Círculo à mão com régua | raio médio a menos de 3% de 6 mm; raios iguais a 0,05 mm |
| Pincel no vazio | cria a peça (barra de 5 mm de largura) |

No navegador: rasgo pela régua, pino pelo Martelo e a corrediça correndo no Testar (`lapis-rasgo-regua-pino-1440.png`). Achado e corrigido: o pino nascia onde o dedo estava, a 0,018 mm da linha de centro de um rasgo à mão, e o motor o encostava com aviso; agora o Martelo crava o pino na linha de centro.

## 15.4 — Caneta, forma livre, multicamada e física

| Aceite | Medido |
| --- | --- |
| Caneta e dedo ao mesmo tempo | eventos `pen` (CDP) e `touch` juntos: o dedo move a vista 60 px enquanto a caneta desenha o laço; o laço recorta a placa; depois, um dedo sozinho só move a vista (a cena não muda) |
| Caneta no Martelo | crava onde toca (erro abaixo de 1 px), sem deslocamento |
| Forma livre | engrenagem e disco viram polígono, sem `source`, com o aviso; desfazer volta a peça igual (parâmetros incluídos) |
| Perfil da camada 3 | recortado; a forma principal (camada 1), a camada e o material do perfil ficam iguais |
| Perfil cortado em duas partes soltas | oferece "Separar em peça"; aceito, a parte vira peça própria na camada do perfil |
| Física | 6 formas tremidas (laço recortado, laço somado, peça nova, borracha em zigue-zague, pincel, furo de toque) compilam sem aviso, sem lasca, com massa recalculada, e caem com a gravidade |
| 33 hashes | iguais (Node e Chromium) |

**Lascas finas.** As formas à mão com furos densos davam aviso de compilação: a triangulação fazia leques de 0,03 a 0,04 mm de espessura, que o Box2D calibrado descarta. A decomposição passou a fundir lascas mais finas que 0,055 mm (detalhe em `docs/decisoes/geometria.md`). Nenhum hash antigo mudou.

**Abuso rápido** (`scripts/abuse-pencil.ts`, `docs/decisoes/abuso-e2c-lapis.json`; 18 execuções por cena, três velocidades e três manobras):

| Cena (montada pelos comandos do Lápis e do Martelo) | Resultado |
| --- | --- |
| Rasgo pela régua com corrediça e pino; placa com laço num eixo | todas as invariantes |
| Alavanca à mão (pincel) num eixo; peça nova desenhada | todas as invariantes |
| Placa cortada em duas, cada metade num eixo | penetração 1,459 mm e energia 8,5 (reprova) |
| Controle: as mesmas duas metades como retângulos, sem Lápis | penetração 2,932 mm e energia 32,3 (reprova, pior) |

A reprovação do corte em duas é do arranjo (duas placas articuladas que se chocam na mesma camada sob a manobra), não da forma desenhada: o controle sem Lápis reprova com números piores. Não afrouxei a invariante; fica registrado. As cenas de teste antigas não mudaram (hashes iguais), então o abuso delas não foi repetido.

## Suavização

Ramer–Douglas–Peucker a 0,5 px, reamostragem a 1,5 px, cantos acima de 35° medidos a 8 px sobre cópia com σ = 2 px, gaussiana de σ = 5 px por trecho entre cantos, laço de volta à área do traço, RDP fino a 0,15 px; recorte limpo na corda de 0,02 mm. `docs/decisoes/lapis-e2c.json` (`scripts/measure-pencil.ts`):

| Traço tremido (zoom 1, 0,2 mm/px) | Resultado |
| --- | --- |
| Laço de 6 mm, 240 pontos | 43 vértices; erro de área 0,24%; maior virada entre segmentos 11,6° (o rastro tinha 169°) |
| Quadrado de 20 mm | 4 cantos; com régua, 4 vértices e erro de área 0,85% |
| Reta tremida ±1 mm, com régua | reta |
| 120 laços de 4, 6 e 10 mm | 1 canto falso (num de 4 mm) |

Revisão de arte na captura da alavanca à mão (`lapis-peca-a-mao-1440.png`): a primeira versão da suavização (Taubin) deixava calombos do tremido do dedo na borda; trocada pela gaussiana, a peça sai com bordas retas, cotovelo vivo por dentro e pontas redondas, com cara de barra dobrada. Uma segunda revisão achou rótulos sobrepostos na faixa do Lápis em 844×390 (a dica "tocar: …" ia no rótulo); a dica foi para o `title`.

## Verificação

- `npm run lint`, `npm run typecheck`, `npm run build`: limpos, sem avisos.
- `npm test`: 775 testes Vitest passaram e 4 falhas esperadas (as herdadas da bancada antiga; a da câmara saiu); 13 testes de assets.
- `npm run check:overflow`: 51 de 51, incluindo a faixa do Martelo e a do Lápis abertas em 360×800, 844×390 e 640×360.
- Playwright das ferramentas: `hand-e2c` (8), `pencil-e2c` (11) e `hammer-e2b` (11) na rodada final; `drag-e2b`, `cards-e2b` e `profiles-e2b` na regressão. Como o palco e a decomposição mudaram, rodei também a regressão do navegador (todas as suítes menos a bancada de 30 min): 151 de 152 na primeira rodada; a falha era o roteiro da E2a tocando com dois dedos a 2 px do botão novo do Lápis (o ajuste de toque do Chrome levava o dedo ao botão). O ponto do toque do teste foi para o meio da prancha; a suíte passou (5 de 5). As capturas históricas que a regressão regrava foram restauradas.
- Determinismo: 33 hashes iguais entre Node e Chromium.
- Testes antigos que gravavam capturas em `docs/capturas/fase-1/parte-e2b/` agora gravam em `test-results/`, para não substituir o histórico.

Capturas em `docs/capturas/fase-1/parte-e2c/`: `martelo-faixa-*` e `lapis-faixa-*` (640×360, 844×390, 1440×900), `martelo-previa-*` e `cursor-aceso-844x390` (cursor aceso), `lapis-laco-recortando-1440` e `lapis-laco-recortado-1440`, `lapis-borda-a-borda-1440` (lado em brasa), `lapis-rasgo-regua-pino-1440` (pino correndo no Testar), `lapis-pincel-desenhando-1440` e `lapis-peca-a-mao-1440` (peça à mão), `lapis-caneta-e-dedo-844x390`.

## Roteiro do Will depois do merge

1. Abrir e fechar o Martelo algumas vezes: a vista não se mexe.
2. Segurar o dedo parado até a mira acender acima dele, levar a mira ao centro de um disco pequeno e soltar: o eixo crava no centro.
3. Lápis, Contorno e Tirar: desenhar um laço dentro de uma placa; sai um furo.
4. Contorno e Tirar: traçar de fora a fora uma placa; o lado menor fica em brasa; "Trocar lado" e "Cravar corte".
5. Traço, Tirar, Régua ligada, 3 mm: riscar uma reta numa placa de base; Martelo, Pino, numa barra por cima do rasgo; Testar.
6. Traço e Somar, 5 mm: desenhar uma alavanca no vazio.
7. Com caneta: desenhar com ela e mover a vista com o dedo ao mesmo tempo.

## Riscos e pendências

- O diâmetro detectado no Lançador (4,05 mm) é menor que o declarado (6 mm); o ciclo passa, mas o disparo fica mais fraco: pico da esfera de 8,4 m/s contra 10,3 m/s no exemplo (`camara-e2c.json`). O cartão continua permitindo ajustar.
- Abuso: placas cortadas em duas e articuladas na mesma camada reprovam penetração e energia sob a manobra, como as mesmas placas desenhadas como retângulos. É do motor com placas finas se chocando, não do Lápis.
- A caneta, uma vez vista, faz o dedo só mover a vista no Lápis até recarregar a página. Se o Will alternar caneta e dedo para desenhar, vale uma opção no futuro.
- Somar com traço aberto por fora, quando o traço não fecha uma região com o contorno, não faz nada e avisa. O "outro lado" de uma soma só existe quando o traço deixa regiões dos dois lados.
- Um canto falso em 120 laços tremidos de 4 mm de raio: em curvas muito fechadas o tremido pode virar um vértice.
- Desempenho com muitas peças à mão (muitos vértices) não foi medido nesta parte; o `/#perf` continua na cena sintética.
