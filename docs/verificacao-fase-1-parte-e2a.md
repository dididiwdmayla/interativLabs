# Verificação — Fase 1 · Parte E2a (base do editor tátil)

Data: 05/11/2026. Branch `ccr-d09ef9b0-93ffqw` (o branch de trabalho desta sessão; o prompt pedia `fase-1-parte-e2a`). Máquina: Node 22 e Chromium headless, sem GPU. A Parte C2 entrou no `main` durante esta parte e foi trazida por merge antes do PR: o objeto padrão é o `lancador-ferrolho` (o `default` de `scenes/examples/index.json`, com as entradas dos dois lados mantidas), e "Meu primeiro mecanismo" é cópia dele, sem mudança de código. O campo novo da C2 (`gas.charge.shots`) ganhou rótulo no formulário de detalhes.

## Itens

| Item | Feito | Commit |
| --- | --- | --- |
| 7.1 Comandos | `src/editor/history.ts` (produceWithPatches, 200 passos, juntar passos do mesmo controle), `commands.ts` (peça, ligação, camada, com nome legível), loja com commit/undo/redo, botões, Ctrl+Z/Ctrl+Shift+Z, dois e três dedos, aviso "Desfeito: …". Os geradores de `src/parts` entraram aqui porque o teste das 50 edições cobre a inserção | `22244b0` |
| 7.2 Layout e tela cheia | Prancha na tela inteira com os quatro cantos e áreas seguras, retrato, painel fixo a partir de 1100 px, faixa do Testar, folhas; Fullscreen API + trava de paisagem (Android), folha de instalação no iPhone; manifesto e ícone provisório (`npm run icons`); correções da Parte D | `c332436` |
| 7.3 Menus de borda | Gesto de 1 s com o anel, marcação (deslizar e soltar), toque, abas, arco de 120° a 150° sem sair da tela (`src/editor/radial.ts`), itens como dado (`src/editor/menus.ts`), canhoto | `de6f97c` |
| 7.4 Seleção e cartão | Toque, mover (comando ao soltar), alças de girar e esticar, encaixe com guia e vibração, toque longo, botão da peça, cartão rápido, detalhes da peça e da ligação (formulário do schema) | `faccb11` |
| 7.5 Gaveta | Onze geradores, gaveta com miniaturas gravadas, fantasma com encaixe, tocar põe no centro | `97e91d9` |
| 7.6 Camadas | Pílula, pilha de pranchas (ativar, reordenar, renomear, ocultar, travar, espessura, excluir com confirmação, nova), aviso de pino | `9e69baa` |
| 7.7 Projetos | IndexedDB, autosave de 500 ms, lista, novo, duplicar, renomear, excluir, exemplos como cópia, exportar e importar, primeiro projeto, pilha da sessão no sessionStorage | `2f2045b` |
| 7.8 Verificação | Testes, capturas, este documento, arquitetura §6, README; e as correções que a revisão achou (abaixo) | commit deste documento |

Correções que saíram da revisão (no commit do 7.8):

1. **Placa de base roubava todos os gestos.** Em cenas com a camada 1 cobrindo tudo (engrenagens, trava), todo toque caía na placa: arrastar movia a placa e nunca havia fundo livre para mover a vista ou abrir o menu de borda. Agora só se move peça da camada ativa (ou a já escolhida); arrastar peça de outra camada move a vista (tocar continua escolhendo e ativando a camada).
2. **O aviso roubava o segundo dedo.** O toque com dois dedos que caía em cima do aviso não desfazia. O aviso agora deixa o toque atravessar (só o botão Desfazer pega).
3. **Cartão em retrato cobria a peça:** a vista sobe a peça para a parte livre ao abrir.
4. **Pilha de camadas no painel de 320 px** cortava os nomes: os botões descem para uma segunda linha quando o espaço é estreito (consulta de contêiner).

## Confirmado nas fontes

Os sites (MDN, web.dev, developer.chrome.com) estão fora da rede liberada desta sessão. A compatibilidade foi conferida no pacote de dados de compatibilidade do MDN, `@mdn/browser-compat-data` 8.1.8 (publicado em 02/11/2026, a mesma base das tabelas do MDN), e o resto nos tipos dos pacotes instalados:

