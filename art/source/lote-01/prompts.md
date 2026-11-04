# interativLabs — Prompts do lote visual 01 (17 imagens)

4 de nov. de 2026 · coordenador visual

O manifesto (`art/source/lote-01/asset-manifest.md`) guarda formato, escala, âncoras e processamento de cada imagem. Este documento guarda só o que você cola no ChatGPT.

## Revisão 2 — 04/11 · lote fechado

As três versões novas foram aprovadas, e as 17 imagens do lote estão aprovadas.

| ID | Status | Motivo |
| --- | --- | --- |
| `spring-coil` (v2) | Aprovada | Frente grossa com sombreado de tubo e costas finas, inclinadas ao contrário: lê como hélice. Seis espiras de passo igual. O fio entra e sai pelas bordas. O diâmetro ocupa 52% da altura (pedido: 45%), o que não muda nada, porque a escala vem da medida. |
| `spring-end` (v2) | Aprovada | Mesmo fio, mesmo diâmetro e mesmos dois traços da espira. Não vieram as duas espiras fechadas junto ao olhal: as espiras já saem no passo normal, o que facilita a emenda com a `spring-coil`. O olhal tem cerca de 1,15 vez o diâmetro da mola. |
| `tex-ink-wear` (v2) | Aprovada | Cobertura de 4,6%, entre 4,3% e 4,9% em todos os 16 quadrantes. Cerca de 9 200 marcas, de pontos a riscos curtos, sem direção. |

Ajuste novo para o código: o fio da `spring-end` sai pela borda direita perto do alto, e não no meio da altura. O corte da direita deve ser feito na mesma fase em que a `spring-coil` é cortada (no ponto em que o fio da frente cruza a linha do eixo), para as duas emendarem.

## Revisão 1 — 04/11

As 17 imagens chegaram. Ficam aprovadas 14 e voltam 3 para geração. As duas molas voltam juntas, porque precisam casar uma com a outra.

Gere as três numa conversa nova, com a abertura de sempre e a `a-editor-celular.png` anexada. A ordem é `spring-coil`, `spring-end` e `tex-ink-wear`. Salve com o sufixo `-v2` (`spring-coil-v2.png`). Os nomes finais quem acerta é o pipeline.

| ID | Status | Motivo |
| --- | --- | --- |
| `paper-stage` | Aprovada | Média (33, 39, 68) contra (30, 36, 72) do token. O pipeline ajusta em Lab, como já previsto. Sem vinheta: os blocos variam menos de 1 nível. Emenda invisível no 3×3. |
| `hw-screw-slot` | Aprovada | Redonda, fenda horizontal, chanfro legível. |
| `hw-screw-hex` | Aprovada | Ver o ajuste de proporção abaixo. |
| `hw-axle` | Aprovada | Eixo e bucha distintos. Ver o ajuste de proporção. |
| `hw-pin` | Aprovada | Hachura cruzada uniforme, sem cruz de centro. |
| `hw-rivet` | Aprovada | A cúpula saiu mais esférica que no frame (e), mas lê bem como rebite. |
| `hw-bearing` | Aprovada | Nove esferas iguais e igualmente espaçadas. Furo vazio. |
| `hw-sensor` | Aprovada | O hexágono saiu cerca de 7% mais alto que um regular. Corrige no pipeline. Não lembra peça de arma. |
| `spring-coil` | **Regenerar** | Saiu como zigue-zague de tubo: a metade de trás tem a mesma espessura da da frente, e o fio tem contorno branco em volta. A identidade e o frame (e, peça 6) pedem frente grossa e costas finas, para ler como hélice. |
| `spring-end` | **Regenerar** | Mesmo motivo, e precisa casar com a nova espira. |
| `tex-ink-wear` | **Regenerar** | Cobertura de 0,3% contra os 3–5% pedidos. Sobre a peça, o efeito some. O formato das marcas está bom; falta quantidade. O prompt novo pede por contagem. |
| `hatch-wood` | Aprovada | Emenda perfeita: as linhas casam na borda com erro mediano de 0,5 px. No 3×3 o nó forma uma grade leve, que o deslocamento por `ref` de cada peça já quebra. |
| `fx-gas` | Aprovada | Cobertura de 17% contra cerca de 25%. Lê denso e sem aglomerados, com emenda invisível. |
| `fx-exhaust` | Aprovada | Raios de cerca de 5 px na raiz, afinando até a ponta. O leque tem 50° (o pedido era 60°), sem problema. |
| `fx-spark` | Aprovada | Três, quatro e seis traços, diferentes entre si. A primeira faísca é um leque para um lado só, o que é plausível para faísca de impacto. |
| `scene-entry` | Aprovada | Transparência real: 48% do fundo com alfa 0 e só 2% de borda parcial. Faces opacas, eixo e pino atravessando as três pranchas, catraca com lingueta, mola espira por espira. Nenhum texto. |
| `mask-develop` | Aprovada | Fronteira entre 44% e 54% da largura, dentro do terço central. A faixa de transição tem 9% (pedido: cerca de 15%), o que deixa a revelação um pouco mais nítida. Preto e branco chegam a 0 e a 255. |

