import sharp from "sharp";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { settings, colors } from "./config.mjs";
import { readImage, png, pipeline } from "./io.mjs";
import { crop } from "./operations.mjs";

const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const cfg = settings.contact;

export async function contacts(prepared, root) {
  const byId = new Map(prepared.map((item) => [item.spec.id, item]));
  const stage = prepared.find((item) => item.spec.paper?.token === "stage");
  const path = (item, token = null) =>
    join(root, "public", (item.metrics.files.find((f) => f.token === token) ?? item.metrics.files[0]).src.x1);
  const stageBuffer = await sharp(path(stage)).png().toBuffer();
  const destination = join(root, "docs/capturas", settings.batch);
  const sheets = [];
  const sheet = async (width, height) => {
    const backgroundTile = await sharp(stageBuffer)
      .extract({
        left: 0,
        top: 0,
        width: Math.min(stage.x1.width, width),
        height: Math.min(stage.x1.height, height),
      })
      .png()
      .toBuffer();
    const background = await sharp({ create: { width, height, channels: 4, background: hex(colors.stage) } })
      .composite([{ input: backgroundTile, tile: true, gravity: "northwest" }])
      .png()
      .toBuffer();
    const layers = [];
    return {
      width,
      height,
      text(value, x, y, size = cfg.font) {
        layers.push({
          input: Buffer.from(
            `<svg width="${width - x}" height="${size + 12}"><text x="0" y="${size}" fill="${hex(colors.ink)}" font-family="DejaVu Sans" font-size="${size}">${escape(value)}</text></svg>`,
          ),
          left: x,
          top: y,
        });
      },
      svg(value, x, y) {
        layers.push({ input: Buffer.from(value), left: Math.round(x), top: Math.round(y) });
      },
      async add(input, x, y, { width: targetWidth, height: targetHeight, opacity = 1, flip = false } = {}) {
        let source = sharp(input);
        if (targetWidth || targetHeight)
          source = source.resize({ width: targetWidth, height: targetHeight, fit: "fill" });
        if (flip) source = source.flop();
        let buffer = await source.png().toBuffer();
        if (opacity !== 1) {
          const pixels = await readImage(buffer);
          for (let i = 3; i < pixels.data.length; i += 4)
            pixels.data[i] = Math.round(pixels.data[i] * opacity);
          buffer = await png(pixels);
        }
        layers.push({ input: buffer, left: Math.round(x), top: Math.round(y) });
      },
      async save(name) {
        const filename = join(destination, `${name}.webp`);
        await sharp(background)
          .composite(layers)
          .webp({ lossless: true, effort: settings.webp.effort })
          .toFile(filename);
        const bytes = (await stat(filename)).size;
        if (bytes > cfg.maxBytes) throw new Error(`Contact sheet exceeds size budget: ${name} (${bytes})`);
        sheets.push({ path: `docs/capturas/${settings.batch}/${name}.webp`, width, height, bytes });
      },
      async buffer() {
        return sharp(background).composite(layers).png().toBuffer();
      },
    };
  };

  // Every repeat tile is shown at native 1x, not resampled into a small card.
  for (const item of prepared.filter(
    (item) => item.spec.repeat === "xy" && (!item.spec.paper || item.spec.paper.token === "stage"),
  )) {
    const pixels = await readImage(path(item));
    const w = pixels.width,
      h = pixels.height;
    const repeat = await sharp({
      create: { width: w * 3, height: h * 3, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: await png(pixels), tile: true, gravity: "northwest" }])
      .png()
      .toBuffer();
    const width = Math.max(cfg.width, w * 3 + cfg.seamCrop * cfg.zoom + cfg.margin * 3);
    const page = await sheet(width, h * 3 + cfg.heading + cfg.margin);
    page.text(`${item.spec.id} · 3×3 nativo`, cfg.margin, 12);
    await page.add(repeat, cfg.margin, cfg.heading);
    const seam = await readImage(repeat);
    const zoom = await pipeline(
      crop(seam, {
        left: w - cfg.seamCrop / 2,
        top: h - cfg.seamCrop / 2,
        width: cfg.seamCrop,
        height: cfg.seamCrop,
      }),
    )
      .resize(cfg.seamCrop * cfg.zoom, cfg.seamCrop * cfg.zoom, { kernel: "nearest" })
      .png()
      .toBuffer();
    const side = w * 3 + cfg.margin * 2;
    page.text("Cruzamento · 4×", side, cfg.heading, cfg.smallFont);
    await page.add(zoom, side, cfg.heading + 32);
    if (item.spec.tints.length > 1) {
      page.text(`${item.spec.tints[1]} · 1x / menor`, side, cfg.heading + 320, cfg.smallFont);
      await page.add(path(item, item.spec.tints[1]), side, cfg.heading + 350);
      await page.add(path(item, item.spec.tints[1]), side, cfg.heading + 350 + h + 20, {
        width: cfg.gasMin,
        height: cfg.gasMin,
      });
    }
    await page.save(`textura-${item.spec.id}`);
  }

  const papers = prepared.filter((item) => item.spec.paper && item !== stage);
  const paperPage = await sheet(cfg.width, 920);
  paperPage.text("Papéis derivados · 1x e menor", cfg.margin, 12);
  for (const [i, item] of papers.entries()) {
    const x = cfg.margin + i * (512 + cfg.margin * 2);
    paperPage.text(item.spec.id, x, cfg.heading, cfg.smallFont);
    await paperPage.add(path(item), x, cfg.heading + 28);
    await paperPage.add(path(item), x, cfg.heading + 28 + 512 + 28, {
      width: cfg.paperMin,
      height: cfg.paperMin,
    });
  }
  await paperPage.save("papeis-derivados");

  const coil = prepared.find((item) => item.spec.coil),
    end = prepared.find((item) => item.spec.end);
  const springPage = await sheet(cfg.width, 1050);
  springPage.text("Mola · 1×5 / olhais + 3 espiras / emendas 4×", cfg.margin, 12);
  for (const [row, token] of coil.spec.tints.entries()) {
    const y = cfg.heading + row * cfg.springRow;
    springPage.text(token, cfg.margin, y, cfg.smallFont);
    const five = await sheet(coil.x1.width * 5, coil.x1.height);
    for (let i = 0; i < 5; i++) await five.add(path(coil, token), i * coil.x1.width, 0);
    await springPage.add(await five.buffer(), cfg.margin, y + 28);
    const overlap = Math.round(coil.x1.width * cfg.springOverlap);
    const start = end.x1.width - overlap;
    const right = start + coil.x1.width * 3 - overlap;
    const assembly = await sheet(right + end.x1.width, end.x1.height);
    await assembly.add(path(end, token), 0, 0);
    for (let i = 0; i < 3; i++) await assembly.add(path(coil, token), start + i * coil.x1.width, 0);
    await assembly.add(path(end, token), right, 0, { flip: true });
    const assembled = await assembly.buffer();
    await springPage.add(assembled, 420, y + 28);
    const assemblyPixels = await readImage(assembled);
    for (const [i, x] of [start, right].entries()) {
      const detail = crop(assemblyPixels, {
        left: x - cfg.alphaCrop / 2,
        top: Math.round(end.x1.height / 2) - cfg.alphaCrop / 2,
        width: cfg.alphaCrop,
        height: cfg.alphaCrop,
      });
      const buffer = await pipeline(detail)
        .resize(cfg.alphaCrop * cfg.zoom, cfg.alphaCrop * cfg.zoom, { kernel: "nearest" })
        .png()
        .toBuffer();
      await springPage.add(buffer, 420 + i * 180, y + 294);
      springPage.text(`Emenda ${i + 1} · 4×`, 420 + i * 180, y + 426, cfg.smallFont);
    }
    // The smallest useful physical spring is shown at half the native height.
    await springPage.add(assembled, 28, y + 310, {
      height: 128,
      width: Math.round((right + end.x1.width) / 2),
    });
  }
  await springPage.save("mola");

  const hardware = prepared.filter((item) => item.spec.group === "ferragens");
  for (let pageIndex = 0; pageIndex < Math.ceil(hardware.length / cfg.hardwarePage); pageIndex++) {
    const items = hardware.slice(pageIndex * cfg.hardwarePage, (pageIndex + 1) * cfg.hardwarePage);
    const page = await sheet(cfg.width, cfg.heading + items.length * cfg.hardwareRow);
    page.text("Ferragens · 1x, 32 e 24 px · ink / gold · opacidade 1 / 0,3", cfg.margin, 12);
    for (const [row, item] of items.entries()) {
      const y = cfg.heading + row * cfg.hardwareRow;
      page.text(item.spec.id, cfg.margin, y, cfg.smallFont);
      for (let column = 0; column < 4; column++) {
        const token = item.spec.tints[column % 2];
        const opacity = column < 2 ? 1 : cfg.opacity;
        const x = cfg.margin + column * 285;
        await page.add(path(item, token), x, y + 26, { opacity });
        const circle = item.metrics.circle;
        const box = item.metrics.crop;
        const cx = ((circle.x - box.left) * item.x1.width) / box.width,
          cy = ((circle.y - box.top) * item.x1.height) / box.height;
        const r = (circle.radius * item.x1.width) / box.width;
        const ax = item.anchor[0] * item.x1.width,
          ay = item.anchor[1] * item.x1.height;
        page.svg(
          `<svg width="256" height="256"><g fill="none" stroke="${hex(column % 2 ? colors.ink : colors.gold)}" stroke-width="0.5"><circle cx="${cx}" cy="${cy}" r="${r}"/><path d="M${ax - 5},${ay}h10 M${ax},${ay - 5}v10"/></g></svg>`,
          x,
          y + 26,
        );
        await page.add(path(item, token), x, y + 290, { width: 32, height: 32, opacity });
        await page.add(path(item, token), x + 60, y + 294, { width: 24, height: 24, opacity });
        page.text(`${token} · ${opacity} · 32 / 24`, x, y + 330, cfg.smallFont);
      }
    }
    await page.save(`ferragens-${pageIndex + 1}`);
  }

  const wear = prepared.find((item) => item.spec.source === "tex-ink-wear");
  const wearPage = await sheet(cfg.width, 780);
  wearPage.text("Falhas de tinta em stage · hachura a 45° em ink-2", cfg.margin, 12);
  let lines = "";
  for (let x = -512; x < 512; x += cfg.hatchSpacing) lines += `<path d="M${x},512l512,-512"/>`;
  const hatch = Buffer.from(
    `<svg width="512" height="512"><g stroke="${hex(colors["ink-2"])}" stroke-width="${cfg.hatchStroke}">${lines}</g></svg>`,
  );
  const test = await sheet(512, 512);
  test.svg(hatch.toString(), 0, 0);
  const wearTile = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: path(wear), tile: true, gravity: "northwest" }])
    .png()
    .toBuffer();
  await test.add(wearTile, 0, 0);
  const testBuffer = await test.buffer();
  await wearPage.add(testBuffer, cfg.margin, cfg.heading);
  wearPage.text("1x · degrau base 256 px", cfg.margin, 600, cfg.smallFont);
  const detail = crop(await readImage(testBuffer), {
    left: 224,
    top: 224,
    width: cfg.seamCrop,
    height: cfg.seamCrop,
  });
  await wearPage.add(
    await pipeline(detail).resize(256, 256, { kernel: "nearest" }).png().toBuffer(),
    640,
    cfg.heading,
  );
  wearPage.text("Recorte 4×", 640, 340, cfg.smallFont);
  await wearPage.save("desgaste-sobre-hachura");

  function alphaBox(input) {
    const half = cfg.alphaCrop / 2;
    for (let y = half; y < input.height - half; y++)
      for (let x = half; x < input.width - half; x++) {
        const p = (y * input.width + x) * 4;
        if (input.data[p + 3] > 32 && input.data[p + 3] < 224 && input.data[p] > 100)
          return {
            left: x - cfg.alphaCrop / 2,
            top: y - cfg.alphaCrop / 2,
            width: cfg.alphaCrop,
            height: cfg.alphaCrop,
          };
      }
    throw new Error("No alpha edge found for contact detail");
  }

  const effects = prepared.filter((item) => item.spec.radial || item.spec.spark);
  const effectPage = await sheet(cfg.width, 850);
  effectPage.text("Efeitos · 1x / menor uso / borda do alfa 4×", cfg.margin, 12);
  for (const [i, item] of effects.entries()) {
    const x = cfg.margin + i * 290;
    effectPage.text(item.spec.id, x, cfg.heading, cfg.smallFont);
    await effectPage.add(path(item), x, cfg.heading + 40);
    await effectPage.add(path(item), x, 400, {
      width: cfg.effectMin,
      height: Math.round((item.x1.height * cfg.effectMin) / item.x1.width),
    });
    const edge = crop(await readImage(path(item)), alphaBox(await readImage(path(item))));
    await effectPage.add(
      await pipeline(edge)
        .resize(cfg.alphaCrop * cfg.zoom, cfg.alphaCrop * cfg.zoom, { kernel: "nearest" })
        .png()
        .toBuffer(),
      x,
      500,
    );
    effectPage.text("Alfa · 4×", x, 650, cfg.smallFont);
  }
  await effectPage.save("efeitos");

  const entry = prepared.find((item) => item.spec.alpha);
  const entryPage = await sheet(cfg.width, 1100);
  entryPage.text("scene-entry · 1x / largura móvel / borda do alfa 4×", cfg.margin, 12);
  await entryPage.add(path(entry), cfg.margin, cfg.heading);
  await entryPage.add(path(entry), 600, cfg.heading, {
    width: cfg.entryMin,
    height: Math.round((entry.x1.height * cfg.entryMin) / entry.x1.width),
  });
  entryPage.text("512 px", cfg.margin, 830, cfg.smallFont);
  entryPage.text("358 px", 600, 600, cfg.smallFont);
  const entryPixels = await readImage(path(entry));
  const edgeBox = alphaBox(entryPixels);
  const edge = crop(entryPixels, edgeBox);
  await entryPage.add(
    await pipeline(edge)
      .resize(cfg.alphaCrop * cfg.zoom, cfg.alphaCrop * cfg.zoom, { kernel: "nearest" })
      .png()
      .toBuffer(),
    600,
    680,
  );
  entryPage.text(`Alfa · 4× · origem ${edgeBox.left}, ${edgeBox.top}`, 600, 830, cfg.smallFont);
  await entryPage.save("entrada");

  const mask = prepared.find((item) => item.spec.mask);
  const maskPage = await sheet(cfg.width, 940);
  maskPage.text(
    `mask-develop · níveis ${mask.metrics.levels.join("/")} · histograma log(1+n)`,
    cfg.margin,
    12,
  );
  await maskPage.add(path(mask), cfg.margin, cfg.heading);
  const histogram = Array(256).fill(0);
  const maskPixels = await readImage(path(mask));
  for (let p = 0; p < maskPixels.data.length; p += 4) histogram[maskPixels.data[p]]++;
  const logs = histogram.map((v) => Math.log1p(v)),
    max = Math.max(...logs);
  const bars = logs
    .map((v, i) => `<rect x="${i * 3}" y="${200 - (v / max) * 200}" width="3" height="${(v / max) * 200}"/>`)
    .join("");
  maskPage.svg(
    `<svg width="768" height="210"><g fill="${hex(colors.ink)}">${bars}</g></svg>`,
    cfg.margin,
    650,
  );
  maskPage.text(
    `0 → 255 · faixa de transição ${(mask.metrics.delivered.transition * 100).toFixed(2)}%`,
    cfg.margin,
    880,
    cfg.smallFont,
  );
  await maskPage.save("mascara-histograma");
  return sheets;
}
