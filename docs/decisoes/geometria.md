# Decisão: geometria (Fase 1 · item 3)

Data: 2026-11-04. Código em `src/geometry/`, testes em `src/geometry/*.test.ts`.

## Booleanos de polígono: Clipper2 (`clipper2-ts` 2.0.1-18)

Avaliadas três bibliotecas nos casos de teste do item 3, mais dois casos de carga. Versões confirmadas no npm nesta data.

| Caso | clipper2-ts 2.0.1-18 | polygon-clipping 0.15.7 | martinez-polygon-clipping 0.9.0 |
| --- | --- | --- | --- |
| Contorno em oito (cruza a si mesmo) | 2 peças, área certa | 2 peças, área certa | **falha**: 1 peça de área 0 |
| Furo tangente à borda | certo | certo | certo |
| Furo que vaza a borda | certo | certo | certo |
| Rasgo que divide a peça | 2 peças | 2 peças | 2 peças |
| Aresta compartilhada (união) | 1 peça | 1 peça | 1 peça |
| Diferença com deslocamento de 1e-7 mm | vazio (correto) | **1 polígono de área 0** | **1 polígono de área 0** |
| Dois furos encostados | certo | certo | certo |
| Estrela ∪ estrela girada | certo | certo | certo |
| Colinear parcial / quase colinear (1e-9 rad) | certo | certo | certo |
| União de 300 círculos | 39 ms | 147 ms | 410 ms |
| Disco − 400 trapézios (corte de engrenagem) | 51 ms | 360 ms | 284 ms |

| | clipper2-ts | polygon-clipping | martinez |
| --- | --- | --- | --- |
| Tamanho (min, gzip, medido no pacote) | 33,8 KB | 14,2 KB | 4,4 KB |
| Licença | BSL-1.0 | MIT | MIT |
| Última versão | 2026-07 (porte do Clipper2 2.0, 258 testes de referência) | 2023-12 | 2026-09 |
| Aritmética | inteira (robusta) | ponto flutuante | ponto flutuante |

Escolha: **clipper2-ts**, pela robustez (único que acertou todos os casos, inclusive o degenerado) e pela velocidade. O tamanho maior é aceitável: a geometria roda no editor, não no laço de simulação. A versão `2.0.1-18` é a marcada como `latest` no npm; fica fixada sem `^`.

Escala inteira fixa: **10 000 unidades por mm** (`CLIP_SCALE` em `src/geometry/clip.ts`), resolução de 0,1 µm. Coordenadas acima de ±9·10¹¹ mm são recusadas com erro tipado, sem exceção.

Regra de preenchimento: não nula (cada laço de um contorno desenhado conta como material). Furos são resolvidos à parte e subtraídos, para que um furo dentro de um laço invertido continue sendo furo.

## Triangulação: earcut 3.2.4

O Clipper2 traz triangulação (Delaunay restrita), testada e descartada: com um furo encostado no contorno externo ela devolveu triângulos com área total **maior** que a da peça (12 300 contra 9 400 esperados). O earcut (ISC, 4,3 KB gzip) acertou os mesmos casos e trata furos por pontes. É determinístico.

## Decomposição convexa

`decomposeConvex` (`src/geometry/decompose.ts`):

1. normaliza a orientação e limpa vértices repetidos (< 0,01 mm) e colineares (< 0,005 mm);
2. triangula com earcut (pontes dos furos para o contorno);
3. funde triângulos por Hertel-Mehlhorn, removendo primeiro a diagonal mais longa, enquanto o resultado continuar convexo e com no máximo **8 vértices** (o limite do Box2D v3, o menor entre os candidatos);
4. peças com menos de 0,05 mm² são fundidas a uma vizinha; se nenhuma fusão convexa servir (lasca num trecho côncavo e denso), funde pelo fecho convexo quando o acréscimo é desprezível; senão descarta, somando a área descartada no aviso.

Círculo sem furo continua círculo. Engrenagem, cremalheira e catraca não passam pela via genérica: núcleo (círculo, ou setores convexos quando há furo central) mais um polígono convexo por dente.

Teste: 31 formas (quadrado, círculo, L, oito, furos tangente e vazando, rasgo divisor, estrela côncava de 12 pontas, placa com 3 furos e 1 rasgo, anel, barra 300 × 1, pente, moldura, contorno aleatório, engrenagem pela via genérica, triângulo com furo, cruz e as peças do lançador do protótipo). Todas: peças convexas, até 8 vértices, soma das áreas com erro < 0,5% e a mesma saída em duas execuções.

## Engrenagem evolvente

O perfil é o que uma cremalheira de corte reta geraria (ângulo de pressão α, ponta reta a 1,25·m da linha primitiva, dente engrossado pela folga). Para cada raio ρ, a meia espessura angular do dente é o menor valor entre o flanco evolvente (onde a ferramenta o gera) e a trocoide traçada pelo canto da ponta da ferramenta. Com poucos dentes a trocoide corta o pé do flanco: é o rebaixo verdadeiro, que deixa a cabeça da vizinha passar. Um pescoço mínimo de 0,2·m de meia largura impede que o dente se solte (com aviso).

- Folga: 0,04·m de redução da espessura no primitivo (padrão).
- Discretização: amostragem adaptativa por desvio de corda de 0,005·m (no máximo 0,005 mm) nos flancos, com pelo menos 8 pontos no trecho evolvente; arcos de cabeça e pé com corda de 0,02 mm.
- Fase: dente k centrado em (k + ½)·2π/z, a mesma convenção do protótipo.
- Forma de colisão: um fecho de 8 pontos por dente (pé, início do evolvente, meio, cabeça, nos dois flancos). O pé do dente abaixo da profundidade de trabalho (r − m) fica fora da colisão, onde nenhuma vizinha chega; a massa usa o contorno inteiro.

Malha medida (módulo 1, 360 posições de uma volta do pinhão): pares 12 × 24, 14 × 32 e 20 × 20 e pinhão de 12 contra cremalheira com **interseção zero** e distância máxima entre perfis de 0,040 a 0,042 mm (limite: 0,1 mm). A distância mínima, 0,0377 mm, é a folga normal esperada (0,04 · cos 20°).

Catraca: dente de serra com rampa reta até a ponta (78% do passo) e face de trava inclinada (4° por padrão), arco de pé até o próximo dente. A forma `gear` com perfil `ratchet` do v1 usa as proporções do protótipo: profundidade π·m/2, ponta em r + 0,4·profundidade.

## Lascas finas (Parte E2c, 07/11)

A decomposição convexa passou a tratar como lasca também a peça mais fina que 0,055 mm na menor largura (`MIN_THICKNESS` em `src/geometry/decompose.ts`), além das com menos de 0,05 mm². Motivo: o Box2D calibrado (`lengthUnits` 5, folga linear de 0,025 mm) descarta como degenerada uma peça com pontos a menos de duas folgas da reta, e a triangulação de furos densos (traço à mão do Lápis) fazia leques finos de um canto distante até dois vértices vizinhos do furo; a peça saía com aviso de compilação. A lasca é fundida à vizinha; quando a fusão passa de 8 vértices, as duas são juntadas (até 14) e divididas de novo pela diagonal que deixa as metades mais grossas; pelo fecho convexo, a lasca fina pode encher um entalhe do tamanho dela mais 0,05 mm². Peças que o motor já aceitava não mudam: os 33 hashes das cenas de teste continuaram iguais.
