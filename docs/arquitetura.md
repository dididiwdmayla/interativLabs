# Arquitetura do interativLabs

Documento vivo. Descreve como o app é dividido, o formato da cena, o modelo de física e as decisões que valem para todas as fases. Decisões tomadas por medição ficam em `docs/decisoes/`.

## 1. Visão geral

O app tem dois modos que nunca se misturam:

- **Editar**: desenhar peças, organizar camadas, criar ligações, ajustar propriedades. O estado é a cena (`Scene`), um documento JSON.
- **Simular**: a cena é compilada para o motor de física, que roda em passo fixo. A pessoa opera o mecanismo pelo toque. Ao voltar para Editar, a simulação é descartada; a cena desenhada não muda.

```
Scene (JSON) ──compile──▶ EngineWorld ──step──▶ Snapshot ──render──▶ SVG
     ▲                                                   │
     └──────────── comandos do editor ◀── toque ─────────┘ (no modo Editar)
```

## 2. Módulos

| Módulo | Faz | Não pode |
| --- | --- | --- |
| `src/model` | Tipos da cena, schema Zod, versões, migrações, ids | Importar React, tocar DOM |
| `src/geometry` | Polígonos com furos, booleanos (unir, subtrair), rasgos, decomposição convexa, offsets, engrenagem evolvente, testes de ponto | Conhecer o motor |
| `src/engine` | Adaptador do motor: compila a cena, aplica forças customizadas, devolve snapshots | Conhecer o renderizador |
| `src/sim` | Laço de passo fixo, gravação de quadros, linha do tempo, eventos (sensor, câmara) | Tocar DOM |
| `src/parts` | Geradores paramétricos: mola, engrenagem, cremalheira, came, catraca, alavanca, parafuso | Guardar estado |
| `src/render` | Desenho SVG da cena e do snapshot: peças, materiais, ligações, efeitos | Alterar a cena |
| `src/editor` | Ferramentas, seleção, encaixes, comandos de desfazer/refazer | Falar direto com o motor |
| `src/ui` | Painéis, barras, folhas, campos, menus | Lógica de domínio |

`src/model`, `src/geometry`, `src/engine` e `src/sim` rodam no Node e são cobertos por testes sem navegador.

### Interface do motor (`src/engine/types.ts`)

Todo motor fica atrás do mesmo adaptador. Fora dele, tudo é em mm, g, s e rad; só o adaptador conhece a escala interna.

```ts
interface EngineAdapter {
  readonly meta: { id: string; name: string; version: string; iterations: string };
  compile(scene: Scene, options: { unitMm: number }): CompileReport; // avisos, corpos, formas, juntas
  step(dt: number): void;            // um passo; o passo fixo de 1/240 s fica em src/sim
  snapshot(): Snapshot;              // poses (mm, rad), estado das ligações e eventos do passo
  pose(partId: Id): PartPose | null; // uma peça, sem montar o snapshot
  dragStart(partId: Id, pointMm: Vec2): boolean;
  dragMove(pointMm: Vec2): void;
  dragEnd(): void;
  contactsDepthMax(): number;        // maior penetração do passo, mm
  setMotorSpeed(linkId: Id, speed: number): void; // rad/s
  setVelocity(partId: Id, v: Vec2, omega: number): void; // roteiros de teste
  dispose(): void;
}
```

- `Snapshot`: `time`, `steps`, `parts[id] = { x, y, angle }`, `links[id]` (eixo: `angle`, `speed`, `gap`; trilho: `translation`; mola: `length`; câmara: `gas`, `pressure`, `fired`, `vented`; sensor: `count`) e `events` (`sensor`, `chamber-fired`, `chamber-vented`).
- Parte comum a todos os motores: `plan.ts` (cena → corpos compostos, peças convexas, massa pela geometria, juntas) e `runtime.ts` (mola de torção, mola do trilho, mola entre pontos, câmara, sensor e arrasto, em unidades da cena). O adaptador só traduz o plano e lê e escreve nos corpos.
- Corpo dinâmico com origem no centro de massa e ângulo 0 na pose desenhada; cada grupo fixo é um corpo estático próprio (uma junta com uma peça fixa só desliga o contato com aquela peça). O índice 0 é o fundo, ponta das ligações com `a: null`.
- Adaptadores do comparativo: Planck, Rapier 2D (padrão e determinístico) e Box2D v3 (`box2d3-wasm`), carregados sob demanda por `src/engine/registry.ts`.

