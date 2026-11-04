# Identidade — Prancha índigo

Direção escolhida pelo Will na Fase 0: um desenho de patente de engrenagens de 1912, impresso em traço branco sobre azul-índigo profundo. Gravura com hachura e contra-hachura para dar volume, molas desenhadas espira por espira, números de referência com linhas de chamada, "Fig. 2" em cursiva, vistas em corte.

A imagem de referência fica fora do repositório. Ela tem marca d'água de uma loja e serve só de direção: nunca vira asset nem é copiada. O que vale daqui em diante é este documento e o frame oficial em `frame-oficial/` (seis imagens aprovadas em 04/11/2026, com a avaliação no `README.md` da pasta). Onde o frame e este documento divergem, vale este documento.

Parte do frame C de `frames.md` (patente gravada) e troca o papel creme e a sépia pelo índigo da cópia, em tema escuro.

## Nome

**Prancha índigo.** "Prancha" é a folha do desenho de patente e é a metáfora da camada: cada camada é uma prancha do mesmo desenho. "Índigo" liga à família interativ (o interativMind é "Índigo noturno") sem repetir o nome. Descartados: "Cianótipo" (a técnica certa, mas puxa para o azul-da-prússia e para a planta azul genérica) e "Patente" (soa jurídico).

Na interface, a palavra continua sendo **camada**. "Prancha" é só linguagem visual e de documentação.

## Conceito

Uma prancha de patente existe para explicar como a força atravessa um mecanismo: cada peça tem número, cada ligação é apontada por uma linha de chamada, e o leitor segue o caminho de uma peça a outra. É o trabalho do interativLabs. A gravura monocromática separa material e profundidade só com traço (hachura, espessura, parede da chapa), então a cor fica livre para o estado, que é o que um app interativo precisa: dois acentos bastam. A hachura é um padrão recortado na forma, por isso funciona em qualquer contorno: a peça desenhada à mão recebe o mesmo acabamento gravado que uma engrenagem gerada, e parece usinada. O fundo índigo escuro faz da prancha a bancada, e esmaecer uma camada é só aproximar o traço do papel.

## Paleta

### Medida na referência

Amostragem com Python/PIL sobre a imagem de 321×387 px, excluindo o canto da marca d'água. Quantis por luminância relativa, agrupamento k-means com 5 grupos e médias de regiões vazias (margens e espaço entre figuras). A imagem é pequena e comprimida: os valores têm erro de ±2 por canal.

| Amostra | Hex | Como foi medida |
| --- | --- | --- |
| Fundo predominante | `#1E2448` | Cor mais frequente da imagem; o grupo do fundo tem 52% dos pixels (média `#202548`) |
| Fundo, variação escura | `#171A37` | Segundo grupo, 25% dos pixels; cantos e bordas da folha |
| Fundo, sombra mais funda | `#111432` | Os 9% mais escuros |
| Fundo, variação clara | `#363A57` | Coluna mais clara de uma área vazia: as manchas verticais da cópia |
| Traço, pico | `#FEFEFE` | Centro das linhas cheias, 2,5% dos pixels |
| Traço, média | `#EAEAEF` | Grupo dos traços, 4% dos pixels |
| Traço esmaecido | `#A3A5B6` | Faixa de luminância 0,3–0,5: hachura fina já misturada ao fundo |
| Traço dissolvido | `#5D6076` | Grupo de 9,5%: hachura muito fina sobre o fundo |
| Fio da moldura | `#7C7E8F` | Coluna da moldura esquerda da folha |

Tudo fica no mesmo matiz, 232–234°. A saturação cai conforme a luz sobe: o fundo tem saturação 0,55, o traço branco 0,02. A paleta da referência é um eixo só, do índigo ao branco frio. Os acentos ficam fora desse eixo de propósito.

O índigo medido é mais violeta e mais escuro que a cianotipia real (azul-da-prússia, mais ciano). Isso afasta a prancha da planta azul de app de engenharia.

### Tokens

Nomes de token em inglês, como manda o `AGENTS.md`.

