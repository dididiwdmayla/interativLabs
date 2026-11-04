# asset-manifest — interativLabs, lote visual 01

Lote 01 da Prancha índigo, escrito pelo coordenador visual em 04/11/2026 a partir de `docs/identidade/identidade.md` e do frame oficial (`docs/identidade/frame-oficial/`).

São 17 imagens para gerar no ChatGPT, em 3 levas, e 23 saídas no registry. O Will gera as imagens com `prompts.md` (os prompts estão lá, não aqui) e traz para o chat do coordenador visual, por grupo ou de uma vez. O coordenador visual revisa antes de as imagens entrarem neste diretório; as reprovadas voltam com o motivo anotado na seção "Revisões" e com o prompt corrigido. As aprovadas sobem aqui com o nome igual ao ID (`hw-screw-slot.png`). Depois o executor roda `npm run assets`, e o coordenador visual confere as folhas de contato em `docs/capturas/lote-01/`.

Nada neste lote lembra arma de fogo. Os mecanismos são genéricos.

## 1. O que é asset e o que é procedural

**Regra:** é procedural (SVG desenhado pelo código) tudo que depende da forma da peça, precisa ficar nítido em qualquer zoom ou muda de cor com o estado. É asset (imagem gerada) o que tem desenho de gravura que o código não faz bem e aparece num tamanho de tela limitado.

O porquê, em três números:

- **Escala.** Peças de 1 a 300 mm, zoom de 0,15× a 8×. A mesma peça pode aparecer de 1 a mais de 10 000 px de tela. Nenhuma imagem fica nítida nessa faixa; um caminho SVG com traço de espessura fixa na tela fica.
- **Forma livre.** Contorno, parede, chanfro e hachura acompanham um contorno desenhado à mão, com furos e rasgos. Só o código conhece esse contorno.
- **Desempenho.** No celular, 150 peças e 100 ligações a 60 qps. Caminhos estáticos movidos só por `transform` custam pouco. Imagens custam memória e preenchimento; ficam restritas a elementos pequenos (ferragens) ou repetidos (texturas), sempre reaproveitadas com `<use>` e `pattern`.

### Procedural (código, em `src/render/` e `src/ui/`)

| Elemento | Como |
| --- | --- |
| Contorno, parede, chanfro iluminado | Caminho `evenodd` da forma; parede como `<use>` deslocado; chanfro como par de offsets calculados na edição (`identidade.md`, "Hierarquia de traço") |
| Sombra entre camadas | `<use>` da forma, deslocado, em `--color-shadow` a 0,7 |
| Hachuras de aço, alumínio, latão, polímero, borracha e pautado do corpo | `pattern` SVG com linhas (ver "Hachuras" abaixo) |
| Engrenagens, catracas e cremalheiras | Geometria de `src/geometry` (evolvente, dente de serra) desenhada como peça comum |
| Cilindro da câmara, guias e batentes do trilho, mola de torção, zona do sensor, símbolo de apoio, cruz de centro | Linhas e arcos no ponto da ligação |
| Cotas, linhas de chamada, números, "Fig. N" | Caminhos e texto com as fontes da identidade |
| Moldura dupla, grade de cruzes, régua da linha do tempo | Linhas |
| Seleção, alças, glifos de encaixe, fio de arrasto | Linhas e círculos em ouro |
| Ponto de brasa da faísca e gradiente radial do clarão | Círculo e `radialGradient` estáticos, animados só por opacidade e escala |
| Ícones | SVG desenhados no projeto, como manda o `AGENTS.md`. Referência de desenho: trilho de ferramentas do frame (c) e barra do frame (a). Não viram asset |
| Lista de camadas (pilha oblíqua) e miniaturas de projeto | SVG gerado da própria cena |
| Ferragem muito pequena | Abaixo de 10 px de tela, cada ferragem vira um símbolo procedural (círculo com traço de fenda, por exemplo): a imagem não ajuda nesse tamanho e custa mais |

### Hachuras: procedural com uma textura de tinta por cima

Decisão: **cinco padrões em `pattern` procedural, madeira como textura gravada, e uma textura única de falhas de tinta sobre todas.**