## 3. Formato da cena (versão 1)

Unidades da cena: milímetros e radianos. A interface mostra graus.

```ts
type Id = string;

interface Scene {
  version: 1;
  meta: { title: string; createdAt: string; updatedAt: string };
  settings: { gravity: { on: boolean; g: number /* mm/s² */ }; snap: { grid: number /* mm */; on: boolean } };
  layers: Layer[];           // índice 0 = fundo
  parts: Part[];
  links: Link[];
}

interface Layer { id: Id; name: string; visible: boolean; locked: boolean }

interface Part {
  id: Id; ref: number; name: string; layer: Id;
  x: number; y: number; angle: number;      // pose desenhada
  shape: Shape;
  material: MaterialId;                     // define densidade, atrito, elasticidade e aparência
  fixed: boolean;                           // corpo estático
  fast: boolean;                            // detecção contínua de colisão
  source?: { generator: string; params: Record<string, number | string> }; // peça paramétrica
}

type Shape =
  | { kind: "poly"; outer: Vec2[]; holes: Vec2[][] }    // coordenadas locais, em mm
  | { kind: "circle"; r: number; holes: Vec2[][] }
  | { kind: "gear"; module: number; teeth: number; pressureAngle: number; profile: "involute" | "ratchet"; bore: number };

// toda ligação também tem ref: number (omitido abaixo)
type Link =
  | { id: Id; kind: "screw";   a: Id | null; b: Id; at: Vec2 /* local de b */ }
  | { id: Id; kind: "axle";    a: Id | null; b: Id; at: Vec2; motor?: Motor; limit?: AngleLimit; torsion?: Torsion }
  | { id: Id; kind: "pin";     host: Id; at: Vec2; r: number; layers: [Id, Id] }
  | { id: Id; kind: "slider";  a: Id | null; b: Id; at: Vec2; dir: number; travel: [number, number]; spring?: LinearSpring }
  | { id: Id; kind: "spring";  a: Id | null; b: Id | null; atA: Vec2; atB: Vec2; k: number; damping: number; freeLength: number }
  | { id: Id; kind: "chamber"; a: Id | null; b: Id | null; at: Vec2; dir: number; bore: number; length: number; charge: number; burn: number }
  | { id: Id; kind: "sensor";  host: Id; at: Vec2; r: number; layers: [Id, Id]; minSpeed: number; triggers: Id[] };
```

Regras do formato:

- Peças e ligações têm `ref: number`, o número de chamada da prancha. É único na cena, atribuído na criação (o maior existente + 1), editável e nunca renumerado sozinho. É ele que aparece nas linhas de chamada da identidade.

- `a: null` significa "preso ao fundo" (o mundo fixo).
- Pontos de ligação são guardados no espaço local da peça de referência. Mover a peça leva a ligação junto.
- `layers: [de, até]` cobre todas as camadas entre as duas, na ordem atual do array.
- O protótipo v0 usa outro formato. A migração `v0 → v1` é escrita na Fase 1 e testada com as três cenas de `reference/prototype-v0/`.

## 3.1 Formato da cena (versão 2) — ligações 2.0

Decidido em 04/11/2026. Entra na Fase 1 · Parte C, com a migração `v1 → v2`. A v2 traz as interações que fazem o mecanismo se comportar como peça de verdade: fixação rígida e fixação relativa (as peças continuam corpos separados, cada uma com seu peso), molas que só empurram, objetos dentro de molas, furos e rasgos onde um pino corre, e gás que empurra todas as paredes que o cercam.

Unidades físicas da v2, na cena e na interface: **mm, g, s, N, N/mm, N·mm, kPa, °** (a cena guarda radianos). A gravidade padrão é a real, **9 810 mm/s²**, com câmera lenta para ver o que acontece em milissegundos.

