// morph effect module. Loaded before the main UI script.
var morphDefaults = {
  morphMotionMode: "morph",
  morphFrameIntervalMs: 2600,
  morphTransitionMs: 1500,
  morphShapeDetail: 48,
  morphBreath: 0.52,
  morphRotationDeg: 36,
  morphFusionRotationDeg: 34,
  morphColor: "#f6f7f1",
  morphOpacity: 0.92,
  morphRenderMode: "fill",
  morphStrokePointCount: 0,
  morphStrokeLineColor: "#f6f7f1",
  morphStrokePointColor: "#92e7d8",
  morphStrokeGuideColor: "#f6f7f1",
  morphStrokePointSize: 1,
  morphStrokeLineWidth: 1,
};

var morphControlDefs = [
  {
    key: "morphMotionMode",
    type: "segmented",
    label: "动效类型",
    options: [
      { value: "morph", label: "变形" },
      { value: "fusion", label: "融合" },
    ],
    tip: "变形使用轮廓点对应；融合使用高斯模糊后的透明度场，通过阈值生成圆润的融合形状。",
  },
  { key: "morphFrameIntervalMs", label: "动效周期", min: 1200, max: 8000, step: 100, tip: "每张图片停留并进入下一张的总周期。周期越短，图形切换越密。" },
  { key: "morphTransitionMs", label: "动效时长", min: 500, max: 5200, step: 50, tip: "每次 morph 过渡实际运动的时长，使用自然缓动；大于周期时会自动收敛。" },
  { key: "morphShapeDetail", label: "形状细节", min: 16, max: 96, step: 1, tip: "控制每个独立形状轮廓的采样点数。数值越高，不规则形状保留越完整。" },
  { key: "morphBreath", label: "呼吸感", min: 0, max: 1, step: 0.01, tip: "控制整体形状过渡时的柔和呼吸、轻微漂浮和弹性感。" },
  { key: "morphRotationDeg", label: "旋转角度", min: -180, max: 180, step: 1, showWhen: () => config.morphMotionMode === "morph", tip: "控制关键帧过渡过程中的形状姿态旋转。起点和终点保持原图朝向，正负值决定中间旋转方向。" },
  { key: "morphFusionRotationDeg", label: "旋转角度", min: -180, max: 180, step: 1, showWhen: () => config.morphMotionMode === "fusion", tip: "融合过渡时整组图案围绕画布中心错位旋转的角度。" },
  {
    key: "morphRenderMode",
    type: "segmented",
    label: "样式",
    showWhen: () => config.morphMotionMode === "morph",
    options: [
      { value: "fill", label: "填充" },
      { value: "stroke", label: "描边" },
    ],
    tip: "填充使用完整色块；描边使用轮廓线、端点和随端点运动绘制的正交辅助线。",
  },
  { key: "morphColor", alphaKey: "morphOpacity", type: "colorAlpha", label: "形状颜色", showWhen: () => config.morphMotionMode === "fusion" || config.morphRenderMode !== "stroke", tip: "控制变形形状的颜色和透明度。" },
  { key: "morphStrokePointCount", label: "端点数量", min: 0, max: 36, step: 1, showWhen: () => config.morphMotionMode === "morph" && config.morphRenderMode === "stroke", tip: "控制视觉端点数量。0 为自动，只取视觉拐角；手动数量不改变轮廓精度。" },
  { key: "morphStrokeLineColor", type: "color", label: "连线颜色", showWhen: () => config.morphMotionMode === "morph" && config.morphRenderMode === "stroke", tip: "控制轮廓描边颜色。" },
  { key: "morphStrokeGuideColor", type: "color", label: "辅助线颜色", showWhen: () => config.morphMotionMode === "morph" && config.morphRenderMode === "stroke", tip: "控制端点处水平、垂直和切线圆辅助线颜色。" },
  { key: "morphStrokePointColor", type: "color", label: "端点颜色", showWhen: () => config.morphMotionMode === "morph" && config.morphRenderMode === "stroke", tip: "控制轮廓取样端点颜色。" },
  { key: "morphStrokePointSize", label: "端点尺寸", min: 0.45, max: 3, step: 0.05, showWhen: () => config.morphMotionMode === "morph" && config.morphRenderMode === "stroke", tip: "控制端点圆点的视觉尺寸。" },
  { key: "morphStrokeLineWidth", label: "连线粗细", min: 0.45, max: 3, step: 0.05, showWhen: () => config.morphMotionMode === "morph" && config.morphRenderMode === "stroke", tip: "控制轮廓线和辅助线的基础粗细。" },
];

function prepareMorphEffect() {
  hideLineEditHandles();
  ensureParticleDefaultKeyframes();
  state.morphSystem.targets = config.particleKeyframes.map((frame, index) => (
    morphShapesFromImageData(frame.imageData, `morph|${frame.id}|${frame.name}|${index}`, frame)
  ));
  state.morphSystem.lastFrameAt = null;
  state.morphSystem.fusionCanvases = null;
}

function morphShapePointCount() {
  return clamp(Math.round(config.morphShapeDetail || 48), 16, 96);
}

function morphShapesFromImageData(imageData, seedKey, frame = null) {
  const field = makeScalarField(imageData, "auto");
  const level = automaticContourLevel(field);
  const { mask, width, height } = foregroundMaskFromField(field, level);
  const components = connectedComponents(mask, width, height);
  const largest = components[0]?.length ?? 0;
  const minArea = Math.max(18, Math.min(largest * 0.035, width * height * 0.006));
  const selected = components
    .filter((component) => component.length >= minArea)
    .slice(0, 10);
  if (!selected.length) return fallbackMorphShapes(seedKey);
  const rawContours = selected
    .map((component) => contourPathFromComponentMask(maskFromComponent(component, mask.length), width, height))
    .filter((path) => path.length >= 4);
  if (!rawContours.length) return fallbackMorphShapes(seedKey);
  const normalized = normalizeContours(rawContours);
  const shapes = normalized
    .map((contour, index) => makeMorphShape(contour, `${seedKey}|${index}`))
    .filter((shape) => shape.points.length >= 8)
    .sort((a, b) => a.center.x - b.center.x || a.center.y - b.center.y || b.area - a.area);
  return morphApplyRegionLabels(frame, filterNestedMorphShapes(shapes));
}

function makeMorphShape(contour, seedKey) {
  const simplified = simplifyToPointCount(contour, morphShapePointCount());
  const points = orientMorphPoints(smoothMorphContour(resampleSmoothClosed(simplified, morphShapePointCount())));
  const center = morphCentroid(points);
  return {
    points,
    center,
    area: Math.abs(polygonArea(points)),
    seed: seededRandom(seedKey)(),
  };
}

function smoothMorphContour(points) {
  let smoothed = points.slice();
  for (let pass = 0; pass < 2; pass += 1) {
    const next = [];
    for (let index = 0; index < smoothed.length; index += 1) {
      const current = smoothed[index];
      const following = smoothed[(index + 1) % smoothed.length];
      next.push({
        x: current.x * 0.76 + following.x * 0.24,
        y: current.y * 0.76 + following.y * 0.24,
      });
      next.push({
        x: current.x * 0.24 + following.x * 0.76,
        y: current.y * 0.24 + following.y * 0.76,
      });
    }
    smoothed = resampleClosed(next, morphShapePointCount());
  }
  return smoothed;
}

function filterNestedMorphShapes(shapes) {
  return shapes.filter((shape, index) => {
    const container = shapes.find((other, otherIndex) => (
      otherIndex !== index &&
      other.area > shape.area * 2.8 &&
      pointInPolygon(shape.center, other.points)
    ));
    return !container;
  });
}

function morphApplyRegionLabels(frame, shapes) {
  const labels = morphEnsureFrameRegionLabels(frame, shapes.length);
  return shapes.map((shape, index) => ({
    ...shape,
    matchId: labels[index] ?? index + 1,
    regionIndex: index,
  }));
}

