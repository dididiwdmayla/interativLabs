# asset-manifest — interativLabs, lote visual 01

Lote 01 da Prancha índigo, escrito pelo coordenador visual em 04/11/2026 a partir de `docs/identidade/identidade.md` e do frame oficial (`docs/identidade/frame-oficial/`).

São 17 imagens para gerar no ChatGPT, em 3 levas, e 23 saídas no registry. O Will gera leva por leva, na ordem, e sobe os PNGs originais neste diretório com o nome igual ao ID (`hw-screw-slot.png`). Depois de cada leva, o executor roda `npm run assets` e o coordenador visual revisa as folhas de contato em `docs/capturas/lote-01/`. Asset reprovado volta ao Will com o motivo anotado aqui, na seção "Revisões".

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

- A cena é em mm. O zoom vai de 0,15× a 8×. A escala de tela no zoom 1 (px por mm) é fixada na Fase 1: o protótipo usava 5 px/mm e a casca provisória usa 2,5. Os tamanhos abaixo são calculados para o pior caso, 5 px/mm: no zoom 8×, 40 px de tela por mm.
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
10. **TRANSPARENTE** (`scene-entry`). Alfa ≥ 248 vira 255; alfa ≤ 4 vira 0 e zera o RGB.
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

Para cada imagem: abra uma conversa nova no ChatGPT, anexe `docs/identidade/frame-oficial/a-editor-celular.webp` (ou o PNG original, se o ChatGPT recusar WebP) e cole o prompt inteiro. Se vier fundo que não é preto puro, moldura, texto ou mais de um objeto onde se pediu um, peça de novo.

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

### paper-stage

```
Attached: a-editor-celular. Use it only as the reference for the paper: the deep indigo cyanotype-copy paper behind the drawing. Ignore everything drawn on it.

A seamless tileable texture, 1024x1024, of that same deep indigo copy paper, seen perfectly flat and straight on, evenly lit. Fine paper fibre, faint soft vertical streaks like a wet-processed copy, and gentle low-contrast mottling. All tones stay in a narrow range of deep violet-indigo, from #181C3D to #262C4D, averaging about #1E2448.

The texture must tile seamlessly on all four edges: streaks and fibres continue across the left/right and top/bottom borders with no visible seam. Uniform overall: no darker corners, no vignette, no lighter centre, no single feature that stands out and would repeat visibly.

Avoid: any lines, drawings, grid, border, frame, text, numbers, stains, creases, tears, coffee marks, sepia, cyan or Prussian blue, watermark, signature, logo.
```

### hw-screw-slot

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, parallel hatching, cross-hatching, bright bevel edges, light from the top left. Do not copy its background, colours, layout or objects.

A single slotted cheese-head machine screw seen exactly from above, as a vintage patent engraving: a perfectly round head, perfectly centred, head diameter about 75% of the image width. A straight slot runs horizontally through the centre, about one fifth of the head diameter wide; the lower wall of the slot is dense hatching, the upper wall a bright clean edge. The head face is shaded with fine parallel hatch lines at 45 degrees, slightly denser toward the lower right. A bright chamfer ring runs just inside the crisp outer outline, and a thin dark line separates the ring from the face.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF); tone comes only from line density, never from grey fills or soft gradients. One object only.

Avoid: drop shadow, perspective, a visible screw shank, text, numbers, reference numerals, leader lines, centre lines, logo, watermark, signature.
```

### hw-screw-hex

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, parallel hatching, cross-hatching, bright bevel edges, light from the top left. Do not copy its background, colours, layout or objects.

A single hex socket cap screw seen exactly from above, as a vintage patent engraving: a perfectly round head, perfectly centred, head diameter about 75% of the image width. In the centre, a regular hexagonal socket about 40% of the head diameter across the corners, with two flat sides horizontal; the inside of the socket is deep, rendered with dense cross-hatching, its upper-left inner walls bright, its lower-right inner walls darker. The head face is shaded with fine parallel hatch lines at 45 degrees. A bright chamfer ring runs just inside the crisp outer outline, and a thin dark line separates the ring from the face.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF); tone comes only from line density, never from grey fills or soft gradients. One object only.

Avoid: drop shadow, perspective, a visible screw shank, text, numbers, reference numerals, leader lines, centre lines, logo, watermark, signature.
```

### hw-axle

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, parallel hatching, cross-hatching, bright bevel edges, light from the top left. Do not copy its background, colours, layout or objects.