- Aço, alumínio, latão, polímero e borracha são linhas retas, tracejadas ou onduladas regulares. Em `pattern` ficam perfeitos e nítidos em todos os degraus de zoom, mudam de cor só pelo token (`stroke` com `var(--color-ink-2)` na ativa, `ink-faint` na inativa) e custam quase nada. Uma textura raster de linha reta perde nitidez a cada degrau e precisaria de uma variante por cor.
- A irregularidade da gravura (linha que falha, tinta que não pegou) vem de `tex-ink-wear`: pontinhos e riscos na cor do palco, recortados na forma por cima da hachura, de qualquer material. Uma textura serve para tudo, então todas as peças ganham o mesmo "impresso" sem multiplicar assets.
- Madeira é veio orgânico com nó. Não tem fórmula curta que fique bonita; é asset (`hatch-wood`).
- O `pattern` fica dentro do grupo da peça (`patternUnits="userSpaceOnUse"`), então gira com ela. O `patternTransform` escolhe o degrau de escala (2ᵏ, para o passo ficar entre 4 e 8 px de tela) e o ângulo de 45° ou 135° (peças vizinhas alternam).
- Orçamento: as texturas raster (`hatch-wood`, `tex-ink-wear`) são medidas no item de desempenho da Fase 2. Se passarem do orçamento no celular, `tex-ink-wear` sai durante a simulação e fica só no modo editar.

### Asset (este lote)

| Grupo | O que | Por quê |
| --- | --- | --- |
| `palco` | Papel índigo do palco, com as barras e o painel derivados dele | Fibra e manchas de cópia são textura de verdade; ficam fora do SVG, no fundo do contêiner, em escala de tela |
| `ferragens` | Cabeças de parafuso (fenda, sextavado, rebite), eixo na bucha, pino em seção, rolamento, corpo do sensor | Volume de gravura (hachura curva, pontilhado, brilho de chanfro) em objetos pequenos e redondos, posicionados por âncora |
| `molas` | Uma espira e a ponta com olhal | A espira com sombreado de tubo é desenho de gravura; o renderizador repete a espira ao longo do eixo (`docs/arquitetura.md` §5) |
| `materiais` | Madeira e falhas de tinta | Ver "Hachuras" |
| `efeitos` | Pontilhado do gás, leque do escape, faíscas | Traço de gravura irregular; animados só por opacidade e `transform` |
| `entrada` | Ilustração das pranchas explodidas e máscara de revelação | Ilustração única e grande; máscara com borda de tinta |

## 2. Formatos

- **CHAVE-PRETA:** traço branco (`#FFFFFF`) sobre preto puro (`#000000`), sem textura no fundo. O pipeline converte o preto em transparência e tinge o traço pela cor do token.
- **OPACO:** imagem sem alfa, emendável nas quatro bordas quando repete.
- **TRANSPARENTE:** PNG com alfa real (o ChatGPT gera fundo transparente quando pedido).
- **MÁSCARA:** tons de cinza; branco é visível.

Cores dos tokens que o pipeline usa no tingimento: `ink` `#EAEAEF`, `ink-2` `#A3A5B6`, `gold` `#D4AA5F`, `ember` `#EE7B4F`, `stage` `#1E2448`. Tingir é trocar o RGB pela cor do token e manter o alfa. O tom apagado das camadas inativas vem da `opacity` do próprio elemento (`ink` a 0,3 sobre o palco dá praticamente `ink-faint`), não de outra variante.

## 3. Escala e tamanhos de uso

- A cena é em mm. O zoom vai de 0,15× a 8×. A escala de tela no zoom 1 é 5 px/mm (fixada em `docs/arquitetura.md` §4): no zoom 8×, 40 px de tela por mm.
- **Ferragens e molas têm escala física.** O registry guarda `mmPerPx` da saída 1x, calculado depois do corte: `diâmetro real ÷ diâmetro medido em px`. Uma cabeça de 6 mm vai de 4,5 px (0,15×) a 240 px de tela (8×); a saída 2x de 512 px cobre esse máximo em tela de densidade 2.
- **Papel, texturas e efeitos ficam em escala de tela** (`mmPerPx: null`): o papel não acompanha o zoom; `hatch-wood` e `tex-ink-wear` trocam de degrau junto com a hachura; faíscas têm tamanho fixo na tela; o gás e o escape escalam pela câmara.
- Os diâmetros "reais" das ferragens são de referência, porque o formato v1 da cena não guarda tamanho de cabeça. O renderizador escala pelo valor da ligação quando houver (raio do pino, por exemplo).

## 4. Processamento (vale para o lote todo)