| Token | Hex | Uso | Origem |
| --- | --- | --- | --- |
| `--color-chrome` | `#171A37` | Barras, trilho de ferramentas, área fora da prancha | Medido (variação escura) |
| `--color-stage` | `#1E2448` | O palco: a prancha onde se desenha | Medido (predominante) |
| `--color-surface` | `#262B4A` | Painel de propriedades, folha inferior, menus | Derivado; coincide com a faixa clara da margem superior |
| `--color-raised` | `#2E3456` | Campo em foco, botão pressionado, item ativo de lista | Derivado |
| `--color-ink` | `#EAEAEF` | Traço principal: contorno de peça, texto | Medido (traço, média) |
| `--color-ink-2` | `#A3A5B6` | Traço secundário: hachura da camada ativa, chamadas, texto de apoio | Medido (traço esmaecido) |
| `--color-ink-3` | `#7D7F93` | Linhas técnicas: centro, construção, cota, moldura. Nunca texto pequeno | Medido (fio da moldura) |
| `--color-ink-faint` | `#5D6076` | Camadas inativas, pautado do corpo fixo, marcas da grade | Medido (traço dissolvido) |
| `--color-wall` | `#2A3050` | Parede da chapa (espessura da peça) e face das peças em camadas inativas | Medido no frame oficial (a) |
| `--color-shadow` | `#0B0D24` | Sombra projetada entre camadas, com opacidade 0,7 | Derivado do mais escuro medido; opacidade medida no frame oficial (a) |
| `--color-gold` | `#D4AA5F` | Acento 1: a mão da pessoa | Escolhido |
| `--color-ember` | `#EE7B4F` | Acento 2: energia e alerta | Escolhido |

O traço principal é `#EAEAEF`, não o branco puro do pico. Branco puro sobre índigo escuro ofusca em tela; `#EAEAEF` é o branco da referência com a tinta assentada, e ainda dá 12,5:1.

A textura do palco fica entre `#181C3D` e `#262C4D`. O claro medido (`#363A57`) é forte demais para ficar embaixo de uma hachura fina; a textura usa 35% dele.

### Os dois acentos

**Ouro velho `#D4AA5F` — a mão da pessoa.** Seleção, foco, ferramenta ativa, alças, encaixe, ligação em criação, o ponto agarrado na simulação, o cabeçote da linha do tempo. Por quê: num desenho todo em branco frio, um branco mais forte não marca seleção; precisa de outro matiz. O ouro quente e pouco saturado destaca sem virar "cor de estado" de app genérico (azul, verde, vermelho). E é a cor da família interativ: no interativMind, o veio dourado marca o erro corrigido; aqui, marca onde a pessoa está mexendo. O tom fica entre o ouro (`#C78E3A`) e a folha de ouro (`#DDAA4C`) do interativMind, um pouco mais claro, porque aqui o ouro vive em linha fina, não em preenchimento.

**Brasa `#EE7B4F` — energia e alerta.** Pressão e calor na câmara, sensor acionado, faísca de impacto, tensão de mola (Fase 5), erro e ação destrutiva. Por quê: o laranja-avermelhado é a cor do metal aquecido, e fica quase no lado oposto do índigo no círculo de cor (cerca de 145° de distância), então um toque pequeno já chama o olho. Na oficina, a marcação sobre a cópia azul era feita a lápis de cor; a brasa é esse lápis.

Regras dos acentos:

- Ouro aparece sobretudo no modo editar; brasa, sobretudo no modo simular. Os dois modos não se misturam, então os acentos raramente dividem a tela.
- Nunca os dois no mesmo elemento. Nenhum dos dois como preenchimento de área grande: cada um ocupa no máximo cerca de 5% da tela.
- Os dois têm luminância parecida (contraste de 1,28:1 entre si) e, para quem não distingue vermelho e verde, ficam quase iguais. Por isso nunca carregam a informação sozinhos: ouro aparece em anéis, alças e contornos fechados; brasa aparece em pontilhado, raios e tiques que crescem.
- Latão não é dourado. Material é hachura; cor é estado.

### Contraste (WCAG 2)

| Primeiro plano | sobre chrome `#171A37` | sobre stage `#1E2448` | sobre surface `#262B4A` | sobre raised `#2E3456` |
| --- | --- | --- | --- | --- |
| ink `#EAEAEF` | 14,13 | 12,50 | 11,47 | 10,06 |
| ink-2 `#A3A5B6` | 6,95 | 6,15 | 5,64 | 4,95 |
| ink-3 `#7D7F93` | 4,30 | 3,80 | 3,49 | 3,06 |
| ink-faint `#5D6076` | 2,74 | 2,43 | 2,23 | 1,95 |
| gold `#D4AA5F` | 7,84 | 6,93 | 6,36 | 5,58 |
| ember `#EE7B4F` | 6,12 | 5,41 | 4,97 | 4,35 |

Leitura:

