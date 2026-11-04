# AGENTS.md — regras do interativLabs

Vale para qualquer agente (Claude Code, Codex ou outro) e para humanos. Leia inteiro antes de mexer no código. Depois leia `docs/arquitetura.md` e o documento da fase em andamento em `docs/fases/`.

## O produto

O interativLabs é uma bancada de mecanismos em 2D, de uso pessoal, vertente da marca interativ. A pessoa desenha peças com o dedo ou o mouse, organiza essas peças em camadas, liga as camadas com pinos, eixos, parafusos, trilhos e molas, e roda a simulação física para operar o mecanismo com o toque: engrenagens, travas, gatilhos, catracas, câmaras de pressão.

A ideia central é a **camada**. A camada 1 é o fundo (por exemplo, o corpo de um mecanismo); quanto mais alta, mais perto de quem olha. Peças só se tocam dentro da mesma camada. Uma camada só age sobre outra por uma ligação explícita. Entender um mecanismo aqui é ver como a força atravessa as camadas.

Identidade: **Prancha índigo**. Um desenho de patente impresso em traço branco sobre papel índigo: gravura com hachura e contra-hachura, material indicado pela hachura (não pela cor), molas espira por espira, números de chamada com linhas finas apontando cada ligação. Cor é estado, não material: ouro velho para a mão da pessoa (seleção, foco, arrasto) e brasa para energia e alerta (câmara, sensor, faísca). A especificação completa, com tokens, traço, hachuras e tipografia, está em `docs/identidade/identidade.md` e vale para tudo. O frame oficial (imagens de referência aprovadas) fica em `docs/identidade/frame-oficial/`.

## Papéis

- **Coordenador geral**: o Claude do Project interativLabs. Planeja fases, escreve todos os prompts de execução, revisa os relatórios conferindo no repositório e mantém este arquivo, `docs/arquitetura.md`, `docs/roadmap.md` e `docs/fases/`. Não escreve código do app.
- **Coordenadores especializados** (visual, sonoro): conversas próprias no mesmo Project. Escrevem os prompts de geração e o manifesto de cada lote. A arte e o som são gerados fora do repositório.
- **Executor**: uma sessão do Claude Code na web ou do Codex, aberta pelo Will com o prompt do coordenador. Executa só o que o prompt pede, um commit por item, e termina com o relatório pedido. Não escreve o próximo prompt nem reabre decisões fechadas.

O executor nunca gera nem substitui assets ou sons. Se um asset não servir, registre no relatório e devolva ao coordenador visual.

O Will trabalha só pelo navegador e pelo celular: nada do que for entregue pode exigir instalar algo no computador dele.

## Stack

- Vite + React + TypeScript estrito. É um app só de navegador, sem servidor.
- Estado do editor: Zustand com Immer. Toda edição passa por um comando, para que desfazer e refazer funcionem em tudo.
- Validação e migração do formato de cena: Zod.
- Movimento de interface: GSAP + `@gsap/react` (`useGSAP`). Registre só os plugins que usar.
- Física: decidida no item 1.4 da Fase 1, por comparativo medido. Os candidatos são Planck (o motor do protótipo), Rapier 2D e Box2D v3 em WASM. O resto do código só fala com o motor pelo adaptador em `src/engine/`.
- Renderização da cena: SVG. Texturas de material entram como `pattern` recortado na forma da peça. Filtros SVG animados são proibidos durante a simulação, porque pesam no celular. Brilho, chanfro e sombra são pré-calculados ou estáticos.
- Testes: Vitest para geometria, motor e cenas; Playwright para capturas e rolagem lateral.
- Deploy: Vercel, ligada ao repositório, com preview por branch.

Antes de adicionar ou atualizar uma biblioteca, confirme a versão atual e a API no npm ou no README. Não confie em memória.

## Pastas

```
art/source/lote-NN/      originais dos assets + asset-manifest.md (versionados, nunca servidos)
art/source/som-NN/       originais do som + sound-manifest.md (nunca servidos)
scripts/assets/          pipeline de assets (npm run assets)
scripts/audio/           pipeline de áudio (npm run audio), quando houver som
public/assets/<grupo>/   saída do pipeline: WebP 1x/2x (gerado, versionado)
public/audio/            saída do pipeline de áudio (gerado, versionado)
src/model/               formato da cena: tipos, schema Zod, versões e migrações
src/geometry/            polígonos, furos e rasgos, booleanos, decomposição convexa, engrenagem evolvente
src/engine/              adaptador do motor de física; sem DOM, roda no Node
src/sim/                 execução da simulação: passo fixo, gravação, linha do tempo, eventos
src/parts/               biblioteca de peças paramétricas (geradores + presets)
src/render/              renderizador SVG: peças, materiais, ligações, efeitos
src/editor/              ferramentas, seleção, encaixes, comandos (desfazer/refazer)
src/ui/                  componentes de interface (painéis, barras, folhas, campos)
src/assets/registry.ts   registro tipado dos assets (GERADO; não editar à mão)
src/styles/tokens.css    cores, tipografia, espaço, sombras, movimento
scenes/examples/         cenas de exemplo (JSON) que o app oferece
scenes/fixtures/         cenas de teste do motor (JSON), uma por comportamento
reference/prototype-v0/  protótipo de referência (não é código do app)
docs/                    arquitetura, fases, decisões, identidade, verificações e capturas
```

## Convenções

