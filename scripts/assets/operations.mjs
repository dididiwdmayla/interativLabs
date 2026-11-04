// Pure pixel operations. Images are interleaved, unpremultiplied RGBA bytes.
export const clamp = (value, low = 0, high = 255) => Math.max(low, Math.min(high, value));

export function image(width, height, data = new Uint8Array(width * height * 4)) {
  return { width, height, data };
}

export function keyBlack(input, { black = 12, white = 235, minArea = 6, preserveDots = false } = {}) {
  const output = image(input.width, input.height, Uint8Array.from(input.data));
  for (let i = 0; i < output.data.length; i += 4) {
    const luminance = 0.2126 * input.data[i] + 0.7152 * input.data[i + 1] + 0.0722 * input.data[i + 2];
    output.data[i + 3] = Math.round(clamp(((luminance - black) / (white - black)) * 255));
    output.data[i] = output.data[i + 1] = output.data[i + 2] = 255;
  }
  if (!preserveDots) {
    const { labels, areas } = components(output);
    for (let p = 0; p < labels.length; p++) {
      if (areas[labels[p]] < minArea) output.data[p * 4 + 3] = 0;
    }
  }
  return output;
}

// Eight-connected components; raster traversal gives stable component IDs.
export function components(input, threshold = 0) {
  const { width, height, data } = input;
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(labels.length);
  const areas = [0];
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] || data[p * 4 + 3] <= threshold) continue;
    const id = areas.length;
    let head = 0;
    let tail = 1;
    queue[0] = p;
    labels[p] = id;
    while (head < tail) {
      const q = queue[head++];
      const x = q % width;
      const y = Math.floor(q / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const n = ny * width + nx;
          if (!labels[n] && data[n * 4 + 3] > threshold) {
            labels[n] = id;
            queue[tail++] = n;
          }
        }
      }
    }
    areas.push(tail);
  }
  return { labels, areas };
}

export function thinComponents(input, fraction, seed) {
  const { labels, areas } = components(input);
  const ids = Array.from({ length: areas.length - 1 }, (_, i) => i + 1);
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const kept = new Set(ids.slice(0, Math.round(ids.length * fraction)));
  const output = image(input.width, input.height, Uint8Array.from(input.data));
  for (let p = 0; p < labels.length; p++) {
    if (!kept.has(labels[p])) output.data[p * 4 + 3] = 0;
  }
  return { output, count: ids.length, kept: kept.size };
}

export function tint(input, rgb) {
  const output = image(input.width, input.height, Uint8Array.from(input.data));
  for (let i = 0; i < output.data.length; i += 4) {
    for (let c = 0; c < 3; c++) output.data[i + c] = output.data[i + 3] ? rgb[c] : 0;
  }
  return output;
}

export function bounds(input, threshold = 8) {
  let left = input.width;
  let top = input.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      if (input.data[(y * input.width + x) * 4 + 3] > threshold) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) throw new Error("Empty alpha bounds");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export function crop(input, box) {
  const output = image(box.width, box.height);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const sx = box.left + x;
      const sy = box.top + y;
      if (sx < 0 || sx >= input.width || sy < 0 || sy >= input.height) continue;
      const p = (sy * input.width + sx) * 4;
      output.data.set(input.data.subarray(p, p + 4), (y * box.width + x) * 4);
    }
  }
  return output;
}

export function boundary(input, threshold = 128) {
  const points = new Map();
  const add = (x, y) => points.set(`${x},${y}`, [x, y]);
  for (let y = 0; y < input.height; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < input.width; x++) {
      if (input.data[(y * input.width + x) * 4 + 3] > threshold) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) {
      add(first, y);
      add(last, y);
    }
  }
  for (let x = 0; x < input.width; x++) {
    let first = -1;
    let last = -1;
    for (let y = 0; y < input.height; y++) {
      if (input.data[(y * input.width + x) * 4 + 3] > threshold) {
        if (first < 0) first = y;
        last = y;
      }
    }
    if (first >= 0) {
      add(x, first);
      add(x, last);
    }
  }
  return [...points.values()];
}