- `ink`, `ink-2` e `gold` passam AA para texto (4,5:1) em todos os fundos.
- `ember` passa AA em chrome, stage e surface. Sobre `raised` (4,35), só texto grande ou não-texto.
- `ink-3` passa 3:1 em todos os fundos: serve para linhas técnicas e texto grande, nunca texto pequeno.
- `ink-faint` fica abaixo de 3:1 de propósito. É estado inativo, isento como um controle desabilitado. Nunca é a única forma de ler algo necessário.
- Botão principal invertido: texto `stage` sobre `ink` dá 12,50; texto `stage` sobre `gold` dá 6,93.
- Sobre `wall` (`#2A3050`), a face das camadas inativas: `ink` 10,70, `ink-2` 5,26, `ink-faint` 2,08.

## Hierarquia de traço

Espessuras em px de tela (CSS). O traço não escala com o zoom: a gravura tem a mesma densidade em qualquer aproximação.

| Linha | Espessura | Cor | Estilo |
| --- | --- | --- | --- |
| Contorno de peça | 1,5 | ink | Contínua, junção arredondada (forma livre não pode fazer bico) |
| Parede (espessura da chapa) | 1 no contorno | wall (face), ink-2 (contorno) | Cópia da peça deslocada 2 px para baixo e para a direita, por baixo dela. Aparece só nas arestas do lado oposto à luz, como uma faixa escura com um fio claro por fora |
| Chanfro iluminado | faixa de 2,5 no total | ink a 0,7 e a 0,35 | Fio escuro de 0,75 px logo dentro do contorno, depois faixa clara de 1,25 px (ink a 0,7) e faixa de 1,25 px mais apagada (ink a 0,35). Sem hachura |
| Linha interna do chanfro | 0,75 | ink-2 | Fecha a faixa do chanfro; a hachura começa aqui |
| Hachura | 0,5–0,75 na textura, no degrau base | ink-2 na camada ativa | Textura do material, gira com a peça |
| Linha de chamada | 0,75 | ink-2 | Curva suave, termina num ponto de 2 px sobre a peça. Chamadas não se cruzam |
| Linha de centro | 0,75 | ink-3 | Traço-ponto 8·2·1·2 |
| Linha de construção | 0,5 | ink-3 | Contínua |
| Linha oculta (raio-x) | 0,75 | ink-2 | Tracejada 4·3 |
| Cota | 0,75 | ink-3 (linha), ink (número) | Setas cheias de 6 px, linha de extensão com 2 px de folga da peça. A linha se interrompe no meio para o valor, em Old Standard TT itálico, 13 px |
| Moldura da prancha | 0,75 + 1,5 | ink-3 | Fio duplo com 3 px de vão. Editar: fio externo contínuo, interno tracejado 4·3. Simular: os dois contínuos |
| Seleção | 2 | gold | Por cima do contorno |

Parede e chanfro são a convenção das patentes levada ao relevo, como no frame oficial: luz do canto superior esquerdo, arestas inferiores e direitas com espessura, borda polida pegando luz. A peça vira uma chapa usinada, sem filtro e sem gradiente. A parede substitui a "linha de sombra" da primeira versão deste documento.

Parede e chanfro são caminhos estáticos no espaço local da peça: o chanfro é um par de caminhos `evenodd` (contorno externo e contorno deslocado para dentro), calculado na edição pela geometria (offsets); a parede é um `<use>` da forma com deslocamento no espaço do mundo. Nada disso é recalculado por quadro.

Como o zoom afeta:

- Espessuras ficam constantes na tela.
- De 3× para cima, contorno sobe para 2 px e a parede para 3 px.
- Quando uma peça fica com menos de 24 px na tela, somem chanfro e parede, e a hachura vira um tom liso com a mesma cobertura.
- A hachura mantém a densidade na tela, por degraus de 2×: o renderizador escolhe a escala da textura (o mm por pixel do registry multiplicado por 2ᵏ) para o passo entre linhas ficar entre 4 e 8 px. Abaixo de 3 px de passo, vira tom. A troca acontece no fim do gesto de pinça, com transição de opacidade de 120 ms, nunca a cada quadro.
- O que é medido em px de tela (deslocamento da parede, faixas do chanfro, espessuras) é recalculado no mesmo momento, no fim do gesto.
- Números de chamada que colidem são escondidos. Têm prioridade os das ligações que tocam a camada ativa.

## Hachuras por material