1. **Mestres.** Abrir cada PNG como RGB (L nas máscaras, RGBA nos transparentes). Os PNGs deste diretório são os mestres: nunca recomprimir.
2. **CHAVE-PRETA → transparência.** Alfa = luminância normalizada, com ponto preto em 12 e branco em 235 (o "preto" do gerador costuma ter ruído até ~10). RGB = cor de tingimento do asset (padrão `ink`). Remover componentes soltos menores que 6 px de área, exceto em `tex-ink-wear`, `fx-gas` e `hw-rivet`, onde o pontinho é o desenho.
3. **Corte de margem.** Caixa de alfa > 8 com respiro uniforme de 4% do lado maior. Ferragens: caixa quadrada centrada na âncora. Texturas que repetem e a espira não são cortadas por margem (ver 6 e 7).
4. **Âncora.** Normalizada 0–1 no espaço da imagem final. Ferragens redondas: centro do círculo ajustado ao contorno externo (ajuste por mínimos quadrados nos pixels de borda), não o centro da caixa. As âncoras de cada asset estão nas tabelas.
5. **Papel (OPACO).** Conferir a emenda; se aparecer, deslocar meio ladrilho e fazer crossfade de ~8% nas bordas, como no interativMind. Ajustar a média para o token (`stage` `#1E2448`) em Lab, preservando a variação, e limitar a luminância ao intervalo `#181C3D`–`#262C4D`. Derivar do mesmo mestre:
   - `paper-chrome`: média `#171A37`, variação × 0,5;
   - `paper-surface`: média `#262B4A`, variação × 0,6.
6. **Texturas que repetem** (`paper-stage`, `hatch-wood`, `tex-ink-wear`, `fx-gas`). Folha de contato com o ladrilho emendado 3×3. Emenda visível: crossfade de ~8% nas bordas. Se continuar visível, reprova.
7. **Período da espira** (`spring-coil`). Autocorrelação horizontal na faixa central da imagem para achar o passo; recortar exatamente um período, começando no ponto em que o fio da frente cruza a linha do eixo. Conferir a emenda com 5 espiras lado a lado na folha de contato.
8. **Uma imagem, várias saídas.**
   - `fx-spark`: separar as três faíscas pelas colunas vazias, em `fx-spark-1`, `-2` e `-3`.
   - `fx-gas`: o mestre é o pontilhado denso (`fx-gas-3`). Gerar `fx-gas-2` e `fx-gas-1` por rarefação determinística: manter 50% e 25% dos componentes conexos, sorteados com semente fixa (o mesmo resultado a cada execução).
9. **Tingimento radial** (`fx-exhaust`). A cor de cada pixel vai de `ember` na âncora até `ink` a partir de 60% do raio do leque, interpolada em Lab. O alfa não muda.
10. **TRANSPARENTE** (`scene-entry`). Alfa ≥ 248 vira 255; alfa ≤ 4 vira 0 e zera o RGB. Se a transparência falhar no gerador, o original vem sobre verde puro (`#00FF00`, fallback de `prompts.md`): recortar o verde por distância de cor, com borda suavizada de 1 px e remoção da franja verde, antes dos mesmos passos.
11. **MÁSCARA** (`mask-develop`). Níveis com ponto preto em ~60 e branco em ~200, para a borda chegar a 0 e a 255.
12. **Saída.** `public/assets/<grupo>/<id>.webp` (1x) e `<id>@2x.webp` (2x), nas larguras das tabelas. OPACO em WebP com perda, qualidade 90. CHAVE-PRETA, TRANSPARENTE e MÁSCARA em WebP sem perda (traço fino não aguenta compressão com perda no alfa). Variantes tingidas ganham sufixo: `hw-screw-slot-gold.webp`.
13. **Registry.** Para cada saída: `id`, `group`, `src` 1x e 2x, `width`, `height`, `anchor` (0–1), `mmPerPx` (ou `null`), `repeat` (`none`, `x` ou `xy`), `tints` (lista das variantes).
14. **Folhas de contato** em `docs/capturas/lote-01/`: cada asset sobre o palco (`paper-stage`), em 1x e no menor tamanho de uso; texturas em 3×3; espira em 1×5; variantes tingidas lado a lado; ferragens também em `opacity` 0,3 (camada inativa).
15. Tudo que é ajuste por asset (pontos de corte, sementes, larguras, tintas) fica em `scripts/assets/config.mjs`, nunca no código do app.

## 5. Levas