A shaft running through a bushing, seen end-on from above in cross-section, as a vintage patent engraving, perfectly centred. From the centre outward: a solid circle (the cut shaft) filled with dense, even cross-hatching at 45 and 135 degrees, with a crisp outline; a thin empty black gap ring; then a wider concentric ring (the bushing), shaded with lines at 45 degrees alternating solid and dashed, with a bright bevel band along its outer edge and a thin inner bevel line. The shaft diameter is half the bushing's outer diameter; the bushing's outer diameter is about 75% of the image width. Light from the top left: the lower-right edges are slightly heavier.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF); tone comes only from line density, never from grey fills or soft gradients. One object only.

Avoid: centre lines, cross marks, drop shadow, perspective, text, numbers, reference numerals, leader lines, logo, watermark, signature.
```

### hw-pin

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, cross-hatching, bright bevel edges, light from the top left. Do not copy its background, colours, layout or objects.

A single steel dowel pin seen end-on, in cross-section, as a vintage patent engraving: a perfectly round solid disc, perfectly centred, diameter about 75% of the image width, filled with fine, even cross-hatching at 45 and 135 degrees. A crisp outer outline, and a thin bright bevel ring just inside it, separated from the hatching by a thin dark line. Light from the top left: the lower-right part of the outline slightly heavier.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF); tone comes only from line density, never from grey fills or soft gradients. One object only.

Avoid: centre lines, cross marks, drop shadow, perspective, text, numbers, reference numerals, leader lines, logo, watermark, signature.
```

### spring-coil

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, hatching, the coil-by-coil spring, bright highlights, light from the top left. Do not copy its background, colours, layout or objects.

A straight helical compression spring seen exactly from the side, lying horizontally across the whole image, as a vintage patent engraving. Exactly 6 identical coils with perfectly even pitch. The wire enters at the left edge and leaves at the right edge at the same height and the same angle, cut off flush by the image borders: no closed ends, no hooks. The front half of each coil is a thick round wire with engraved tube shading: a bright highlight line along its upper side and fine short hatch strokes along its lower side. The back half of each coil is drawn thinner and fainter, passing behind. The spring's outer diameter is about 45% of the image height, centred vertically; all coils have exactly the same shape.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF); tone comes only from line density, never from grey fills or soft gradients.

Avoid: perspective, tilt, uneven coils, end coils, drop shadow, text, numbers, reference numerals, leader lines, logo, watermark, signature.
```

### spring-end

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, hatching, the coil-by-coil spring, bright highlights, light from the top left. Do not copy its background, colours, layout or objects.

The end of a helical spring seen exactly from the side, lying horizontally, as a vintage patent engraving. At the left, a round eye loop of the same wire, seen side-on, centred at about one fifth of the image width, the attachment point of the spring. Then two tightly closed coils touching each other, then one open coil that leaves through the right edge at mid-height, cut off flush by the border. The wire is a thick round wire with engraved tube shading on the front half of each coil (bright highlight along the upper side, fine short hatch strokes along the lower side); the back half of each coil is thinner and fainter. The spring's outer diameter is about 45% of the image height, centred vertically.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF); tone comes only from line density, never from grey fills or soft gradients.

Avoid: perspective, tilt, a second spring end, drop shadow, text, numbers, reference numerals, leader lines, logo, watermark, signature.
```

### tex-ink-wear

```
Attached: a-editor-celular. Use it only to understand the printing style: an engraving printed in white ink. Do not copy its background, colours, layout or objects.

A seamless tileable texture, 1024x1024: the tiny imperfections of a hand-printed engraving, isolated. On a pure black background, sparse tiny white specks of different sizes (1 to 5 pixels), very short fine scratches (at most 20 pixels long) and small dry-brush breaks, like the places where ink failed to print. Very sparse and even: white covers only about 4% of the image, spread uniformly, with no clusters, no lines, no larger shapes and no direction.

The texture must tile seamlessly on all four edges with no visible seam.

Pure black background (#000000), perfectly flat: no paper, no gradient, no vignette, no frame. White marks only (#FFFFFF).

Avoid: drawings, hatching, grid, text, numbers, logo, watermark, signature.
```

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

### hatch-wood

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: fine white engraved lines of varying weight. Do not copy its background, colours, layout or objects.