Cada material se distingue por padrão e densidade de linha, como na convenção de hachura de corte do desenho técnico (família ANSI 31–38), adaptada à gravura. Os padrões são definidos no espaço local da peça e giram com ela; a hachura nunca fica presa à tela.

Medidas em px de tela no degrau base. Traço `ink-2` na camada ativa.

| Material | Padrão | Medidas | Leitura |
| --- | --- | --- | --- |
| Aço | Pares de linhas paralelas a 45° | Traço 0,6; as duas linhas do par a 1,5 de distância; um par a cada 6 | Tom médio-escuro, duro, regular |
| Alumínio | Linhas simples a 45° | Traço 0,5; uma linha a cada 7 | O metal mais claro, aberto |
| Latão | Linha cheia alternada com linha tracejada, a 45° | Traço 0,6; linhas a cada 3,5; tracejado de 4 com vão de 2 | Tom médio, vibrante |
| Polímero | Hachura cruzada aberta, 45° e 135° | Traço 0,5; a cada 8 nas duas direções (losangos grandes) | Tom claro-médio, neutro |
| Borracha | Linhas onduladas paralelas ao eixo x da peça | Traço 0,75; uma a cada 4; onda de amplitude 1 e período 8 | Macio, elástico |
| Madeira | Veio: linhas longas quase paralelas ao eixo x, levemente irregulares, com um nó (3 a 4 anéis elípticos) por ladrilho | Traço 0,5–0,75 variando; espaçamento entre 3 e 6 | Orgânico, direcional |
| Fixo / corpo | Faixa de 8 px da hachura do material ao longo da borda interna; miolo com pautado horizontal fino | Pautado: traço 0,5 em `ink-faint`, uma linha a cada 6 | Grande e calmo; lê como estrutura, não como peça |

Regras:

- **Peças vizinhas do mesmo material alternam o ângulo** (45° e 135°), como no desenho de corte. A escolha segue a paridade da peça na camada.
- **Chanfro sem hachura.** A hachura é recortada no contorno interno, não no externo. A faixa clara entre os dois lê como aresta polida pegando luz. É o que faz a peça parecer usinada.
- **Fixo/corpo** usa a hachura do próprio material só na faixa da borda (no SVG, o contorno com traço largo preenchido pelo padrão e recortado pela forma). Pontos presos ao fundo ganham o símbolo de apoio: um traço curto com quatro tiques a 45° embaixo.
- **Gás não é material.** O gás da câmara é pontilhado irregular (ver "Câmara").
- Aço, alumínio, latão, polímero, borracha e o pautado do corpo são `pattern` SVG procedurais; madeira é textura gravada do lote 01. Por cima de todas, uma textura sutil de falhas de tinta dá a irregularidade da gravura. A divisão e o porquê estão em `art/source/lote-01/asset-manifest.md`.
- Texturas e ferragens vêm do gerador como traço branco sobre preto puro, e o pipeline converte o preto em transparência. O tom mais apagado (camada inativa) vem da opacidade do próprio elemento; cores de acento vêm de variantes tingidas no pipeline. Nunca por filtro SVG.

## Como cada elemento aparece

### Palco

Papel índigo de cópia: `--color-stage` com textura opaca emendável de fibra fina, manchas verticais suaves e leve mosqueado, entre `#181C3D` e `#262C4D`. O escurecimento das bordas é um gradiente radial estático do palco, não faz parte do ladrilho. A prancha tem moldura de fio duplo, recuada 8 px da borda do palco.

A grade não é desenhada como linhas. Com o encaixe ligado, cada cruzamento vira uma cruz de 5 px em `ink-faint` com 40% de opacidade, a cada 10 mm, e uma cruz de 9 px a cada 50 mm. Sem encaixe, nada.

### Peças

Cada peça tem, de baixo para cima:

1. a sombra projetada (ver "Camadas");
2. a parede;
3. o preenchimento com a cor do palco (a peça cobre o que está atrás dela na mesma camada, como na gravura);
4. a hachura do material, recortada no contorno interno;
5. a textura de falhas de tinta, recortada do mesmo jeito;
6. o chanfro iluminado e a sua linha interna;
7. o contorno.

Furos e rasgos usam `evenodd` e recebem o mesmo tratamento por dentro: contorno, chanfro e o palco aparecendo pelo furo. Num furo, a parede aparece por dentro, no lado de cima e da esquerda, como a parede interna do furo vista de leve; isso sai sozinho da cópia deslocada.

Peças não ganham parafusos decorativos: uma cabeça de parafuso só aparece onde existe a ligação parafuso.

