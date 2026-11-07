# Fase 2 · M1a — criação

## Entrega

| Item | Commit | Estado |
| --- | --- | --- |
| 1 · Sondas | `0467c5d` | Parcial. Hash igual, queda livre, mola e folga positiva passaram. Penetração ainda retorna zero; forças de ligações sem junta nativa ficam indisponíveis. |
| 2 · Painel | `aaa8a2e` | Implementado; quatro gráficos capturados em 844×390 e 1440×900, cursor em 0,58 s do Lançador. |
| 3 · Eventos | `509948b` | Implementado; teste confere ordem e passo contra eventos do motor. Inclui respiros, nomes, contagem e limiar por toque longo. |
| 4 · Presets | Commit deste relatório | Parcial. Roda: 8 estalos = 8 dentes. Lançador: pico 10,963 m/s, fora de 10,3 ±0,3; duas tentativas, sem alterar a física. Torque da lingueta aparece zerado. |

## Leituras do motor

- Força: módulo de `b2Joint_GetConstraintForce`, multiplicado por `unitMm / 10⁶` para N. Torque: `b2Joint_GetConstraintTorque × unitMm² / 10⁶`, em N·mm. Molas usam a lei já registrada pelo runtime; pressão e volume vêm do modelo da câmara.
- Folga: API confirmada nos tipos instalados do **box2d3-wasm 6.0.0**, `b2ComputeShapeDistance(input, null)`, com `b2ShapeProxy`, contornos convexos da compilação, transformados para o mundo e filtrados por camada. Retorna a menor distância, convertida para mm. **Não resolve o sinal de penetração:** o teste adicional de blocos sobrepostos recebeu 0 em vez de −2 mm. As funções de colisão entre polígonos não estão expostas nessa interface; não foi introduzido outro motor nem alterada a física.
- Parafusos fundidos em um corpo, pinos e rasgos por contato não têm uma reação de junta disponível nesta implementação. A interface mostra “—”; falta completar essa parte da tabela.

## Verificações e limites

- `typecheck`, `lint` e `build`: limpos. `git fetch origin main` e `git merge origin/main`: integração da revisão `6665f5f` (som). Conflitos em `useUiStore`, sessão, controlador e worker resolvidos preservando coleta, transporte e reprodução de som, junto com `samples`. Nenhuma edição em `src/sound/` ou `scripts/audio/`.
- Vitest executado somente nos três arquivos novos em `src/instruments/`. Eventos: 2/2. Sondas: 3/4 no estado final (falha conhecida de penetração; antes dessa checagem adicional, 4/4). Presets: 1/2 (falha conhecida do pico do Lançador). As afirmações dos aceites permanecem nos testes, sem alargar tolerâncias ou marcar como ignoradas.
- Capturas anteriores ao merge do som; não repetidas, conforme o limite de uma rodada visual.
- Captura: somente `capture-m1a`, 4/4 com `PW_CHROMIUM=/usr/bin/chromium`. A primeira tentativa não abriu navegador porque faltava o executável baixado pelo Playwright. Quatro imagens em `docs/capturas/fase-2/m1a/`, todas inspecionadas; nenhum ajuste visual posterior.
- Verificação seguinte: esclarecer torque da lingueta zerado pela API de reação; fechar forças sem junta nativa e penetração; investigar diferença entre pico instantâneo e medida de saída da esfera. Conferir também persistência, retorno/reinício com sondas, seleção de folga em peças multicamada e camadas afastadas, toque longo, sobreposição de tiques próximos e execução longa (amostras completas ficam na memória do worker; poses continuam com janela de 10 s). A régua limita o cursor à janela gravada, mesmo quando o gráfico mostra a execução inteira.
- Não foram rodadas bateria completa, regressão Playwright, bancada, abuso, overflow ou determinismo. Sem subagentes, sem mudanças em assets, sons ou formato de cena.

## rtk gain

```text
/bin/bash: line 1: rtk: command not found
```
