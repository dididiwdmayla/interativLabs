# Frame oficial — Prancha índigo

Seis imagens geradas pelo Will no ChatGPT com `docs/identidade/prompts-frame.md` e revisadas pelo coordenador visual em 04/11/2026. **As seis estão aprovadas.**

São referência de estilo, não de mecanismo. Onde uma imagem e `docs/identidade/identidade.md` divergem, vale o documento. O que as imagens mostraram de melhor já entrou nele (seção "Mudanças a partir do frame oficial").

| Arquivo | Prompt | Tamanho |
| --- | --- | --- |
| `a-editor-celular.webp` | (a) editor no celular | 853×1844 |
| `b-simulacao-celular.webp` | (b) simulação no celular | 853×1844 |
| `c-editor-computador.webp` | (c) editor no computador | 1586×992 |
| `d-materiais.webp` | (d) folha de materiais | 1536×1024 |
| `e-ferragens.webp` | (e) folha de ferragens | 1536×1024 |
| `f-entrada.webp` | (f) tela de entrada | 853×1844 |

Os PNGs originais passavam de 3 MB cada. Estão aqui em WebP de qualidade 96 (PSNR entre 40 e 41,5 dB contra o original, cerca de 0,6 MB cada). Os PNGs ficam com o Will.

Para anexar ao ChatGPT como referência de estilo nos prompts do lote 01, use `a-editor-celular.webp`. Se o ChatGPT não aceitar WebP, converta para PNG antes de anexar ou use o original.

## Avaliação

Pela lista de verificação de `prompts-frame.md`. "Sim" passa, "parcial" tem um desvio que não reprova, "—" não se aplica à imagem. Os pontos 1, 2, 3, 7 e 11 são eliminatórios.

| Ponto | a | b | c | d | e | f |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Papel | sim | sim | sim | sim | sim | sim |
| 2. Traço | sim | sim | sim | sim | sim | sim |
| 3. Peça usinada | sim | sim | sim | sim | sim | sim |
| 4. Materiais | parcial | — | sim | sim | — | — |
| 5. Camadas | sim | — | parcial | — | — | sim |
| 6. Chamadas | sim | sim | sim | — | sim | parcial |
| 7. Acentos | sim | sim | sim | — | — | sim |
| 8. Mola | sim | sim | sim | — | sim | sim |
| 9. Interface | sim | sim | sim | — | — | parcial |
| 10. Coerência | sim | sim | sim | parcial | parcial | parcial |
| 11. Limpeza | sim | sim | sim | sim | sim | sim |

Notas:

- **Papel (1, 10).** Medido no papel vazio: (a) `#1F2543`, (b) `#19203F`, (c) `#1F2645`. As folhas (d), (e) e (f) saíram mais escuras, perto de `#161C3B`. Todas no índigo certo; o app usa o token `#1E2448`.
- **Traço (2).** Branco frio em todas (médias de `#EBE9E6` a `#F2EEEB`). O cilindro 21 da (a) tem um sombreado suave de render, e as sombras da (d) e da (e) têm desfoque; ver "O que ignorar".
- **Materiais (4).** A (a) mostra só aço e corpo. Na (d), os sete padrões se distinguem com a imagem reduzida a um quarto, inclusive aço (pares) e alumínio (simples).
- **Camadas (5).** Na (c), a alavanca da camada 3 ficou com força total; devia estar esmaecida.
- **Acentos (7).** Ouro só em seleção, ferramenta ativa, arrasto e foco. Brasa só no gás, no escape, na faísca e nos eventos da (b), mas saiu âmbar (`#E4933F` nos pixels mais claros), perto demais do ouro.
- **Interface (9).** A (a) reduzida a 390 px continua legível: ícones, título, numerais e "Fig. 1". Na (f), o anel de foco tem canto arredondado.
- **Chamadas (6).** Na (f), o número 1 aparece duas vezes.
- **Limpeza (11).** Nenhuma marca d'água, assinatura ou logotipo. "interativLabs" na (f) é texto composto, como pedido. O cilindro da (a) e da (b) lê como peça pneumática industrial.

## O que vale

Os recursos abaixo viram regra e já estão em `identidade.md`.

### (a) Editor no celular