Engrenagens e catracas seguem a mesma receita. O cubo recebe a hachura de eixo (ver "Eixo"), e o aro dentado pode receber uma hachura que acompanha a curvatura, como na referência, quando a engrenagem vier da biblioteca.

### Camadas

A camada 1 é a própria folha: não projeta sombra. Da camada 2 em diante, cada peça projeta sobre o que está embaixo a mesma silhueta deslocada para baixo e para a direita, em `--color-shadow` com opacidade 0,7, borda dura, sem desfoque. O deslocamento é de 3 px no enquadramento padrão e acompanha o zoom, como uma distância real entre pranchas, até no máximo 6 px. A direção é no espaço do mundo: girar a peça não gira a luz. Isso se faz só com `transform` (um grupo com o mesmo transform da peça mais o deslocamento, ou um `<use>` da peça); nada é recalculado por quadro.

Os três estados de `docs/arquitetura.md` §5:

- **Todas:** todas as camadas com força total.
- **Ativa em destaque:** a ativa com força total e a sua sombra. As de baixo ficam veladas, como no frame oficial: face em `--color-wall`, contorno e hachura em `ink-faint`, sem parede nem chanfro, sombra a 0,25 de opacidade. A troca é feita por classe no grupo da camada, que redefine as cores; nunca por `opacity` no grupo inteiro, que obriga o navegador a compor a camada à parte a cada quadro. As de cima ficam só com o contorno em `ink-faint`, sem preenchimento, hachura nem sombra, para não esconder a ativa.
- **Raio-x:** sem preenchimento, hachura nem sombra. A ativa em contorno cheio, as outras em linha oculta (tracejada).

Em todos os estados, **o que atravessa camadas não esmaece**: eixo, pino, sensor e câmara que tocam a camada ativa ficam com força total mesmo dentro de camadas esmaecidas. É onde se vê a força passar de uma prancha a outra.

Trocar a camada ativa: troca cruzada de opacidade entre a versão forte e a esmaecida, e a nova ativa se desloca 1 px para cima e para a esquerda e volta, como uma prancha levantada e assentada. `--dur-plate`, curva `--ease-plate`.

### Ligações

Toda ligação tem um **número de referência com linha de chamada**, como na patente. O número fica fora da peça, em espaço livre, em Old Standard TT itálico, 13 px, `ink`. A chamada é curva e fina, em `ink-2`, termina num ponto sobre a ligação e nunca cruza outra chamada. Ligações com faixa de camadas mostram a faixa embaixo do número, em Archivo tabular de 11 px, `ink-2` (por exemplo, "2–4"). O número é o `ref` da ligação no formato da cena (`docs/arquitetura.md` §3): único, atribuído na criação, nunca renumerado sozinho. Peças também têm `ref` e ganham chamada quando selecionadas.

Ligações presas ao fundo (`a: null`) mostram o símbolo de apoio.

- **Parafuso.** Cabeça vista de cima (asset: fenda, sextavado interno ou rebite), em `ink`, sobre a peça mais alta do grupo, girando com ela, sobre um disco de assento na cor do palco e uma sombra curta.
- **Eixo.** Cruz de linhas de centro (traço-ponto, 12 px, `ink-3`), anel do mancal (contorno de 1,5 px) e o eixo em seção: círculo com hachura de aço densa. Motor: seta curva de 270° em `ink-2` com ponta cheia, no sentido do giro. Batente de ângulo: dois tiques radiais e um arco tracejado entre eles, em `ink-3`. Mola de torção: espiral de 2 voltas e meia em volta do eixo, em `ink-2`.
- **Pino.** Círculo pequeno com hachura cruzada fina (seção de pino), contorno de 1,5 px. Aparece em todas as camadas da faixa. Nas camadas da faixa que não são a ativa, ganha um anel tracejado um pouco maior: o sinal de que atravessa a prancha.
- **Trilho.** Duas linhas paralelas finas em `ink-2` (a guia), o eixo de deslizamento em traço-ponto `ink-3`, e os batentes como blocos curtos com hachura de corpo nas pontas do curso. O curso aparece como cota quando o trilho está selecionado. A mola de retorno é desenhada espira por espira ao longo do eixo.
- **Mola.** Vista lateral, espira por espira (asset de uma espira, repetido). A frente de cada espira em 1,5 px `ink`; as costas em 0,75 px `ink-2`, o que dá a profundidade da hélice. Extremidades com espira fechada e olhal; ancoragens com um círculo pequeno. Ao esticar, o fio mantém a espessura e só o passo muda.
- **Câmara.** Cilindro em corte: paredes com hachura de corpo, furo com linha de centro, e o volume de gás atrás do pistão em pontilhado irregular `ink-2`, ralo em repouso. Na queima, o pontilhado passa para brasa e adensa em três degraus, mais denso junto ao pistão (três camadas de pontilhado prontas, trocadas por opacidade). O recuo é da física; o desenho não treme.
- **Sensor.** Corpo do sensor visto de cima (asset) no ponto da ligação; em volta, círculo tracejado curto (a zona, no raio real) em `ink-2`, com oito tiques radiais por fora. A faixa de camadas aparece como no pino. Acionado: anel e tiques em brasa, os tiques crescem 1,3× e apagam em 280 ms; o número da chamada pisca em brasa e volta.

