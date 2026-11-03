# Frames de identidade — candidatos

Três direções visuais para o interativLabs. Cada uma traduz a ideia central do produto, a camada, num material do mundo real. O Will gera as imagens no ChatGPT com os prompts abaixo (duas por frame: a tela no celular e a folha de materiais e ferragens), compara e escolhe uma. O frame escolhido vira a seção "Identidade" do `AGENTS.md` e a base do manifesto do lote 01.

As imagens dos frames são para decidir a direção. Textos que o gerador inventar na tela não importam; olhe material, luz, cor, profundidade e clima.

Para todas: nada infantil, nada de clip-art, sem emojis, sem cara de app de engenharia genérico (azul de blueprint com grade branca está fora).

---

## Frame A — Vegetal e grafite

**Conceito.** Uma mesa de luz de desenhista. Cada camada é uma folha de papel vegetal; as folhas de cima ficam mais perto e deixam ver, esmaecidas, as de baixo. As peças são desenhadas a grafite, com o material indicado pela hachura de corte do desenho técnico (cada material tem sua hachura, como na norma). As cotas são em lápis vermelho. As linhas de construção usam o azul que não sai na cópia, o azul que os desenhistas usavam para rascunhar.

**Por que serve.** A camada aqui é literal: uma folha sobre a outra. A vista explodida vira folhas se levantando da mesa. O modo editar e o modo simular se separam naturalmente: no editar, o desenho é rascunho; no simular, a luz da mesa acende e o traço vira nanquim.

**Paleta.** Vegetal `#F2F1EA` · luz da mesa `#FBFCF7` · grafite `#2B2D2F` · azul de rascunho `#7FB8D8` · vermelho de cota `#C2412D` · sombra da folha `#D9D8CF`.

**Tema.** Claro como principal. O escuro seria a mesa de luz apagada: vegetal sobre vidro escuro, traço claro.

**Riscos.** Pode ficar frio e acadêmico se a hachura for rígida demais. Precisa de textura real de papel e de grafite para não parecer um CAD comum.

**Prompt 1 — tela no celular**
```
A mobile app screen (portrait, 390x844) for a 2D mechanism workbench, shown as a style frame. The canvas is a drafting light table seen from above: several stacked sheets of translucent tracing paper (vellum), each sheet slightly offset with soft shadow, the lower sheets faded through the upper ones. On the sheets, a small mechanism drawn in soft graphite pencil: a ratchet wheel with a spring-loaded pawl and two meshing gears, each part filled with technical-drawing section hatching (different hatch pattern per material). Thin red-pencil dimension lines with arrowheads. Faint non-photo-blue construction lines and centre marks. Tiny circular axle marks where parts pivot. A slim top bar and a bottom tool strip made of the same vellum, with hand-drawn graphite line icons. Warm daylight, real paper grain, graphite sheen, subtle smudges. Elegant, precise, calm, not childish, no blueprint blue, no emojis, no logos.
```

**Prompt 2 — folha de materiais e ferragens**
```
A design reference sheet on cream tracing paper over a light table: a grid of square swatches showing section hatch patterns for steel, aluminium, brass, polymer, rubber and wood, drawn in graphite; beside them, top-view drawings of mechanical hardware: slotted screw head, hex socket screw head, dowel pin, rivet, ball bearing, a compression spring drawn coil by coil, a short rack and a small involute gear. Red-pencil labels as short lines (no readable text needed). Non-photo-blue guide lines. Real paper texture, graphite sheen, soft daylight. Precise technical illustration, calm and refined.
```

---

## Frame B — Aço azulado

**Conceito.** A bancada de um relojoeiro à noite. Feltro verde-musgo, luz quente de luminária, lupa. As camadas são as placas e as pontes de um movimento de relógio. As peças são de latão com acabamento de faixas de Genebra e granulado circular, de prata rodinada e de aço com azulamento térmico, aquele azul-violeta profundo dos parafusos de relógio fino. Os eixos são rubis. Na simulação, um brilho percorre as peças que se movem.

**Por que serve.** Um movimento de relógio é o mecanismo em camadas por excelência: placas sobrepostas ligadas por pinos e eixos, cada roda num andar. O acabamento de cada material é uma textura que repete, ou seja, cabe em qualquer forma desenhada à mão. É o frame com mais "vontade de mexer".