- **Relevo de chapa.** Cada peça é uma chapa com espessura: parede curta para baixo e à direita, sombra dura atrás. As camadas parecem chapas usinadas empilhadas, não desenhos chapados.
- **Chanfro iluminado.** Contorno branco, fio escuro, faixa clara que esmaece para dentro, depois a hachura.
- **Camadas inativas veladas.** Face num índigo mais claro e de baixo contraste, traço apagado. A camada ativa salta sem precisar de cor.
- **Eixo.** Cruz de centro em traço-ponto atravessando a peça, anéis concêntricos do cubo.
- **Chamadas.** Numeral itálico fora da peça, linha curva fina, ponto na ponta.
- **Seleção.** Contorno em ouro e alças em anel de ouro com miolo índigo.
- **Barra de ferramentas.** Ícones em quadrados de traço; a ferramenta ativa tem quadrado e ícone em ouro; "SIMULAR" é o único bloco claro.
- **Letreiro.** Título em caixa alta muito espaçada; "Fig. 1" em cursiva no canto inferior esquerdo.
- **Moldura de edição.** Fio externo contínuo e fio interno tracejado.

### (b) Simulação no celular

- Moldura dupla contínua.
- **Régua da linha do tempo** com tiques longos e curtos, cabeçote em ouro com ponta triangular, eventos passados como tiques em brasa.
- **Fio de arrasto em ouro**, do anel no ponto agarrado até o dedo.
- **Gás da câmara** em pontilhado de brasa, denso junto ao pistão e ralo atrás.
- **Escape** em leque de raios finos, brasa na raiz e branco nas pontas.
- **Faísca** de poucos traços curtos em volta de um ponto de brasa.
- Só ficam os números das peças operadas.
- Barra inferior com botões quadrados de traço (pausa, passo) e "EDITAR" em contorno.

### (c) Editor no computador

- **Painel de propriedades.** Título em caixa alta espaçada com fio duplo. Campos com rótulo em caixa alta serifada, valor em grotesca e linha de base fina.
- **Lista de camadas como pilha oblíqua de pranchas:** a ativa à frente, branca, com sombra; as outras apagadas; número em itálico com traço ("– 2").
- **Cota** com setas cheias e o valor em itálico no meio da linha.
- **Trilho** como guia com batentes; mola de retorno espira por espira dentro da janela do trilho.
- **Trilho de ferramentas.** Os dez ícones em quadrados de traço (seta, retângulo, círculo, polígono, traço livre, engrenagem, parafuso, eixo, trilho, mola) são a referência de desenho para os ícones SVG do projeto. Não viram asset.
- **Madeira** lida pelo veio com nós, mesmo numa área grande.

### (d) Materiais

- As sete hachuras como especificadas, distinguíveis a um quarto do tamanho. É a referência de densidade dos `pattern` procedurais e da textura de madeira.
- **O quadrado 8 é a regra da peça de forma livre:** contorno, chanfro claro (também por dentro do furo e do rasgo), parede e sombra.
- **Fixo/corpo:** faixa de hachura na borda e pautado fino no miolo.

### (e) Ferragens

- Cabeças vistas de cima com fenda e sextavado em relevo e hachura na cabeça; pino em seção com hachura cruzada e cruz de centro; rebite abaulado em pontilhado; rolamento de esferas; mola com frente grossa, costas finas e sombreado de tubo. É a referência direta das ferragens do lote 01.
- A engrenagem com rasgo de chaveta no furo é um detalhe que o gerador procedural de engrenagens pode ganhar.

### (f) Entrada

- **Vista explodida em perspectiva oblíqua:** pranchas espaçadas, eixo e pino atravessando todas, sombra de uma prancha sobre a de baixo. É a referência da ilustração da entrada (lote 01) e da Fase 6.
- **Lista de projetos** com miniatura em prancha pequena, data à direita e fios entre as linhas; "NOVO PROJETO" claro e retangular.
- Nome "interativLabs" composto em tipo serifado espaçado, sem logotipo.

## O que ignorar

- **A lógica dos mecanismos:** lingueta sem apoio coerente, biela da câmara ligada à catraca, fio de arrasto que termina na linha do tempo (b), alavanca do trinco (c), eixos e pinos das pranchas da entrada (f).
- **Parafusos decorativos** nos cantos das chapas (a, b, c). No app, uma cabeça de parafuso só aparece onde existe a ligação parafuso.
- **Sombreado suave de render** no cilindro (a) e **sombras com desfoque** (d, e). O volume vem só da hachura, e a sombra é dura.
- **Brasa âmbar** (b). O token é `#EE7B4F`, mais vermelho, para não se confundir com o ouro.
- **Papel mais escuro** em (d), (e) e (f). Vale o token `#1E2448`.
- **"0,25×" em itálico serifado** (b). Valores são Archivo tabular.
- **Setas de giro** ao lado das engrenagens (b). O movimento já mostra o giro; a seta curva fica só como símbolo do motor.
- **Alavanca da camada 3 sem esmaecer** (c).
- **Número repetido e anel de foco arredondado** (f).
- **Textos e números inventados:** valem só os pedidos nos prompts.
