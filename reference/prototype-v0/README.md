# Protótipo v0

O protótipo que validou a ideia, feito numa conversa antes do repositório existir. É **referência de comportamento**, não código do app. A Fase 1 reescreve tudo sobre a arquitetura definitiva.

- `bancada.html`: o app inteiro num arquivo (editor SVG + simulação). Carrega Planck 1.5.0 e poly-decomp 0.3.0 do jsDelivr.
- `engine.js`: o motor isolado (geometria, compilação da cena para o Planck, forças de mola, torção, trilho e câmara, sensores, exemplos). Roda no Node com `npm i planck@1.5.0 poly-decomp@0.3.0`.
- `scenes/*.json`: as três cenas de exemplo no formato v0 (px, ângulos em radianos nos corpos e em graus nos limites dos eixos). A migração `v0 → v1` da Fase 1 usa estes arquivos.

## O que foi validado (Node, Planck, passo de 1/240 s)

| Cena | Entrada | Resultado medido |
| --- | --- | --- |
| Lançador | Gatilho solto por 1 s | Retém segura o percussor; nada se move |
| Lançador | Arrastar o gatilho para trás por ~0,5 s | Retém gira ~24°, percussor avança 54 px, sensor dispara uma vez, esfera sai a ~1.890 px/s |
| Trava | Arrastar a maçaneta para baixo | Maçaneta gira 30°, lingueta recolhe 38 px e sai do batente; ao soltar, volta |
| Engrenagens | Motor a −12 rpm | Razões 1,5 e 2,0 conferidas; catraca gira livre |
| Engrenagens | Motor a +12 rpm | Catraca trava; o conjunto para em ~13° |

## Lições do protótipo

- O retém só segura se o batente do eixo impedir o giro no sentido em que a força do percussor empurra. A geometria do engate decide isso, não a mola.
- Um dedo de alavanca que passa por baixo do pino trava o mecanismo por sobrecentro. Limite o giro antes desse ponto.
- Molas de torção fracas perdem para a gravidade em alavancas pesadas. O exemplo da trava usa polímero na maçaneta e rigidez alta.
- Engrenagens com dentes reais colidindo funcionam com subpassos de 1/240 s e folga de ~20% da altura do dente entre ponta e raiz.
- Parafuso como corpo composto é mais estável que junta soldada.
