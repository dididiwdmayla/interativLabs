# Lote 01 — medidas

GERADO por `npm run assets`. Valores medidos nos mestres e nos WebP decodificados; sem data variável na saída. Os PNGs permanecem intactos.

## Por saída

Fator aplicado inclui o arredondamento da altura para pixels inteiros. Diferença de eixos medida após a correção, antes do corte; no sensor, diferença máxima entre as três distâncias de faces opostas. A âncora vem do contorno ajustado, inclusive no rebite deslocado; rolamento usa o furo e sensor usa o anel do êmbolo. `mmPerPx` é o diâmetro físico dividido pelo diâmetro medido e escalado à saída 1x; as duas partes da mola compartilham a mesma escala vertical.

| ID              | Fator vertical | Diferença | Âncora (x; y)      | mm/px 1x   | Bytes 1x                   | Bytes 2x                     |
| --------------- | -------------- | --------- | ------------------ | ---------- | -------------------------- | ---------------------------- |
| `paper-stage`   | 1.0000000      | —         | 0.000000; 0.000000 | null       | base: 6188                 | base: 49790                  |
| `paper-chrome`  | 1.0000000      | —         | 0.000000; 0.000000 | null       | base: 2484                 | base: 11240                  |
| `paper-surface` | 1.0000000      | —         | 0.000000; 0.000000 | null       | base: 3260                 | base: 17654                  |
| `hw-screw-slot` | 0.9832536      | 0.005%    | 0.500901; 0.500477 | 0.02552114 | ink: 39728; gold: 39728    | ink: 121866; gold: 121866    |
| `hw-screw-hex`  | 0.9792663      | 0.029%    | 0.500861; 0.500667 | 0.02562321 | ink: 42474; gold: 42474    | ink: 145130; gold: 145130    |
| `hw-axle`       | 0.9784689      | 0.032%    | 0.500698; 0.500626 | 0.03414112 | ink: 36584; gold: 36584    | ink: 120010; gold: 120010    |
| `hw-pin`        | 0.9784689      | 0.033%    | 0.500762; 0.500453 | 0.01705390 | ink: 41040; gold: 41040    | ink: 137090; gold: 137090    |
| `hw-rivet`      | 0.9824561      | 0.011%    | 0.500931; 0.500216 | 0.02118422 | ink: 37238; gold: 37238    | ink: 119498; gold: 119498    |
| `hw-bearing`    | 0.9696970      | 0.012%    | 0.500664; 0.500356 | 0.04303335 | ink: 34862; gold: 34862    | ink: 117656; gold: 117656    |
| `hw-sensor`     | 0.9417863      | 0.668%    | 0.500273; 0.500770 | 0.02927758 | ink: 34222; gold: 34222    | ink: 110954; gold: 110954    |
| `spring-coil`   | 1.0000000      | —         | 0.000000; 0.500000 | 0.04411765 | ink: 5070; gold: 5070      | ink: 15708; gold: 15708      |
| `spring-end`    | 1.0000000      | —         | 0.589972; 0.493182 | 0.04411765 | ink: 11194; gold: 11194    | ink: 33222; gold: 33222      |
| `tex-ink-wear`  | 1.0000000      | —         | 0.000000; 0.000000 | null       | stage: 31946               | stage: 90258                 |
| `hatch-wood`    | 1.0000000      | —         | 0.000000; 0.000000 | null       | ink-2: 36626               | ink-2: 107946                |
| `fx-gas-1`      | 1.0000000      | —         | 0.000000; 0.000000 | null       | ink-2: 20102; ember: 20100 | ink-2: 45368; ember: 45368   |
| `fx-gas-2`      | 1.0000000      | —         | 0.000000; 0.000000 | null       | ink-2: 32158; ember: 32158 | ink-2: 83366; ember: 83366   |
| `fx-gas-3`      | 1.0000000      | —         | 0.000000; 0.000000 | null       | ink-2: 45852; ember: 45852 | ink-2: 139666; ember: 139666 |
| `fx-exhaust`    | 1.0000000      | —         | 0.060000; 0.500000 | null       | base: 16290                | base: 39044                  |
| `fx-spark-1`    | 1.0000000      | —         | 0.040734; 0.527698 | null       | ink: 550                   | ink: 1166                    |
| `fx-spark-2`    | 1.0000000      | —         | 0.233376; 0.572590 | null       | ink: 822                   | ink: 1766                    |
| `fx-spark-3`    | 1.0000000      | —         | 0.391399; 0.502959 | null       | ink: 834                   | ink: 1686                    |
| `scene-entry`   | 1.0000000      | —         | 0.500000; 0.000000 | null       | base: 257912               | base: 977330                 |
| `mask-develop`  | 1.0000000      | —         | 0.000000; 0.000000 | null       | base: 14496                | base: 49034                  |

## Mola e máscara

- Espira: autocorrelação horizontal na faixa central, período **255.973977 px**, correlação 0.998921; corte x=323, largura inteira 256, altura 1024. O valor real difere dos ~242 px estimados no pedido.
- Ponta: correlação cruzada com o início da espira, corte x=707, correlação 0.631409; caixa x=85, largura 622. Centro do olhal ajustado em (451.962; 505.019) no mestre. A folha monta os olhais com sobreposição de 20.000% da primeira espira.
- Máscara: níveis iniciais 60/200 deixariam 4.557% de transição; usados **40/220**. Extremos 0 e 255; transição final **6.120%**, mediana por linha do intervalo 5–95% de cinza. Continua abaixo dos 15% nominais do manifesto e segue para conferência visual.