### spring-coil (v2)

CHAVE-PRETA · paisagem · espira que repete · leva 1

```
A straight helical compression spring seen exactly from the side, lying horizontally across the whole image, drawn like the coil spring in the attached reference image: a real round-wire helix that reads as a cylinder, never a zigzag, a wave or a ribbon.

Exactly 6 identical coils with perfectly even pitch, about half the spring's outer diameter. Each coil is drawn as two different strokes:
- the front half: a thick round wire slanting up and to the right from the bottom edge of the spring to the top edge, with engraved tube shading: a bright highlight line along its upper-left side and fine short hatch strokes along its lower-right side;
- the back half: a much thinner and fainter line, about one third of the front's thickness, slanting the other way, visible in the gaps between the front strokes and passing behind them.
Front and back halves meet at the top and bottom edges of the spring, where the wire turns.

The wire enters at the left edge and leaves at the right edge at the same height and the same angle, cut off flush by the image borders: no closed ends, no hooks. The spring's outer diameter is about 45% of the image height, centred vertically; all coils have exactly the same shape.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

No white outline or halo around the wire, no perspective, no tilt, no uneven coils, no end coils, no drop shadow.

Landscape 3:2, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### spring-end (v2)

CHAVE-PRETA · paisagem · ponta da mola com olhal · gerar logo depois do spring-coil v2 · leva 1

```
The end of the same helical spring as spring-coil (the previous image in this conversation): exactly the same wire thickness, outer diameter and pitch, and the same two kinds of stroke, a thick front half with engraved tube shading slanting up and to the right, and a much thinner, fainter back half slanting the other way. Seen exactly from the side, lying horizontally.

At the left, a round eye loop of the same wire, seen side-on, centred at about one fifth of the image width, its outer diameter about the same as the spring's outer diameter: the attachment point of the spring. Then two tightly closed coils touching each other, then one open coil that leaves through the right edge at mid-height, cut off flush by the border, at the same height and angle as the wire of spring-coil. The spring's outer diameter is about 45% of the image height, centred vertically.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

Only one spring end. No white outline or halo around the wire, no perspective, no tilt, no second eye, no drop shadow.

Landscape 3:2, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### tex-ink-wear (v2)

CHAVE-PRETA · quadrado · seamless · falhas de tinta sobre as peças · leva 1