function leastSquares(rows, values) {
  const size = rows[0].length;
  const matrix = Array.from({ length: size }, () => Array(size + 1).fill(0));
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) matrix[i][j] += rows[r][i] * rows[r][j];
      matrix[i][size] += rows[r][i] * values[r];
    }
  }
  for (let c = 0; c < size; c++) {
    let pivot = c;
    for (let r = c + 1; r < size; r++) if (Math.abs(matrix[r][c]) > Math.abs(matrix[pivot][c])) pivot = r;
    [matrix[c], matrix[pivot]] = [matrix[pivot], matrix[c]];
    const divisor = matrix[c][c];
    if (Math.abs(divisor) < 1e-12) throw new Error("Singular contour fit");
    for (let j = c; j <= size; j++) matrix[c][j] /= divisor;
    for (let r = 0; r < size; r++) {
      if (r === c) continue;
      const factor = matrix[r][c];
      for (let j = c; j <= size; j++) matrix[r][j] -= factor * matrix[c][j];
    }
  }
  return matrix.map((row) => row[size]);
}

export function fitCircle(points) {
  const ox = points.reduce((s, p) => s + p[0], 0) / points.length;
  const oy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const centered = points.map(([x, y]) => [x - ox, y - oy]);
  const [a, b, c] = leastSquares(
    centered.map(([x, y]) => [x, y, 1]),
    centered.map(([x, y]) => x * x + y * y),
  );
  const x = ox + a / 2;
  const y = oy + b / 2;
  const radius = Math.sqrt(c + (a * a + b * b) / 4);
  const residual = Math.sqrt(
    points.reduce((s, p) => s + (Math.hypot(p[0] - x, p[1] - y) - radius) ** 2, 0) / points.length,
  );
  return { x, y, radius, residual };
}

// Axis-aligned ellipse, least squares in centered/scaled coordinates. Its
// correction is then applied before the final circle anchor is measured.
export function fitProportion(points) {
  const circle = fitCircle(points);
  const normalized = points.map(([x, y]) => [(x - circle.x) / circle.radius, (y - circle.y) / circle.radius]);
  const [a, b, c, d] = leastSquares(
    normalized.map(([x, y]) => [y * y, x, y, 1]),
    normalized.map(([x]) => x * x),
  );
  if (a >= 0) throw new Error("Contour is not an ellipse");
  const cx = b / 2;
  const cy = -c / (2 * a);
  const k = d + cx * cx - a * cy * cy;
  const rx = Math.sqrt(k) * circle.radius;
  const ry = Math.sqrt(k / -a) * circle.radius;
  return {
    x: circle.x + cx * circle.radius,
    y: circle.y + cy * circle.radius,
    rx,
    ry,
    factor: rx / ry,
    difference: Math.abs(rx - ry) / Math.max(rx, ry),
  };
}

export function autocorrelation(signal, minPeriod, maxPeriod) {
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const values = signal.map((v) => v - mean);
  const score = (lag) => {
    let numerator = 0,
      a = 0,
      b = 0;
    for (let i = 0; i < values.length - lag; i++) {
      numerator += values[i] * values[i + lag];
      a += values[i] ** 2;
      b += values[i + lag] ** 2;
    }
    return numerator / Math.sqrt(a * b || 1);
  };
  let period = minPeriod;
  for (let lag = minPeriod + 1; lag <= maxPeriod; lag++) if (score(lag) > score(period)) period = lag;
  const left = score(period - 1),
    center = score(period),
    right = score(period + 1);
  return { period: period + (0.5 * (left - right)) / (left - 2 * center + right || 1), correlation: center };
}

export function horizontalSignal(input, top, bottom) {
  return Array.from({ length: input.width }, (_, x) => {
    let sum = 0;
    for (let y = top; y < bottom; y++) sum += input.data[(y * input.width + x) * 4 + 3];
    return sum / (bottom - top);
  });
}

export function phaseCut(input, reference, { min, max, strip = 8, top = 0, bottom = input.height }) {
  let best = { cut: min, correlation: -Infinity };
  for (let cut = min; cut <= max; cut++) {
    let ab = 0,
      aa = 0,
      bb = 0;
    for (let y = top; y < bottom; y++)
      for (let dx = 0; dx < strip; dx++) {
        const a = input.data[(y * input.width + cut + dx) * 4 + 3];
        const b = reference.data[(y * reference.width + dx) * 4 + 3];
        ab += a * b;
        aa += a * a;
        bb += b * b;
      }
    const correlation = ab / Math.sqrt(aa * bb || 1);
    if (correlation > best.correlation) best = { cut, correlation };
  }
  return best;
}