## Coberturas

Cobertura binária = fração dos pixels com alfa > 8; ponderada = soma do alfa / área. A redução de tamanho espalha marcas finas em mais pixels com alfa baixo. Por isso as duas medidas são publicadas, sem equiparar área ocupada a quantidade de tinta.

| Saída          | Mestre: binária / ponderada | 1x: binária / ponderada | Componentes mantidos       |
| -------------- | --------------------------- | ----------------------- | -------------------------- |
| `tex-ink-wear` | 6.146% / 2.521%             | 25.142% / 3.005%        | todos (exceção dos pontos) |
| `fx-gas-1`     | 18.699% / 13.004%           | 11.838% / 3.565%        | 2350 / 9399                |
| `fx-gas-2`     | 18.699% / 13.004%           | 24.228% / 7.353%        | 4700 / 9399                |
| `fx-gas-3`     | 18.699% / 13.004%           | 47.540% / 14.429%       | 9399 / 9399                |

O mestre de gás medido não alcança os 25% nominais do manifesto; não se adicionaram pontos. As variantes mantêm 25% e 50% dos componentes, sorteados com a mesma semente, e a densa mantém 100%. A distribuição já repete sem corte perceptível: o crossfade do gás foi desativado em `config.mjs`, pois produzia faixas de menor contraste.

## Papel e emendas

Médias em RGB sRGB, arredondadas para hex, depois da compressão WebP qualidade 90. Salto de emenda = média da diferença absoluta nas bordas opostas; salto interno = média entre vizinhos horizontais e verticais. A métrica usa RGB pré-multiplicado pelo alfa e o próprio alfa, para o RGB oculto não distorcer a comparação. A folha sobre o papel é a conferência visual decisiva.

| Saída           | Média RGB final        | Média hex | Salto na emenda | Salto interno | Razão    |
| --------------- | ---------------------- | --------- | --------------- | ------------- | -------- |
| `paper-stage`   | 29.986, 35.842, 72.530 | #1E2449   | 0.295654        | 0.217617      | 1.358598 |
| `paper-chrome`  | 23.226, 25.727, 54.474 | #171A36   | 0.151367        | 0.059561      | 2.541391 |
| `paper-surface` | 37.107, 43.734, 73.747 | #252C4A   | 0.288574        | 0.105303      | 2.740406 |
| `tex-ink-wear`  | —                      | —         | 0.000000        | 3.539353      | 0.000000 |
| `hatch-wood`    | —                      | —         | 0.000000        | 13.927619     | 0.000000 |
| `fx-gas-1`      | —                      | —         | 7.513184        | 8.348007      | 0.899997 |
| `fx-gas-2`      | —                      | —         | 12.701660       | 17.023776     | 0.746113 |
| `fx-gas-3`      | —                      | —         | 18.227051       | 32.819009     | 0.555381 |

Nos papéis, os saltos absolutos permanecem abaixo de um nível RGB, mas a compressão com perda faz a razão superar 1 quando a variação interna é muito pequena. A operação de crossfade, antes da compressão, deixa as bordas iguais; o teste sintético confere razão menor que 1. A madeira tem nós repetidos em grade na folha 3×3 e exige retorno ao coordenador visual, mesmo com a borda contínua.

## Tamanhos e folhas de contato

Total de `public/assets/`: **4858436 bytes** (4.633 MiB), somando todos os WebP 1x/2x e variantes.

Todas as folhas são WebP sem perda, compostas pelo sharp sobre o paper-stage processado. Cada uma fica abaixo de 3 MiB.

| Folha                                                      | Dimensões | Bytes   |
| ---------------------------------------------------------- | --------- | ------- |
| [textura-paper-stage.webp](textura-paper-stage.webp)       | 1876×1628 | 72908   |
| [textura-tex-ink-wear.webp](textura-tex-ink-wear.webp)     | 1200×860  | 120446  |
| [textura-hatch-wood.webp](textura-hatch-wood.webp)         | 1200×860  | 276218  |
| [textura-fx-gas-1.webp](textura-fx-gas-1.webp)             | 1200×860  | 199524  |
| [textura-fx-gas-2.webp](textura-fx-gas-2.webp)             | 1200×860  | 292836  |
| [textura-fx-gas-3.webp](textura-fx-gas-3.webp)             | 1200×860  | 402170  |
| [papeis-derivados.webp](papeis-derivados.webp)             | 1200×920  | 96020   |
| [mola.webp](mola.webp)                                     | 1200×1050 | 285400  |
| [ferragens-1.webp](ferragens-1.webp)                       | 1200×1504 | 1121066 |
| [ferragens-2.webp](ferragens-2.webp)                       | 1200×1144 | 764088  |
| [desgaste-sobre-hachura.webp](desgaste-sobre-hachura.webp) | 1200×780  | 200550  |
| [efeitos.webp](efeitos.webp)                               | 1200×850  | 98022   |
| [entrada.webp](entrada.webp)                               | 1200×1100 | 472690  |
| [mascara-histograma.webp](mascara-histograma.webp)         | 1200×940  | 84310   |

Os números completos, fatores medidos antes do arredondamento e tamanhos por variante estão em [medidas.json](medidas.json). A conferência artística, os testes de determinismo, o tamanho do dist e os encaminhamentos ficam em [relatorio.md](relatorio.md).