function morphEnsureFrameRegionLabels(frame, shapeCount) {
  if (!frame) return Array.from({ length: shapeCount }, (_, index) => index + 1);
  const labels = Array.isArray(frame.morphRegionLabels) ? frame.morphRegionLabels.slice() : [];
  while (labels.length < shapeCount) labels.push(labels.length + 1);
  if (labels.length > shapeCount) labels.length = shapeCount;
  frame.morphRegionLabels = labels.map((label, index) => {
    const value = Math.round(Number(label));
    return Number.isFinite(value) && value > 0 ? value : index + 1;
  });
  return frame.morphRegionLabels;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, prev = polygon.length - 1; index < polygon.length; prev = index, index += 1) {
    const a = polygon[index];
    const b = polygon[prev];
    const denom = Math.abs(b.y - a.y) < 0.000001 ? 0.000001 : b.y - a.y;
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      (point.x < ((b.x - a.x) * (point.y - a.y)) / denom + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function fallbackMorphShapes(seedKey) {
  const rng = seededRandom(`morph-fallback|${seedKey}`);
  return [0, 1, 2].map((_, index) => {
    const center = {
      x: 50 + (index - 1) * 18,
      y: 50 + Math.sin(index * 1.7) * 8,
    };
    const radius = 8 + rng() * 6;
    const points = Array.from({ length: morphShapePointCount() }, (__, pointIndex) => {
      const t = (pointIndex / morphShapePointCount()) * Math.PI * 2;
      const wobble = 1 + Math.sin(t * 3 + index) * 0.16;
      return {
        x: center.x + Math.cos(t) * radius * wobble,
        y: center.y + Math.sin(t) * radius * wobble,
      };
    });
    return { points, center, area: Math.abs(polygonArea(points)), seed: rng() };
  });
}

function morphCentroid(points) {
  if (!points.length) return { x: 50, y: 50 };
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function orientMorphPoints(points) {
  const oriented = polygonArea(points) < 0 ? points.slice().reverse() : points.slice();
  const center = morphCentroid(oriented);
  let startIndex = 0;
  let best = Infinity;
  oriented.forEach((point, index) => {
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const score = Math.abs(angle + Math.PI / 2) + Math.abs(point.x - center.x) * 0.001;
    if (score < best) {
      best = score;
      startIndex = index;
    }
  });
  return oriented.slice(startIndex).concat(oriented.slice(0, startIndex));
}

function alignMorphPoints(from, to) {
  if (from.length !== to.length || from.length < 2) return to;
  let bestShift = 0;
  let bestScore = Infinity;
  for (let shift = 0; shift < to.length; shift += 1) {
    let score = 0;
    for (let index = 0; index < from.length; index += 1) {
      score += distance(from[index], to[(index + shift) % to.length]);
    }
    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }
  return to.slice(bestShift).concat(to.slice(0, bestShift));
}

function morphFrameShapeCount(frames) {
  return Math.max(1, ...frames.map((frame) => frame.length));
}

function morphTransitionPairs(current, next) {
  const currentGroups = morphRegionGroups(current);
  const nextGroups = morphRegionGroups(next);
  const labels = [...new Set([...currentGroups.keys(), ...nextGroups.keys()])].sort((a, b) => a - b);
  if (!labels.length) {
    const count = morphFrameShapeCount([current, next]);
    return Array.from({ length: count }, (_, index) => ({
      currentIndex: index < current.length ? index : null,
      nextIndex: index < next.length ? index : null,
      matchId: index + 1,
    }));
  }
  const pairs = [];
  labels.forEach((label) => {
    const currentItems = currentGroups.get(label) ?? [];
    const nextItems = nextGroups.get(label) ?? [];
    const count = Math.max(currentItems.length, nextItems.length);
    for (let index = 0; index < count; index += 1) {
      pairs.push({
        currentIndex: currentItems[index]?.index ?? null,
        nextIndex: nextItems[index]?.index ?? null,
        matchId: label,
      });
    }
  });
  return pairs;
}

function morphRegionGroups(frame) {
  const groups = new Map();
  frame.forEach((shape, index) => {
    const label = morphShapeMatchId(shape, index);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push({ shape, index });
  });
  return groups;
}

function morphShapeMatchId(shape, fallbackIndex) {
  const value = Math.round(Number(shape?.matchId));
  return Number.isFinite(value) && value > 0 ? value : fallbackIndex + 1;
}

function morphShapeAt(frame, index, counterpart = null) {
  if (!frame.length) return fallbackMorphShapes("empty")[0];
  if (frame[index]) return frame[index];
  const source = nearestMorphSource(frame, counterpart?.center) ?? frame[index % frame.length];
  const basis = counterpart ?? source;
  const attach = nearestMorphPoint(source.points, basis.center);
  const splitScale = 0.018;
  return {
    ...basis,
    points: basis.points.map((point) => ({ x: attach.x + (point.x - basis.center.x) * splitScale, y: attach.y + (point.y - basis.center.y) * splitScale })),
    center: attach,
    area: 0,
    phantom: true,
  };
}

function nearestMorphSource(frame, center) {
  if (!frame.length || !center) return null;
  return frame
    .map((shape) => ({ shape, score: distance(shape.center, center) }))
    .sort((a, b) => a.score - b.score)[0]?.shape ?? null;
}

function nearestMorphPoint(points, target) {
  if (!points.length || !target) return { x: 50, y: 50 };
  return points
    .map((point) => ({ point, score: distance(point, target) }))
    .sort((a, b) => a.score - b.score)[0].point;
}

function morphFrameMix(now) {
  const frames = state.morphSystem.targets.filter((targets) => targets.length);
  if (!frames.length) return { current: [], next: [], progress: 0, raw: 0, index: 0, segment: 0, active: false };
  const interval = Math.max(400, config.morphFrameIntervalMs);
  const transition = Math.min(Math.max(120, config.morphTransitionMs), interval);
  const hold = Math.max(0, interval - transition);
  const elapsed = Number.isFinite(state.startedAt) ? now - state.startedAt : 0;
  const cycle = Math.max(1, frames.length) * interval;
  const segment = Math.max(0, Math.floor(Math.max(0, elapsed) / interval));
  const local = ((elapsed % cycle) + cycle) % cycle;
  const index = Math.min(frames.length - 1, Math.floor(local / interval));
  const frameLocal = local % interval;
  const raw = frameLocal < hold ? 0 : clamp((frameLocal - hold) / transition, 0, 1);
  return {
    current: frames[index],
    next: frames[(index + 1) % frames.length],
    progress: morphNaturalEase(raw),
    raw,
    index,
    segment,
    active: raw > 0 && raw < 1,
  };
}

function morphNaturalEase(value) {
  const t = organicEase(value);
  const breath = clamp(config.morphBreath, 0, 1);
  const inhale = Math.sin(t * Math.PI);
  return clamp(t + inhale * (0.035 + breath * 0.035) * (0.5 - t), 0, 1);
}

function morphGravityPull(progress, breath) {
  const p = clamp(progress, 0, 1);
  const window = Math.sin(Math.PI * p) ** 2;
  const lateBias = p - 0.38;
  return lateBias * window * (16 + breath * 10);
}

function morphOrbitTransform(a, b, progress, breath, side) {
  const center = { x: 50, y: 50 };
  const base = {
    x: mixCellValue(a.center.x, b.center.x, progress),
    y: mixCellValue(a.center.y, b.center.y, progress),
  };
  const sx = a.center.x - center.x;
  const sy = a.center.y - center.y;
  const ex = b.center.x - center.x;
  const ey = b.center.y - center.y;
  const startRadius = Math.max(0.001, Math.hypot(sx, sy));
  const endRadius = Math.max(0.001, Math.hypot(ex, ey));
  const startAngle = Math.atan2(sy, sx);
  const endAngle = Math.atan2(ey, ex);
  let deltaAngle = endAngle - startAngle;
  while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
  while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
  const crossDirection = Math.sign(sx * ey - sy * ex);
  const direction = crossDirection || side || 1;
  const arcWindow = 4 * progress * (1 - progress);
  const angle = startAngle + deltaAngle * progress;
  const radius = mixCellValue(startRadius, endRadius, progress) + Math.min(14, Math.max(3.5, Math.abs(deltaAngle) * 6.5 + Math.abs(endRadius - startRadius) * 0.32)) * arcWindow * (0.62 + breath * 0.42);
  const tangent = { x: -Math.sin(angle) * direction, y: Math.cos(angle) * direction };
  const inertia = morphGravityPull(progress, breath);
  const orbit = {
    x: center.x + Math.cos(angle) * radius + tangent.x * inertia,
    y: center.y + Math.sin(angle) * radius + tangent.y * inertia,
  };
  const spinBase = Math.max(0.28, Math.min(1.35, Math.abs(deltaAngle) * 0.58 + 0.22 + breath * 0.42));
  const spin = direction * spinBase * Math.sin(Math.PI * progress);
  return {
    x: orbit.x - base.x,
    y: orbit.y - base.y,
    rotation: spin,
  };
}

function morphShapeProgress(raw, index, segmentIndex) {
  const p = clamp(raw, 0, 1);
  if (p <= 0 || p >= 1) return p;
  const breath = clamp(config.morphBreath, 0, 1);
  const rng = seededRandom(`morph-shape-progress|${segmentIndex}|${index}`);
  const delay = rng() * 0.14 * breath;
  const duration = Math.max(0.62, 1 - delay * 0.55);
  const shifted = clamp((p - delay) / duration, 0, 1);
  const wave = Math.sin(shifted * Math.PI * 2 + index * 0.73 + segmentIndex) * 0.025 * breath * Math.sin(shifted * Math.PI);
  return clamp(morphNaturalEase(shifted) + wave, 0, 1);
}

function morphInterpolatedShape(a, b, index, mix, now) {
  const progress = morphShapeProgress(mix.raw, index, mix.index);
  const settled = organicEase(progress);
  const t = settled;
  const alignedB = alignMorphPoints(a.points, b.points);
  const breath = clamp(config.morphBreath, 0, 1);
  const side = seededRandom(`morph-shape-arc|${mix.index}|${index}`)() > 0.5 ? 1 : -1;
  const orbit = morphOrbitTransform(a, b, settled, breath, side);
  const transitionRotation = morphTransitionRotationAngle(settled);
  const displaySeed = morphStableShapeSeed(mix.raw > 0 ? b : a, index);
  const floatPhase = now * 0.0011 + displaySeed * 17.13;
  const idleX = Math.sin(floatPhase) * breath * 0.28;
  const idleY = Math.cos(floatPhase * 0.91) * breath * 0.28;
  const pulse = 1 + Math.sin(now * 0.0017 + displaySeed * 11.7) * 0.018 * breath + Math.sin(Math.PI * settled) * 0.045 * breath;
  const rotation = 0;
  const mergePull = (a.phantom || b.phantom) ? Math.sin(Math.PI * settled) * (0.22 + breath * 0.18) : 0;
  const points = a.points.map((point, pointIndex) => {
    const target = alignedB[pointIndex] ?? point;
    const sourcePoint = morphRotatePointAround(point, a.center, transitionRotation.from);
    const targetPoint = morphRotatePointAround(target, b.center, transitionRotation.to);
    const localWave = Math.sin((pointIndex / Math.max(1, a.points.length)) * Math.PI * 2 + now * 0.0012 + index) * 0.25 * breath * Math.sin(Math.PI * settled);
    const x = mixCellValue(sourcePoint.x, targetPoint.x, t);
    const y = mixCellValue(sourcePoint.y, targetPoint.y, t);
    const pullCenter = b.phantom ? b.center : a.phantom ? a.center : null;
    return {
      x: mixCellValue(x, pullCenter?.x ?? x, mergePull) + orbit.x + idleX + localWave,
      y: mixCellValue(y, pullCenter?.y ?? y, mergePull) + orbit.y + idleY + localWave * 0.35,
    };
  });
  const center = morphCentroid(points);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const transformedPoints = points.map((point) => {
    const dx = (point.x - center.x) * pulse;
    const dy = (point.y - center.y) * pulse;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
  const strokeVisualPoints = morphStrokeVisualPoints(transformedPoints);
  return {
    points: transformedPoints,
    strokeVisualPoints,
    strokeGuidePoints: strokeVisualPoints,
    strokeProgress: mix.active ? morphGuideDrawProgress(mix.raw) : 1,
    strokeGuideProgress: mix.active ? morphGuideDrawProgress(mix.raw) : 1,
    strokeSeed: morphShapeStrokeSeed(mix.raw > 0 ? b : a, index),
    alpha: a.phantom && b.phantom ? 0 : 0.95,
  };
}

function morphStableShapeSeed(shape, fallbackIndex) {
  const seed = Number(shape?.seed);
  if (Number.isFinite(seed)) return seed;
  const center = shape?.center ?? { x: 0, y: 0 };
  return (fallbackIndex + 1) * 0.137 + center.x * 0.001 + center.y * 0.0001;
}

function morphShapeStrokeSeed(shape, fallbackIndex) {
  const seed = Number(shape?.seed);
  if (Number.isFinite(seed)) return `morph-stroke-shape|${seed.toFixed(5)}`;
  const center = shape?.center ?? { x: 0, y: 0 };
  return `morph-stroke-shape|${fallbackIndex}|${center.x.toFixed(2)}|${center.y.toFixed(2)}`;
}

function morphTransitionRotationAngle(progress) {
  const angle = (Number(config.morphRotationDeg ?? config.morphStrokeRotationDeg) || 0) * Math.PI / 180;
  const p = clamp(progress, 0, 1);
  return {
    from: angle * p,
    to: angle * (p - 1),
  };
}

function morphRotatePointAround(point, center, angle) {
  if (!angle) return point;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

function morphGuideDrawProgress(raw) {
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return morphNaturalEase(raw);
}

function ensureMorphFusionCanvases(width, height) {
  const system = state.morphSystem;
  const existing = system.fusionCanvases;
  const scale = Math.min(1, 720 / Math.max(width, height));
  const fieldWidth = Math.max(1, Math.round(width * scale));
  const fieldHeight = Math.max(1, Math.round(height * scale));
  if (existing && existing.width === width && existing.height === height && existing.fieldWidth === fieldWidth && existing.fieldHeight === fieldHeight) return existing;
  const makeCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = fieldWidth;
    canvas.height = fieldHeight;
    return canvas;
  };
  const from = makeCanvas();
  const to = makeCanvas();
  const output = makeCanvas();
  system.fusionCanvases = {
    width,
    height,
    fieldWidth,
    fieldHeight,
    scale,
    from,
    to,
    output,
    fromCtx: from.getContext("2d"),
    toCtx: to.getContext("2d"),
    outputCtx: output.getContext("2d"),
  };
  return system.fusionCanvases;
}

function rotatedMorphCanvasPoint(point, center, angle) {
  const canvasPoint = particleToCanvas(point);
  if (!angle) return canvasPoint;
  const canvasCenter = particleToCanvas(center);
  const dx = canvasPoint.x - canvasCenter.x;
  const dy = canvasPoint.y - canvasCenter.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: canvasCenter.x + dx * cos - dy * sin,
    y: canvasCenter.y + dx * sin + dy * cos,
  };
}

function drawMorphFusionPath(ctx, shape, rotation, rotationCenter) {
  if (!shape.points.length) return;
  const first = rotatedMorphCanvasPoint(shape.points[0], rotationCenter, rotation);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 0; index < shape.points.length; index += 1) {
    const controls = bezierControls(shape.points, index, 0.92);
    const c1 = rotatedMorphCanvasPoint(controls.c1, rotationCenter, rotation);
    const c2 = rotatedMorphCanvasPoint(controls.c2, rotationCenter, rotation);
    const end = rotatedMorphCanvasPoint(closedPoint(shape.points, index + 1), rotationCenter, rotation);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMorphFusionField(fieldCtx, width, height, scale, shapes, rotation, blurPx) {
  fieldCtx.setTransform(1, 0, 0, 1, 0, 0);
  fieldCtx.clearRect(0, 0, width, height);
  fieldCtx.save();
  fieldCtx.setTransform(scale, 0, 0, scale, 0, 0);
  fieldCtx.filter = `blur(${Math.max(0, blurPx * scale).toFixed(2)}px)`;
  fieldCtx.fillStyle = "#ffffff";
  fieldCtx.globalAlpha = 1;
  const rotationCenter = { x: 50, y: 50 };
  shapes.forEach((shape) => drawMorphFusionPath(fieldCtx, shape, rotation, rotationCenter));
  fieldCtx.restore();
  fieldCtx.filter = "none";
}

function renderMorphFusionEffect(ctx, mix) {
  const width = particleCanvas.width;
  const height = particleCanvas.height;
  if (!width || !height) return;
  const buffers = ensureMorphFusionCanvases(width, height);
  const breath = clamp(config.morphBreath, 0, 1);
  const eased = mix.progress;
  const active = mix.raw > 0 && mix.raw < 1;
  const spin = (Number(config.morphFusionRotationDeg) || 0) * Math.PI / 180;
  const fromRotation = active ? -spin * eased : 0;
  const toRotation = active ? spin * (1 - eased) : 0;
  const blurPx = state.particleSystem.viewport.size * (0.018 + breath * 0.022);
  const holdKey = !active && eased <= 0.001
    ? `hold|${mix.index}|${width}x${height}|${buffers.fieldWidth}x${buffers.fieldHeight}|${config.morphColor}|${config.morphOpacity}|${config.morphBreath}|${mix.current.length}`
    : "";
  if (holdKey && buffers.cacheKey === holdKey) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffers.output, 0, 0, width, height);
    ctx.restore();
    return;
  }
  drawMorphFusionField(buffers.fromCtx, buffers.fieldWidth, buffers.fieldHeight, buffers.scale, mix.current, fromRotation, blurPx);
  const fromData = buffers.fromCtx.getImageData(0, 0, buffers.fieldWidth, buffers.fieldHeight).data;
  const shouldDrawNext = active || eased >= 0.999;
  let toData = null;
  if (shouldDrawNext) {
    drawMorphFusionField(buffers.toCtx, buffers.fieldWidth, buffers.fieldHeight, buffers.scale, mix.next, toRotation, blurPx);
    toData = buffers.toCtx.getImageData(0, 0, buffers.fieldWidth, buffers.fieldHeight).data;
  }
  const output = buffers.outputCtx.createImageData(buffers.fieldWidth, buffers.fieldHeight);
  const out = output.data;
  const color = parseColorValue(config.morphColor) ?? { r: 246, g: 247, b: 241, a: 1 };
  const mergeBoost = active ? Math.sin(Math.PI * eased) * (0.12 + breath * 0.2) : 0;
  const fromWeight = eased >= 0.999 ? 0 : clamp(1 - eased + mergeBoost, 0, 1);
  const toWeight = eased >= 0.999 ? 1 : (active ? clamp(eased + mergeBoost, 0, 1) : 0);
  const threshold = 127;
  const alpha = Math.round(255 * clamp(config.morphOpacity * color.a, 0, 1));
  const edgeFeather = 5;
  for (let index = 0; index < out.length; index += 4) {
    const field = fromData[index + 3] * fromWeight + (toData ? toData[index + 3] * toWeight : 0);
    const coverage = clamp((field - (threshold - edgeFeather)) / (edgeFeather * 2), 0, 1);
    if (coverage > 0) {
      const smoothCoverage = coverage * coverage * (3 - 2 * coverage);
      out[index] = color.r;
      out[index + 1] = color.g;
      out[index + 2] = color.b;
      out[index + 3] = Math.round(alpha * smoothCoverage);
    }
  }
  buffers.outputCtx.putImageData(output, 0, 0);
  buffers.cacheKey = holdKey;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buffers.output, 0, 0, width, height);
  ctx.restore();
}

function renderMorphEffect(now) {
  hideParticles();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  showParticleCanvas();
  resizeParticleCanvas();
  const ctx = particleCanvas.getContext("2d");
  const system = state.morphSystem;
  system.lastFrameAt = now;
  const mix = morphFrameMix(now);
  ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  if (renderMorphRegionLabelEditor(ctx)) {
    return;
  }
  if (config.morphMotionMode === "fusion") {
    renderMorphFusionEffect(ctx, mix);
    if (now - (system.lastDebugAt || 0) > 250) {
      system.lastDebugAt = now;
      window.__motionDebug.morphFrameCount = config.particleKeyframes.length;
      window.__motionDebug.morphShapeCount = morphFrameShapeCount(state.morphSystem.targets);
      window.__motionDebug.morphProgress = mix.progress;
    }
    return;
  }
  const pairs = morphTransitionPairs(mix.current, mix.next);
  ctx.fillStyle = config.morphColor;
  pairs.forEach((pair, index) => {
    const currentShape = pair.currentIndex == null ? null : mix.current[pair.currentIndex] ?? null;
    const nextShape = pair.nextIndex == null ? null : mix.next[pair.nextIndex] ?? null;
    const a = currentShape ?? morphShapeAt(mix.current, index, nextShape);
    const b = nextShape ?? morphShapeAt(mix.next, pair.nextIndex ?? index, a);
    drawMorphShape(ctx, morphInterpolatedShape(a, b, index, mix, now));
  });
  if (now - (system.lastDebugAt || 0) > 250) {
    system.lastDebugAt = now;
    window.__motionDebug.morphFrameCount = config.particleKeyframes.length;
    window.__motionDebug.morphShapeCount = pairs.length;
    window.__motionDebug.morphProgress = mix.progress;
  }
}

function toggleMorphRegionLabelEditor(frameId) {
  if (state.morphSystem.labelEditor?.frameId === frameId) {
    state.morphSystem.labelEditor = null;
  } else {
    state.morphSystem.labelEditor = { frameId };
    config.effectType = "morph";
    if (!state.morphSystem.targets.length) prepareMorphEffect();
  }
  renderMotionControls();
  updateMeta();
  updateFormulaAndCode();
  refreshPreviewNow();
}

function renderMorphRegionLabelEditor(ctx) {
  const editor = state.morphSystem.labelEditor;
  if (!editor || config.effectType !== "morph") return false;
  const frameIndex = config.particleKeyframes.findIndex((frame) => frame.id === editor.frameId);
  if (frameIndex < 0) {
    state.morphSystem.labelEditor = null;
    return false;
  }
  const frame = config.particleKeyframes[frameIndex];
  let shapes = state.morphSystem.targets[frameIndex];
  if (!shapes) {
    shapes = morphShapesFromImageData(frame.imageData, `morph|${frame.id}|${frame.name}|${frameIndex}`, frame);
    state.morphSystem.targets[frameIndex] = shapes;
  }
  morphEnsureFrameRegionLabels(frame, shapes.length);
  shapes.forEach((shape, index) => {
    const label = frame.morphRegionLabels[index] ?? index + 1;
    drawMorphRegionLabelShape(ctx, shape, label);
  });
  window.__motionDebug.morphEditingFrame = frame.id;
  window.__motionDebug.morphShapeCount = shapes.length;
  return true;
}

function drawMorphRegionLabelShape(ctx, shape, label) {
  if (!shape.points.length) return;
  const viewport = state.particleSystem.viewport;
  const first = particleToCanvas(shape.points[0]);
  ctx.save();
  ctx.fillStyle = colorToRgbaText(config.morphColor, 0.22);
  ctx.strokeStyle = colorToRgbaText(config.morphStrokeLineColor || config.morphColor, 0.78);
  ctx.lineWidth = Math.max(1, devicePixelRatio || 1);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 0; index < shape.points.length; index += 1) {
    const controls = bezierControls(shape.points, index, 0.92);
    const c1 = particleToCanvas(controls.c1);
    const c2 = particleToCanvas(controls.c2);
    const end = particleToCanvas(closedPoint(shape.points, index + 1));
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const center = particleToCanvas(shape.center);
  const radius = Math.max(13, viewport.size * 0.035);
  ctx.fillStyle = "rgba(5, 5, 7, 0.86)";
  ctx.strokeStyle = colorToRgbaText(config.morphStrokePointColor || "#92e7d8", 0.95);
  ctx.lineWidth = Math.max(1, devicePixelRatio || 1);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colorToRgbaText(config.morphStrokePointColor || "#92e7d8", 1);
  ctx.font = `700 ${Math.max(12, radius * 0.9)}px SF Pro Display, Helvetica Neue, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(label), center.x, center.y + 0.5);
  ctx.restore();
}

function handleMorphRegionLabelClick(event) {
  const editor = state.morphSystem.labelEditor;
  if (!editor || config.effectType !== "morph") return false;
  resizeParticleCanvas();
  const frameIndex = config.particleKeyframes.findIndex((frame) => frame.id === editor.frameId);
  if (frameIndex < 0) return false;
  const frame = config.particleKeyframes[frameIndex];
  const shapes = state.morphSystem.targets[frameIndex] ?? [];
  if (!shapes.length) return false;
  const point = canvasToParticlePoint(event);
  let hitIndex = shapes.findIndex((shape) => pointInPolygon(point, shape.points));
  if (hitIndex < 0) {
    let best = Infinity;
    shapes.forEach((shape, index) => {
      const score = distance(point, shape.center);
      if (score < best) {
        best = score;
        hitIndex = index;
      }
    });
  }
  if (hitIndex < 0) return false;
  const labels = morphEnsureFrameRegionLabels(frame, shapes.length);
  const maxLabel = morphMaxEditableRegionLabel();
  labels[hitIndex] = (labels[hitIndex] % maxLabel) + 1;
  shapes[hitIndex].matchId = labels[hitIndex];
  updateMeta();
  updateFormulaAndCode();
  refreshPreviewNow();
  return true;
}

function morphMaxEditableRegionLabel() {
  const targetCount = morphFrameShapeCount(state.morphSystem.targets);
  const labelMax = Math.max(0, ...config.particleKeyframes.flatMap((frame) => (
    Array.isArray(frame.morphRegionLabels) ? frame.morphRegionLabels.map((label) => Number(label) || 0) : []
  )));
  return Math.max(1, targetCount, labelMax);
}

function drawMorphShape(ctx, shape) {
  if (config.morphMotionMode === "morph" && config.morphRenderMode === "stroke") {
    drawMorphStrokeShape(ctx, shape);
    return;
  }
  drawMorphFilledShape(ctx, shape);
}

function drawMorphFilledShape(ctx, shape) {
  if (!shape.points.length) return;
  const first = particleToCanvas(shape.points[0]);
  ctx.save();
  ctx.globalAlpha = clamp((shape.alpha ?? 1) * config.morphOpacity, 0, 1);
  ctx.fillStyle = config.morphColor;
  ctx.shadowColor = config.morphColor;
  ctx.shadowBlur = state.particleSystem.viewport.size * 0.012 * clamp(config.morphBreath, 0, 1);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 0; index < shape.points.length; index += 1) {
    const controls = bezierControls(shape.points, index, 0.92);
    const c1 = particleToCanvas(controls.c1);
    const c2 = particleToCanvas(controls.c2);
    const end = particleToCanvas(closedPoint(shape.points, index + 1));
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function morphStrokeDesiredPointCount(points) {
  const manual = Math.round(Number(config.morphStrokePointCount) || 0);
  if (manual > 0) return clamp(manual, 1, points.length);
  return clamp(Math.round(points.length * 0.28), 3, Math.min(18, points.length));
}

function morphCornerPointIndices(points, maxCount, exactCount = false) {
  if (points.length < 3) return points.map((_, index) => index);
  const desired = clamp(Math.round(maxCount), 1, points.length);
  const startIndex = morphCanonicalContourStartIndex(points);
  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = (startIndex + index) % points.length;
    const next = (startIndex + index + 1) % points.length;
    const length = distance(points[current], points[next]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return fillMorphVisualIndices([], points.length, desired);
  const indices = [];
  let segment = 0;
  let walked = 0;
  const phase = exactCount ? 0.5 : 0.35;
  for (let slot = 0; slot < desired; slot += 1) {
    const target = ((slot + phase) / desired) * total;
    while (segment < lengths.length - 1 && walked + lengths[segment] < target) {
      walked += lengths[segment];
      segment += 1;
    }
    const local = lengths[segment] <= 0 ? 0 : (target - walked) / lengths[segment];
    indices.push((startIndex + segment + (local > 0.5 ? 1 : 0)) % points.length);
  }
  return fillMorphVisualIndices([...new Set(indices)], points.length, desired);
}

function morphCanonicalContourStartIndex(points) {
  const center = morphCentroid(points);
  let bestIndex = 0;
  let bestScore = Infinity;
  points.forEach((point, index) => {
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const angleScore = Math.abs(angle + Math.PI / 2);
    const score = angleScore * 1000 + point.y * 0.01 + point.x * 0.0001;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function fillMorphVisualIndices(indices, pointCount, desired) {
  const selected = new Set(indices);
  const target = clamp(Math.round(desired), 1, pointCount);
  let cursor = 0;
  while (selected.size < target && cursor < pointCount * 3) {
    const index = Math.round((cursor / Math.max(1, target)) * pointCount) % pointCount;
    selected.add(index);
    cursor += 1;
  }
  return [...selected].slice(0, target);
}

function morphStrokeVisualPoints(points) {
  const manualCount = Math.round(Number(config.morphStrokePointCount) || 0);
  return morphSampleStrokeVisualPoints(points, morphStrokeDesiredPointCount(points), manualCount > 0);
}

function morphSampleStrokeVisualPoints(points, count, exactCount = false) {
  if (!points.length) return [];
  if (points.length < 3) return points.map((point, slotIndex) => ({ ...point, sourceIndex: slotIndex, slotIndex }));
  const desired = clamp(Math.round(count), 1, points.length);
  const startIndex = morphCanonicalContourStartIndex(points);
  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = (startIndex + index) % points.length;
    const next = (startIndex + index + 1) % points.length;
    const length = distance(points[current], points[next]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return points.slice(0, desired).map((point, slotIndex) => ({ ...point, sourceIndex: slotIndex, slotIndex }));
  const phase = exactCount ? 0.5 : 0.35;
  const candidateCount = clamp(Math.max(desired * 7, points.length * 2), desired, 240);
  const samples = [];
  let segment = 0;
  let walked = 0;
  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    const target = ((candidateIndex + phase) / candidateCount) * total;
    while (segment < lengths.length - 1 && walked + lengths[segment] < target) {
      walked += lengths[segment];
      segment += 1;
    }
    const current = (startIndex + segment) % points.length;
    const next = (startIndex + segment + 1) % points.length;
    const local = lengths[segment] <= 0 ? 0 : clamp((target - walked) / lengths[segment], 0, 1);
    samples.push({
      x: mixCellValue(points[current].x, points[next].x, local),
      y: mixCellValue(points[current].y, points[next].y, local),
      sourceIndex: current,
      slotIndex: candidateIndex,
      pathOrder: target / total,
    });
  }
  return morphDistributeStrokeVisualPoints(samples, desired);
}

function morphDistributeStrokeVisualPoints(candidates, desired) {
  if (candidates.length <= desired) return candidates.map((point, slotIndex) => ({ ...point, slotIndex }));
  const selected = [candidates[0]];
  const used = new Set([0]);
  while (selected.length < desired && used.size < candidates.length) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    candidates.forEach((candidate, index) => {
      if (used.has(index)) return;
      const nearest = selected.reduce((best, point) => Math.min(best, distance(candidate, point)), Infinity);
      const arcBalance = Math.min(...selected.map((point) => {
        const gap = Math.abs(candidate.pathOrder - point.pathOrder);
        return Math.min(gap, 1 - gap);
      }));
      const score = nearest + arcBalance * 2;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) break;
    used.add(bestIndex);
    selected.push(candidates[bestIndex]);
  }
  return selected
    .sort((a, b) => a.pathOrder - b.pathOrder)
    .map((point, slotIndex) => ({ ...point, slotIndex }));
}

function morphCanvasPoint(point) {
  return particleToCanvas(point);
}

function morphSampleSmoothCanvasPath(points, samplesPerSegment = 6) {
  if (!points.length) return [];
  if (points.length < 3) return points.map(morphCanvasPoint);
  const samples = [];
  const steps = Math.max(3, Math.round(samplesPerSegment));
  for (let index = 0; index < points.length; index += 1) {
    const start = closedPoint(points, index);
    const end = closedPoint(points, index + 1);
    const { c1, c2 } = bezierControls(points, index, 0.92);
    for (let step = 0; step < steps; step += 1) {
      const local = step / steps;
      samples.push(morphCanvasPoint(cubicPoint(start, c1, c2, end, local)));
    }
  }
  samples.push(morphCanvasPoint(points[0]));
  return samples;
}

function drawMorphProgressivePolyline(ctx, samples, progress) {
  if (samples.length < 2 || progress <= 0) return;
  const segmentLengths = [];
  let total = 0;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const length = Math.hypot(samples[index + 1].x - samples[index].x, samples[index + 1].y - samples[index].y);
    segmentLengths.push(length);
    total += length;
  }
  const target = total * clamp(progress, 0, 1);
  let walked = 0;
  ctx.beginPath();
  ctx.moveTo(samples[0].x, samples[0].y);
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const a = samples[index];
    const b = samples[index + 1];
    const length = segmentLengths[index];
    if (walked + length <= target) {
      ctx.lineTo(b.x, b.y);
      walked += length;
      continue;
    }
    const local = length <= 0 ? 0 : (target - walked) / length;
    ctx.lineTo(a.x + (b.x - a.x) * local, a.y + (b.y - a.y) * local);
    break;
  }
  ctx.stroke();
}

function morphLineToCanvasBounds(point, direction, width, height) {
  const dx = Math.abs(direction.x) < 0.00001 ? 0 : direction.x;
  const dy = Math.abs(direction.y) < 0.00001 ? 0 : direction.y;
  const candidates = [];
  if (dx) {
    candidates.push((0 - point.x) / dx, (width - point.x) / dx);
  }
  if (dy) {
    candidates.push((0 - point.y) / dy, (height - point.y) / dy);
  }
  const negative = candidates.filter((value) => value < 0).sort((a, b) => b - a)[0] ?? -width;
  const positive = candidates.filter((value) => value > 0).sort((a, b) => a - b)[0] ?? width;
  return {
    start: { x: point.x + dx * negative, y: point.y + dy * negative },
    end: { x: point.x + dx * positive, y: point.y + dy * positive },
  };
}

function drawMorphGuideSegment(ctx, anchor, target, color, alpha, progress, width) {
  const end = {
    x: anchor.x + (target.x - anchor.x) * clamp(progress, 0, 1),
    y: anchor.y + (target.y - anchor.y) * clamp(progress, 0, 1),
  };
  const gradient = ctx.createLinearGradient(anchor.x, anchor.y, end.x, end.y);
  gradient.addColorStop(0, colorToRgbaText(color, alpha));
  gradient.addColorStop(1, colorToRgbaText(color, 0));
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawMorphFadingGuideLine(ctx, point, direction, width, height, color, alpha, progress, lineWidth, lengthRatio = 1) {
  const bounds = morphLineToCanvasBounds(point, direction, width, height);
  const ratio = clamp(lengthRatio, 0.08, 1);
  const start = {
    x: point.x + (bounds.start.x - point.x) * ratio,
    y: point.y + (bounds.start.y - point.y) * ratio,
  };
  const end = {
    x: point.x + (bounds.end.x - point.x) * ratio,
    y: point.y + (bounds.end.y - point.y) * ratio,
  };
  drawMorphGuideSegment(ctx, point, start, color, alpha, progress, lineWidth);
  drawMorphGuideSegment(ctx, point, end, color, alpha, progress, lineWidth);
}

function morphStrokeGuideItems(visualPoints, seed) {
  if (!visualPoints.length) return [];
  const count = clamp(Math.round(visualPoints.length * 0.32), 1, Math.max(1, Math.ceil(visualPoints.length * 0.45)));
  const rng = seededRandom(`${seed}|guides|${visualPoints.length}|${config.morphStrokePointCount}`);
  return visualPoints
    .map((point, index) => ({
      point,
      index,
      score: rng(),
      axis: rng() < 0.42 ? "x" : (rng() < 0.72 ? "y" : "both"),
      lengthX: 0.16 + rng() * 0.72,
      lengthY: 0.16 + rng() * 0.72,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .sort((a, b) => a.index - b.index);
}

function morphNearestCirclePair(visualPoints, seed) {
  if (visualPoints.length < 3) return null;
  const rng = seededRandom(`${seed}|circle|${visualPoints.length}|stable-triple`);
  const count = visualPoints.length;
  const start = Math.floor(rng() * count);
  const maxOffset = Math.min(3, count - 1);
  let firstOffset = 1 + Math.floor(rng() * maxOffset);
  let secondOffset = 1 + Math.floor(rng() * maxOffset);
  if (firstOffset === secondOffset) secondOffset = (secondOffset % maxOffset) + 1;
  const firstGap = Math.min(firstOffset, secondOffset);
  const secondGap = Math.max(firstOffset, secondOffset);
  let a = start;
  let b = (start + firstGap) % count;
  let c = (start + secondGap) % count;
  if (a === b || b === c || a === c) {
    a = 0;
    b = Math.min(1, count - 1);
    c = Math.min(2, count - 1);
  }
  const circle = morphCircleThroughThreePoints(visualPoints[a], visualPoints[b], visualPoints[c]);
  if (!circle) return null;
  return {
    center: circle.center,
    radius: circle.radius,
    direction: rng() > 0.5 ? 1 : -1,
  };
}

function morphCircleThroughThreePoints(a, b, c) {
  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;
  const cx = c.x;
  const cy = c.y;
  const denom = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(denom) < 0.0000001) return null;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const center = {
    x: (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / denom,
    y: (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / denom,
  };
  const radius = distance(center, a);
  if (!Number.isFinite(radius)) return null;
  return { center, radius };
}

function drawMorphProgressiveCircle(ctx, circle, color, alpha, progress, lineWidth) {
  if (!circle || progress <= 0) return;
  const center = morphCanvasPoint(circle.center);
  const radius = circle.radius / 100 * state.particleSystem.viewport.size;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * clamp(progress, 0, 1) * circle.direction;
  ctx.save();
  ctx.strokeStyle = colorToRgbaText(color, alpha);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, startAngle, endAngle, circle.direction < 0);
  ctx.stroke();
  ctx.restore();
}

function morphColorSelfAlpha(color) {
  const parts = typeof parseColorValue === "function" ? parseColorValue(color) : null;
  return clamp(Number(parts?.a ?? 1), 0, 1);
}

function drawMorphStrokeShape(ctx, shape) {
  if (!shape.points.length) return;
  const viewport = state.particleSystem.viewport;
  const lineWidth = Math.max(0.6, Number(config.morphStrokeLineWidth) || 1) * Math.max(1, devicePixelRatio);
  const pointRadius = Math.max(0.45, Number(config.morphStrokePointSize) || 1) * Math.max(1, devicePixelRatio) * 1.8;
  const alpha = clamp((shape.alpha ?? 1) * config.morphOpacity, 0, 1);
  const pathProgress = clamp(shape.strokeProgress ?? 1, 0, 1);
  const guideProgress = clamp(shape.strokeGuideProgress ?? pathProgress, 0, 1);
  const visualPoints = shape.strokeVisualPoints?.length ? shape.strokeVisualPoints : morphStrokeVisualPoints(shape.points);
  const guidePoints = shape.strokeGuidePoints?.length ? shape.strokeGuidePoints : visualPoints;
  const canvasVisualPoints = visualPoints.map((point) => ({ ...morphCanvasPoint(point), sourceIndex: point.sourceIndex, slotIndex: point.slotIndex }));
  const guideItems = morphStrokeGuideItems(guidePoints, shape.strokeSeed || "morph-stroke");
  const guideColor = config.morphStrokeGuideColor || config.morphStrokeLineColor;
  const guideAlpha = alpha * 0.62 * morphColorSelfAlpha(guideColor);
  const lineAlpha = alpha * morphColorSelfAlpha(config.morphStrokeLineColor);
  const pointAlpha = alpha * morphColorSelfAlpha(config.morphStrokePointColor);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (guideAlpha > 0.001) {
    ctx.shadowColor = guideColor;
    ctx.shadowBlur = viewport.size * 0.004 * clamp(config.morphBreath, 0, 1);
    guideItems.forEach(({ point, axis, lengthX, lengthY }) => {
      const anchor = morphCanvasPoint(point);
      const guideWidth = Math.max(0.5, lineWidth * 0.42);
      if (axis === "x" || axis === "both") {
        drawMorphFadingGuideLine(ctx, anchor, { x: 1, y: 0 }, particleCanvas.width, particleCanvas.height, guideColor, guideAlpha, guideProgress, guideWidth, lengthX);
      }
      if (axis === "y" || axis === "both") {
        drawMorphFadingGuideLine(ctx, anchor, { x: 0, y: 1 }, particleCanvas.width, particleCanvas.height, guideColor, guideAlpha, guideProgress, guideWidth, lengthY);
      }
    });
    drawMorphProgressiveCircle(ctx, morphNearestCirclePair(guidePoints, shape.strokeSeed || "morph-stroke"), guideColor, guideAlpha, guideProgress, Math.max(0.5, lineWidth * 0.5));
  }
  if (lineAlpha > 0.001) {
    ctx.shadowColor = config.morphStrokeLineColor;
    ctx.shadowBlur = viewport.size * 0.004 * clamp(config.morphBreath, 0, 1);
    ctx.strokeStyle = colorToRgbaText(config.morphStrokeLineColor, lineAlpha);
    ctx.lineWidth = lineWidth;
    drawMorphProgressivePolyline(ctx, morphSampleSmoothCanvasPath(shape.points), pathProgress);
  }
  if (pointAlpha > 0.001) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = colorToRgbaText(config.morphStrokePointColor, pointAlpha);
    canvasVisualPoints.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

function generateMorphStandaloneHTML() {
  if (!state.morphSystem.targets.length) prepareMorphEffect();
  const frames = state.morphSystem.targets.map((frame) => frame.map((shape) => ({
    points: shape.points.map((point) => ({ x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) })),
    center: { x: Number(shape.center.x.toFixed(3)), y: Number(shape.center.y.toFixed(3)) },
    area: Number(shape.area.toFixed(3)),
    seed: Number(shape.seed.toFixed(5)),
    matchId: morphShapeMatchId(shape, shape.regionIndex ?? 0),
  })));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Morph Motion</title>
  <style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050507; overflow: hidden; }
canvas { width: min(82vmin, 720px); height: min(82vmin, 720px); display: block; }
  </style>
</head>
<body>
  <canvas id="stage" aria-hidden="true"></canvas>
  <script>
const frames = ${JSON.stringify(frames)};
const config = ${JSON.stringify({
  morphMotionMode: config.morphMotionMode,
  morphFrameIntervalMs: config.morphFrameIntervalMs,
  morphTransitionMs: config.morphTransitionMs,
  morphShapeDetail: morphShapePointCount(),
  morphBreath: config.morphBreath,
  morphRotationDeg: config.morphRotationDeg,
  morphFusionRotationDeg: config.morphFusionRotationDeg,
  morphColor: config.morphColor,
  morphOpacity: config.morphOpacity,
  morphRenderMode: config.morphRenderMode,
  morphStrokePointCount: config.morphStrokePointCount,
  morphStrokeLineColor: config.morphStrokeLineColor,
  morphStrokePointColor: config.morphStrokePointColor,
  morphStrokeGuideColor: config.morphStrokeGuideColor,
  morphStrokePointSize: config.morphStrokePointSize,
  morphStrokeLineWidth: config.morphStrokeLineWidth,
})};
const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
let viewport = { x: 0, y: 0, size: 1, width: 1, height: 1 };
const startedAt = performance.now();
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function seededRandom(seed) {
  let hash = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6D2B79F5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function organicEase(value) {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function mixValue(from, to, progress) {
  return from + (to - from) * progress;
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function centroid(points) {
  if (!points.length) return { x: 50, y: 50 };
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
function naturalEase(value) {
  const t = organicEase(value);
  const breath = clamp(config.morphBreath, 0, 1);
  const inhale = Math.sin(t * Math.PI);
  return clamp(t + inhale * (0.035 + breath * 0.035) * (0.5 - t), 0, 1);
}
function gravityPull(progress, breath) {
  const p = clamp(progress, 0, 1);
  const window = Math.sin(Math.PI * p) ** 2;
  const lateBias = p - 0.38;
  return lateBias * window * (16 + breath * 10);
}
function orbitTransform(a, b, progress, breath, side) {
  const center = { x: 50, y: 50 };
  const base = {
    x: mixValue(a.center.x, b.center.x, progress),
    y: mixValue(a.center.y, b.center.y, progress),
  };
  const sx = a.center.x - center.x;
  const sy = a.center.y - center.y;
  const ex = b.center.x - center.x;
  const ey = b.center.y - center.y;
  const startRadius = Math.max(0.001, Math.hypot(sx, sy));
  const endRadius = Math.max(0.001, Math.hypot(ex, ey));
  const startAngle = Math.atan2(sy, sx);
  const endAngle = Math.atan2(ey, ex);
  let deltaAngle = endAngle - startAngle;
  while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
  while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
  const crossDirection = Math.sign(sx * ey - sy * ex);
  const direction = crossDirection || side || 1;
  const arcWindow = 4 * progress * (1 - progress);
  const angle = startAngle + deltaAngle * progress;
  const radius = mixValue(startRadius, endRadius, progress) + Math.min(14, Math.max(3.5, Math.abs(deltaAngle) * 6.5 + Math.abs(endRadius - startRadius) * 0.32)) * arcWindow * (0.62 + breath * 0.42);
  const tangent = { x: -Math.sin(angle) * direction, y: Math.cos(angle) * direction };
  const inertia = gravityPull(progress, breath);
  const orbit = {
    x: center.x + Math.cos(angle) * radius + tangent.x * inertia,
    y: center.y + Math.sin(angle) * radius + tangent.y * inertia,
  };
  const spinBase = Math.max(0.28, Math.min(1.35, Math.abs(deltaAngle) * 0.58 + 0.22 + breath * 0.42));
  const spin = direction * spinBase * Math.sin(Math.PI * progress);
  return {
    x: orbit.x - base.x,
    y: orbit.y - base.y,
    rotation: spin,
  };
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const size = Math.min(width, height) * 0.72;
  viewport = { x: (width - size) / 2, y: (height - size) / 2, size, width, height };
}
function toCanvas(point) {
  return { x: viewport.x + point.x / 100 * viewport.size, y: viewport.y + point.y / 100 * viewport.size };
}
function frameMix(now) {
  const interval = Math.max(400, config.morphFrameIntervalMs);
  const transition = Math.min(Math.max(120, config.morphTransitionMs), interval);
  const hold = Math.max(0, interval - transition);
  const elapsed = now - startedAt;
  const cycle = Math.max(1, frames.length) * interval;
  const segment = Math.max(0, Math.floor(Math.max(0, elapsed) / interval));
  const local = ((elapsed % cycle) + cycle) % cycle;
  const index = Math.min(frames.length - 1, Math.floor(local / interval));
  const frameLocal = local % interval;
  const raw = frameLocal < hold ? 0 : clamp((frameLocal - hold) / transition, 0, 1);
  return { current: frames[index] || [], next: frames[(index + 1) % frames.length] || frames[index] || [], raw, progress: naturalEase(raw), index, segment, active: raw > 0 && raw < 1 };
}
function shapeProgress(raw, index, segmentIndex) {
  const p = clamp(raw, 0, 1);
  if (p <= 0 || p >= 1) return p;
  const breath = clamp(config.morphBreath, 0, 1);
  const rng = seededRandom("morph-shape-progress|" + segmentIndex + "|" + index);
  const delay = rng() * 0.14 * breath;
  const duration = Math.max(0.62, 1 - delay * 0.55);
  const shifted = clamp((p - delay) / duration, 0, 1);
  const wave = Math.sin(shifted * Math.PI * 2 + index * 0.73 + segmentIndex) * 0.025 * breath * Math.sin(shifted * Math.PI);
  return clamp(naturalEase(shifted) + wave, 0, 1);
}
function shapeCount(current, next) {
  return Math.max(1, current.length, next.length);
}
function transitionPairs(current, next) {
  const currentGroups = regionGroups(current);
  const nextGroups = regionGroups(next);
  const labels = [...new Set([...currentGroups.keys(), ...nextGroups.keys()])].sort((a, b) => a - b);
  if (!labels.length) {
    const count = shapeCount(current, next);
    return Array.from({ length: count }, (_, index) => ({
      currentIndex: index < current.length ? index : null,
      nextIndex: index < next.length ? index : null,
      matchId: index + 1,
    }));
  }
  const pairs = [];
  labels.forEach((label) => {
    const currentItems = currentGroups.get(label) || [];
    const nextItems = nextGroups.get(label) || [];
    const count = Math.max(currentItems.length, nextItems.length);
    for (let index = 0; index < count; index += 1) {
      pairs.push({
        currentIndex: currentItems[index]?.index ?? null,
        nextIndex: nextItems[index]?.index ?? null,
        matchId: label,
      });
    }
  });
  return pairs;
}
function regionGroups(frame) {
  const groups = new Map();
  frame.forEach((shape, index) => {
    const label = shapeMatchId(shape, index);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push({ shape, index });
  });
  return groups;
}
function shapeMatchId(shape, fallbackIndex) {
  const value = Math.round(Number(shape?.matchId));
  return Number.isFinite(value) && value > 0 ? value : fallbackIndex + 1;
}
function shapeAt(frame, index, counterpart = null) {
  if (!frame.length) return fallbackShape();
  if (frame[index]) return frame[index];
  const source = nearestSource(frame, counterpart?.center) || frame[index % frame.length];
  const basis = counterpart || source;
  const attach = nearestPoint(source.points, basis.center);
  const splitScale = 0.018;
  return {
    ...basis,
    points: basis.points.map((point) => ({ x: attach.x + (point.x - basis.center.x) * splitScale, y: attach.y + (point.y - basis.center.y) * splitScale })),
    center: attach,
    area: 0,
    phantom: true,
  };
}
function nearestSource(frame, center) {
  if (!frame.length || !center) return null;
  return frame.map((shape) => ({ shape, score: distance(shape.center, center) })).sort((a, b) => a.score - b.score)[0]?.shape || null;
}
function nearestPoint(points, target) {
  if (!points.length || !target) return { x: 50, y: 50 };
  return points.map((point) => ({ point, score: distance(point, target) })).sort((a, b) => a.score - b.score)[0].point;
}
function fallbackShape() {
  const points = Array.from({ length: Math.max(16, config.morphShapeDetail || 48) }, (_, index) => {
    const t = index / Math.max(16, config.morphShapeDetail || 48) * Math.PI * 2;
    return { x: 50 + Math.cos(t) * 12, y: 50 + Math.sin(t) * 12 };
  });
  return { points, center: { x: 50, y: 50 }, area: 452, seed: 0 };
}
function alignPoints(from, to) {
  if (from.length !== to.length || from.length < 2) return to;
  let bestShift = 0;
  let bestScore = Infinity;
  for (let shift = 0; shift < to.length; shift += 1) {
    let score = 0;
    for (let index = 0; index < from.length; index += 1) {
      score += distance(from[index], to[(index + shift) % to.length]);
    }
    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }
  return to.slice(bestShift).concat(to.slice(0, bestShift));
}
function interpolatedShape(a, b, index, mix, now) {
  const progress = shapeProgress(mix.raw, index, mix.index);
  const settled = organicEase(progress);
  const t = settled;
  const alignedB = alignPoints(a.points, b.points);
  const breath = clamp(config.morphBreath, 0, 1);
  const side = seededRandom("morph-shape-arc|" + mix.index + "|" + index)() > 0.5 ? 1 : -1;
  const orbit = orbitTransform(a, b, settled, breath, side);
  const transitionRotation = transitionRotationAngle(settled);
  const displaySeed = stableShapeSeed(mix.raw > 0 ? b : a, index);
  const floatPhase = now * 0.0011 + displaySeed * 17.13;
  const idleX = Math.sin(floatPhase) * breath * 0.28;
  const idleY = Math.cos(floatPhase * 0.91) * breath * 0.28;
  const pulse = 1 + Math.sin(now * 0.0017 + displaySeed * 11.7) * 0.018 * breath + Math.sin(Math.PI * settled) * 0.045 * breath;
  const rotation = 0;
  const mergePull = (a.phantom || b.phantom) ? Math.sin(Math.PI * settled) * (0.22 + breath * 0.18) : 0;
  const points = a.points.map((point, pointIndex) => {
    const target = alignedB[pointIndex] || point;
    const sourcePoint = rotatePointAround(point, a.center, transitionRotation.from);
    const targetPoint = rotatePointAround(target, b.center, transitionRotation.to);
    const localWave = Math.sin((pointIndex / Math.max(1, a.points.length)) * Math.PI * 2 + now * 0.0012 + index) * 0.25 * breath * Math.sin(Math.PI * settled);
    const x = mixValue(sourcePoint.x, targetPoint.x, t);
    const y = mixValue(sourcePoint.y, targetPoint.y, t);
    const pullCenter = b.phantom ? b.center : a.phantom ? a.center : null;
    return {
      x: mixValue(x, pullCenter?.x ?? x, mergePull) + orbit.x + idleX + localWave,
      y: mixValue(y, pullCenter?.y ?? y, mergePull) + orbit.y + idleY + localWave * 0.35,
    };
  });
  const center = centroid(points);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const transformedPoints = points.map((point) => {
    const dx = (point.x - center.x) * pulse;
    const dy = (point.y - center.y) * pulse;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
  const visualPoints = strokeVisualPoints(transformedPoints);
  return {
    points: transformedPoints,
    strokeVisualPoints: visualPoints,
    strokeGuidePoints: visualPoints,
    strokeProgress: mix.active ? guideDrawProgress(mix.raw) : 1,
    strokeGuideProgress: mix.active ? guideDrawProgress(mix.raw) : 1,
    strokeSeed: shapeStrokeSeed(mix.raw > 0 ? b : a, index),
    alpha: a.phantom && b.phantom ? 0 : 0.95,
  };
}
function stableShapeSeed(shape, fallbackIndex) {
  const seed = Number(shape?.seed);
  if (Number.isFinite(seed)) return seed;
  const center = shape?.center || { x: 0, y: 0 };
  return (fallbackIndex + 1) * 0.137 + center.x * 0.001 + center.y * 0.0001;
}
function shapeStrokeSeed(shape, fallbackIndex) {
  const seed = Number(shape?.seed);
  if (Number.isFinite(seed)) return "morph-stroke-shape|" + seed.toFixed(5);
  const center = shape?.center || { x: 0, y: 0 };
  return "morph-stroke-shape|" + fallbackIndex + "|" + center.x.toFixed(2) + "|" + center.y.toFixed(2);
}
function transitionRotationAngle(progress) {
  const angle = (Number(config.morphRotationDeg ?? config.morphStrokeRotationDeg) || 0) * Math.PI / 180;
  const p = clamp(progress, 0, 1);
  return {
    from: angle * p,
    to: angle * (p - 1),
  };
}
function rotatePointAround(point, center, angle) {
  if (!angle) return point;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}
function guideDrawProgress(raw) {
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return naturalEase(raw);
}
function closedPoint(points, index) {
  return points[(index + points.length) % points.length];
}
function bezierControls(points, index, smoothing = 0.92) {
  const p0 = closedPoint(points, index - 1);
  const p1 = closedPoint(points, index);
  const p2 = closedPoint(points, index + 1);
  const p3 = closedPoint(points, index + 2);
  const scale = smoothing / 6;
  return {
    c1: { x: p1.x + (p2.x - p0.x) * scale, y: p1.y + (p2.y - p0.y) * scale },
    c2: { x: p2.x - (p3.x - p1.x) * scale, y: p2.y - (p3.y - p1.y) * scale },
  };
}
let fusionCanvases = null;
function ensureFusionCanvases(width, height) {
  const scale = Math.min(1, 720 / Math.max(width, height));
  const fieldWidth = Math.max(1, Math.round(width * scale));
  const fieldHeight = Math.max(1, Math.round(height * scale));
  if (fusionCanvases && fusionCanvases.width === width && fusionCanvases.height === height && fusionCanvases.fieldWidth === fieldWidth && fusionCanvases.fieldHeight === fieldHeight) return fusionCanvases;
  const makeCanvas = () => {
    const node = document.createElement("canvas");
    node.width = fieldWidth;
    node.height = fieldHeight;
    return node;
  };
  const from = makeCanvas();
  const to = makeCanvas();
  const output = makeCanvas();
  fusionCanvases = {
    width,
    height,
    fieldWidth,
    fieldHeight,
    scale,
    output,
    fromCtx: from.getContext("2d"),
    toCtx: to.getContext("2d"),
    outputCtx: output.getContext("2d"),
  };
  return fusionCanvases;
}
function colorParts(color) {
  const text = String(color || "").trim();
  const hex = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) raw = raw.split("").map((item) => item + item).join("");
    return { r: parseInt(raw.slice(0, 2), 16), g: parseInt(raw.slice(2, 4), 16), b: parseInt(raw.slice(4, 6), 16), a: 1 };
  }
  const rgb = text.match(/^rgba?\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)(?:\s*,\s*([+-]?\d*\.?\d+))?/i);
  if (rgb) return { r: clamp(Math.round(Number(rgb[1])), 0, 255), g: clamp(Math.round(Number(rgb[2])), 0, 255), b: clamp(Math.round(Number(rgb[3])), 0, 255), a: rgb[4] == null ? 1 : clamp(Number(rgb[4]), 0, 1) };
  return { r: 246, g: 247, b: 241, a: 1 };
}
function rotatedCanvasPoint(point, center, angle) {
  const canvasPoint = toCanvas(point);
  if (!angle) return canvasPoint;
  const canvasCenter = toCanvas(center);
  const dx = canvasPoint.x - canvasCenter.x;
  const dy = canvasPoint.y - canvasCenter.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: canvasCenter.x + dx * cos - dy * sin, y: canvasCenter.y + dx * sin + dy * cos };
}
function drawFusionPath(targetCtx, shape, rotation, rotationCenter) {
  if (!shape.points.length) return;
  const first = rotatedCanvasPoint(shape.points[0], rotationCenter, rotation);
  targetCtx.beginPath();
  targetCtx.moveTo(first.x, first.y);
  for (let index = 0; index < shape.points.length; index += 1) {
    const controls = bezierControls(shape.points, index, 0.92);
    const c1 = rotatedCanvasPoint(controls.c1, rotationCenter, rotation);
    const c2 = rotatedCanvasPoint(controls.c2, rotationCenter, rotation);
    const end = rotatedCanvasPoint(closedPoint(shape.points, index + 1), rotationCenter, rotation);
    targetCtx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  }
  targetCtx.closePath();
  targetCtx.fill();
}
function drawFusionField(fieldCtx, width, height, scale, shapes, rotation, blurPx) {
  fieldCtx.setTransform(1, 0, 0, 1, 0, 0);
  fieldCtx.clearRect(0, 0, width, height);
  fieldCtx.save();
  fieldCtx.setTransform(scale, 0, 0, scale, 0, 0);
  fieldCtx.filter = "blur(" + Math.max(0, blurPx * scale).toFixed(2) + "px)";
  fieldCtx.fillStyle = "#ffffff";
  const rotationCenter = { x: 50, y: 50 };
  shapes.forEach((shape) => drawFusionPath(fieldCtx, shape, rotation, rotationCenter));
  fieldCtx.restore();
  fieldCtx.filter = "none";
}
function renderFusion(mix) {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) return;
  const buffers = ensureFusionCanvases(width, height);
  const breath = clamp(config.morphBreath, 0, 1);
  const eased = mix.progress;
  const active = mix.raw > 0 && mix.raw < 1;
  const spin = (Number(config.morphFusionRotationDeg) || 0) * Math.PI / 180;
  const fromRotation = active ? -spin * eased : 0;
  const toRotation = active ? spin * (1 - eased) : 0;
  const blurPx = viewport.size * (0.018 + breath * 0.022);
  const holdKey = !active && eased <= 0.001 ? "hold|" + mix.index + "|" + width + "x" + height + "|" + buffers.fieldWidth + "x" + buffers.fieldHeight + "|" + config.morphColor + "|" + config.morphOpacity + "|" + config.morphBreath + "|" + mix.current.length : "";
  if (holdKey && buffers.cacheKey === holdKey) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffers.output, 0, 0, width, height);
    ctx.restore();
    return;
  }
  drawFusionField(buffers.fromCtx, buffers.fieldWidth, buffers.fieldHeight, buffers.scale, mix.current, fromRotation, blurPx);
  const fromData = buffers.fromCtx.getImageData(0, 0, buffers.fieldWidth, buffers.fieldHeight).data;
  const shouldDrawNext = active || eased >= 0.999;
  let toData = null;
  if (shouldDrawNext) {
    drawFusionField(buffers.toCtx, buffers.fieldWidth, buffers.fieldHeight, buffers.scale, mix.next, toRotation, blurPx);
    toData = buffers.toCtx.getImageData(0, 0, buffers.fieldWidth, buffers.fieldHeight).data;
  }
  const output = buffers.outputCtx.createImageData(buffers.fieldWidth, buffers.fieldHeight);
  const out = output.data;
  const color = colorParts(config.morphColor);
  const mergeBoost = active ? Math.sin(Math.PI * eased) * (0.12 + breath * 0.2) : 0;
  const fromWeight = eased >= 0.999 ? 0 : clamp(1 - eased + mergeBoost, 0, 1);
  const toWeight = eased >= 0.999 ? 1 : (active ? clamp(eased + mergeBoost, 0, 1) : 0);
  const threshold = 127;
  const alpha = Math.round(255 * clamp(config.morphOpacity * color.a, 0, 1));
  const edgeFeather = 5;
  for (let index = 0; index < out.length; index += 4) {
    const field = fromData[index + 3] * fromWeight + (toData ? toData[index + 3] * toWeight : 0);
    const coverage = clamp((field - (threshold - edgeFeather)) / (edgeFeather * 2), 0, 1);
    if (coverage > 0) {
      const smoothCoverage = coverage * coverage * (3 - 2 * coverage);
      out[index] = color.r;
      out[index + 1] = color.g;
      out[index + 2] = color.b;
      out[index + 3] = Math.round(alpha * smoothCoverage);
    }
  }
  buffers.outputCtx.putImageData(output, 0, 0);
  buffers.cacheKey = holdKey;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buffers.output, 0, 0, width, height);
  ctx.restore();
}
function colorToRgba(color, alpha) {
  const parts = colorParts(color);
  const opacity = clamp(alpha == null ? parts.a : alpha, 0, 1);
  return "rgba(" + parts.r + ", " + parts.g + ", " + parts.b + ", " + Number(opacity.toFixed(3)) + ")";
}
function colorSelfAlpha(color) {
  return clamp(Number(colorParts(color).a || 0), 0, 1);
}
function strokeDesiredPointCount(points) {
  const manual = Math.round(Number(config.morphStrokePointCount) || 0);
  if (manual > 0) return clamp(manual, 1, points.length);
  return clamp(Math.round(points.length * 0.28), 3, Math.min(18, points.length));
}
function cornerPointIndices(points, maxCount, exactCount = false) {
  if (points.length < 3) return points.map((_, index) => index);
  const desired = clamp(Math.round(maxCount), 1, points.length);
  const startIndex = canonicalContourStartIndex(points);
  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = (startIndex + index) % points.length;
    const next = (startIndex + index + 1) % points.length;
    const length = distance(points[current], points[next]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return fillVisualIndices([], points.length, desired);
  const indices = [];
  let segment = 0;
  let walked = 0;
  const phase = exactCount ? 0.5 : 0.35;
  for (let slot = 0; slot < desired; slot += 1) {
    const target = ((slot + phase) / desired) * total;
    while (segment < lengths.length - 1 && walked + lengths[segment] < target) {
      walked += lengths[segment];
      segment += 1;
    }
    const local = lengths[segment] <= 0 ? 0 : (target - walked) / lengths[segment];
    indices.push((startIndex + segment + (local > 0.5 ? 1 : 0)) % points.length);
  }
  return fillVisualIndices([...new Set(indices)], points.length, desired);
}
function canonicalContourStartIndex(points) {
  const center = centroid(points);
  let bestIndex = 0;
  let bestScore = Infinity;
  points.forEach((point, index) => {
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const angleScore = Math.abs(angle + Math.PI / 2);
    const score = angleScore * 1000 + point.y * 0.01 + point.x * 0.0001;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}
function fillVisualIndices(indices, pointCount, desired) {
  const selected = new Set(indices);
  const target = clamp(Math.round(desired), 1, pointCount);
  let cursor = 0;
  while (selected.size < target && cursor < pointCount * 3) {
    selected.add(Math.round((cursor / Math.max(1, target)) * pointCount) % pointCount);
    cursor += 1;
  }
  return [...selected].slice(0, target);
}
function strokeVisualPoints(points) {
  const manualCount = Math.round(Number(config.morphStrokePointCount) || 0);
  return sampleStrokeVisualPoints(points, strokeDesiredPointCount(points), manualCount > 0);
}
function sampleStrokeVisualPoints(points, count, exactCount = false) {
  if (!points.length) return [];
  if (points.length < 3) return points.map((point, slotIndex) => ({ ...point, sourceIndex: slotIndex, slotIndex }));
  const desired = clamp(Math.round(count), 1, points.length);
  const startIndex = canonicalContourStartIndex(points);
  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = (startIndex + index) % points.length;
    const next = (startIndex + index + 1) % points.length;
    const length = distance(points[current], points[next]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return points.slice(0, desired).map((point, slotIndex) => ({ ...point, sourceIndex: slotIndex, slotIndex }));
  const phase = exactCount ? 0.5 : 0.35;
  const candidateCount = clamp(Math.max(desired * 7, points.length * 2), desired, 240);
  const samples = [];
  let segment = 0;
  let walked = 0;
  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    const target = ((candidateIndex + phase) / candidateCount) * total;
    while (segment < lengths.length - 1 && walked + lengths[segment] < target) {
      walked += lengths[segment];
      segment += 1;
    }
    const current = (startIndex + segment) % points.length;
    const next = (startIndex + segment + 1) % points.length;
    const local = lengths[segment] <= 0 ? 0 : clamp((target - walked) / lengths[segment], 0, 1);
    samples.push({
      x: mixValue(points[current].x, points[next].x, local),
      y: mixValue(points[current].y, points[next].y, local),
      sourceIndex: current,
      slotIndex: candidateIndex,
      pathOrder: target / total,
    });
  }
  return distributeStrokeVisualPoints(samples, desired);
}

function distributeStrokeVisualPoints(candidates, desired) {
  if (candidates.length <= desired) return candidates.map((point, slotIndex) => ({ ...point, slotIndex }));
  const selected = [candidates[0]];
  const used = new Set([0]);
  while (selected.length < desired && used.size < candidates.length) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    candidates.forEach((candidate, index) => {
      if (used.has(index)) return;
      const nearest = selected.reduce((best, point) => Math.min(best, distance(candidate, point)), Infinity);
      const arcBalance = Math.min(...selected.map((point) => {
        const gap = Math.abs(candidate.pathOrder - point.pathOrder);
        return Math.min(gap, 1 - gap);
      }));
      const score = nearest + arcBalance * 2;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) break;
    used.add(bestIndex);
    selected.push(candidates[bestIndex]);
  }
  return selected
    .sort((a, b) => a.pathOrder - b.pathOrder)
    .map((point, slotIndex) => ({ ...point, slotIndex }));
}
function cubicPoint(p0, c1, c2, p1, t) {
  const inv = 1 - t;
  const inv2 = inv * inv;
  const t2 = t * t;
  return {
    x: inv2 * inv * p0.x + 3 * inv2 * t * c1.x + 3 * inv * t2 * c2.x + t2 * t * p1.x,
    y: inv2 * inv * p0.y + 3 * inv2 * t * c1.y + 3 * inv * t2 * c2.y + t2 * t * p1.y,
  };
}
function sampleSmoothCanvasPath(points, samplesPerSegment = 6) {
  if (!points.length) return [];
  if (points.length < 3) return points.map(toCanvas);
  const samples = [];
  const steps = Math.max(3, Math.round(samplesPerSegment));
  for (let index = 0; index < points.length; index += 1) {
    const start = closedPoint(points, index);
    const end = closedPoint(points, index + 1);
    const controls = bezierControls(points, index);
    for (let step = 0; step < steps; step += 1) {
      samples.push(toCanvas(cubicPoint(start, controls.c1, controls.c2, end, step / steps)));
    }
  }
  samples.push(toCanvas(points[0]));
  return samples;
}
function drawProgressivePolyline(samples, progress) {
  if (samples.length < 2 || progress <= 0) return;
  const lengths = [];
  let total = 0;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const length = Math.hypot(samples[index + 1].x - samples[index].x, samples[index + 1].y - samples[index].y);
    lengths.push(length);
    total += length;
  }
  const target = total * clamp(progress, 0, 1);
  let walked = 0;
  ctx.beginPath();
  ctx.moveTo(samples[0].x, samples[0].y);
  for (let index = 0; index < lengths.length; index += 1) {
    const a = samples[index];
    const b = samples[index + 1];
    const length = lengths[index];
    if (walked + length <= target) {
      ctx.lineTo(b.x, b.y);
      walked += length;
      continue;
    }
    const local = length <= 0 ? 0 : (target - walked) / length;
    ctx.lineTo(a.x + (b.x - a.x) * local, a.y + (b.y - a.y) * local);
    break;
  }
  ctx.stroke();
}
function lineToCanvasBounds(point, direction, width, height) {
  const dx = Math.abs(direction.x) < 0.00001 ? 0 : direction.x;
  const dy = Math.abs(direction.y) < 0.00001 ? 0 : direction.y;
  const candidates = [];
  if (dx) candidates.push((0 - point.x) / dx, (width - point.x) / dx);
  if (dy) candidates.push((0 - point.y) / dy, (height - point.y) / dy);
  const negative = candidates.filter((value) => value < 0).sort((a, b) => b - a)[0] || -width;
  const positive = candidates.filter((value) => value > 0).sort((a, b) => a - b)[0] || width;
  return {
    start: { x: point.x + dx * negative, y: point.y + dy * negative },
    end: { x: point.x + dx * positive, y: point.y + dy * positive },
  };
}
function drawGuideSegment(anchor, target, color, alpha, progress, width) {
  const end = { x: anchor.x + (target.x - anchor.x) * clamp(progress, 0, 1), y: anchor.y + (target.y - anchor.y) * clamp(progress, 0, 1) };
  const gradient = ctx.createLinearGradient(anchor.x, anchor.y, end.x, end.y);
  gradient.addColorStop(0, colorToRgba(color, alpha));
  gradient.addColorStop(1, colorToRgba(color, 0));
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}
function drawFadingGuideLine(point, direction, color, alpha, progress, lineWidth, lengthRatio = 1) {
  const bounds = lineToCanvasBounds(point, direction, canvas.width, canvas.height);
  const ratio = clamp(lengthRatio, 0.08, 1);
  const start = {
    x: point.x + (bounds.start.x - point.x) * ratio,
    y: point.y + (bounds.start.y - point.y) * ratio,
  };
  const end = {
    x: point.x + (bounds.end.x - point.x) * ratio,
    y: point.y + (bounds.end.y - point.y) * ratio,
  };
  drawGuideSegment(point, start, color, alpha, progress, lineWidth);
  drawGuideSegment(point, end, color, alpha, progress, lineWidth);
}
function strokeGuideItems(visualPoints, seed) {
  if (!visualPoints.length) return [];
  const count = clamp(Math.round(visualPoints.length * 0.32), 1, Math.max(1, Math.ceil(visualPoints.length * 0.45)));
  const rng = seededRandom(seed + "|guides|" + visualPoints.length + "|" + config.morphStrokePointCount);
  return visualPoints.map((point, index) => ({
    point,
    index,
    score: rng(),
    axis: rng() < 0.42 ? "x" : (rng() < 0.72 ? "y" : "both"),
    lengthX: 0.16 + rng() * 0.72,
    lengthY: 0.16 + rng() * 0.72,
  })).sort((a, b) => a.score - b.score).slice(0, count).sort((a, b) => a.index - b.index);
}
function nearestCirclePair(visualPoints, seed) {
  if (visualPoints.length < 3) return null;
  const rng = seededRandom(seed + "|circle|" + visualPoints.length + "|stable-triple");
  const count = visualPoints.length;
  const start = Math.floor(rng() * count);
  const maxOffset = Math.min(3, count - 1);
  let firstOffset = 1 + Math.floor(rng() * maxOffset);
  let secondOffset = 1 + Math.floor(rng() * maxOffset);
  if (firstOffset === secondOffset) secondOffset = (secondOffset % maxOffset) + 1;
  const firstGap = Math.min(firstOffset, secondOffset);
  const secondGap = Math.max(firstOffset, secondOffset);
  let a = start;
  let b = (start + firstGap) % count;
  let c = (start + secondGap) % count;
  if (a === b || b === c || a === c) {
    a = 0;
    b = Math.min(1, count - 1);
    c = Math.min(2, count - 1);
  }
  const circle = circleThroughThreePoints(visualPoints[a], visualPoints[b], visualPoints[c]);
  if (!circle) return null;
  return {
    center: circle.center,
    radius: circle.radius,
    direction: rng() > 0.5 ? 1 : -1,
  };
}
function circleThroughThreePoints(a, b, c) {
  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;
  const cx = c.x;
  const cy = c.y;
  const denom = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(denom) < 0.0000001) return null;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const center = {
    x: (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / denom,
    y: (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / denom,
  };
  const radius = distance(center, a);
  if (!Number.isFinite(radius)) return null;
  return { center, radius };
}
function drawProgressiveCircle(circle, color, alpha, progress, lineWidth) {
  if (!circle || progress <= 0) return;
  const center = toCanvas(circle.center);
  const radius = circle.radius / 100 * viewport.size;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * clamp(progress, 0, 1) * circle.direction;
  ctx.save();
  ctx.strokeStyle = colorToRgba(color, alpha);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, startAngle, endAngle, circle.direction < 0);
  ctx.stroke();
  ctx.restore();
}
function drawStrokeShape(shape) {
  if (!shape.points.length) return;
  const alpha = clamp((shape.alpha == null ? 1 : shape.alpha) * config.morphOpacity, 0, 1);
  const lineWidth = Math.max(0.6, Number(config.morphStrokeLineWidth) || 1) * (window.devicePixelRatio || 1);
  const pointRadius = Math.max(0.45, Number(config.morphStrokePointSize) || 1) * (window.devicePixelRatio || 1) * 1.8;
  const pathProgress = clamp(shape.strokeProgress == null ? 1 : shape.strokeProgress, 0, 1);
  const guideProgress = clamp(shape.strokeGuideProgress == null ? pathProgress : shape.strokeGuideProgress, 0, 1);
  const visualPoints = shape.strokeVisualPoints && shape.strokeVisualPoints.length ? shape.strokeVisualPoints : strokeVisualPoints(shape.points);
  const guidePoints = shape.strokeGuidePoints && shape.strokeGuidePoints.length ? shape.strokeGuidePoints : visualPoints;
  const guideColor = config.morphStrokeGuideColor || config.morphStrokeLineColor;
  const guideAlpha = alpha * 0.62 * colorSelfAlpha(guideColor);
  const lineAlpha = alpha * colorSelfAlpha(config.morphStrokeLineColor);
  const pointAlpha = alpha * colorSelfAlpha(config.morphStrokePointColor);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (guideAlpha > 0.001) {
    ctx.shadowColor = guideColor;
    ctx.shadowBlur = viewport.size * 0.004 * clamp(config.morphBreath, 0, 1);
    strokeGuideItems(guidePoints, shape.strokeSeed || "morph-stroke").forEach(({ point, axis, lengthX, lengthY }) => {
      const anchor = toCanvas(point);
      const guideWidth = Math.max(0.5, lineWidth * 0.42);
      if (axis === "x" || axis === "both") {
        drawFadingGuideLine(anchor, { x: 1, y: 0 }, guideColor, guideAlpha, guideProgress, guideWidth, lengthX);
      }
      if (axis === "y" || axis === "both") {
        drawFadingGuideLine(anchor, { x: 0, y: 1 }, guideColor, guideAlpha, guideProgress, guideWidth, lengthY);
      }
    });
    drawProgressiveCircle(nearestCirclePair(guidePoints, shape.strokeSeed || "morph-stroke"), guideColor, guideAlpha, guideProgress, Math.max(0.5, lineWidth * 0.5));
  }
  if (lineAlpha > 0.001) {
    ctx.shadowColor = config.morphStrokeLineColor;
    ctx.shadowBlur = viewport.size * 0.004 * clamp(config.morphBreath, 0, 1);
    ctx.strokeStyle = colorToRgba(config.morphStrokeLineColor, lineAlpha);
    ctx.lineWidth = lineWidth;
    drawProgressivePolyline(sampleSmoothCanvasPath(shape.points), pathProgress);
  }
  if (pointAlpha > 0.001) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = colorToRgba(config.morphStrokePointColor, pointAlpha);
    visualPoints.map(toCanvas).forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}
function drawShape(shape) {
  if (config.morphMotionMode === "morph" && config.morphRenderMode === "stroke") {
    drawStrokeShape(shape);
    return;
  }
  drawFilledShape(shape);
}
function drawFilledShape(shape) {
  if (!shape.points.length) return;
  const first = toCanvas(shape.points[0]);
  ctx.save();
  ctx.globalAlpha = clamp((shape.alpha == null ? 1 : shape.alpha) * config.morphOpacity, 0, 1);
  ctx.fillStyle = config.morphColor;
  ctx.shadowColor = config.morphColor;
  ctx.shadowBlur = viewport.size * 0.012 * clamp(config.morphBreath, 0, 1);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 0; index < shape.points.length; index += 1) {
    const controls = bezierControls(shape.points, index);
    const c1 = toCanvas(controls.c1);
    const c2 = toCanvas(controls.c2);
    const end = toCanvas(closedPoint(shape.points, index + 1));
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}
function tick(now) {
  resize();
  const mix = frameMix(now);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (config.morphMotionMode === "fusion") {
    renderFusion(mix);
    requestAnimationFrame(tick);
    return;
  }
  const pairs = transitionPairs(mix.current, mix.next);
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    const currentShape = pair.currentIndex == null ? null : mix.current[pair.currentIndex] || null;
    const nextShape = pair.nextIndex == null ? null : mix.next[pair.nextIndex] || null;
    const a = currentShape || shapeAt(mix.current, index, nextShape);
    const b = nextShape || shapeAt(mix.next, pair.nextIndex ?? index, a);
    drawShape(interpolatedShape(a, b, index, mix, now));
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function generateMorphLottie() {
  const shapes = state.morphSystem.targets.find((frame) => frame.length) ?? [];
  const isStroke = config.morphMotionMode === "morph" && config.morphRenderMode === "stroke";
  const layers = shapes.map((shape, index) => makeLottieShapeLayer(
    `Morph shape ${index + 1}`,
    makeLottiePathShape(shape.points, true),
    {
      index: index + 1,
      fill: isStroke ? null : config.morphColor,
      stroke: isStroke ? config.morphStrokeLineColor : null,
      strokeWidth: isStroke ? Number(config.morphStrokeLineWidth) || 1 : 0,
      opacity: config.morphOpacity,
    },
  ));
  return makeBasicLottieDocument("Morph", layers);
}