export function seamError(input) {
  let seam = 0,
    inside = 0,
    ns = 0,
    ni = 0;
  for (let y = 0; y < input.height; y++)
    for (let x = 0; x < input.width; x++)
      for (let c = 0; c < 4; c++) {
        const p = (y * input.width + x) * 4 + c;
        if (x === 0) {
          seam += Math.abs(input.data[p] - input.data[(y * input.width + input.width - 1) * 4 + c]);
          ns++;
        } else {
          inside += Math.abs(input.data[p] - input.data[p - 4]);
          ni++;
        }
        if (y === 0) {
          seam += Math.abs(input.data[p] - input.data[((input.height - 1) * input.width + x) * 4 + c]);
          ns++;
        } else {
          inside += Math.abs(input.data[p] - input.data[p - input.width * 4]);
          ni++;
        }
      }
  return { seam: seam / ns, internal: inside / ni, ratio: seam / ns / (inside / ni || 1) };
}

// Pair corresponding distances from opposite edges, fading their common mean
// into the original over a narrow strip. This is a half-tile offset/crossfade
// expressed in original coordinates, so no interpolation or content rescale occurs.
export function crossfade(input, fraction = 0.08) {
  const output = image(input.width, input.height, Uint8Array.from(input.data));
  for (const axis of ["x", "y"]) {
    const length = axis === "x" ? output.width : output.height;
    const breadth = axis === "x" ? output.height : output.width;
    const strip = Math.max(2, Math.round(length * fraction));
    for (let d = 0; d < strip; d++) {
      const weight = 0.5 * (1 + Math.cos((Math.PI * d) / (strip - 1)));
      for (let t = 0; t < breadth; t++)
        for (let c = 0; c < 4; c++) {
          const a = (axis === "x" ? t * output.width + d : d * output.width + t) * 4 + c;
          const b =
            (axis === "x" ? t * output.width + length - 1 - d : (length - 1 - d) * output.width + t) * 4 + c;
          const average = (output.data[a] + output.data[b]) / 2;
          output.data[a] = Math.round(output.data[a] * (1 - weight) + average * weight);
          output.data[b] = Math.round(output.data[b] * (1 - weight) + average * weight);
        }
    }
  }
  return output;
}

export function rgbToLab(rgb) {
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const f = (v) => (v > 216 / 24389 ? Math.cbrt(v) : (v * 841) / 108 + 4 / 29);
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function labToRgb([l, a, b]) {
  const f = (v) => (v ** 3 > 216 / 24389 ? v ** 3 : ((v - 4 / 29) * 108) / 841);
  const y = (l + 16) / 116;
  const x = 0.95047 * f(y + a / 500),
    yy = f(y),
    z = 1.08883 * f(y - b / 200);
  return [
    3.2404542 * x - 1.5371385 * yy - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * yy + 0.041556 * z,
    0.0556434 * x - 0.2040259 * yy + 1.0572252 * z,
  ].map((v) =>
    clamp(Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055))),
  );
}