### Seleção e edição

- Peça selecionada: contorno em ouro, 2 px, por cima do contorno normal, sem brilho. O nome da peça aparece numa chamada em ouro.
- Alças: círculos de 10 px com contorno de ouro de 1,5 px e miolo da cor do palco. Área de toque de 44 px. Alça de giro: arco curto com ponta de seta, em ouro.
- Seleção por caixa: retângulo tracejado 4·3 em ouro, 1 px.
- Encaixe ativo: um glifo em ouro por tipo. Centro: cruz dentro de círculo. Vértice: quadrado. Ponto médio: triângulo. Tangente: círculo com reta tangente. Concêntrico: dois círculos. Guias de alinhamento: linha de construção em ouro, 0,5 px, 50% de opacidade.
- Passar o mouse (computador): o contorno engrossa para 2 px, sem mudar de cor.
- Ligação em criação: o desenho da ligação em ouro até ser confirmada.
- Forma inválida (polígono que cruza a si mesmo): o cruzamento marcado com um x pequeno em brasa; a mensagem vai para a folha de propriedades.
- Modo editar: o fio interno da moldura da prancha é tracejado, como um desenho em andamento.

### Simulação

O desenho não muda quando a peça se move: é a peça gravada que anda e gira. Mudam o quadro e os sinais:

- O fio interno da moldura passa de tracejado a contínuo: a prancha impressa, em operação.
- Somem as linhas de construção, as cotas, as marcas da grade e os números das ligações que a pessoa não opera. Ficam os números das ligações que se tocam (gatilhos, alavancas, motores).
- O dedo (ou o mouse) que agarra uma peça vira um anel de ouro no ponto agarrado, com um fio de ouro de 0,75 px até o dedo: a força do arrasto.
- Linha do tempo: régua gravada, com tique longo a cada segundo e curto a cada 0,1 s (só os longos quando não couberem). Cabeçote em ouro: linha vertical com ponta triangular em cima. Eventos (sensor, câmara) são tiques em brasa um pouco mais altos que os longos.
- Setas de giro não aparecem na simulação: o movimento já mostra o giro. A seta curva é só o símbolo do motor.
- Durante a simulação, só mudam `transform` e o desenho das ligações (molas, fio do arrasto). A troca de degraus da câmara e os efeitos usam opacidade e `transform` em elementos já criados.

### Efeitos

Sempre em traço de gravura, nunca em brilho de tela. Numa camada própria, com um conjunto fixo de elementos reaproveitados.

- **Clarão da câmara.** Leque de 7 a 11 raios finos e afinados na ponta (como os raios de explosão das gravuras), em brasa no centro e `ink` nas pontas, mais um gradiente radial estático em brasa a 18% embaixo. Só opacidade e escala animam. 160 ms.
- **Faísca de impacto.** De 3 a 6 traços curtos e afinados saindo do ponto de contato, em `ink`, com um ponto de brasa no centro. 120–200 ms. No máximo 12 faíscas na tela.
- **Fumaça** (Fase 5): volutas de linha em `ink-faint`, que sobem e somem por opacidade.
- Nenhum filtro SVG, nenhum desfoque.

### Interface

