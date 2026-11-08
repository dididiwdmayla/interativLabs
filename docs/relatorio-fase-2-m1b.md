# Fase 2 · M1b — relatório de criação

| Item | Commit | Estado |
| --- | --- | --- |
| 5a — painel compacto | `2bffdc5` | Pronto: janela de 0,5 s, pinça, execução inteira, deslocamento/posição absoluta, picos pt-BR e plural. Faixa de 117 px em 844×390; dois gráficos visíveis. |
| 5 — variantes | `4d951ce` | Pronto: A–D, seletor, renomear/apagar, cena e desfazer próprios, sondas/ocultação compartilhadas, IndexedDB e abertura antiga como A. |
| 6 — comparar | `dd5eafb` | Pronto: mesmas entradas, reprodução sincronizada, curvas, diferença, resumo e fantasma. Teste de igualdade nas quatro sondas passou. |
| 6b — experimente comparar | commit deste relatório, `Fase 2 · item 6b — demonstração do Lançador e capturas M1b` | Implementado e capturado; ressalva: B não apresentou um ciclo de retorno mensurável pelo critério abaixo. |

## Números da demonstração

Aplicada a predefinição existente **Dura** à mola `k27`, sem alteração do motor. Gesto do gatilho em 240 Hz, execução de 1,8 s.

| Medida | A | B |
| --- | --- | --- |
| Recuo máximo após acendimento | 15,00 mm | 0,05 mm |
| Ciclo: acendimento até retorno a até 0,5 mm da pose desenhada, após o pico | 0,24 s | — |

B permaneceu dentro de 0,5 mm: não há excursão seguida de retorno para medir um ciclo. Portanto, **recuo menor confirmado; ciclo mais curto não confirmado**. A física ficou intacta, inclusive as leituras reservadas à M1v.

## Verificação e limites

- Typecheck passou após cada item. Vitest: `displacement.test.ts` (1), `variants.test.ts` (2), `comparison.test.ts` (2) e `tryComparison.test.ts` (1), todos passaram.
- `git fetch origin && git merge origin/main`: atualizado, sem conflitos. Lint e build finais limpos.
- Apenas `capture-m1b`: duas capturas aprovadas em 844×390 e 1440×900, inspecionadas visualmente. Chromium padrão ausente; usada a alternativa `PW_CHROMIUM=/usr/bin/chromium`. Sem ajuste visual posterior.
- Capturas: [celular deitado](capturas/fase-2/m1b/lancador-comparacao-844x390.png) e [desktop](capturas/fase-2/m1b/lancador-comparacao-1440x900.png).
- Fora da cobertura: regressão geral de edição, dispositivos com pinça real, camadas afastadas com fantasma, execuções longas e desempenho com comparação. A gravação da última execução fica na memória da sessão; cenas e históricos das variantes ficam no IndexedDB. Exportação JSON e duplicação de projeto mantêm o comportamento de copiar a cena ativa.
- Não foram rodados a bateria inteira, bancada, abuso, overflow nem regressão/determinismo Playwright. Os dois testes conhecidos de física não foram corrigidos nem executados.

## rtk

Comandos: `rtk gain` e `ls -la /usr/local/bin/rtk ~/.local/bin/rtk 2>&1`.

```text
/bin/bash: line 1: rtk: command not found
ls: cannot access '/usr/local/bin/rtk': No such file or directory
ls: cannot access '/home/agent/.local/bin/rtk': No such file or directory
```
