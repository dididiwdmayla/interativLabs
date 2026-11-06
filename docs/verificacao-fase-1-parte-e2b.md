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

## 13.3 — Martelo: Fixar

Botão de 52 px junto ao desfazer, lado invertido para canhoto, oculto no Testar e acessível pelo menu Inserir. Quatro grupos na faixa; nesta etapa as ferramentas Ligar, Guiar e Gás ainda não são ativadas. A abertura reenquadra a cena na área livre acima da faixa. Mouse mostra prévia antes do clique; dedo a desloca 64 px, com linha até o ponto e contornos das duas peças. Esc sai.

Parafuso, eixo, pino e trava são comandos únicos. Pino detecta furo/rasgo num perfil e cria a ligação `slot` no mesmo comando; material atravessado bloqueia a cravada com aviso. Ligação existente abre o cartão sem duplicar. A animação usa transform/opacity, com corte para movimento reduzido e vibração de 12 ms quando suportada.

Playwright: 11 testes em toque 844×390 e mouse 1440×900, mais faixa/prévia em 640×360; eixo tocado a 30% do raio termina em `[0, 0]`, erro 0 mm. Parafuso sem apoio aponta ao fundo; pino gera `slot.profile` e modo `joint`; todas as cravadas desfazem/refazem para JSON idêntico. Retângulos da faixa e cantos não se interceptam. A física das ligações criadas foi conferida no teste de comando: eixo gira com carga tangencial, parafuso fica fixo, pino corre sem sair da linha.

Verificação: lint, typecheck e build; 679 testes Vitest passando e quatro falhas esperadas anteriores; 13 testes de assets; 48 testes de overflow, incluindo Martelo aberto em 360×800, 844×390 e 640×360. Capturas em `docs/capturas/fase-1/parte-e2b/martelo-*`.

## 13.4 — Martelo: Ligar, Guiar e Gás

Mola, haste e cabo nascem entre as pontas desenhadas, inclusive com uma ponta no fundo. A mola usa 10 Hz e 10% do amortecimento crítico, calculados pela massa efetiva; o diâmetro das espiras acompanha o comprimento. A prévia reutiliza as espiras do lote 01. Trilho usa curso `[0, comprimento]`, encaixe de 15° e eixo principal da peça. A ferragem selecionada pode ser arrastada mantendo suas peças; sair de um contorno dá aviso.

Sensor pede o alvo, realça câmaras e travas, e oferece a ação (acender, abrir/fechar respiro ou soltar trava). Toque no fundo cria sem ação. O sensor detecta na camada ativa, mesmo hospedado numa peça abaixo. Câmara mede interseções da linha com as peças móveis, junta paredes do mesmo corpo, ordena as duas primeiras pela frente e mede a largura livre na transversal do meio. Sem parede encontrada, aguarda a escolha na prancha antes de gravar uma cena válida. Diâmetro não encontrado abre o cartão com aviso.

Testes: 20 fluxos de ferramentas com mouse/toque, mais faixa 640×360 e câmara controlada. Mola de 30 mm, trilho de 20 mm, desfazer/refazer com JSON idêntico; sensor criado pela interface solta a trava no Testar. Câmara controlada detecta corpo, duas paredes na ordem correta e diâmetro de 6 mm. Na física, uma mola inicialmente deslocada cruza os dois lados do comprimento livre de 20 mm.

**Falha esperada preservada: recriar exatamente a câmara do Lançador de bancada.** Com início e fim idênticos ao exemplo, a regra geométrica encontra a Luva (`p8`) sob o começo, não o fundo (`null`) gravado no exemplo. O vão livre da Luva é 4,1 mm, enquanto a câmara do exemplo declara 6 mm (erro 1,9 mm). As duas peças móveis à frente que cruzam a linha são Esfera 1 e Êmbolo (`p10`, `p9`), em vez de Êmbolo e Ferrolho (`p9`, `p7`); Ferrolho e Luva pertencem ao mesmo corpo aparafusado. A posição mundial e direção foram recuperadas sem erro (−45,4; 0 mm e 0°), comprimento 100 mm. Alterar a tolerância não resolve essa diferença entre a regra de detecção e o dado autoral. O teste mantém o aceite original como falha esperada; números e peças estão em `docs/decisoes/camara-e2b.json`. O cartão precisa permitir corrigir corpo e paredes (item 13.5).

Verificação do item 13.4: 686 testes Vitest passaram, cinco falhas esperadas (quatro herdadas e a reconstrução da câmara acima); 13 testes de assets passaram; lint, typecheck e build limpos. Os 22 testes Playwright das ferramentas passaram.

## 13.5 — Cartões de ligação

Os 12 cartões têm predefinições antes de Detalhes e ícones próprios. Trocas parafuso/suporte/trava e haste/cabo/mola preservam peças, pontos e identificador. A seção Liga permite trocar as peças sob o ponto, conservando coordenadas mundiais; no rasgo escolhe guia/perfil/furo. Câmara e sensor ganharam as listas editáveis e a escolha de alvos na prancha. Remover um respiro retira as ações correspondentes e renumera os demais índices no mesmo comando.

Tabela final em §6 da arquitetura: molas 4/10/25 Hz com amortecimento 0,1 do crítico; suporte 60/15 Hz; atrito 0,05/0,30 do peso efetivo. Os testes conferem frequência linear e angular em duas massas, as 18 combinações de troca de tipo, alças e desfazer, além da escolha de paredes, respiros, portas e ações. São 22 testes de unidade novos. As alças de eixo, trilho, mola e sensor alteram somente o campo correspondente; eixo encaixa em 5°.

Playwright: 17 testes passaram, incluindo captura dos 12 cartões em 844×390, agrupamento do desfazer no mesmo controle e arrasto real das quatro alças em 1440×900. Capturas `cartao-*` e `alca-*`. As cenas passam por `parseScene` antes de entrar no editor, como na importação do app.

Verificação do item 13.5: 708 testes Vitest passaram, cinco falhas esperadas preservadas; 13 testes de assets; lint, typecheck e build limpos.

## Pedidos ao coordenador visual

Ferragem própria da trava com argola de soltura. Até a entrega, a implementação usa exclusivamente as ferragens existentes do lote 01 e a marca desenhada no código. Nenhum asset foi gerado ou substituído.

## Ainda em andamento

13.6–13.8: operações multicamada, exemplo Roda e lingueta, capturas e verificação final. Este registro não declara esses itens entregues.