A seamless tileable texture, 1024x1024: engraved wood grain as in a 19th-century patent drawing, white lines on pure black. About 45 long grain lines running nearly horizontally across the whole tile, slightly wavy, with irregular spacing (between 15 and 30 pixels) and irregular thickness (2 to 4 pixels), some lines tapering and ending, a few short splits. One small knot, off-centre, made of three or four elliptical rings, with the nearby grain lines flowing around it; a second, smaller and fainter knot far from the first.

The texture must tile seamlessly on all four edges: every grain line that leaves the right edge re-enters at the left edge at the same height, and top and bottom match as well. Even density over the whole tile.

Pure black background (#000000), perfectly flat: no paper, no gradient, no lighting, no vignette, no frame. White lines only (#FFFFFF).

Avoid: planks, board edges, nails, cracks across the whole tile, grey fills, text, numbers, logo, watermark, signature.
```

### hw-rivet

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, stippling, fine curved hatching, bright highlights, light from the top left. Do not copy its background, colours, layout or objects.

A single round-head rivet seen exactly from above, as a vintage patent engraving: a perfectly round domed head, perfectly centred, diameter about 75% of the image width. The dome is shown only with engraved stippling and fine concentric curved hatching: a small bright highlight toward the upper left, dots and hatching getting denser toward the lower right. A crisp outer outline, slightly heavier on the lower right.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines and dots only (#FFFFFF); tone comes only from dot and line density, never from grey fills or soft gradients. One object only.

Avoid: drop shadow, perspective, a visible shank, text, numbers, reference numerals, leader lines, centre lines, logo, watermark, signature.
```

### hw-bearing

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, hatching, cross-hatching, bright bevel edges, light from the top left. Do not copy its background, colours, layout or objects.

A single small deep-groove ball bearing seen exactly from above, as a vintage patent engraving, perfectly centred, outer diameter about 80% of the image width. An outer ring and an inner ring, both shaded with fine parallel hatching at 45 degrees and with bright bevel edges; between them, nine identical, evenly spaced balls, each with a small bright highlight toward the upper left and fine curved hatching toward the lower right, held by a thin cage line. The bore in the middle is empty black, about one third of the outer diameter.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF); tone comes only from line density, never from grey fills or soft gradients. One object only.

Avoid: drop shadow, perspective, a shaft through the bore, text, numbers, reference numerals, leader lines, centre lines, logo, watermark, signature.
```

### hw-sensor

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: line weight, hatching, stippling, bright bevel edges, light from the top left. Do not copy its background, colours, layout or objects.

A small industrial contact sensor seen exactly from above, as a vintage patent engraving, perfectly centred: a regular hexagonal body like a nut, about 70% of the image width across the flats, its faces shaded with fine parallel hatching; inside it a round collar with a bright bevel; in the centre a small round plunger with a domed top, rendered with stippling and a small bright highlight toward the upper left. Crisp outlines, slightly heavier on the lower right.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines and dots only (#FFFFFF); tone comes only from line and dot density, never from grey fills or soft gradients. One object only.

Avoid: wires, cables, a trigger, anything resembling a weapon part, drop shadow, perspective, text, numbers, reference numerals, leader lines, logo, watermark, signature.
```

### fx-gas

```
Attached: a-editor-celular. Use it only as the style reference for engraved stippling: small hand-made dots of varied size. Do not copy its background, colours, layout or objects.

A seamless tileable texture, 1024x1024: dense, irregular engraved stippling, white dots on pure black, like the stipple shading of an old engraving. Dots of varied size, from 2 to 8 pixels, some slightly irregular in shape, spread evenly over the whole tile and covering about 25% of the area. No clusters, no empty patches, no lines, no direction, no gradient.

The texture must tile seamlessly on all four edges with no visible seam.

Pure black background (#000000), perfectly flat: no paper, no vignette, no frame. White dots only (#FFFFFF).

Avoid: smoke, clouds, fire, sparks, glow, blur, text, numbers, logo, watermark, signature.
```

### fx-exhaust

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: fine, clean, tapering white lines. Do not copy its background, colours, layout or objects.

A small burst of engraved rays, as drawn in old engravings to show a puff of air escaping from a valve: 9 fine straight rays fanning out from a single point at the middle of the left edge toward the right, spread over about 60 degrees, symmetric around the horizontal. Rays of different lengths, the longest reaching about 85% of the image width; each ray is thickest at the root (about 6 pixels) and tapers to a hair-thin point. Between the longer rays, a few very short rays near the root.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF), no glow.