| Leva | Destrava | IDs |
| --- | --- | --- |
| 1 | O palco com textura, as ligações mais comuns (parafuso, eixo, pino, mola) e o acabamento impresso das peças | `paper-stage`, `hw-screw-slot`, `hw-screw-hex`, `hw-axle`, `hw-pin`, `spring-coil`, `spring-end`, `tex-ink-wear` |
| 2 | Madeira, as ferragens restantes e os efeitos da simulação | `hatch-wood`, `hw-rivet`, `hw-bearing`, `hw-sensor`, `fx-gas`, `fx-exhaust`, `fx-spark` |
| 3 | A tela de entrada | `scene-entry`, `mask-develop` |

Os prompts de geração estão em `prompts.md`, neste diretório, organizados em seis grupos, um por conversa do ChatGPT. Cada grupo abre com a imagem (a) do frame oficial anexada e um texto de abertura. A leva de cada imagem está indicada no próprio prompt.

---

## Leva 1

| ID | Grupo | Formato | Gerar | Uso 1x / 2x | Escala | Âncora | Repete | Tintas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `paper-stage` | palco | OPACO | 1024×1024 | ladrilho 512 / 1024 | tela | — | xy | — (deriva `paper-chrome` e `paper-surface`) |
| `hw-screw-slot` | ferragens | CHAVE-PRETA | 1024×1024 | 256 / 512 | Ø da cabeça = 6 mm | centro da cabeça | não | ink, gold |
| `hw-screw-hex` | ferragens | CHAVE-PRETA | 1024×1024 | 256 / 512 | Ø da cabeça = 6 mm | centro da cabeça | não | ink, gold |
| `hw-axle` | ferragens | CHAVE-PRETA | 1024×1024 | 256 / 512 | Ø externo da bucha = 8 mm | centro do eixo | não | ink, gold |
| `hw-pin` | ferragens | CHAVE-PRETA | 1024×1024 | 256 / 512 | Ø = 4 mm; o renderizador escala por 2r ÷ 4 | centro | não | ink, gold |
| `spring-coil` | molas | CHAVE-PRETA | 1536×1024 | altura 256 / 512 | Ø externo da espira = 6 mm | (0; 0,5): entrada do fio, no eixo | x | ink, gold |
| `spring-end` | molas | CHAVE-PRETA | 1536×1024 | altura 256 / 512 | mesma escala da espira | centro do olhal | não | ink, gold |
| `tex-ink-wear` | materiais | CHAVE-PRETA | 1024×1024 | 256 / 512; degrau base = 256 px de tela | tela, por degraus | — | xy | stage |

Regras de uso e de conferência:

- **paper-stage.** Fica no fundo do contêiner do palco, fora do SVG, como `background` em escala de tela que se desloca com o pan (`background-position`) e não escala com o zoom. A vinheta das bordas é um gradiente estático à parte. Conferir: média dentro de ±2 de `#1E2448` depois do ajuste, nenhuma emenda no 3×3, nenhuma mancha que se repita como padrão evidente.
- **hw-screw-slot, hw-screw-hex.** Uma `<image>` em `<defs>` por variante, usada com `<use>` em cada parafuso, girando com a peça, sobre um disco de assento procedural na cor do palco e uma sombra curta. Conferir: círculo redondo (diferença de eixos abaixo de 2%), fenda horizontal, relevo legível em 32 px.
- **hw-axle.** No ponto de cada eixo, sob a cruz de centro procedural. Conferir: anéis concêntricos (desvio abaixo de 2%), eixo e bucha distintos em 24 px.
- **hw-pin.** Em todas as camadas da faixa do pino; nas que não são a ativa, com o anel tracejado procedural. Conferir: hachura cruzada uniforme, sem cruz de centro desenhada.
- **spring-coil, spring-end.** A mola é uma `spring-end` em cada ponta (a da direita espelhada) e N cópias de `spring-coil` entre elas, cada uma com `translate` e `scaleX`. N vem do comprimento livre; o `scaleX` fica entre 0,6 e 1,6, e fora disso N muda no fim do gesto, nunca durante a simulação. O olhal se sobrepõe a 20% da primeira espira para esconder a emenda. Conferir: emenda invisível em 1×5; frente grossa, costas finas; mesma espessura de fio na ponta e na espira.
- **tex-ink-wear.** Tingido com a cor do palco: os pontinhos "apagam" o traço onde caem. Vai por cima da hachura, recortado na forma, em todas as peças. Conferir: em 3×3 não aparece padrão; cobertura entre 3% e 5% da área; sobre uma hachura de teste, a linha parece impressa, não quebrada.

---

## Leva 2

