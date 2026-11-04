# Fase 1 · Parte E1 — relatório do lote 01

Pipeline concluído no branch `fase-1-lote-01`: 17 mestres preservados, 23 entradas no registro, 70 WebP e 14 folhas de contato. A aprovação visual continua pendente; a madeira precisa voltar ao coordenador visual. Interface, geometria, motores, cenas e `/#bench` ficaram intactos.

## Itens e commits

| Item | Resultado | Commit |
| --- | --- | --- |
| 10.1 | Extração binária, hashes dos zips conferidos, inventário e zips removidos | `a647c5b` |
| 10.2 | Configuração, operações testáveis e cores dos tokens existentes | `d16e9e0` |
| 10.3 | Proporção, âncoras, fases, níveis, rarefação e tingimentos | `b1b77cd` |
| 10.4 | WebP 1x/2x, registro tipado, variantes e teste de arquivos/dimensões | `98d1866` |
| 10.5 | Folhas e medidas; gás sem as faixas provocadas pelo crossfade | `e22f07c` |
| 10.6 | Testes finais, determinismo, revisão artística e documentação | Commit que adiciona este relatório; hash na descrição do PR |

Os ajustes encontrados na verificação final estão no item 10.6: âncora das faíscas pela interseção dos raios, raio efetivamente desenhado no tingimento radial, margem de luminância do papel para a compressão e preservação do RGB transparente.

## Fontes e verificação