Avoid: fire, flames, smoke, explosion clouds, sparks, glow, blur, colour, a nozzle or any object, text, numbers, logo, watermark, signature.
```

### fx-spark

```
Attached: a-editor-celular. Use it only as the style reference for the engraving technique: fine, clean, tapering white lines. Do not copy its background, colours, layout or objects.

Three small impact sparks in a row, side by side, each centred in its own third of the image and separated from the others by wide empty black space. Each spark is made of 3 to 6 short, straight, tapering white strokes radiating from a tiny empty centre, with irregular lengths and angles, like the impact marks of old engravings. The three sparks differ from each other: one with 3 strokes, one with 4, one with 6. Each spark fits in a circle about 25% of the image height.

Pure black background (#000000), perfectly flat: no paper, no texture, no vignette, no frame. White lines only (#FFFFFF), no glow.

Avoid: stars, asterisks, glow, blur, fire, colour, text, numbers, logo, watermark, signature.
```

---

## Leva 3

| ID | Grupo | Formato | Gerar | Uso 1x / 2x | Escala | Âncora | Repete | Tintas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `scene-entry` | entrada | TRANSPARENTE | 1024×1536 | largura 512 / 1024 | tela | (0,5; 0): centro do topo | não | — |
| `mask-develop` | entrada | MÁSCARA | 1536×1024 | 768 / 1536 | tela | — | não | — |

Regras de uso e de conferência:

- **scene-entry.** A figura principal da tela de entrada (frame oficial f), sobre o papel do palco, com "Fig. 1" composto pelo código embaixo. No celular ocupa a largura útil (358 px em 390); no computador, até 512 px. Conferir: faces das pranchas opacas (nada de traço atravessando uma prancha por baixo); eixo e pino atravessando as três; nenhum número, texto ou chamada (as chamadas são procedurais, sobre a imagem).
- **mask-develop.** Revelação da entrada e das trocas de tela: a máscara gira 45° e corre do canto superior esquerdo para o inferior direito, só por `transform`. Com `prefers-reduced-motion`, não é usada (vira opacidade). Conferir: a faixa de transição ocupa cerca de 15% da largura; branco e preto chegam a 255 e 0 depois dos níveis.

### scene-entry

```
Attached: a-editor-celular. Use it as the style reference for the engraving technique: white line engraving with parallel hatching, cross-hatching, bright bevel edges, light from the top left, compression springs drawn coil by coil.

An exploded oblique view of a generic layered mechanism, as a vintage patent engraving, on a fully transparent background. Three thin flat rectangular plates with rounded corners and a small hole near each corner float one above the other, evenly spaced, seen from above at the same oblique angle, filling about 90% of the image width. The lowest plate carries a spur gear; the middle plate carries a short lever and a small compression spring drawn coil by coil; the top plate carries a ratchet wheel with a pivoting pawl. One vertical axle, drawn as a hatched cylinder with a dash-dot centre line, passes through all three plates and the gear and ratchet on it; one thin pin passes through the plates near the right edge. Each plate shows its thickness as a narrow hatched edge.

Plate faces and part faces are filled with opaque deep indigo #232A4C so that nothing behind them shows through; all lines are off-white #EAEAEF, secondary hatching #A3A5B6. Each plate casts a hard-edged flat shadow in #0B0D24 at 70% opacity onto the plate below, offset down and to the right. Everything outside the drawing is fully transparent.

Avoid: background paper, frame, border, reference numerals, leader lines, "Fig." caption, any text, numbers, logo, watermark, signature; soft shadows, glow, blur, 3D render look, photographic metal; anything resembling a firearm.
```

### mask-develop

```
Attached: a-editor-celular. Use it only for the feel of ink printed on paper; do not draw anything from it, and keep the result in pure greyscale.

A grayscale transition mask, 1536x1024. The left part of the image is pure white (#FFFFFF), the right part pure black (#000000). They meet along an irregular, roughly vertical frontier in the middle third of the image, shaped like ink soaking into paper: feathered and fibrous, with small tendrils and soft blooms reaching into the black, never a straight or smooth edge. The soft transition band is about 15% of the image width. The white area and the black area are completely flat, with no texture and no specks.

Avoid: colour, drawings, lines, engraving, hatching, paper texture, frame, text, numbers, logo, watermark, signature.
```

Se o anexo fizer o gerador desenhar gravura na máscara, gere de novo sem ele.

---

## Revisões

Nenhuma ainda. Cada reprovação entra aqui com a data, o ID, o motivo e o ajuste no prompt.