| ID | Grupo | Formato | Gerar | Uso 1x / 2x | Escala | Âncora | Repete | Tintas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hatch-wood` | materiais | CHAVE-PRETA | 1024×1024 | 256 / 512; degrau base = 256 px de tela | tela, por degraus | — | xy | ink-2 |
| `hw-rivet` | ferragens | CHAVE-PRETA | 1024×1024 | 256 / 512 | Ø da cabeça = 5 mm | centro da cabeça | não | ink, gold |
| `hw-bearing` | ferragens | CHAVE-PRETA | 1024×1024 | 256 / 512 | Ø externo = 10 mm | centro do furo | não | ink, gold |
| `hw-sensor` | ferragens | CHAVE-PRETA | 1024×1024 | 256 / 512 | 6 mm entre faces | centro do êmbolo | não | ink, gold |
| `fx-gas` | efeitos | CHAVE-PRETA | 1024×1024 | 256 / 512 | ladrilho = 16 mm | — | xy | ink-2, ember (nas três densidades) |
| `fx-exhaust` | efeitos | CHAVE-PRETA | 1024×1024 | 256 / 512 | comprimento do leque = 3 × calibre da câmara | raiz do leque, ~(0,06; 0,5) | não | radial (processamento 9) |
| `fx-spark` | efeitos | CHAVE-PRETA | 1536×1024 | cada faísca 64 / 128 | tela: 24–40 px | centro de cada faísca | não | ink |

Regras de uso e de conferência:

- **hatch-wood.** `pattern` raster recortado na forma, girando com a peça, com o veio no eixo x da peça. Cada peça desloca o padrão por uma fração do ladrilho tirada do `ref`, para duas peças de madeira vizinhas não ficarem idênticas. Conferir: no 3×3, o nó não forma uma grade evidente; espaçamento médio entre 4 e 6 px de tela no degrau base; o veio continua nas emendas.
- **hw-rivet.** Terceira aparência da ligação parafuso. O formato v1 da cena não tem campo de aparência; fica disponível para a Fase 4. Conferir: cúpula legível em 24 px só com pontilhado.
- **hw-bearing.** Aparência alternativa do eixo (Fase 4). Conferir: esferas iguais e igualmente espaçadas; furo central vazio.
- **hw-sensor.** No ponto da ligação sensor; a zona (círculo tracejado no raio real) e os tiques são procedurais. Conferir: legível em 24 px; não lembra botão de disparo nem nenhuma peça de arma.
- **fx-gas.** O mestre vira três densidades (processamento 8). Na câmara, preenche o volume de gás como `pattern` em mm, com um `linearGradient` estático como máscara (opaco junto ao pistão, transparente no fundo). Repouso: `fx-gas-1` em `ink-2`. Queima: troca cruzada por opacidade para `fx-gas-1`, `-2` e `-3` em brasa. Conferir: pontos de tamanhos variados, sem aglomerados, cobertura de cerca de 25% no mestre.
- **fx-exhaust.** Um elemento por câmara, criado na compilação da cena e animado só por opacidade e escala (160 ms). Conferir: raios afinando até a ponta; a brasa fica na raiz depois do tingimento radial.
- **fx-spark.** Um conjunto fixo de 12 elementos reaproveitados, sorteando entre as três faíscas e girando ao acaso. Conferir: as três são diferentes entre si e legíveis em 24 px.

---

## Leva 3

| ID | Grupo | Formato | Gerar | Uso 1x / 2x | Escala | Âncora | Repete | Tintas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scene-entry` | entrada | TRANSPARENTE | 1024×1536 | largura 512 / 1024 | tela | (0,5; 0): centro do topo | não | — |
| `mask-develop` | entrada | MÁSCARA | 1536×1024 | 768 / 1536 | tela | — | não | — |

Regras de uso e de conferência:

- **scene-entry.** A figura principal da tela de entrada (frame oficial f), sobre o papel do palco, com "Fig. 1" composto pelo código embaixo. No celular ocupa a largura útil (358 px em 390); no computador, até 512 px. Conferir: faces das pranchas opacas (nada de traço atravessando uma prancha por baixo); eixo e pino atravessando as três; nenhum número, texto ou chamada (as chamadas são procedurais, sobre a imagem).
- **mask-develop.** Revelação da entrada e das trocas de tela: a máscara gira 45° e corre do canto superior esquerdo para o inferior direito, só por `transform`. Com `prefers-reduced-motion`, não é usada (vira opacidade). Conferir: a faixa de transição ocupa cerca de 15% da largura; branco e preto chegam a 255 e 0 depois dos níveis.

---

## Revisões

Nenhuma ainda. Cada reprovação entra aqui com a data, o ID, o motivo e o ajuste no prompt.