**Paleta.** Feltro `#1E2A24` · feltro em luz `#2C3B33` · latão `#C9A45C` · aço azulado `#2B3F8C` → `#5B4FA0` · prata rodinada `#D9DCDF` · rubi `#B0213B` · marfim do texto `#EDE6D6`.

**Tema.** Escuro como principal. O claro seria a mesma bancada de dia, com feltro cinza-claro.

**Riscos.** O realismo exige texturas muito boas; uma textura fraca derruba tudo. O brilho na simulação precisa ser pré-calculado para não pesar no celular.

**Prompt 1 — tela no celular**
```
A mobile app screen (portrait, 390x844) for a 2D mechanism workbench, shown as a style frame. The canvas is a watchmaker's bench at night seen from directly above: deep moss-green felt, warm lamp light from the top left, a soft vignette. On it, a flat, layered mechanism like an exposed watch movement: brass plates with Geneva stripes and circular perlage graining, rhodium-silver bridges, a ratchet wheel with a spring-loaded pawl, two meshing gears, heat-blued steel screws with a deep violet-blue sheen, synthetic ruby jewel bearings at the pivots. Each layer casts a crisp short shadow on the one below. Thin ivory UI: a slim top bar and a bottom tool strip in dark felt with fine ivory line icons and small brass accents. Macro photography realism but flat top-down composition. Luxurious, precise, calm, no emojis, no logos.
```

**Prompt 2 — folha de materiais e ferragens**
```
A material and hardware reference sheet on dark moss-green felt, top-down, warm lamp light: square swatches of brass with Geneva stripes, brass with circular perlage, rhodium-plated silver, heat-blued steel, brushed steel, matte black polymer, red rubber, and a short strip of knurling. Below, top views of watch-style hardware: slotted heat-blued screw head, ruby jewel bearing in a brass chaton, steel dowel pin, rivet, a coil of a compression spring seen from the side, a small involute gear and a sawtooth ratchet wheel. Macro photography realism, crisp detail, consistent lighting across all swatches.
```

---

## Frame C — Patente gravada

**Conceito.** Os desenhos de patente do século XIX. Papel de algodão envelhecido, gravura a buril com hachura e contra-hachura para dar volume, figuras numeradas ("Fig. 1"), números de referência com linhas de chamada, moldura fina. Cada camada é uma prancha; a peça em destaque ganha o número da chamada. Na simulação, a gravura ganha um leve tom de cobre onde há movimento.

**Por que serve.** É o idioma visual clássico de explicar um mecanismo. Linhas de chamada numeradas viram a forma natural de mostrar ligações entre camadas ("o pino 12 atravessa da prancha 2 à 4"). A hachura de gravura pode ser gerada por forma, então funciona com peças desenhadas à mão.

**Paleta.** Papel `#EFE6D2` · tinta `#2A211A` · sépia `#6B4A2B` · cobre `#B4673A` · vermelho de carimbo `#9E2B25` · ouro velho `#B08D4A`.

**Tema.** Claro como principal. O escuro seria a chapa de cobre gravada: fundo cobre-escuro, traço claro.

**Riscos.** Pode puxar para o nostálgico decorativo e ficar pesado na interface. A interface precisa ser contemporânea e sóbria por cima de uma cena antiga.

**Prompt 1 — tela no celular**
```
A mobile app screen (portrait, 390x844) for a 2D mechanism workbench, shown as a style frame. The canvas looks like a 19th-century patent drawing plate on aged cotton paper: a ratchet wheel with a spring-loaded pawl and two meshing gears, rendered as fine copperplate engraving with hatching and cross-hatching for volume, thin reference numerals with leader lines, a small 'Fig. 1' caption, a hairline double border. Stacked plates are suggested by slightly offset paper sheets with soft shadows. The app UI on top is modern and restrained: a slim top bar and a bottom tool strip in warm paper tone with fine ink line icons, a single vermilion stamp accent. Real paper grain and ink texture. Refined, precise, not kitsch, no emojis, no logos.
```

**Prompt 2 — folha de materiais e ferragens**
```
A reference plate in the style of a 19th-century patent engraving on aged cotton paper: square swatches showing how steel, brass, wood, rubber and polymer are rendered with different engraving hatch patterns; beside them, engraved top views of hardware: slotted screw head, hex screw head, dowel pin, rivet, ball bearing, a compression spring drawn coil by coil, a small involute gear, a sawtooth ratchet wheel and a short rack. Reference numerals with leader lines. Fine burin lines, consistent engraving density, real paper texture.
```