```ts
interface Scene { version: 2; /* … como na v1 … */ }

interface Layer { id: Id; name: string; visible: boolean; locked: boolean;
  thickness: number }                        // mm, padrão 3; massa = densidade × área × espessura

// Materiais com densidade real em g/mm³ (aço 0,00785; alumínio 0,0027; latão 0,0085;
// polímero 0,0012; borracha 0,0011; madeira 0,0007), atrito e restituição.

type Link =
  // — Fixação rígida: nada se move entre as peças —
  | { kind: "screw";  a: Id | null; b: Id; at: Vec2 }
  // — Fixações relativas: cada peça segue um corpo, com o seu peso —
  | { kind: "axle";   a: Id | null; b: Id; at: Vec2;               // pivô: gira, balança com o peso
      motor?: Motor; limit?: AngleLimit; torsion?: Torsion; friction?: number /* N·mm */ }
  | { kind: "rod";    a: Id | null; b: Id | null; atA: Vec2; atB: Vec2 }        // haste/biela: distância fixa, gira nas duas pontas
  | { kind: "cable";  a: Id | null; b: Id | null; atA: Vec2; atB: Vec2; maxLength: number } // cabo: só limita o máximo; afrouxa
  | { kind: "mount";  a: Id | null; b: Id; at: Vec2;               // suporte elástico: preso, mas cede com o peso e vibra
      linearHz: number; angularHz: number; damping: number }
  | { kind: "slider"; a: Id | null; b: Id; at: Vec2; dir: number;  // trilho
      travel: [number, number]; spring?: LinearSpring; friction?: number /* N */ }
  // — Contato entre camadas —
  | { kind: "pin";    host: Id; at: Vec2; r: number; layers: [Id, Id] }
  | { kind: "slot";   pin: Id /* ligação pin */; guide: Id /* peça com o furo */; hole: number /* índice em shape.holes */;
      mode: "joint" | "contact" }                                  // pino correndo num furo ou rasgo
  // — Molas —
  | { kind: "spring"; a: Id | null; b: Id | null; atA: Vec2; atB: Vec2;
      k: number /* N/mm */; damping: number /* N·s/mm */; freeLength: number;
      mode: "fixed" | "seated" | "tension";                        // presa nas duas pontas | apoiada (só empurra) | só puxa
      solidLength?: number;                                        // espiras encostadas: vira batente rígido
      guide?: Id;                                                  // peça que passa por dentro e alinha o eixo da mola
      coil: { outerD: number; wireD: number; turns: number } }     // desenho e comprimento sólido padrão
  // — Gás —
  | { kind: "chamber"; body: Id | null; at: Vec2; dir: number;     // cilindro: corpo que contém o furo
      bore: number /* Ø mm */; length: number;
      walls: { part: Id; seal: number /* mm de curso até abrir */ }[];  // peças que fecham o gás (1 ou 2)
      vents: { at: number /* mm do fundo */; d: number /* Ø do orifício */; open: boolean }[];
      ports: { to: Id /* outra câmara */; at: number; d: number }[];
      gas: { model: "isothermal" | "adiabatic"; gamma: number; p0: number /* kPa */;
             charge?: { amount: number /* mmol */; burnMs: number } } }
  | { kind: "sensor"; host: Id; at: Vec2; r: number; layers: [Id, Id]; minSpeed: number;
      actions: { do: "ignite" | "open" | "close"; target: Id; vent?: number }[] };
// Toda ligação tem também id e ref.
```

Regras da v2:

- **Fixo × relativo.** Parafuso soma as peças num corpo só. Todas as outras ligações mantêm corpos separados: uma peça presa por eixo, haste, cabo ou suporte elástico continua sentindo a gravidade, balança, pende e transmite o próprio peso.
- **Mola apoiada** (`seated`) empurra quando comprimida e se solta quando passa do comprimento livre, como uma mola de compressão assentada num ressalto. **Comprimento sólido**: com as espiras encostadas, a mola vira batente rígido (padrão `turns × wireD`).
- **Objeto dentro da mola.** A mola nunca colide com nada: é força e desenho. Com `guide`, o eixo dela acompanha a peça-guia (uma haste que passa por dentro) e o desenho envolve a guia.
- **Furo e rasgo como guia.** `slot` liga um pino ao furo `hole` da peça-guia. `joint`: só em rasgo reto, vira restrição de ponto sobre segmento com rotação livre e batentes nas pontas (preciso, sem folga). `contact`: qualquer forma de furo (curva, em L, mancal redondo); o pino colide com as paredes do furo, com a folga real do desenho. O pino precisa ocupar a camada da peça-guia.
- **Gás que empurra tudo.** A pressão age em cada parede (`walls`) para fora e devolve a reação ao `body`. Com duas paredes móveis (um pistão à frente e um bloco atrás, sobre um trilho com mola), o bloco recua enquanto o pistão avança: o efeito de recuo do fundo (blowback) sai da física, não de animação.

