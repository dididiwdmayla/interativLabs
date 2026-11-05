# Fase 1 · Parte E2b — verificação

Em implementação no branch `work`. O PR #7 está no histórico do `main` (merge `1c206fa`). Os itens seguintes só são marcados como concluídos depois de suas verificações.

## 13.1 — formato v3

Commit `801b2a8`. Migração v2 → v3 altera apenas a versão. Os seis exemplos v2 abrem com os mesmos hashes. As regras novas têm testes de rejeição com caminho do campo, em português. Os 29 hashes anteriores foram preservados; as três entradas acrescentadas ao manifesto pertencem às cenas novas.

## 13.2 — motor, perfis e trava

Cada superfície produz formas no mesmo corpo, com filtro, material e densidade da sua camada. A massa e a inércia analíticas somam as superfícies; a união por parafuso preserva ambas e os filtros. A cena de perfis soma 1,0568 g, com erro numérico abaixo de 10⁻¹⁰ g. O apoio da camada 2 é atravessado; repouso em y = 9,0001 mm sobre as camadas 1 e 3. O rasgo no perfil mantém o pino na linha (desvio 0,0003 mm) e chega a 20,1003 mm.

A geometria usada em uma ligação procura a superfície na camada inferida da ligação, com retorno à forma principal. Como o formato não guarda `link.layer`, a camada é a mais alta das camadas principais dos extremos; pino/sensor usam a do hospedeiro e câmara a do corpo. Rasgo usa `slot.profile` explicitamente. O perfil e a principal compartilham a origem, portanto âncoras continuam no mesmo espaço local.

A trava usa solda rígida com corpos separados. A entrada de toque é enfileirada antes do passo; sensor e fusível removem a junta depois do passo, fora do solver. O estado entra no snapshot e na gravação, sem interpolar o instante da soltura. Reiniciar recria a junta. No Box2D 6.0.0 a leitura é `b2Joint_GetConstraintForce(joint)`, vetor sem parâmetro `inv_dt`; multiplica-se pela escala de comprimento e divide-se por 10⁶ para obter N. O wrapper do vetor é liberado com `delete()`.

| Aceite da trava | Medido |
| --- | --- |
| Peso preso por 3 s | Desvio máximo 0,0003 mm |
| Soltura roteirizada em 0,1 s e queda por 0,2 s | 196,4557 mm; g inferido 9 822,8 mm/s², erro +0,13% |
| Fusível de 0,1 N, carga em rampa | Soltou com 0,1005 N (+0,5%) |
| Sensor | Soltura e evento no mesmo passo, verificado no teste de unidade |
| Linha do tempo | Replay após rewind com o mesmo hash; reinício restaura a trava |

Todos os 32 hashes coincidiram entre Node e Chromium. Abuso completo: 18 execuções dos dois casos multicamada e 18 da trava, sem falhas novas. Dados em `docs/decisoes/medidas-e2b.json`, `abuso-e2b-perfis.json`, `abuso-e2b-trava.json` e `fixtures-chromium.json`.

O desenho usa um nó por superfície, atualizando a pose compartilhada sem remontar a cena por quadro. Miniaturas, hit-test, camadas e raio-x incluem os perfis. Ferragem da trava: pino do lote 01 e argola em SVG; animação de 250 ms com transform/opacity e corte em movimento reduzido. O teste de navegador toca na ferragem antes do arrasto.

Verificação desta etapa: lint, typecheck e build limpos; 671 testes Vitest passaram, quatro falhas esperadas anteriores; os 13 testes de assets passaram. Desempenho registrado separadamente em `docs/decisoes/perf-e2b.json`.

### Desempenho medido

Chromium do sistema, headless, renderização por software, 1440×900. O binário do Playwright não pôde ser baixado (domínio bloqueado); `PW_CHROMIUM=/usr/bin/chromium` executou os testes. Comparação com checkout isolado de `801b2a8`, no mesmo ambiente, sem testes de física concorrentes durante a coleta final:

| Cena | Lento | Normal | Real | Desenho p95 em Real |
| --- | --- | --- | --- | --- |
| Antes, 150 peças | 30,0 fps | 29,9 fps | 59,9 fps | 4,0 ms |
| Agora, 150 peças | 30,0 fps | 59,9 fps | 59,9 fps | 4,4 ms |
| Agora, 150 peças, 30 com dois perfis | 30,0 fps | 59,9 fps | 30,0 fps | 5,8 ms |

A cena original não perdeu a mediana de quadros nesta comparação. **O alvo de 60 fps com perfis em Real não passou neste ambiente**; não foi relaxado. O p95 de desenho aumentou 1,4 ms em relação à base atual. O resultado oscila entre cadências de 30 e 60 fps no Chromium sem GPU; precisa ser repetido em celular intermediário. Os dois relatórios brutos preservam aparelho, navegador e tempos. O roteiro limpa o resultado anterior antes de cada rodada e confere 180 superfícies na variante.

## Pedidos ao coordenador visual

Ferragem própria da trava com argola de soltura. Até a entrega, a implementação usa exclusivamente as ferragens existentes do lote 01 e a marca desenhada no código. Nenhum asset foi gerado ou substituído.

## Ainda em andamento

13.3–13.8: Martelo, cartões, operações multicamada, exemplo Roda e lingueta, capturas e verificação final. Este registro não declara esses itens entregues.
