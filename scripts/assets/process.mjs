import { join } from "node:path";
import { outputs, sourceIds, settings, colors } from "./config.mjs";
import { readImage, resize } from "./io.mjs";
import {
  keyBlack,
  bounds,
  boundary,
  fitCircle,
  fitProportion,
  fitHexProportion,
  hexFaces,
  radialBoundary,
  crop,
  adjustLab,
  crossfade,
  seamError,
  autocorrelation,
  horizontalSignal,
  frontCrossing,
  phaseCut,
  thinComponents,
  splitColumns,
  radialTint,
  normalizeAlpha,
  levels,
  transitionWidth,
  coverage,
  meanRgb,
  tint,
  fitRayCenter,
} from "./operations.mjs";

function marginBox(input, center = null) {
  const box = bounds(input, settings.alphaBounds);
  const padding = Math.ceil(Math.max(box.width, box.height) * settings.padding);
  if (center) {
    const radius = Math.max(
      center.x - box.left,
      box.left + box.width - center.x,
      center.y - box.top,
      box.top + box.height - center.y,
    );
    const side = Math.ceil(2 * (radius + padding));
    return {
      left: Math.floor(center.x - side / 2),
      top: Math.floor(center.y - side / 2),
      width: side,
      height: side,
    };
  }
  return {
    left: box.left - padding,
    top: box.top - padding,
    width: box.width + 2 * padding,
    height: box.height + 2 * padding,
  };
}

