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
  id: Id; name: string; layer: Id;
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

- `a: null` significa "preso ao fundo" (o mundo fixo).
- Pontos de ligação são guardados no espaço local da peça de referência. Mover a peça leva a ligação junto.
- `layers: [de, até]` cobre todas as camadas entre as duas, na ordem atual do array.
- O protótipo v0 usa outro formato. A migração `v0 → v1` é escrita na Fase 1 e testada com as três cenas de `reference/prototype-v0/`.

## 4. Física

### Camadas como filtros

Cada camada `i` tem o bit `1 << i`. Uma peça usa categoria e máscara iguais ao bit da sua camada. Um pino ou sensor que vai da camada `de` até a `até` usa a soma dos bits do intervalo. O limite prático é de 16 camadas.

### Ligações no motor

| Ligação | No motor |
| --- | --- |
| Parafuso | As peças parafusadas viram **um corpo composto** (união por componentes conexos), não uma junta soldada. É perfeitamente rígido e estável. Se alguma peça do grupo é fixa ou está parafusada ao fundo, o corpo é estático. |
| Eixo | Junta de revolução. Motor e batente do próprio motor; mola de torção como torque aplicado a cada subpasso. |
| Pino, sensor | Fixture circular extra no corpo da peça hospedeira, com o filtro da faixa de camadas. O sensor não colide; ele gera evento. |
| Trilho | Junta prismática com batentes; mola de retorno como força aplicada a cada subpasso. |
| Mola | Força de Hooke com amortecimento, aplicada a cada subpasso nos dois pontos. |
| Câmara | Força customizada (ver abaixo). |

### Câmara de pressão (modelo simplificado)

- Volume atrás do projétil: `V = área × s`, onde `s` é a distância do fundo até a face traseira do projétil, ao longo do eixo.
- Pressão: `P = n / V` (constantes absorvidas em `charge`). Força no projétil: `F = P × área = n / s`. A mesma força, invertida, vai para o corpo do fundo: é o recuo.
- Queima: ao ser acionada, a carga entra de forma linear durante `burn` ms.
- Escape: quando o projétil passa de `length` ou sai do eixo, o gás decai com constante de 4 ms. Há também um vazamento lento, para que um projétil travado não fique sob pressão para sempre.
- O objetivo é ser plausível e didático, não balística real.

### Passo de tempo

Passo fixo de 1/240 s, com acumulador. Câmera lenta reduz o tempo simulado por quadro, não o passo. A linha do tempo grava snapshots (poses e estado das ligações) para voltar e repetir.

### Escala interna

A cena é em mm, mas os motores 2D funcionam melhor com corpos de 0,1 a 10 unidades. O adaptador converte com uma escala única. A escala e os limites de velocidade são decididos no comparativo do item 1.4 e documentados em `docs/decisoes/motor.md`.

## 5. Renderização

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

## 9. Decisões abertas

| Decisão | Quando | Como |
| --- | --- | --- |
| Motor de física | Fase 1 · item 4 | Comparativo medido |
| Identidade visual | Fase 0 | Escolha entre os frames de `docs/identidade/frames.md` |
| Biblioteca de booleanos de polígono | Fase 1 · item 3 | Robustez nos casos de teste da geometria |