- **Barras** (topo e ferramentas): `chrome`, separadas do palco por um fio de 1 px em `ink-faint`.
- **Painel e folha inferior:** `surface`. Cabeçalho com título em Old Standard TT 700 caixa alta, entreletra 0,2 em, 13 px, e um fio duplo embaixo em `ink-3`. A alça de arrasto da folha são três traços curtos gravados. Raio de 2 px; nada de pílula.
- **Botões de texto:** retângulo com raio de 2 px, contorno de 1 px em `ink-3`, texto em Old Standard TT 700 caixa alta, entreletra 0,12 em, 14 px, `ink` (o letreiro da prancha, como no frame oficial). Pressionado: fundo `raised` e 1 px para baixo. Ligado: contorno e texto em ouro. Principal (Simular): fundo `ink`, texto `stage`, o único bloco claro da tela. Destrutivo: texto em brasa, com confirmação na própria página.
- **Botões de ferramenta:** o ícone dentro de um quadrado de traço de 44 px, contorno de 1 px em `ink-3`, cantos retos. Ferramenta ativa: quadrado e ícone em ouro.
- **Campos:** rótulo em Old Standard TT 700 caixa alta, 12 px, `ink-2`, entreletra 0,14 em. Valor em Archivo com algarismos tabulares, 15 px, `ink`. Unidade (mm, °, s) em `ink-2`. Linha de base de 1 px em `ink-3`; em foco, 2 px em ouro.
- **Foco visível:** contorno de 2 px em ouro, a 2 px do elemento, cantos retos.
- **Lista de camadas:** uma pilha de pranchas em perspectiva oblíqua, como uma vista explodida em miniatura (frame oficial c): cada camada é um paralelogramo com fio duplo e furos de canto. A ativa fica à frente, em `ink`, com a sua sombra dura; as outras em `ink-faint`, sem sombra. Ao lado de cada prancha, o número em Old Standard TT itálico com um traço curto ("– 2") e o nome; nome e número ficam legíveis em todas (`ink` na ativa, `ink-2` nas outras). Desenho procedural em SVG.
- **Ícones:** desenhados no projeto em SVG, grade de 24 px, traço de 1,5 px em `ink`, pontas retas. Superfícies com 2 a 4 linhas de hachura a 45°. O ícone de cada ligação é o próprio desenho dela no palco (o ícone do eixo é o símbolo do eixo). Ativo: ouro. Cada ícone é uma pequena prancha de patente, não um pictograma genérico. Referência de desenho: o trilho de ferramentas do frame oficial (c) e a barra do (a).

### Tipografia

Todas no Google Fonts, licença OFL, conferidas nos pacotes `@fontsource` 5.3.0: acentos do português, °, × e – presentes.

| Papel | Família | Por quê |
| --- | --- | --- |
| Títulos, botões de texto, rótulos de campo | **Old Standard TT** 700, caixa alta, entreletra 0,12–0,2 em | Romano moderno do século XIX, a letra dos cabeçalhos impressos das patentes e dos livros técnicos da época. Em caixa alta espaçada, é o letreiro da prancha. O peso 700 segura os traços finos em 12 px sobre o índigo |
| Números de chamada | **Old Standard TT** 400 itálico | Os algarismos itálicos das chamadas da referência. Os algarismos dele têm largura fixa: números alinham |
| Texto, valores e mensagens | **Archivo** (variável: peso 100–900, largura 62–125) | Grotesca contemporânea, legível de 11 a 16 px, com algarismos tabulares (`tnum`) para mm, ° e s. O eixo de largura deixa o painel caber em 390 px sem trocar de família. Mantém a interface sóbria por cima da cena antiga |
| "Fig." (opcional) | **Pinyon Script** 400 | Cursiva de caligrafia inglesa, no espírito do "Fig. 2" da referência. Só para "Fig. N" e o título da figura, a partir de 22 px. Nunca em interface |

Escala no celular: título de tela 28/32; título de painel 13/20; texto 15/22; rótulo 12/16; botão de texto 14/20; valor 15/20; número de chamada e valor de cota 13; "Fig." 24. No computador, o texto do painel desce para 14/20.

"Fig. N" é a legenda da cena: aparece no canto inferior da prancha com o nome do projeto, como nas pranchas de patente. Sem Pinyon Script, "Fig." usa Old Standard TT itálico.

## Movimento

Caráter: a imagem se revela como uma cópia na lavagem, aparecendo devagar e assentando, sem passar do ponto. **Quem balança é a física, não a interface**: nada de elástico nem de mola nas transições.