export async function processBatch(root) {
  const raw = new Map();
  for (const id of sourceIds) {
    const spec = outputs.find((output) => output.source === id);
    const original = await readImage(join(root, "art/source", settings.batch, `${id}.png`), {
      grayscale: spec.format === "MÁSCARA",
    });
    raw.set(
      id,
      spec.format === "CHAVE-PRETA"
        ? keyBlack(original, {
            black: settings.black,
            white: settings.white,
            minArea: settings.minArea,
            preserveDots: settings.preserveDots.includes(id),
          })
        : original,
    );
  }

  const coilSpec = outputs.find((output) => output.coil);
  const coilRaw = raw.get(coilSpec.source);
  const band = coilSpec.coil.band.map((v) => Math.round(v * coilRaw.height));
  const measured = autocorrelation(horizontalSignal(coilRaw, ...band), ...coilSpec.coil.periodRange);
  if (Math.abs(measured.period - coilSpec.coil.measuredPeriod) > 0.5)
    throw new Error("Coil period changed; recalibrate config.mjs");
  const coilBox = coilSpec.coil.crop ?? {
    left: frontCrossing(coilRaw, coilSpec.coil.crossingRange, band),
    top: 0,
    width: Math.round(measured.period),
    height: coilRaw.height,
  };
  const coil = crop(coilRaw, coilBox);
  const coilDiameter = bounds(coil, settings.alphaBounds).height;
  const prepared = [];
  for (const spec of outputs) {
    let input = raw.get(spec.source);
    let anchor = spec.anchor.value ?? null;
    let diameter = null;
    const metrics = {
      source: spec.source,
      sourceSize: [input.width, input.height],
      factor: 1,
      axesDifference: null,
    };
    if (spec.group === "ferragens") {
      const points = boundary(input, settings.contourThreshold);
      const measuredCorrection =
        spec.scale.measure === "hex-faces" ? fitHexProportion(points) : fitProportion(points);
      metrics.measuredCorrection = measuredCorrection;
      if (Math.abs(measuredCorrection.factor - spec.correction.factor) > 0.001)
        throw new Error(`Recalibrate ${spec.id}: configured correction differs from measured contour`);
      input = await resize(input, input.width, Math.round(input.height * spec.correction.factor));
      metrics.factor = input.height / metrics.sourceSize[1];
      const correctedPoints = boundary(input, settings.contourThreshold);
      const circle = fitCircle(correctedPoints);
      const ellipse = fitProportion(correctedPoints);
      metrics.axes = [ellipse.rx * 2, ellipse.ry * 2];
      metrics.circle = circle;
      metrics.axesDifference = ellipse.difference;
      diameter = circle.radius * 2;
      if (spec.scale.measure === "hex-faces") {
        metrics.faces = hexFaces(correctedPoints);
        metrics.axesDifference =
          (Math.max(...metrics.faces) - Math.min(...metrics.faces)) / Math.max(...metrics.faces);
        diameter = metrics.faces.reduce((a, b) => a + b, 0) / metrics.faces.length;
      }
      let center = circle;
      if (spec.anchor.ring) {
        const ring = spec.anchor.ring;
        center = fitCircle(
          radialBoundary(input, {
            ...ring,
            center: [ring.center[0], ring.center[1] * metrics.factor],
            radius: ring.radius.map((v) => v * metrics.factor),
          }),
        );
        metrics.anchorCircle = center;
      }
      const box = marginBox(input, center);
      input = crop(input, box);
      anchor = [(center.x - box.left) / box.width, (center.y - box.top) / box.height];
      metrics.crop = box;
    } else if (spec.paper) {
      input = crossfade(input, settings.crossfade);
      input = adjustLab(input, colors[spec.paper.token], {
        variation: spec.paper.variation,
        luminance: spec.paper.token === "stage" ? settings.paperLuminance : null,
        luminanceGuard: spec.paper.token === "stage" ? settings.paperLuminanceGuard : 0,
      });
    } else if (spec.coil) {
      input = coil;
      diameter = coilDiameter;
      metrics.period = measured;
      metrics.crop = coilBox;
    } else if (spec.end) {
      const center = fitCircle(radialBoundary(input, spec.end.eyeRing));
      const phase = phaseCut(input, coil, {
        min: spec.end.phaseRange[0],
        max: spec.end.phaseRange[1],
        strip: spec.end.strip,
      });
      // Keep the same vertical canvas and pixel scale as the coil. Only the
      // horizontal margin and excess turns after the phase cut are removed.
      const alpha = bounds(input, settings.alphaBounds);
      const left = alpha.left - Math.ceil(coilDiameter * settings.padding);
      const box = spec.end.crop ?? { left, top: 0, width: phase.cut - left, height: input.height };
      input = crop(input, box);
      anchor = [(center.x - box.left) / box.width, center.y / box.height];
      diameter = coilDiameter;
      metrics.phase = phase;
      metrics.eye = center;
      metrics.crop = box;
    } else if (spec.gas) {
      const thinned = thinComponents(input, spec.gas.fraction, spec.gas.seed);
      input = thinned.output;
      metrics.components = { count: thinned.count, kept: thinned.kept };
      input = crossfade(input, spec.gas.crossfade);
    } else if (spec.spark) {
      const ranges = splitColumns(input, spec.spark.emptyThreshold, spec.spark.minGap);
      if (ranges.length !== 3)
        throw new Error(`fx-spark: expected three separated column groups, got ${ranges.length}`);
      const [left, right] = ranges[spec.spark.index - 1];
      input = crop(input, { left, top: 0, width: right - left, height: input.height });
      const center = fitRayCenter(input);
      if (Math.hypot(center.x + left - spec.anchor.measured[0], center.y - spec.anchor.measured[1]) > 0.5)
        throw new Error(`Recalibrate spark center: ${spec.id}`);
      const box = marginBox(input);
      const rightEdge = Math.max(
        box.left + box.width,
        Math.ceil(center.x) + Math.ceil(box.width * settings.padding),
      );
      box.left = Math.min(box.left, Math.floor(center.x) - Math.ceil(box.width * settings.padding));
      box.width = rightEdge - box.left;
      input = crop(input, box);
      anchor = [(center.x - box.left) / box.width, (center.y - box.top) / box.height];
      metrics.rayCenter = center;
      metrics.columnRange = [left, right];
      metrics.crop = box;
    } else if (spec.radial) {
      const box = marginBox(input);
      input = crop(input, box);
      input = radialTint(
        input,
        [anchor[0] * input.width, anchor[1] * input.height],
        colors[spec.radial.from],
        colors[spec.radial.to],
        spec.radial.reach,
        settings.alphaBounds,
      );
      metrics.crop = box;
    } else if (spec.alpha) {
      input = normalizeAlpha(input, spec.alpha);
      const box = marginBox(input);
      input = crop(input, box);
      metrics.crop = box;
    } else if (spec.mask) {
      input = levels(input, ...spec.mask.levels);
      metrics.levels = spec.mask.levels;
      metrics.initialTransition = transitionWidth(input);
      if (metrics.initialTransition < spec.mask.minTransition) {
        input = levels(raw.get(spec.source), ...spec.mask.fallback);
        metrics.levels = spec.mask.fallback;
      }
      metrics.transition = transitionWidth(input);
      let low = 255,
        high = 0;
      for (let i = 0; i < input.data.length; i += 4) {
        low = Math.min(low, input.data[i]);
        high = Math.max(high, input.data[i]);
      }
      metrics.extrema = [low, high];
    } else if (spec.repeat === "xy") {
      input = crossfade(input, settings.crossfade);
    }
    if (!anchor) throw new Error(`Missing anchor: ${spec.id}`);
    const size = spec.size;
    const width = size.axis === "width" ? size.x1 : Math.round((input.width * size.x1) / input.height);
    const height = size.axis === "height" ? size.x1 : Math.round((input.height * size.x1) / input.width);
    let x1 = await resize(input, width, height);
    let x2 = await resize(input, width * 2, height * 2);
    // Resampling can change the first/last pixel. Restore periodic edges at
    // each output resolution, then measure the actual encoded files later.
    if (spec.repeat === "xy") {
      x1 = crossfade(x1, spec.gas?.crossfade ?? settings.crossfade);
      x2 = crossfade(x2, spec.gas?.crossfade ?? settings.crossfade);
    }
    if (spec.tints.length) {
      x1 = tint(x1, colors[spec.tints[0]]);
      x2 = tint(x2, colors[spec.tints[0]]);
    }
    if (spec.alpha) {
      x1 = normalizeAlpha(x1, { ...spec.alpha, unpremultiply: false });
      x2 = normalizeAlpha(x2, { ...spec.alpha, unpremultiply: false });
    }
    const mmPerPx = diameter ? spec.scale.mm / ((diameter * height) / input.height) : null;
    metrics.anchor = anchor;
    metrics.mmPerPx = mmPerPx;
    metrics.diameter1x = diameter ? (diameter * height) / input.height : null;
    metrics.coverage = coverage(x1, settings.alphaBounds);
    metrics.masterCoverage = coverage(raw.get(spec.source), settings.alphaBounds);
    if (spec.paper) metrics.mean = meanRgb(x1);
    if (spec.repeat === "xy") metrics.seam = seamError(x1);
    prepared.push({ spec, x1, x2, anchor, mmPerPx, metrics });
    console.log(`${spec.id}: ${width}×${height}, anchor ${anchor.map((v) => v.toFixed(4)).join(", ")}`);
  }
  return prepared;
}