## 4. Física

### Camadas como filtros

Cada camada `i` tem o bit `1 << i`. Uma peça usa categoria e máscara iguais ao bit da sua camada. Um pino ou sensor que vai da camada `de` até a `até` usa a soma dos bits do intervalo. O limite prático é de 16 camadas.

### Motor

**Box2D v3** (`box2d3-wasm`, build compat), decidido em 04/11/2026 pelo comparativo de `docs/decisoes/motor.md`: o mais rápido nas cenas pesadas, determinístico entre plataformas (o motor é WASM), 219 KB gzip carregados só no modo Simular. Planck e Rapier ficam só na página `/#bench`, para comparação, e saem do pacote do app. Escala interna: **1 mm por unidade**. Os padrões do Box2D estão em metros: todo parâmetro de velocidade (empurrão de contato, limiar de restituição, limiar de evento de impacto, velocidade máxima) é convertido para mm/s no adaptador.

### Ligações no motor (v2)

| Ligação | No motor |
| --- | --- |
| Parafuso | Corpo composto (união por componentes conexos). Grupo com peça fixa ou parafuso ao fundo = corpo estático. |
| Eixo | Junta de revolução nativa: motor, batente e mola de torção nativos; atrito como motor de velocidade zero com torque máximo = atrito. |
| Haste | Junta de distância rígida (mínimo = máximo). |
| Cabo | Junta de distância com só o máximo ativo; sem mola. |
| Suporte elástico | Junta soldada com frequências linear e angular e amortecimento. |
| Trilho | Junta prismática nativa com batentes; mola de retorno nativa ou força, o que for estável; atrito como motor de velocidade zero. |
| Pino, sensor | Forma circular extra no corpo hospedeiro, com o filtro da faixa de camadas. Sensor gera evento com a velocidade de aproximação. |
| Rasgo (`joint`) | Junta de roda (ponto sobre reta, rotação livre) sem mola, com batentes nas pontas do rasgo. |
| Rasgo (`contact`) | Nada além da geometria: o furo existe na peça-guia (decomposição com furos) e o pino colide com as paredes. |
| Mola | Força de Hooke com amortecimento, aplicada a cada passo; mola rígida demais para o passo vira junta de distância com mola nativa (rigidez e massa efetiva convertidas em frequência). Modos e comprimento sólido como na v2. |
| Câmara | Força customizada a cada passo (ver abaixo). |

### Câmara de gás (v2)

- Gás ideal. `V = A × L`, com `A = π·(bore/2)²` e `L` a distância entre as faces internas das paredes ao longo do eixo (ou entre o fundo e a parede, com uma só).
- `isothermal`: `P = nRT/V`. `adiabatic`: depois da queima, `P·V^γ` constante. Pressão em kPa; força em cada parede `F = (P − P_atm) × A`, para fora; a soma das reações vai ao `body`.
- Queima: o sensor aciona; a carga entra linear em `burnMs`.
- Vedação: uma parede que anda mais que `seal` abre a câmara.
- Escape: respiro aberto, ou descoberto por uma parede que passa por ele, solta gás pelo orifício: `dn/dt` proporcional à área do orifício e à pressão (fluxo estrangulado simplificado). Portas ligam câmaras e trocam gás pela diferença de pressão.
- O snapshot traz, por câmara: pressão, volume, gás e o trabalho feito em cada parede. Esse é o dado dos gráficos da Fase 5.
- Plausível e didático, não balística real.

### Passo de tempo

Passo fixo de 1/240 s, com acumulador. Câmera lenta reduz o tempo simulado por quadro, não o passo. A linha do tempo grava snapshots (poses e estado das ligações) para voltar e repetir.

### Escala de tela

No zoom 1, **5 px de tela por mm**. É a escala do protótipo (1 px do v0 = 0,2 mm), então as cenas migradas aparecem do mesmo tamanho. O zoom vai de 0,15× a 8× (0,75 a 40 px por mm). Os tamanhos dos assets do lote 01 foram calculados para essa escala.

