/**
 * Ícone provisório do app (Fase 1 · Parte E2a): uma engrenagem em traço
 * branco sobre índigo, desenhada aqui em SVG e convertida em PNG pelo sharp.
 * O definitivo virá do coordenador visual.
 *
 * Saída: scripts/icons/app-icon.svg (o desenho) e public/icons/
 *   icon-192.png, icon-512.png (Android), icon-maskable-512.png (Android,
 *   área segura de 80%) e apple-touch-icon.png (180, iOS).
 *
 * Cores: os valores dos tokens --color-stage, --color-ink e --color-ink-2
 * (src/styles/tokens.css); o SVG é dado, fora do CSS do app.
 *
 * Rodar: npm run icons
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = join(root, "public", "icons");

const STAGE = "#1E2448";
const INK = "#EAEAEF";
const INK2 = "#A3A5B6";

const f = (n) => (Math.round(n * 100) / 100).toString();

/** Contorno de engrenagem simples (dente trapezoidal), centro (cx, cy). */
function gearPath(cx, cy, teeth, rRoot, rTip) {
  const step = (Math.PI * 2) / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const at = (r, t) => {
      const ang = a + t * step;
      return `${f(cx + r * Math.cos(ang))} ${f(cy + r * Math.sin(ang))}`;
    };
    pts.push(at(rRoot, 0), at(rRoot, 0.18), at(rTip, 0.33), at(rTip, 0.57), at(rRoot, 0.72));
  }
  return `M${pts.join("L")}Z`;
}

/** O desenho em 512 × 512; `k` encolhe a engrenagem (ícone maskable). */
function svg(k = 1) {
  const c = 256;
  const s = (v) => v * k;
  const gear = gearPath(c, c, 14, s(150), s(188));
  let hatch = "";
  for (let x = -512; x <= 512; x += 14) hatch += `M${x} 512L${x + 512} 0`;
  const dash = (x1, y1, x2, y2) =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK2}" stroke-width="5" stroke-dasharray="40 9 5 9"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${STAGE}"/>
  <defs>
    <clipPath id="g"><path d="${gear}" fill-rule="evenodd"/><circle cx="${c}" cy="${c}" r="${s(62)}"/></clipPath>
    <clipPath id="ring"><path d="${gear}M${c + s(62)} ${c}A${s(62)} ${s(62)} 0 1 0 ${c - s(62)} ${c}A${s(62)} ${s(62)} 0 1 0 ${c + s(62)} ${c}Z" fill-rule="evenodd"/></clipPath>
  </defs>
  <path d="${hatch}" stroke="${INK2}" stroke-width="3.5" clip-path="url(#ring)"/>
  <path d="${gear}" fill="none" stroke="${INK}" stroke-width="${f(11 * k)}" stroke-linejoin="round"/>
  <circle cx="${c}" cy="${c}" r="${s(120)}" fill="none" stroke="${INK}" stroke-width="${f(3.5 * k)}" opacity="0.7"/>
  <circle cx="${c}" cy="${c}" r="${s(62)}" fill="${STAGE}" stroke="${INK}" stroke-width="${f(10 * k)}"/>
  <circle cx="${c}" cy="${c}" r="${s(24)}" fill="none" stroke="${INK}" stroke-width="${f(7 * k)}"/>
  ${dash(c - s(232), c, c + s(232), c)}
  ${dash(c, c - s(232), c, c + s(232))}
</svg>
`;
}

mkdirSync(out, { recursive: true });
const main = svg(1);
writeFileSync(join(here, "app-icon.svg"), main);
const maskable = svg(0.78);

const jobs = [
  [main, 192, "icon-192.png"],
  [main, 512, "icon-512.png"],
  [maskable, 512, "icon-maskable-512.png"],
  [main, 180, "apple-touch-icon.png"],
];
for (const [src, size, name] of jobs) {
  await sharp(Buffer.from(src)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(out, name));
  console.log(`public/icons/${name} (${size}×${size})`);
}