- **Fullscreen API** (`Element.requestFullscreen`): Chrome Android desde a 71; Safari desde a 16.4 (com prefixo `webkit` desde a 5.1); Safari do iOS: "Only available on iPad, not on iPhone", com um botão sobreposto que não some e que sai da tela cheia ao deslizar para baixo.
- **Screen Orientation `lock()`**: Chrome Android desde a 38; Safari (Mac e iOS) não tem; Firefox Android desde a 144. Exige tela cheia ou app instalado; a falha é tratada em silêncio.
- **Instalação:** no Chrome Android o manifesto precisa de `name` ou `short_name`, `icons`, `start_url` e `display` (ou `display_override`). Pelo blog do Chrome ("Revisiting Chrome's installability criteria", achado por busca), desde o Chrome 108 no celular instalar pelo menu não exige mais service worker com `fetch`; o aviso automático de instalação ainda pode exigir, e não há service worker aqui. No iOS, o `apple-touch-icon` tem prioridade sobre os ícones do manifesto; `display` é lido desde o iOS 11.3; `orientation` e `background_color` não são lidos pelo Safari do iOS.
- **`navigator.vibrate`**: Chrome Android desde a 32, exige um gesto da pessoa (desde a 60) e não funciona em iframe de outra origem; **Safari (Mac e iOS) não tem**; no Firefox Android existe, mas não vibra.
- **Ponteiros:** `PointerEvent.pointerType` no Chrome Android desde a 55 e no Safari do iOS desde a 13; `setPointerCapture` também. Cada dedo é um ponteiro com `pointerId` próprio; o teste com vários dedos usa `Input.dispatchTouchEvent` do CDP.
- **Immer 11.2.9** (instalado): `produceWithPatches` devolve `[estado, patches, inversos]` e continua precisando de `enablePatches()`; `applyPatches(base, patches)`.
- **IndexedDB**: `IDBFactory.open` no Chrome Android desde a 25 e no Safari do iOS desde a 15 (no iOS 14 o primeiro `open` podia travar; versões anteriores à 14 funcionavam); `IDBObjectStore.put/get/getAll/delete` e transações `readwrite`. Nos testes, `fake-indexeddb` 6.2.7.

## Testes

`npm run lint`, `npm run typecheck`, `npm test` (26 arquivos, 556 testes + 4 falhas esperadas preexistentes, já com as cenas da C2; 13 do pipeline de assets) e `npm run build` limpos, sem avisos. Novos:

- `src/editor/commands.test.ts`: **50 edições aleatórias** de todos os tipos desta parte (inserir de cada gerador, mover, girar, girar 90°, escalar, mudar parâmetro, espelhar, duplicar, excluir peça e ligação, mudar de camada, nova camada, campos de camada, reordenar, excluir camada, material, fixa/solta, nome, campos de ligação) em seis exemplos (inclusive o lançador de ferrolho), cada uma validada pelo schema; desfeitas, a cena volta ao hash do início; refeitas, ao hash do fim. Limite de 200, refazer limpo ao editar, nomes legíveis, exclusão em cascata e aviso de pino.
- `src/editor/gestures.test.ts`, `radial.test.ts` (nada fora da tela nem sob o entalhe em 844×390, 640×360, 390×844 e 1440×900, dos dois lados, com 2 a 9 itens), `snap.test.ts`, `linkFields.test.ts` (rótulos em português, campos opcionais ligados continuam válidos, graus).
- `src/parts/parts.test.ts`: os onze geradores com forma válida e decomposição no padrão e nos limites de cada parâmetro, área analítica, espelhada, nome com número, número de chamada, fixa só na camada 1, refazer a forma pelos parâmetros.
- `src/render/callouts.test.ts`: o lado livre é escolhido; sem caminho limpo o número vai para fora da cena; em todos os exemplos, toda chamada visível tem caminho limpo ou fica fora da cena.
- `src/editor/projects.test.ts` (IndexedDB com o fake): guardar, listar, ler, renomear, excluir, último aberto, cena idêntica; importar as três cenas v0 do protótipo; erro com o caminho do campo; data relativa.

Playwright:

- `--project=e2a` (toque emulado, 844×390, 5 testes): o menu de borda abre com 1 s e não com 0,6 s; escolha por deslizar e soltar; o roteiro do aceite do 7.5 (placa na camada 1 e barra na 2 arrastadas da gaveta, barra mudada de camada pelo cartão, barra esticada pela alça, desfazer tudo com dois dedos e refazer tudo com três, com o JSON da cena conferido a cada passo); desfazer com dois dedos; o projeto e a pilha de desfazer sobrevivem a recarregar.
- `check:overflow`: sem rolagem lateral e com alvos de 44 px em 360, 390, 412 px e 844×390 nas cinco rotas, e com cada folha (menu, gaveta, camadas, cartão) e o menu de borda abertos em 360×800 e 844×390.
- `--project=capture-e2a` gera as 40 capturas.

## Medidas

- **Pacote principal:** 123,3 KB gzip depois do merge da C2 (121,4 KB antes dele; era 108,4 KB na Parte D). Sob demanda: detalhes da ligação 2,5 KB, schema e migrações 34,3 KB (já eram), simulação como antes.
- **Desempenho** (`/#perf`, 150 peças e 100 ligações, 1× com arrasto, Chromium da sessão): 390×844 59,9 qps (p5 59,9); 844×390 59,9 (p5 59,5); 1440×900 59,9 (p5 30,0). Em 1440×900 o `main` dá o mesmo p5 de 30 nesta máquina, com a física no worker em p95 de 22 ms: é da máquina desta sessão, não desta parte (o desenho por quadro segue em 0,8–0,9 ms de mediana). Fica valendo a rodada no celular do Will.

## Capturas