### Escala interna

1 mm por unidade do motor (Box2D v3). Ver `docs/decisoes/motor.md`.

## 5. Renderização

- Assets são acessados por `assets` de `@/assets/registry`, gerado por `npm run assets`: id, grupo, fontes 1x/2x sob `BASE_URL`, dimensões, âncora normalizada, mm/px, repetição e variantes tingidas com suas fontes.

- Uma `<g>` por camada, na ordem da profundidade. Dentro dela, uma `<g>` por peça, com `transform` atualizado a cada quadro.
- A forma da peça vira um `path` com regra `evenodd` (furos e rasgos funcionam sem decomposição no desenho).
- Material = textura que repete (`pattern` em mm reais, via `scale` do registry) + borda e chanfro desenhados como contornos deslocados + sombra estática projetada na camada de baixo. Nada disso é recalculado durante a simulação.
- Ferragens (cabeça de parafuso, pino, rolamento, sensor) são assets posicionados no ponto da ligação, girando com a peça.
- Molas são desenhadas por segmentos (uma espira repetida ao longo do eixo), esticando e comprimindo com o comprimento real.
- Efeitos (clarão, fumaça, faíscas de impacto) ficam numa camada própria e são limitados por quantidade.
- A visão de camadas tem três estados: todas, ativa em destaque (as outras esmaecidas) e raio-x (só contornos). A vista explodida em perspectiva entra numa fase própria.

## 6. Editor

- Toda mudança é um comando com `do`/`undo`. Um arrasto gera um comando só, ao soltar.
- Ferramentas: selecionar, retângulo, círculo, polígono por pontos, traço livre, furo, rasgo, peça da biblioteca, e uma ferramenta por ligação.
- Encaixes: grade, centro de círculo, vértice, ponto médio, concêntrico, tangente, alinhado ao eixo de outra ligação. O encaixe ativo aparece como marca visível.
- Seleção: toque seleciona a peça mais alta da camada ativa; seleção múltipla por caixa (arrasto com a ferramenta de seleção num espaço vazio, no computador) e pelo botão "Selecionar mais" (no celular).
- Painel de propriedades: folha inferior no celular (recolhida por padrão), coluna à direita no computador.

## 7. Persistência

- Projetos em IndexedDB: cena, miniatura e data. Autosave a cada comando, com debounce.
- Exportar e importar em JSON. Ao importar, a cena passa pelo schema e pelas migrações; um erro mostra qual campo falhou.

## 8. Testes

- **Geometria**: casos de borda (polígono que cruza a si mesmo, furo tangente à borda, rasgo que corta a peça em duas).
- **Motor**: uma cena por comportamento em `scenes/fixtures/`, rodada no Node por N segundos com entradas roteirizadas (por exemplo, "arraste o ponto P até Q em 0,4 s"), com afirmações sobre poses, velocidades e eventos.
- **Visual**: capturas Playwright em 390×844 e 1440×900, nos dois temas quando houver, guardadas em `docs/capturas/fase-N/`.
- **Desempenho**: cena sintética de 150 peças e 100 ligações; registra quadros por segundo e tempo de passo.

## 9. Decisões

| Decisão | Quando | Estado |
| --- | --- | --- |
| Identidade visual | Fase 0 | Fechada: Prancha índigo (`docs/identidade/identidade.md`) |
| Biblioteca de booleanos de polígono | Fase 1 · item 3 | Fechada: Clipper2 (`clipper2-ts`), escala inteira de 10 000 por mm; triangulação pelo earcut (`docs/decisoes/geometria.md`) |
| Motor de física | Fase 1 · item 4 | Fechada em 04/11: Box2D v3 (`box2d3-wasm`). A rodada no celular do Will, quando a Vercel estiver ligada, só confirma; se o celular mostrar problema, volta à mesa |
| Escala interna e limite de velocidade | Fase 1 · item 4 | Fechada: 1 mm por unidade, 40 m/s (§4) |
| Formato v2 e ligações 2.0 | 04/11 | Fechada (§3.1); entra na Fase 1 · Parte C |
| Gravidade | 04/11 | Real (9 810 mm/s²) por padrão; calibração de contato e subpassos na Parte C |
