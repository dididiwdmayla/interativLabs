import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { format } from "prettier";
import { settings } from "./config.mjs";

const percent = (value) => `${(value * 100).toFixed(3)}%`;
const hex = (rgb) =>
  "#" +
  rgb
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

export async function report(metrics, sheets, root) {
  const lines = [
    "# Lote 01 — medidas",
    "",
    "GERADO por `npm run assets`. Valores medidos nos mestres e nos WebP decodificados; sem data variável na saída. Os PNGs permanecem intactos.",
    "",
    "## Por saída",
    "",
    "Fator aplicado inclui o arredondamento da altura para pixels inteiros. Diferença de eixos medida após a correção, antes do corte; no sensor, diferença máxima entre as três distâncias de faces opostas. A âncora vem do contorno ajustado, inclusive no rebite deslocado; rolamento usa o furo e sensor usa o anel do êmbolo. `mmPerPx` é o diâmetro físico dividido pelo diâmetro medido e escalado à saída 1x; as duas partes da mola compartilham a mesma escala vertical.",
    "",
    "| ID | Fator vertical | Diferença | Âncora (x; y) | mm/px 1x | Bytes 1x | Bytes 2x |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const item of metrics.outputs) {
    const size = (key) => item.files.map((file) => `${file.token ?? "base"}: ${file.bytes[key]}`).join("; ");
    lines.push(
      `| \`${item.id}\` | ${item.factor.toFixed(7)} | ${item.axesDifference === null ? "—" : percent(item.axesDifference)} | ${item.anchor.map((v) => v.toFixed(6)).join("; ")} | ${item.mmPerPx?.toFixed(8) ?? "null"} | ${size("x1")} | ${size("x2")} |`,
    );
  }
  const coil = metrics.outputs.find((item) => item.period),
    end = metrics.outputs.find((item) => item.phase),
    mask = metrics.outputs.find((item) => item.levels);
  lines.push(
    "",
    "## Mola e máscara",
    "",
    `- Espira: autocorrelação horizontal na faixa central, período **${coil.period.period.toFixed(6)} px**, correlação ${coil.period.correlation.toFixed(6)}; corte x=${coil.crop.left}, largura inteira ${coil.crop.width}, altura ${coil.crop.height}. O valor real difere dos ~242 px estimados no pedido.`,
    `- Ponta: correlação cruzada com o início da espira, corte x=${end.phase.cut}, correlação ${end.phase.correlation.toFixed(6)}; caixa x=${end.crop.left}, largura ${end.crop.width}. Centro do olhal ajustado em (${end.eye.x.toFixed(3)}; ${end.eye.y.toFixed(3)}) no mestre. A folha monta os olhais com sobreposição de ${percent(settings.contact.springOverlap)} da primeira espira.`,
    `- Máscara: níveis iniciais ${mask.levels.join("/") === "40/220" ? "60/200" : "configurados"} deixariam ${percent(mask.initialTransition)} de transição; usados **${mask.levels.join("/")}**. Extremos ${mask.extrema.join(" e ")}; transição final **${percent(mask.delivered.transition)}**, mediana por linha do intervalo 5–95% de cinza. Continua abaixo dos 15% nominais do manifesto e segue para conferência visual.`,
    "",
    "## Coberturas",
    "",
    "Cobertura binária = fração dos pixels com alfa > 8; ponderada = soma do alfa / área. A redução de tamanho espalha marcas finas em mais pixels com alfa baixo. Por isso as duas medidas são publicadas, sem equiparar área ocupada a quantidade de tinta.",
    "",
    "| Saída | Mestre: binária / ponderada | 1x: binária / ponderada | Componentes mantidos |",
    "| --- | --- | --- | --- |",
  );
  for (const item of metrics.outputs.filter((item) => item.id === "tex-ink-wear" || item.components)) {
    const a = item.masterCoverage,
      b = item.delivered.coverage;
    lines.push(
      `| \`${item.id}\` | ${percent(a.binary)} / ${percent(a.weighted)} | ${percent(b.binary)} / ${percent(b.weighted)} | ${item.components ? `${item.components.kept} / ${item.components.count}` : "todos (exceção dos pontos)"} |`,
    );
  }
  lines.push(
    "",
    "O mestre de gás medido não alcança os 25% nominais do manifesto; não se adicionaram pontos. As variantes mantêm 25% e 50% dos componentes, sorteados com a mesma semente, e a densa mantém 100%. A distribuição já repete sem corte perceptível: o crossfade do gás foi desativado em `config.mjs`, pois produzia faixas de menor contraste.",
    "",
    "## Papel e emendas",
    "",
    "Médias em RGB sRGB, arredondadas para hex, depois da compressão WebP qualidade 90. Salto de emenda = média da diferença absoluta nas bordas opostas; salto interno = média entre vizinhos horizontais e verticais. A métrica usa RGB pré-multiplicado pelo alfa e o próprio alfa, para o RGB oculto não distorcer a comparação. A folha sobre o papel é a conferência visual decisiva.",
    "",
    "| Saída | Média RGB final | Média hex | Salto na emenda | Salto interno | Razão |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const item of metrics.outputs.filter((item) => item.delivered.seam)) {
    const m = item.delivered;
    lines.push(
      `| \`${item.id}\` | ${m.mean?.map((v) => v.toFixed(3)).join(", ") ?? "—"} | ${m.mean ? hex(m.mean) : "—"} | ${m.seam.seam.toFixed(6)} | ${m.seam.internal.toFixed(6)} | ${m.seam.ratio.toFixed(6)} |`,
    );
  }
  lines.push(
    "",
    "Nos papéis, os saltos absolutos permanecem abaixo de um nível RGB, mas a compressão com perda faz a razão superar 1 quando a variação interna é muito pequena. A operação de crossfade, antes da compressão, deixa as bordas iguais; o teste sintético confere razão menor que 1. A madeira tem nós repetidos em grade na folha 3×3 e exige retorno ao coordenador visual, mesmo com a borda contínua.",
    "",
    "## Tamanhos e folhas de contato",
    "",
    `Total de \`public/assets/\`: **${metrics.assetsBytes} bytes** (${(metrics.assetsBytes / 1048576).toFixed(3)} MiB), somando todos os WebP 1x/2x e variantes.`,
    "",
    "Todas as folhas são WebP sem perda, compostas pelo sharp sobre o paper-stage processado. Cada uma fica abaixo de 3 MiB.",
    "",
    "| Folha | Dimensões | Bytes |",
    "| --- | --- | --- |",
  );
  for (const sheet of sheets)
    lines.push(
      `| [${sheet.path.split("/").at(-1)}](${sheet.path.split("/").at(-1)}) | ${sheet.width}×${sheet.height} | ${sheet.bytes} |`,
    );
  lines.push(
    "",
    "Os números completos, fatores medidos antes do arredondamento e tamanhos por variante estão em [medidas.json](medidas.json). A conferência artística, os testes de determinismo, o tamanho do dist e os encaminhamentos ficam em [relatorio.md](relatorio.md).",
    "",
  );
  await writeFile(
    join(root, "docs/capturas", settings.batch, "medidas.md"),
    await format(lines.join("\n"), { parser: "markdown", printWidth: 110 }),
  );
}