`docs/capturas/fase-1/parte-e2a/`, em 844×390, 390×844, 1180×820 e 1440×900 (densidade 2): `menu-direita`, `menu-esquerda`, `anel-segurar` (por volta de meio segundo), `gaveta`, `arrasto-encaixe` (a Intermediária no alinhamento dos eixos, guia tracejada), `cartao` e `cartao-detalhes`, `pilha`, `projetos`, `engrenagens`.

## Revisão de diretor de arte (lado a lado com o frame oficial)

No nível do frame:

- **Menus de borda** (`menu-direita-844x390`, `menu-esquerda-844x390`): discos de traço sobre o palco, o item sob o dedo em ouro, o arco de construção em traço-ponto e o título em caixa alta espaçada no centro do arco. Lê como parte da prancha, não como menu de biblioteca.
- **Cartão rápido** (`cartao-1440x900`): título em Old Standard caixa alta com o fio duplo, o número de chamada num anel de ouro, rótulos de campo com linha de base, materiais como as próprias hachuras (o ouro só no escolhido), ações como quadrados de traço, Excluir em brasa. Próximo do painel do frame (c).
- **Arrasto com encaixe** (`arrasto-encaixe-844x390`): contorno de ouro, guia tracejada fina atravessando a prancha, números de chamada fora durante o arrasto.
- **Pilha de pranchas** (`pilha-1440x900`): paralelogramos de fio duplo com furos de canto, a ativa em ink com a sombra dura, número em itálico com o traço ("– 3").
- **Projetos** (`projetos-844x390`): miniatura gravada em moldura de fio duplo, nome em caixa alta, data em Archivo, fios entre as linhas, como a lista do frame (f).
- **Engrenagens enquadradas** (`engrenagens-844x390`): as três engrenagens e a lingueta ocupam a altura útil inteira (o enquadramento agora mira as peças móveis); as chamadas ficam curtas e saem para o lado livre.

Abaixo do frame:

1. **Ícones dos itens de menu** ainda simples perto das pranchas do frame (c): poucos têm hachura, e o "peças prontas" e o "exemplos" são pictogramas pequenos dentro de discos grandes (`menu-direita-844x390`).
2. **Gaveta em retrato** (`gaveta-390x844`): a fileira rola de lado e mostra três peças e meia; a placa de base das engrenagens fica atrás, sem relação com a gaveta. Funciona, mas é menos bonita que a faixa lateral da paisagem.
3. **Cartão em retrato** (`cartao-390x844`) ocupa 62% da altura; a peça sobe para a parte livre, mas fica colada no nome do projeto.
4. **Botão da peça**: ícone de "detalhes" (três cotas) num anel de ouro; legível, mas genérico. O frame não tem esse elemento; um desenho próprio (talvez o número de chamada com a linha) caberia melhor.
5. **Dica no topo** em Archivo de 12 px, `ink-2`: legível, mas em paisagem fica longa numa linha só.
6. **Chamadas do lançador de ferrolho** (o objeto padrão da C2): com mais de vinte ligações num desenho comprido, os números se amontoam no canto de cima à esquerda e algumas linhas ficam longas. A escolha por menos cruzamentos ajuda, mas a cena pede um critério de prioridade (mostrar só as da camada ativa, por exemplo), que vale discutir com a E2b.
7. Os pontos já registrados na Parte D continuam: gás sem o pontilhado (Fase 2), madeira com nós em grade, sem `tex-ink-wear`.

## O que ficou de fora e por quê

- Criar ligações, cartão rápido de ligação com predefinições, desenho livre, caneta, modo camadas em cores, cartões "o que é", tutorial e rastro: Parte E2b, como o prompt manda. O menu de borda já recebe os itens novos pela lista de `src/editor/menus.ts`.
- Listas da ligação (paredes da câmara, respiros, portas, ações do sensor) fora do formulário de detalhes: entram com a criação de ligações na E2b.
- Service worker (uso sem rede): não pedido; a instalação pelo menu funciona sem ele no Chrome Android.
- O ícone é provisório; o definitivo vem do coordenador visual.

## Riscos e pendências

- **iPhone:** sem tela cheia de página nem trava de orientação; a tela cheia depende de instalar. Sem vibração no encaixe.
- **Mover só na camada ativa** é uma interpretação da regra do §6 ("arrastar uma peça não selecionada seleciona e move"), forçada pela placa de base; precisa do aval do coordenador e do teste do Will.
- **Desempenho no celular** não medido aqui; a medição da sessão em 1440×900 tem p5 de 30 qps também no `main`.
- O teste com toque emulado precisou de uma pausa de 400 ms depois de cada arrasto: o reconhecedor de gestos do Chromium descarta o toque seguinte a um arrasto emulado pelo CDP. No aparelho de verdade isso não foi observado, mas vale conferir.
- A pilha de desfazer guardada no sessionStorage pode passar do limite em cenas grandes com muitos passos; nesse caso ela só não é guardada (o desfazer vale até recarregar).