```
Seamless, tileable texture of the tiny imperfections of a hand-printed engraving, isolated, like the places where the ink of the attached reference failed to print: about 1,500 separate small white marks spread evenly over the whole tile. A mix of specks of different sizes (2 to 6 pixels), very short fine scratches (5 to 20 pixels long, in random directions) and small dry-brush breaks. Much denser than a starry sky: any 100 by 100 pixel area holds about ten marks, and white covers about 4% of the image. No clusters, no empty patches, no long lines, no larger shapes and no direction.

It must tile perfectly: the left edge continues into the right edge and the top edge into the bottom edge, with no visible seam.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White marks only (#FFFFFF). The black will be converted into transparency.

No drawings, no hatching, no grid, no frame.

Square 1:1, full-bleed, highest resolution available.

No text, letters, numbers, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### Ajustes que ficam para o código

Vão para o manifesto e o pipeline. Nenhum pede geração nova.

- **Proporção.** As imagens quadradas vieram em 1254×1254, e as ferragens redondas saíram cerca de 2% mais altas que largas: pino 998×1020, sextavado 1000×1021, eixo 999×1020, rolamento 997×1026. Corrigir a escala vertical para o círculo ajustado dar eixos iguais, com um fator por asset em `config.mjs`. No `hw-sensor`, o fator deve deixar o hexágono regular (cerca de 0,934 na vertical).
- **Âncora.** O centro do `hw-rivet` está 18 px acima do centro da imagem. A âncora sai do ajuste de círculo, não do centro da caixa, como o manifesto já manda.
- **fx-gas.** O mestre tem 17% de cobertura, não 25%. Se a queima parecer rala na folha de contato, suba as frações de rarefação de 50% e 25% para 60% e 30%.
- **mask-develop.** Com os níveis padrão (60 e 200), a faixa estreita ainda mais. Confira na folha de contato e afrouxe para 40 e 220, se a borda ficar dura.

## Como gerar

Abra uma conversa nova no ChatGPT para cada grupo, na ordem de 1 a 6. Na primeira mensagem de cada conversa, anexe `a-editor-celular.png` e cole o texto de abertura. Depois mande um prompt por mensagem, na ordem deste documento. O lote pode levar mais de um dia de cota.

1. Baixe cada imagem em PNG com o nome igual ao ID, por exemplo `hw-screw-slot.png`. Se refizer uma imagem, use um nome novo: `hw-pin-v2.png`.
2. Teste a transparência no `scene-entry`, o único asset TRANSPARENTE. Se vier com o xadrez desenhado ou com fundo sólido, troque o parágrafo que começa com "Output:" pelo fallback abaixo e me avise. O pipeline recorta o verde.
3. Imagens que precisam casar saem em sequência na mesma conversa: as sete ferragens, e o `spring-coil` seguido do `spring-end`.
4. CHAVE-PRETA e MÁSCARA vêm com fundo preto puro de propósito. O preto vira transparência, e o traço é tingido pela cor do token.
5. Peça de novo na hora se vier:
   - texto, número, número de chamada ou linha de chamada;
   - fundo que não é preto puro;
   - no `paper-stage`, linha, grade ou mancha;
   - moldura, sombra projetada ou perspectiva;
   - mais de um objeto onde se pediu um;
   - qualquer coisa que lembre arma.

   Depois de duas tentativas ruins, guarde a melhor e siga.
6. Traga tudo para cá, por grupo ou no fim. Na revisão eu confiro o fundo, o enquadramento, a emenda das texturas e a consistência entre as peças, e devolvo os prompts corrigidos.

Fallback de fundo, só se a transparência falhar no `scene-entry`:

```
Output: PNG on a perfectly flat, uniform pure green background (#00FF00) — no texture, no gradient, no shadow, no vignette (the green will be keyed out later). Do not use any green inside the drawing. Only the drawing, complete and centered, with empty margin around it; no paper, no frame, no cast shadow outside the plates.
```

## Abertura de cada conversa

Cole com `a-editor-celular.png` anexada. Essa mensagem não gera imagem: o ChatGPT só responde "Ready".

```
I'm attaching the approved style reference for interativLabs, a 2D mechanism workbench app: a mechanism drawn as a vintage patent plate, printed as white line engraving on deep indigo paper. In this conversation I will request several separate image assets, one per message. Rules for every image in this conversation:

- Use the attached image only as a style reference: its engraving technique (fine, crisp white lines; parallel hatching, cross-hatching and stippling for volume; a clean bright bevel band just inside every outline; slightly heavier lines on the lower-right edges, with light from the top left), its compression springs drawn coil by coil, and its deep indigo copy paper.
- Never edit, crop, extend or redraw the reference itself, and never copy its composition, layout, interface or mechanism.
- Unless a prompt says otherwise, draw pure white lines (#FFFFFF) on a perfectly flat, uniform pure black background (#000000): tone comes only from the density of lines and dots, never from grey fills or soft gradients. No paper texture, no vignette, no frame. The black will be converted into transparency later.
- Draw exactly what the prompt asks and nothing more: no reference numerals, no leader lines, no centre lines, no drop shadows and no perspective unless the prompt asks for them.
- Never anything resembling a firearm or a weapon part.
- No text, letters, numbers, signatures, logos or watermarks in any image.
- Always generate at the highest resolution available, as PNG.
- Reply with just the image, no commentary.

Don't generate anything yet. Reply only "Ready".
```

---

## Grupo 1 — Papel (1)

O papel do palco, opaco, emendável nas quatro bordas. Todos os outros fundos do app saem dele.

### paper-stage

OPACO · quadrado · seamless · fundo do palco · leva 1

```
Seamless, tileable texture of the deep indigo copy paper behind the drawing in the attached reference image, seen perfectly flat and straight on. Fine paper fibre, faint soft vertical streaks like a wet-processed cyanotype copy, and gentle low-contrast mottling. All tones stay in a narrow range of deep violet-indigo, from #181C3D to #262C4D, averaging about #1E2448: never cyan, never Prussian blue, never sepia, never flat black.

It must tile perfectly: the left edge continues into the right edge and the top edge into the bottom edge, with no visible seam.

Flat, even, shadowless lighting. No lines, no drawings, no grid, no border, no stains, no creases, no tears, no focal point, no single feature that would repeat visibly, no vignette, no darker corners, no lighter centre.

Square 1:1, full-bleed, highest resolution available.

No text, letters, numbers, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

---

## Grupo 2 — Ferragens (7)

As sete saem na mesma conversa, em sequência, para manter o mesmo traço, a mesma hachura e o mesmo tamanho na imagem. Todas vistas exatamente de cima, centradas, sem perspectiva.

### hw-screw-slot

CHAVE-PRETA · quadrado · ligação parafuso, cabeça de fenda · leva 1

```
A single slotted cheese-head machine screw seen exactly from above, as a vintage patent engraving like the attached reference: a perfectly round head, head diameter about 75% of the image width. A straight slot runs horizontally through the centre, about one fifth of the head diameter wide; the lower wall of the slot is dense hatching, the upper wall a bright clean edge. The head face is shaded with fine parallel hatch lines at 45 degrees, slightly denser toward the lower right. A bright chamfer ring runs just inside the crisp outer outline, with a thin dark line separating the ring from the face.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

Only the screw head, perfectly centred, with even black margin around it. One object only. No visible shank, no drop shadow, no perspective, no centre lines.

Square 1:1, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### hw-screw-hex

CHAVE-PRETA · quadrado · ligação parafuso, cabeça sextavada · gerar logo depois do hw-screw-slot · leva 1

```
A single hex socket cap screw seen exactly from above, from the same set as hw-screw-slot (the previous image in this conversation, if present): the same head size, outline, chamfer ring and hatching. A perfectly round head, head diameter about 75% of the image width. In the centre, a regular hexagonal socket about 40% of the head diameter across the corners, with two flat sides horizontal; the inside of the socket is deep, rendered with dense cross-hatching, its upper-left inner walls bright, its lower-right inner walls darker. The head face is shaded with fine parallel hatch lines at 45 degrees. A bright chamfer ring runs just inside the crisp outer outline, with a thin dark line separating the ring from the face.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

Only the screw head, perfectly centred, with even black margin around it. One object only. No visible shank, no drop shadow, no perspective, no centre lines.

Square 1:1, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### hw-axle

CHAVE-PRETA · quadrado · ligação eixo, eixo na bucha · leva 1

```
A shaft running through a bushing, seen end-on from above in cross-section, as a vintage patent engraving like the attached reference, with the same line weight as the screw heads earlier in this conversation. From the centre outward: a solid circle (the cut shaft) filled with dense, even cross-hatching at 45 and 135 degrees, with a crisp outline; a thin empty black gap ring; then a wider concentric ring (the bushing), shaded with lines at 45 degrees alternating solid and dashed, with a bright bevel band along its outer edge and a thin inner bevel line. The shaft diameter is half the bushing's outer diameter; the bushing's outer diameter is about 75% of the image width. Light from the top left: the lower-right edges are slightly heavier.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

Only the shaft and bushing, perfectly centred and concentric, with even black margin around them. One object only. No centre lines, no cross marks, no drop shadow, no perspective.

Square 1:1, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### hw-pin

CHAVE-PRETA · quadrado · ligação pino, seção do pino · leva 1

```
A single steel dowel pin seen end-on, in cross-section, as a vintage patent engraving like the attached reference, with the same line weight as the previous hardware in this conversation: a perfectly round solid disc, diameter about 75% of the image width, filled with fine, even cross-hatching at 45 and 135 degrees. A crisp outer outline, and a thin bright bevel ring just inside it, separated from the hatching by a thin dark line. Light from the top left: the lower-right part of the outline slightly heavier.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

Only the pin section, perfectly centred, with even black margin around it. One object only. No centre lines, no cross marks, no drop shadow, no perspective.

Square 1:1, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### hw-rivet

CHAVE-PRETA · quadrado · terceira aparência do parafuso, rebite (Fase 4) · leva 2

```
A single round-head rivet seen exactly from above, as a vintage patent engraving like the attached reference, from the same set as the screw heads earlier in this conversation: a perfectly round domed head, diameter about 75% of the image width. The dome is shown only with engraved stippling and fine concentric curved hatching: a small bright highlight toward the upper left, dots and hatching getting denser toward the lower right. A crisp outer outline, slightly heavier on the lower right.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines and dots only (#FFFFFF). The black will be converted into transparency.

Only the rivet head, perfectly centred, with even black margin around it. One object only. No visible shank, no drop shadow, no perspective, no centre lines.

Square 1:1, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### hw-bearing

CHAVE-PRETA · quadrado · aparência alternativa do eixo, rolamento (Fase 4) · leva 2

```
A single small deep-groove ball bearing seen exactly from above, as a vintage patent engraving like the attached reference, with the same line weight and hatching as the hardware earlier in this conversation; outer diameter about 80% of the image width. An outer ring and an inner ring, both shaded with fine parallel hatching at 45 degrees and with bright bevel edges; between them, nine identical, evenly spaced balls, each with a small bright highlight toward the upper left and fine curved hatching toward the lower right, held by a thin cage line. The bore in the middle is empty black, about one third of the outer diameter.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

Only the bearing, perfectly centred, with even black margin around it. One object only. No shaft through the bore, no drop shadow, no perspective, no centre lines.

Square 1:1, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### hw-sensor

CHAVE-PRETA · quadrado · ligação sensor, corpo do sensor · leva 2

```
A small industrial contact sensor seen exactly from above, as a vintage patent engraving like the attached reference, with the same line weight as the hardware earlier in this conversation: a regular hexagonal body like a nut, about 70% of the image width across the flats, its faces shaded with fine parallel hatching; inside it a round collar with a bright bevel; in the centre a small round plunger with a domed top, rendered with stippling and a small bright highlight toward the upper left. Crisp outlines, slightly heavier on the lower right.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines and dots only (#FFFFFF). The black will be converted into transparency.

Only the sensor, perfectly centred, with even black margin around it. One object only. No wires, no cables, no trigger, nothing resembling a weapon part, no drop shadow, no perspective.

Square 1:1, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

---

## Grupo 3 — Molas (2)

O renderizador monta cada mola com uma ponta em cada lado e várias espiras repetidas entre elas. As duas imagens precisam do mesmo fio, do mesmo diâmetro e do mesmo sombreado. Gere o `spring-end` logo depois do `spring-coil`, na mesma conversa.

### spring-coil

CHAVE-PRETA · paisagem · espira que repete · leva 1

```
A straight helical compression spring seen exactly from the side, lying horizontally across the whole image, as a vintage patent engraving like the springs in the attached reference. Exactly 6 identical coils with perfectly even pitch. The wire enters at the left edge and leaves at the right edge at the same height and the same angle, cut off flush by the image borders: no closed ends, no hooks. The front half of each coil is a thick round wire with engraved tube shading: a bright highlight line along its upper side and fine short hatch strokes along its lower side. The back half of each coil is drawn thinner and fainter, passing behind. The spring's outer diameter is about 45% of the image height, centred vertically; all coils have exactly the same shape.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

No perspective, no tilt, no uneven coils, no end coils, no drop shadow.

Landscape 3:2, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### spring-end

CHAVE-PRETA · paisagem · ponta da mola com olhal · gerar logo depois do spring-coil · leva 1

```
The end of the same helical spring as spring-coil (the previous image in this conversation, if present): the same wire thickness, the same outer diameter, the same coil shape and the same engraved shading. Seen exactly from the side, lying horizontally. At the left, a round eye loop of the same wire, seen side-on, centred at about one fifth of the image width: the attachment point of the spring. Then two tightly closed coils touching each other, then one open coil that leaves through the right edge at mid-height, cut off flush by the border. Front half of each coil thick, with a bright highlight along its upper side and fine short hatch strokes along its lower side; back half thinner and fainter. The spring's outer diameter is about 45% of the image height, centred vertically.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

Only one spring end. No perspective, no tilt, no second eye, no drop shadow.

Landscape 3:2, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

---

## Grupo 4 — Texturas de linha (3)

As três se repetem nas quatro direções e precisam emendar sem marca. A falha de tinta dá o aspecto de impresso a todas as peças. A madeira é o único material que não sai de hachura desenhada pelo código. O pontilhado é o gás da câmara.

### tex-ink-wear

CHAVE-PRETA · quadrado · seamless · falhas de tinta sobre as peças · leva 1

```
Seamless, tileable texture of the tiny imperfections of a hand-printed engraving, isolated: sparse tiny white specks of different sizes (1 to 5 pixels), very short fine scratches (at most 20 pixels long) and small dry-brush breaks, like the places where the ink of the attached reference failed to print. Very sparse and even: white covers only about 4% of the image, spread uniformly, with no clusters, no lines, no larger shapes and no direction.

It must tile perfectly: the left edge continues into the right edge and the top edge into the bottom edge, with no visible seam.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White marks only (#FFFFFF). The black will be converted into transparency.

No drawings, no hatching, no grid, no frame.

Square 1:1, full-bleed, highest resolution available.

No text, letters, numbers, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### hatch-wood

CHAVE-PRETA · quadrado · seamless · material madeira · leva 2

```
Seamless, tileable texture of engraved wood grain as in a 19th-century patent drawing, in the fine white engraved lines of the attached reference. About 45 long grain lines running nearly horizontally across the whole tile, slightly wavy, with irregular spacing (between 15 and 30 pixels) and irregular thickness (2 to 4 pixels), some lines tapering and ending, a few short splits. One small knot, off-centre, made of three or four elliptical rings, with the nearby grain lines flowing around it; a second, smaller and fainter knot far from the first. Even density over the whole tile.

It must tile perfectly: every grain line that leaves the right edge re-enters at the left edge at the same height, and the top edge continues into the bottom edge, with no visible seam.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no lighting, no vignette and no other color. White lines only (#FFFFFF). The black will be converted into transparency.

No planks, no board edges, no nails, no cracks across the whole tile, no grey fills.

Square 1:1, full-bleed, highest resolution available.

No text, letters, numbers, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### fx-gas

CHAVE-PRETA · quadrado · seamless · gás da câmara · leva 2

```
Seamless, tileable texture of dense, irregular engraved stippling, like the stipple shading in the attached reference: white dots of varied size, from 2 to 8 pixels, some slightly irregular in shape, spread evenly over the whole tile and covering about 25% of the area. No clusters, no empty patches, no lines, no direction, no gradient.

It must tile perfectly: the left edge continues into the right edge and the top edge into the bottom edge, with no visible seam.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White dots only (#FFFFFF). The black will be converted into transparency.

No smoke, no clouds, no fire, no sparks, no glow, no blur.

Square 1:1, full-bleed, highest resolution available.

No text, letters, numbers, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

---

## Grupo 5 — Efeitos da simulação (2)

São os traços da gravura antiga para ar escapando e para impacto. O código anima esses traços só por opacidade e escala, e pinta de brasa onde precisa.

### fx-exhaust

CHAVE-PRETA · quadrado · escape da câmara · leva 2

```
A small burst of engraved rays, as drawn in old engravings to show a puff of air escaping from a valve, in the fine, clean, tapering white lines of the attached reference: 9 fine straight rays fanning out from a single point at the middle of the left edge toward the right, spread over about 60 degrees, symmetric around the horizontal. Rays of different lengths, the longest reaching about 85% of the image width; each ray is thickest at the root (about 6 pixels) and tapers to a hair-thin point. Between the longer rays, a few very short rays near the root.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF), no glow. The black will be converted into transparency.

Only the rays. No nozzle or any object, no fire, no flames, no smoke, no explosion clouds, no sparks, no blur, no colour.

Square 1:1, highest resolution available.

No text, letters, numbers, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

### fx-spark

CHAVE-PRETA · paisagem · três faíscas de impacto · leva 2

```
Three small impact sparks in a row, side by side, each centred in its own third of the image and separated from the others by wide empty black space, in the fine, clean, tapering white lines of the attached reference. Each spark is made of short, straight, tapering white strokes radiating from a tiny empty centre, with irregular lengths and angles, like the impact marks of old engravings. The three sparks differ from each other: one with 3 strokes, one with 4, one with 6. Each spark fits in a circle about 25% of the image height.

Background: perfectly flat, uniform pure black (#000000), with no paper texture, no gradient, no vignette and no other color. White lines only (#FFFFFF), no glow. The black will be converted into transparency.

No stars, no asterisks, no glow, no blur, no fire, no colour.

Landscape 3:2, highest resolution available.

No text, letters, numbers, logos or watermarks. Use the reference only for style; do not edit it or copy its composition.
```

---

## Grupo 6 — Tela de entrada (2)

O `scene-entry` é a figura grande da tela de entrada e o único asset com transparência de verdade, então é o teste de transparência do lote. A máscara é um mapa em tons de cinza que o código usa para revelar a tela como tinta entrando no papel. Se a máscara vier com gravura desenhada por causa do anexo, abra uma conversa nova sem anexo e sem abertura e cole só o prompt dela.

### scene-entry

TRANSPARENTE · retrato · figura da tela de entrada · leva 3

```
An exploded oblique view of a generic layered mechanism, as a vintage patent engraving like the attached reference. Three thin flat rectangular plates with rounded corners and a small hole near each corner float one above the other, evenly spaced, seen from above at the same oblique angle, filling about 90% of the image width. The lowest plate carries a spur gear; the middle plate carries a short lever and a small compression spring drawn coil by coil; the top plate carries a ratchet wheel with a pivoting pawl. One vertical axle, drawn as a hatched cylinder with a dash-dot centre line, passes through all three plates and the gear and ratchet on it; one thin pin passes through the plates near the right edge. Each plate shows its thickness as a narrow hatched edge.

This image is not white on black. Plate faces and part faces are filled with opaque deep indigo #232A4C, so that nothing behind them shows through; all lines are off-white #EAEAEF, secondary hatching #A3A5B6. Each plate casts a hard-edged flat shadow in #0B0D24 at 70% opacity onto the plate below, offset down and to the right. No soft shadows, no glow, no blur, no 3D render look, no photographic metal.

Output: PNG with a fully transparent background (real alpha channel). Only the drawing, complete and centered, with empty margin around it. No checkerboard pattern, no paper, no frame, no border.

Portrait 2:3, highest resolution available.

No text, letters, numbers, reference numerals, leader lines, "Fig." caption, logos or watermarks; nothing resembling a firearm. Use the reference only for style; do not edit it or copy its composition.
```

### mask-develop

MÁSCARA · paisagem · revelação da entrada e das trocas de tela · leva 3

```
A grayscale transition mask. Ignore the attached reference for this one: draw nothing from it.

The left part of the image is pure white (#FFFFFF), the right part pure black (#000000). They meet along an irregular, roughly vertical frontier in the middle third of the image, shaped like ink soaking into paper: feathered and fibrous, with small tendrils and soft blooms reaching into the black, never a straight or smooth edge. The soft transition band is about 15% of the image width. The white area and the black area are completely flat, with no texture and no specks.

Grayscale only: no colour, no drawings, no lines, no engraving, no hatching, no paper texture, no grain, no halftone dots, no dithering; smooth, clean gradients. White means visible, black means hidden. Full-bleed, no border.

Landscape 3:2, highest resolution available.

No text, letters, numbers, logos or watermarks.
```