Em **04/11/2026**, `npm view sharp version dist-tags.latest repository.url engines --json` confirmou **sharp 0.35.5**, atual no npm, com Node ≥ 20.9. O [README oficial](https://github.com/lovell/sharp/blob/main/README.md) confirma ESM, `sharp(input).resize().toBuffer()/toFile()` e composição. A API do [pacote 0.35.5 no npm](https://www.npmjs.com/package/sharp/v/0.35.5), em `lib/index.d.ts` e `dist/output.mjs`, confirmou `raw`, `toColourspace`, `composite` e `webp({ lossless, quality, effort, exact })`. `exact: true` preserva o RGB zerado sob alfa zero. Ambiente: Node 24.22.1, libvips 8.18.7, libwebp 1.6.0.

`lint`, `typecheck`, `test` e `build` passaram. Foram **130 testes Vitest + 13 testes do pipeline**, além das **3 falhas esperadas preexistentes** do comparativo, já marcadas no repositório. O teste integrado usa três mestres sintéticos e executa o lote completo duas vezes em diretório temporário; confere também a faixa Lab no WebP decodificado e o alfa/RGB da entrada. Os hashes dos 17 PNGs continuam iguais aos registrados na extração.

Duas execuções adicionais de **`npm run assets`** no diretório real produziram **87 arquivos idênticos**, incluindo folhas, registro e medidas. SHA-256 agregado: `a06f660d0b32a6111b60566ba113cd4f7f400e685c8436c7682080c959c76ee9`. Evidência por arquivo em [determinismo.json](determinismo.json).

`public/assets/`: **4.858.436 bytes (4,633 MiB)**. `dist/`: **13.554.041 bytes (12,926 MiB)**, 97 arquivos; os **70 WebP foram conferidos por hash dentro do dist**. Evidência em [verificacao.json](verificacao.json). As Partes A e B já entraram no `main` pelo [PR #1](https://github.com/dididiwdmayla/interativLabs/pull/1), portanto o PR E1 pode ser aberto sem rascunho.

## Medidas principais

| Ferragem | Fator vertical aplicado | Diferença após correção |
| --- | --- | --- |
| Fenda | 0,983254 | 0,005% |
| Sextavado | 0,979266 | 0,029% |
| Eixo | 0,978469 | 0,032% |
| Pino | 0,978469 | 0,033% |
| Rebite | 0,982456 | 0,011% |
| Rolamento | 0,969697 | 0,012% |
| Sensor | 0,941786 | 0,668% entre faces |

- Espira: **255,973977 px**, corte de 256 px em x=323. Ponta: corte x=707 por correlação cruzada, correlação 0,631409. Ambas: **0,04411765 mm/px** em 1x.
- Cobertura ponderada pelo alfa em 1x: desgaste **3,005%**; gás 1/2/3 **3,565% / 7,353% / 14,429%**. Coberturas binárias e do mestre, com o limiar declarado, em [medidas.md](medidas.md).
- Médias finais do papel: stage **#1E2449**, chrome **#171A36**, surface **#252C4A**, todas a menos de 2 níveis por canal dos alvos.
- Razão emenda/interno: stage **1,358598**, chrome **2,541391**, surface **2,740406**, desgaste e madeira **0**, gás 1/2/3 **0,899997 / 0,746113 / 0,555381**. Nos papéis, o salto absoluto é menor que 0,30 nível RGBA; a razão cresce porque a variação interna é muito pequena após a compressão com perda.
- Máscara: níveis **40/220**, extremos **0/255**, transição final **6,120%**. Os níveis 60/200 deixariam 4,557% e acionaram a alternativa prevista.

Âncoras, escala de cada saída, tamanhos por variante e medidas completas: [medidas.md](medidas.md) e [medidas.json](medidas.json).

## Folhas de contato

Todas em WebP sem perda, sobre o papel processado, abaixo de 1,1 MiB cada:

- [docs/capturas/lote-01/textura-paper-stage.webp](textura-paper-stage.webp)
- [docs/capturas/lote-01/textura-tex-ink-wear.webp](textura-tex-ink-wear.webp)
- [docs/capturas/lote-01/textura-hatch-wood.webp](textura-hatch-wood.webp)
- [docs/capturas/lote-01/textura-fx-gas-1.webp](textura-fx-gas-1.webp)
- [docs/capturas/lote-01/textura-fx-gas-2.webp](textura-fx-gas-2.webp)
- [docs/capturas/lote-01/textura-fx-gas-3.webp](textura-fx-gas-3.webp)
- [docs/capturas/lote-01/papeis-derivados.webp](papeis-derivados.webp)
- [docs/capturas/lote-01/mola.webp](mola.webp)
- [docs/capturas/lote-01/ferragens-1.webp](ferragens-1.webp)
- [docs/capturas/lote-01/ferragens-2.webp](ferragens-2.webp)
- [docs/capturas/lote-01/desgaste-sobre-hachura.webp](desgaste-sobre-hachura.webp)
- [docs/capturas/lote-01/efeitos.webp](efeitos.webp)
- [docs/capturas/lote-01/entrada.webp](entrada.webp)
- [docs/capturas/lote-01/mascara-histograma.webp](mascara-histograma.webp)

## Revisão artística, divergências e pendências

- **Madeira: devolver ao coordenador visual.** Em `textura-hatch-wood.webp`, os nove nós formam grade evidente no 3×3 (aproximadamente x=208/464/720, y=152/408/664). A emenda é contínua, mas esse critério do manifesto não passou. Crossfade não elimina um motivo repetido no interior; nenhuma marca foi desenhada, apagada ou substituída.
- **Mola: conferência necessária.** Frente grossa e costas finas foram preservadas; o 1×5 acompanha o período. Em `mola.webp`, a junção olhal–espira ainda é identificável nos recortes 4×, sobretudo à direita (recortes a partir de x=420 e x=600, y=358). A fase medida e a sobreposição de 20% estão documentadas; a emenda não recebe aprovação artística definitiva nesta entrega.
- **Papéis:** sem linha dura na emenda; manchas difusas ainda permitem reconhecer repetição em uma área 3×3 grande. Conferir `textura-paper-stage.webp` e os valores absolutos de emenda antes de aprovar. O WebP qualidade 90 respeita a faixa de luminância, verificada pixel a pixel no teste.
- **Ferragens e alfa:** contornos redondos, diferenças abaixo de 2%, fenda/sextavado/eixo/rolamento/sensor distinguíveis a 24 px; a cúpula do rebite permanece legível. As variantes a 0,3 ficam discretas como previsto. Não foi observado halo escuro nas bordas de `efeitos.webp` e `entrada.webp`; o mestre da entrada já tinha RGB sem pré-multiplicação, portanto não foi desmultiplicado.
- **Desgaste:** a hachura continua inteira, com falha sutil de tinta; o efeito em `stage` quase desaparece sobre o próprio papel. A cobertura ponderada atinge 3%, enquanto a binária muda bastante com a redução. O coordenador visual deve usar a folha de hachura para julgar a intensidade.
- **Valores reais diferentes dos estimados:** mestres quadrados 1254×1254; período 256, não ~242 px; correção do sensor medida em 0,9417 antes do arredondamento, não ~0,934; gás abaixo dos 25% nominais; máscara ainda mais estreita que os 15% nominais. Seguiram-se os arquivos reais e as regras de processamento do manifesto.
- **Cantos CHAVE-PRETA:** algumas regiões de 16×16 excedem 4: eixo/pino chegam a 5 por ruído; madeira, desgaste e gás contêm marcas claras nas bordas. Todos os valores estão em [originais.md](originais.md); os mestres não foram retocados. O ponto preto 12 trata o ruído previsto.
- **Escala do gás:** a tabela menciona ladrilho de 16 mm, enquanto a seção 3 determina `mmPerPx: null` para gás e escape. O registro segue a regra explícita da seção 3, também reiterada no pedido; a escala pela câmara fica para a aplicação na Fase 2.

## Próximos passos do Will

1. Mandar estas folhas, ou seus links no GitHub, ao chat do coordenador visual para a conferência final, destacando madeira, mola, papel e máscara.
2. Levar este relatório ao coordenador geral.
3. Fazer o merge do PR **somente depois das duas aprovações** e da resolução das pendências que eles indicarem.