| Token | Valor | Uso |
| --- | --- | --- |
| `--ease-develop` | `cubic-bezier(0.3, 0, 0.2, 1)` | Revelação: entrada de traço, chamada, painel. Começa devagar, ganha corpo, assenta |
| `--ease-settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Folha ou painel que assenta (mesmo valor do interativMind) |
| `--ease-press` | `cubic-bezier(0.5, 0, 0.1, 1)` | Prensa: toque em botão, troca de modo (mesmo valor do interativMind) |
| `--ease-plate` | `cubic-bezier(0.65, 0, 0.35, 1)` | Troca de prancha (camada ativa): simétrica e pesada |
| `--ease-fade` | `cubic-bezier(0.55, 0, 0.75, 0.2)` | Saída (mesmo valor do interativMind) |

Durações: `--dur-tick` 90 ms (estalo de toque), `--dur-quick` 180 ms, `--dur-base` 320 ms, `--dur-plate` 480 ms, `--dur-develop` 640 ms.

Traço que "se desenha" é feito por máscara que corre do canto superior esquerdo para o inferior direito, na direção da luz. Nunca por `stroke-dashoffset` (o `AGENTS.md` só permite animar `transform`, `opacity` e máscaras).

Com `prefers-reduced-motion`, as transições de interface viram cortes de opacidade de 120 ms, e a revelação por máscara vira opacidade. A simulação e os seus efeitos continuam, só com opacidade (sem escala).

## Tema

Único e escuro, como o interativMind. A referência é escura, o contraste é alto (12,5:1 no texto principal) e um tema claro seria outra identidade, não uma variação desta.

Se um dia houver tema claro, o caminho histórico é a cópia Pellet: traço índigo sobre papel branco. Ele fica fora desta fase. Com tema único, as menções a "tema escuro e claro" no `AGENTS.md` (desempenho e capturas) precisam ser ajustadas pelo coordenador geral.

## O que evitar

- Planta azul com grade branca genérica de app de engenharia: ciano saturado, grade de linhas, fonte monoespaçada "técnica".
- Azul-da-prússia ou ciano no fundo. O fundo é índigo escuro, puxado para o violeta.
- Brilho neon, glow, desfoque, sombra suave de app, gradiente de cor nas peças.
- Peça em cinza chapado ou em metal fotográfico 3D. A peça é gravura.
- Cantos muito arredondados, botões em pílula, cartões flutuando com sombra difusa.
- Ouro ou brasa preenchendo área grande; um terceiro acento; vermelho e verde de semáforo para estados.
- Cursiva fora de "Fig."; texto pequeno em `ink-3` ou `ink-faint`.
- Grunge, papel rasgado, mancha de café, sépia. O envelhecimento é só a textura da cópia.
- Elástico e mola nas transições da interface.
- Emojis, ícones de biblioteca genérica, logotipo, assinatura, marca d'água, nomes de inventor.
- Qualquer coisa que lembre arma de fogo, nos exemplos, nos frames ou nos assets.

## Decisões do Will (03/11/2026)

- Tema único, escuro (índigo).
- Pinyon Script fica, só no "Fig. N".
- Mecanismos do frame oficial como nos prompts: catraca, engrenagens e cilindro pneumático no celular; trinco de porta no computador.

## Mudanças a partir do frame oficial (04/11/2026)

O frame mostrou um acabamento melhor que a primeira versão deste documento em alguns pontos. O que mudou:

1. **Relevo de chapa.** A "linha de sombra" virou **parede**: uma cópia da peça deslocada 2 px, em `--color-wall` (novo token, `#2A3050`), com fio claro por fora. As peças leem como chapas usinadas empilhadas.
2. **Chanfro iluminado.** A faixa do chanfro deixou de ser vazia: fio escuro, faixa clara (`ink` a 0,7) e faixa apagada (`ink` a 0,35), sem hachura.
3. **Sombra entre camadas** mais funda: opacidade de 0,55 para 0,7 (medido cerca de 0,75 no frame).
4. **Camadas inativas veladas:** face em `--color-wall`, traço em `ink-faint`, sem parede nem chanfro.
5. **Letreiro na interface:** botões de texto, rótulos de campo e títulos de painel em Old Standard TT 700 caixa alta; o rótulo sobe de 11 para 12 px. Valores e texto seguem em Archivo.
6. **Botões de ferramenta** como ícones em quadrados de traço; ativo em ouro.
7. **Lista de camadas** como pilha oblíqua de pranchas.
8. **Cota** com o valor em Old Standard TT itálico, `ink`, no meio da linha.
9. **Moldura:** no modo editar, fio externo contínuo e interno tracejado; no simular, os dois contínuos.
10. **Linha do tempo:** régua com tiques longos e curtos, cabeçote com ponta triangular.

Os tokens da Fase 1 (`src/styles/tokens.css`) precisam receber `--color-wall` e a nova opacidade da sombra.