export function meanRgb(input) {
  const sum = [0, 0, 0];
  for (let i = 0; i < input.data.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += input.data[i + c];
  return sum.map((v) => v / (input.width * input.height));
}

export function adjustLab(input, targetRgb, { variation = 1, luminance = null } = {}) {
  const labs = new Float64Array(input.width * input.height * 3);
  const mean = [0, 0, 0];
  for (let p = 0; p < input.width * input.height; p++) {
    const lab = rgbToLab(Array.from(input.data.subarray(p * 4, p * 4 + 3)));
    for (let c = 0; c < 3; c++) {
      labs[p * 3 + c] = lab[c];
      mean[c] += lab[c] / (input.width * input.height);
    }
  }
  const target = rgbToLab(targetRgb);
  const output = image(input.width, input.height);
  const range = luminance?.map((rgb) => rgbToLab(rgb)[0]);
  for (let p = 0; p < input.width * input.height; p++) {
    const lab = mean.map((m, c) => target[c] + (labs[p * 3 + c] - m) * variation);
    if (range) lab[0] = clamp(lab[0], range[0], range[1]);
    output.data.set([...labToRgb(lab), 255], p * 4);
  }
  return output;
}

export function radialTint(input, anchor, from, to, reach) {
  const a = rgbToLab(from),
    b = rgbToLab(to);
  const output = image(input.width, input.height, Uint8Array.from(input.data));
  const radius = Math.max(
    ...[
      [0, 0],
      [input.width, 0],
      [0, input.height],
      [input.width, input.height],
    ].map(([x, y]) => Math.hypot(x - anchor[0], y - anchor[1])),
  );
  for (let y = 0; y < input.height; y++)
    for (let x = 0; x < input.width; x++) {
      const p = (y * input.width + x) * 4;
      const t = clamp(Math.hypot(x - anchor[0], y - anchor[1]) / (reach * radius), 0, 1);
      output.data.set(output.data[p + 3] ? labToRgb(a.map((v, c) => v + (b[c] - v) * t)) : [0, 0, 0], p);
    }
  return output;
}

export function normalizeAlpha(input, { low = 4, high = 248, unpremultiply = false } = {}) {
  const output = image(input.width, input.height, Uint8Array.from(input.data));
  for (let i = 0; i < output.data.length; i += 4) {
    const alpha = input.data[i + 3];
    if (alpha <= low) {
      output.data.fill(0, i, i + 4);
      continue;
    }
    if (unpremultiply && alpha < high)
      for (let c = 0; c < 3; c++) output.data[i + c] = clamp(Math.round((input.data[i + c] * 255) / alpha));
    if (alpha >= high) output.data[i + 3] = 255;
  }
  return output;
}

export function levels(input, black, white) {
  const output = image(input.width, input.height);
  for (let i = 0; i < input.data.length; i += 4) {
    const value = Math.round(clamp(((input.data[i] - black) * 255) / (white - black)));
    output.data.set([value, value, value, 255], i);
  }
  return output;
}

export function transitionWidth(input) {
  // Median horizontal 5–95% transition span, independent of grain speckles.
  const spans = [];
  for (let y = 0; y < input.height; y++) {
    let left = -1,
      right = -1;
    for (let x = 0; x < input.width; x++) {
      const v = input.data[(y * input.width + x) * 4];
      if (v > 12 && v < 243) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0) spans.push(right - left + 1);
  }
  spans.sort((a, b) => a - b);
  return (spans[Math.floor(spans.length / 2)] ?? 0) / input.width;
}

export function coverage(input, threshold = 8) {
  let covered = 0,
    alpha = 0;
  for (let i = 3; i < input.data.length; i += 4) {
    if (input.data[i] > threshold) covered++;
    alpha += input.data[i] / 255;
  }
  return { binary: covered / (input.width * input.height), weighted: alpha / (input.width * input.height) };
}

export function hexFaces(points, factor = 1) {
  return [Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map((angle) => {
    const distances = points.map(([x, y]) => x * Math.cos(angle) + y * factor * Math.sin(angle));
    return Math.max(...distances) - Math.min(...distances);
  });
}

export function fitHexProportion(points) {
  let best = { factor: 1, difference: Infinity };
  for (let i = 8500; i <= 10500; i++) {
    const factor = i / 10000;
    const faces = hexFaces(points, factor);
    const difference = (Math.max(...faces) - Math.min(...faces)) / Math.max(...faces);
    if (difference < best.difference) best = { factor, difference, faces };
  }
  return best;
}

export function radialBoundary(
  input,
  { center, radius, angles = [0, 360], threshold = 128, edge = "outer" },
) {
  const points = [];
  for (let degrees = angles[0]; degrees < angles[1]; degrees += 0.5) {
    const angle = (degrees * Math.PI) / 180;
    let found = null;
    for (let r = radius[0]; r <= radius[1]; r += 0.5) {
      const x = Math.round(center[0] + r * Math.cos(angle));
      const y = Math.round(center[1] + r * Math.sin(angle));
      if (x < 0 || y < 0 || x >= input.width || y >= input.height) continue;
      if (input.data[(y * input.width + x) * 4 + 3] > threshold) {
        found = [x, y];
        if (edge === "inner") break;
      }
    }
    if (found) points.push(found);
  }
  return points;
}

export function frontCrossing(input, range, band) {
  const signal = horizontalSignal(input, band[0], band[1]);
  let peak = range[0];
  for (let x = range[0]; x <= range[1]; x++) if (signal[x] > signal[peak]) peak = x;
  let left = peak,
    right = peak;
  while (left > range[0] && signal[left - 1] >= signal[peak] * 0.9) left--;
  while (right < range[1] && signal[right + 1] >= signal[peak] * 0.9) right++;
  return Math.round((left + right) / 2);
}

export function splitColumns(input, threshold, minGap = 1) {
  const ranges = [];
  let start = -1;
  for (let x = 0; x <= input.width; x++) {
    let occupied = false;
    if (x < input.width)
      for (let y = 0; y < input.height; y++) {
        if (input.data[(y * input.width + x) * 4 + 3] > threshold) {
          occupied = true;
          break;
        }
      }
    if (occupied && start < 0) start = x;
    if (!occupied && start >= 0) {
      ranges.push([start, x]);
      start = -1;
    }
  }
  const grouped = [];
  for (const range of ranges) {
    const previous = grouped.at(-1);
    if (previous && range[0] - previous[1] < minGap) previous[1] = range[1];
    else grouped.push([...range]);
  }
  return grouped;
}