- Código, nomes de arquivos, identificadores e comentários em inglês. Textos de interface, documentação e commits em português do Brasil.
- Componentes em PascalCase, um componente principal por arquivo. Hooks começam com `use`.
- `src/model`, `src/geometry`, `src/engine` e `src/sim` não importam React nem tocam o DOM. Precisam rodar no Node, nos testes.
- Assets só pelo registry: `import { assets } from "@/assets/registry"`. Nunca escreva caminhos de `/assets/...` à mão.
- Cores, fontes, raios, sombras e curvas de movimento só pelos tokens. Nada de hex solto em componente. Exceção: dados de cena e SVG de dados, com o motivo comentado.
- Ícones: SVG desenhados no projeto, no estilo da identidade escolhida. Sem biblioteca genérica de ícones. Sem emojis na interface.
- Unidades: tudo que a pessoa vê e digita é em milímetros (mm), graus (°) e segundos. A escala interna do motor fica escondida no adaptador e é documentada em `docs/decisoes/motor.md`.
- Persistência local: IndexedDB, com todo acesso protegido por try/catch. Exportar e importar em JSON com `version`. Toda mudança no formato da cena entra com uma migração e um teste que abre o arquivo da versão anterior.

## Regras do domínio

- **Camadas**: a ordem do array é a profundidade (índice 0 = fundo). Peças só colidem com peças da mesma camada. Isso é imposto pelos filtros de colisão do motor, nunca por checagem na renderização.
- **Comunicação entre camadas só por ligação explícita.** As ligações são:
  - parafuso: une peças num corpo rígido único;
  - eixo: rotação, com motor, batente de ângulo e mola de torção opcionais;
  - pino: um círculo preso a uma peça que ocupa uma faixa de camadas (de/até) e colide em todas elas;
  - trilho: deslizamento num eixo, com curso, batentes e mola de retorno;
  - mola: entre dois pontos, com rigidez, amortecimento e comprimento livre;
  - câmara: pressão de gás que empurra um projétil ou pistão e devolve o recuo;
  - sensor: zona que detecta impacto acima de uma velocidade mínima e dispara um evento.
  Nenhum outro caminho de força entre camadas pode existir.
- **Simulação determinística**: passo fixo com subpassos, a mesma cena com as mesmas entradas dá o mesmo resultado. A simulação sempre parte do estado desenhado; editar e simular são modos separados.
- **Toda cena de exemplo tem uma cena de teste** em `scenes/fixtures/` que afirma o comportamento. Exemplo: "com o gatilho solto, o retém segura o percussor por 3 s; puxando o gatilho, o projétil sai com velocidade dentro da faixa X–Y". Mudou o motor e o teste quebrou? O motor está errado até prova em contrário.
- **Desfazer cobre tudo**: desenho, ligações, propriedades, camadas. Arrastar é um comando só, registrado quando o dedo solta.
- **Exemplos e presets** que acompanham o projeto são mecanismos genéricos: travas, catracas, trincos, engrenagens, cames, motores, lançadores de esfera. Não entram reproduções de modelos reais de armas, nem medidas de projetos reais.

## Movimento e acessibilidade

- Na interface, anime só `transform`, `opacity` e máscaras. Nada de animar `width`, `height`, `top` ou `left`.
- Curvas com nome nos tokens, definidas junto com a identidade.
- `prefers-reduced-motion` é respeitado: transições de interface viram cortes suaves. A simulação continua, porque é o conteúdo.
- Pause o laço de simulação e as partículas quando a aba sai de foco (`document.visibilityState`).
- Contraste AA para texto. Foco visível no estilo da identidade.
- Mobile-first: desenhe para 390 px de largura e depois amplie. Toque é o primeiro controle: alvos de pelo menos 44 px, pinça para zoom, dois dedos para mover.

## Desempenho

- 60 quadros por segundo com 150 peças e 100 ligações num celular intermediário, em cada tema que existir. Isso é medido no item da fase que mexe na renderização, não suposto.
- Durante a simulação, só mude atributos de `transform` das peças e o desenho das ligações. Não recrie elementos a cada quadro.

## Pipeline de assets

1. Os originais entram em `art/source/lote-NN/` junto com o `asset-manifest.md` do lote. O manifesto é a fonte da verdade: formato, dimensões, uso, regras de processamento.
2. `npm run assets` lê todos os lotes, processa e grava:
   - `public/assets/<grupo>/<id>.webp` (1x) e `<id>@2x.webp` (2x);
   - `src/assets/registry.ts`, tipado, com âncoras e escala física (mm por pixel) de cada asset;
   - folhas de contato em `docs/capturas/lote-NN/` para conferência.
3. Texturas que repetem são conferidas emendadas 3×3 na folha de contato. Emenda visível reprova.
4. Ajustes por asset ficam em `scripts/assets/config.mjs`, nunca espalhados no código do app.
5. Confira as folhas de contato antes de commitar.

## Padrão de qualidade

Bonito o bastante para apresentar. Nada genérico, nada com cara de template. A peça desenhada à mão precisa parecer usinada, não um polígono cinza. Animações com detalhe, mecânicas que dão vontade de mexer, sensação física no toque. Confira com captura de tela (Playwright em 390×844 e 1440×900, em cada tema que existir) antes de dar algo por pronto.

## Commits

- Mensagens em português: `Fase N · item M — descrição`. Um commit por item, push após cada commit.
- Cada fase roda num branch próprio (`fase-N`); cada parte da fase chega ao `main` por um PR, com o título que o prompt definir. O coordenador revisa; o Will faz o merge.
- Se a sessão cair, retome pelo `git log`: o último `Fase N · item M` diz onde parou.
- Antes de commitar: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` limpos, sem avisos.
- Ao fechar uma fase: `docs/verificacao-fase-N.md` com o que foi feito, o que ficou de fora e por quê, as medidas pedidas e as capturas em `docs/capturas/fase-N/`.
