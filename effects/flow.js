// flow effect module. Loaded before the main UI script.
var flowDefaults = {
  particleCount: 82,
  trailSpan: 0.36,
  durationMs: 5200,
  pulseDurationMs: 4200,
  strokeWidth: 4.8,
  contourColor: "#f6f7f1",
  contourOpacity: 0.13,
  motionColor: "#f6f7f1",
  motionOpacity: 1,
  pulseCycleMs: 0,
  pulseGapRatio: 0.25,
};

var flowControlDefs = [
  { key: "particleCount", label: "粒子数量", min: 24, max: 140, step: 1, tip: "流动算法的粒子数量。越多尾迹越连续。" },
  { key: "trailSpan", label: "尾迹长度", min: 0.12, max: 0.68, step: 0.01, tip: "流动算法中粒子队列在曲线上拉开的距离，越大拖尾越长。" },
  { key: "durationMs", label: "循环时长", min: 2400, max: 12000, step: 100, tip: "流动算法中粒子跑完整条公式曲线所需时间，值越小速度越快。" },
  { key: "pulseDurationMs", label: "呼吸时长", min: 1800, max: 10000, step: 100, tip: "流动算法中高频傅立叶细节轻微呼吸变化的周期，形成柔和的动态起伏。" },
  { key: "strokeWidth", label: "轨迹粗细", min: 2.5, max: 7.5, step: 0.1, tip: "流动算法的底层轨迹线和粒子半径，值越大视觉更饱满。" },
  { key: "contourColor", alphaKey: "contourOpacity", type: "colorAlpha", label: "轮廓颜色", tip: "控制底层轮廓线的颜色和透明度。" },
  { key: "motionColor", alphaKey: "motionOpacity", type: "colorAlpha", label: "动效颜色", tip: "控制运动粒子的颜色和透明度。" },
  { key: "pulseCycleMs", label: "脉冲周期", min: 0, max: 10000, step: 100, tip: "控制流动粒子的透明度节奏。0 为关闭，数值为一次明暗变化的周期时长。" },
  { key: "pulseGapRatio", label: "脉冲间隔", min: 0, max: 0.8, step: 0.01, showWhen: () => config.pulseCycleMs > 0, tip: "控制每个脉冲周期中保持透明的间隔比例。" },
];

function buildPath(detailScale, steps = 180) {
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    points.push(curvePoint(index / steps, detailScale));
  }
  return buildSmoothSvgPath(points);
}

function ensureParticles() {
  const desired = Math.round(config.particleCount);
  while (state.particles.length < desired) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("fill", config.motionColor);
    motionGroup.appendChild(circle);
    state.particles.push(circle);
  }
  state.particles.forEach((circle, index) => {
    circle.style.display = index < desired ? "" : "none";
  });
}

function renderFlowEffect(now) {
  const time = now - state.startedAt;
  const loop = getLoopState(time);
  const detailScale = getDetailScale(time);
  const openFlow = referenceHasOpenContours();
  const openPulse = openFlow && config.pulseCycleMs > 0;
  const openPulseProgress = openPulse ? getOpenFlowPulseProgress(time) : loop.progress;
  hideParticleCanvas();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  ensureParticles();
  motionGroup.removeAttribute("transform");
  motionPath.setAttribute("stroke-width", String(config.strokeWidth));
  motionPath.setAttribute("stroke", config.contourColor);
  motionPath.setAttribute("d", state.normalizedContours.length ? buildSmoothSvgMultiPath(state.normalizedContours, state.normalizedContourClosed) : buildPath(detailScale));
  motionPath.setAttribute("opacity", config.contourOpacity.toFixed(3));
  const count = Math.max(2, Math.round(config.particleCount));
  state.particles.forEach((node, index) => {
    if (index >= count) return;
    const tailOffset = index / (count - 1);
    const rawProgress = openPulseProgress - tailOffset * config.trailSpan;
    if (openPulse && rawProgress < 0) {
      node.setAttribute("opacity", "0");
      return;
    }
    const progress = openPulse ? clamp(rawProgress, 0, 1) : normalizeProgress(rawProgress);
    const point = openFlow ? sampleFlowOpenPathPoint(progress) : curvePoint(progress, detailScale);
    const fade = Math.pow(1 - tailOffset, 0.56);
    node.setAttribute("fill", config.motionColor);
    node.setAttribute("cx", point.x.toFixed(2));
    node.setAttribute("cy", point.y.toFixed(2));
    node.setAttribute("r", (0.72 + fade * (config.strokeWidth * 0.58)).toFixed(2));
    node.setAttribute("opacity", ((0.04 + fade * 0.96) * config.motionOpacity * loop.opacity).toFixed(3));
  });
}

function getOpenFlowPulseProgress(time) {
  const cycleDuration = Math.max(1, config.pulseCycleMs);
  const gapRatio = clamp(config.pulseGapRatio, 0, 0.8);
  const visibleDuration = Math.max(1, cycleDuration * (1 - gapRatio));
  const local = time % cycleDuration;
  return softenedBezierProgress(clamp(local / visibleDuration, 0, 1));
}

function prepareFlowEffect() {
  const contours = state.normalizedContours.length ? state.normalizedContours : [state.normalized];
  const sampleCount = derivedSampleCount(config.harmonicCount);
  state.flowSampleContours = [];
  state.flowSampleContourClosed = [];
  if (referenceHasOpenContours()) {
    state.flowSampleContours = buildFlowSampleContours(contours, state.normalizedContourClosed, sampleCount);
    state.flowSampleContourClosed = contours.map((_, index) => state.normalizedContourClosed[index] ?? true);
    state.samples = state.flowSampleContours.flat();
    state.coefficients = [];
    return;
  }
  state.samples = resampleSmoothContoursAsOneStroke(contours, sampleCount);
  const harmonicLimit = Math.min(Math.round(config.harmonicCount), Math.floor(state.samples.length / 2) - 1);
  state.coefficients = computeCoefficients(state.samples, harmonicLimit);
}

function generateFlowStandaloneHTML() {
  const coeffs = state.coefficients.map(({ k, re, im }) => ({ k, re: Number(re.toFixed(6)), im: Number(im.toFixed(6)) }));
  const contourPaths = state.normalizedContours.map((contour) => contour.map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })));
  const contourClosed = state.normalizedContours.map((_, index) => state.normalizedContourClosed[index] !== false);
  const flowOpen = referenceHasOpenContours();
  const flowSampleContours = (state.flowSampleContours || []).map((contour) => contour.map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${state.fileName.replace(/[<>&"]/g, "")} Flow Loader</title>
  <style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050507; color: #f5f7fb; font-family: Inter, system-ui, sans-serif; }
svg { width: min(72vmin, 520px); height: min(72vmin, 520px); overflow: visible; }
.wrap { display: grid; gap: 18px; justify-items: center; }
.title { color: rgba(245,247,251,.64); font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrap">
<svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
  <g id="group">
    <path id="path" stroke="${config.contourColor}" stroke-width="${config.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${config.contourOpacity}"></path>
  </g>
</svg>
<div class="title">${state.fileName.replace(/[<>&"]/g, "")}</div>
  </div>
  <script>
const SVG_NS = "http://www.w3.org/2000/svg";
const coeffs = ${JSON.stringify(coeffs)};
const contourPaths = ${JSON.stringify(contourPaths)};
const contourClosed = ${JSON.stringify(contourClosed)};
const flowOpen = ${JSON.stringify(flowOpen)};
const flowSampleContours = ${JSON.stringify(flowSampleContours)};
const config = ${JSON.stringify({
  effectType: config.effectType,
  particleCount: Math.round(config.particleCount),
  trailSpan: config.trailSpan,
  durationMs: config.durationMs,
  pulseDurationMs: config.pulseDurationMs,
  strokeWidth: config.strokeWidth,
  contourColor: config.contourColor,
  contourOpacity: config.contourOpacity,
  motionColor: config.motionColor,
  motionOpacity: config.motionOpacity,
  pulseCycleMs: config.pulseCycleMs,
  pulseGapRatio: config.pulseGapRatio,
})};
const group = document.querySelector("#group");
const path = document.querySelector("#path");
const particles = Array.from({ length: config.particleCount }, () => {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("fill", config.motionColor);
  group.appendChild(circle);
  return circle;
});
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function normalizeProgress(progress) { return ((progress % 1) + 1) % 1; }
function detailScale(time) {
  const p = (time % config.pulseDurationMs) / config.pulseDurationMs;
  return 0.52 + ((Math.sin(p * Math.PI * 2 + 0.55) + 1) / 2) * 0.48;
}
function point(progress, detail) {
  let x = 0, y = 0;
  const base = 2 * Math.PI * progress;
  coeffs.forEach((c) => {
    const d = Math.abs(c.k) > 7 ? 0.76 + 0.24 * detail : 1;
    const angle = base * c.k;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    x += d * (c.re * cos - c.im * sin);
    y += d * (c.re * sin + c.im * cos);
  });
  return { x, y };
}
function closedPoint(points, index) {
  return points[(index + points.length) % points.length];
}
function bezierControls(points, index, smoothing = 0.82) {
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
function openBezierControls(points, index, smoothing = 0.82) {
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  const scale = smoothing / 6;
  return {
    c1: { x: p1.x + (p2.x - p0.x) * scale, y: p1.y + (p2.y - p0.y) * scale },
    c2: { x: p2.x - (p3.x - p1.x) * scale, y: p2.y - (p3.y - p1.y) * scale },
  };
}
function buildSmoothSvgPath(points, closed = true) {
  if (!points.length) return "";
  const parts = ["M " + points[0].x.toFixed(2) + " " + points[0].y.toFixed(2)];
  if (points.length < 3) {
    points.slice(1).forEach((p) => parts.push("L " + p.x.toFixed(2) + " " + p.y.toFixed(2)));
    return closed ? parts.join(" ") + " Z" : parts.join(" ");
  }
  if (!closed) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const end = points[i + 1];
      const cp = openBezierControls(points, i);
      parts.push("C " + cp.c1.x.toFixed(2) + " " + cp.c1.y.toFixed(2) + " " + cp.c2.x.toFixed(2) + " " + cp.c2.y.toFixed(2) + " " + end.x.toFixed(2) + " " + end.y.toFixed(2));
    }
    return parts.join(" ");
  }
  for (let i = 0; i < points.length; i += 1) {
    const end = closedPoint(points, i + 1);
    const cp = bezierControls(points, i);
    parts.push("C " + cp.c1.x.toFixed(2) + " " + cp.c1.y.toFixed(2) + " " + cp.c2.x.toFixed(2) + " " + cp.c2.y.toFixed(2) + " " + end.x.toFixed(2) + " " + end.y.toFixed(2));
  }
  return parts.join(" ") + " Z";
}
function buildSmoothSvgMultiPath(contours, closedFlags = []) {
  return contours.map((contour, index) => buildSmoothSvgPath(contour, closedFlags[index] !== false)).filter(Boolean).join(" ");
}
function buildPath(detail, steps = 180) {
  const points = [];
  for (let i = 0; i < steps; i += 1) points.push(point(i / steps, detail));
  return buildSmoothSvgPath(points);
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function pathLength(points, closed = true) {
  let length = 0;
  const limit = closed ? points.length : points.length - 1;
  for (let i = 0; i < limit; i += 1) length += distance(points[i], points[(i + 1) % points.length]);
  return length;
}
function pointAlongContour(points, progress, closed = true) {
  if (!points.length) return { x: 50, y: 50 };
  if (points.length === 1) return points[0];
  const lengths = [];
  let total = 0;
  const limit = closed ? points.length : points.length - 1;
  for (let i = 0; i < limit; i += 1) {
    const length = distance(points[i], points[(i + 1) % points.length]);
    lengths.push(length);
    total += length;
  }
  const target = clamp(progress, 0, 1) * Math.max(1, total);
  let walked = 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const length = lengths[i];
    if (walked + length >= target || i === lengths.length - 1) {
      const local = length <= 0 ? 0 : (target - walked) / length;
      const a = points[i], b = points[(i + 1) % points.length];
      return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    }
    walked += length;
  }
  return closed ? points[0] : points[points.length - 1];
}
function openPoint(progress) {
  const contours = flowSampleContours.filter((contour) => contour.length >= 2);
  if (!contours.length) return { x: 50, y: 50 };
  const lengths = contours.map((contour, index) => pathLength(contour, contourClosed[index] !== false));
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  let target = clamp(progress, 0, 1) * total;
  for (let index = 0; index < contours.length; index += 1) {
    if (target <= lengths[index] || index === contours.length - 1) return pointAlongContour(contours[index], lengths[index] <= 0 ? 0 : target / lengths[index], contourClosed[index] !== false);
    target -= lengths[index];
  }
  return pointAlongContour(contours[contours.length - 1], 1, contourClosed[contours.length - 1] !== false);
}
function loopState(time) {
  const progress = (time % config.durationMs) / config.durationMs;
  return { progress: config.pulseCycleMs > 0 ? softenedBezierProgress(progress) : progress, opacity: pulseOpacity(time) };
}
function pulseOpacity(time) {
  if (config.pulseCycleMs <= 0) return 1;
  const cycleDuration = Math.max(1, config.pulseCycleMs);
  const gapRatio = clamp(config.pulseGapRatio, 0, 0.8);
  const visibleDuration = Math.max(1, cycleDuration * (1 - gapRatio));
  const local = time % cycleDuration;
  if (local >= visibleDuration) return 0;
  const phase = local / visibleDuration;
  const fadePortion = 0.34;
  const fadeIn = easedSegment(0, fadePortion, phase);
  const fadeOut = 1 - easedSegment(1 - fadePortion, 1, phase);
  return fadeIn * fadeOut;
}
function standardBezierEase(value) {
  const target = clamp(value, 0, 1);
  let low = 0;
  let high = 1;
  let t = target;
  for (let i = 0; i < 14; i += 1) {
    t = (low + high) / 2;
    const x = cubicBezierAxis(t, 0.5, 0);
    if (x < target) low = t;
    else high = t;
  }
  return cubicBezierAxis(t, 0, 1);
}
function cubicBezierAxis(t, p1, p2) {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}
function easedSegment(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1);
  return standardBezierEase(t);
}
function softenedBezierProgress(value) {
  const linear = clamp(value, 0, 1);
  const eased = standardBezierEase(linear);
  return linear * 0.65 + eased * 0.35;
}
function openFlowPulseProgress(time) {
  const cycleDuration = Math.max(1, config.pulseCycleMs);
  const gapRatio = clamp(config.pulseGapRatio, 0, 0.8);
  const visibleDuration = Math.max(1, cycleDuration * (1 - gapRatio));
  const local = time % cycleDuration;
  return softenedBezierProgress(clamp(local / visibleDuration, 0, 1));
}
function tick(now) {
  const loop = loopState(now);
  const d = detailScale(now);
  const openPulse = flowOpen && config.pulseCycleMs > 0;
  const openProgress = openPulse ? openFlowPulseProgress(now) : loop.progress;
  group.removeAttribute("transform");
  path.setAttribute("d", contourPaths.length ? buildSmoothSvgMultiPath(contourPaths, contourClosed) : buildPath(d));
  path.setAttribute("stroke", config.contourColor);
  path.setAttribute("opacity", config.contourOpacity.toFixed(3));
  particles.forEach((node, index) => {
    const tail = index / (config.particleCount - 1);
    const raw = openProgress - tail * config.trailSpan;
    if (openPulse && raw < 0) {
      node.setAttribute("opacity", "0");
      return;
    }
    const progress = openPulse ? clamp(raw, 0, 1) : normalizeProgress(raw);
    const p = flowOpen ? openPoint(progress) : point(progress, d);
    const fade = Math.pow(1 - tail, 0.56);
    node.setAttribute("fill", config.motionColor);
    node.setAttribute("cx", p.x.toFixed(2));
    node.setAttribute("cy", p.y.toFixed(2));
    node.setAttribute("r", (0.72 + fade * (config.strokeWidth * 0.58)).toFixed(2));
    node.setAttribute("opacity", ((0.04 + fade * 0.96) * config.motionOpacity * loop.opacity).toFixed(3));
  });
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function generateFlowLottie() {
  const contours = state.normalizedContours.length ? state.normalizedContours : [state.normalized].filter((contour) => contour.length);
  const layers = contours.map((contour, index) => makeLottieShapeLayer(
    `Flow contour ${index + 1}`,
    makeLottiePathShape(contour, state.normalizedContourClosed[index] !== false),
    {
      index: index + 1,
      stroke: config.motionColor,
      strokeWidth: Math.max(1, config.strokeWidth * 5.12),
      opacity: config.motionOpacity,
    },
  ));
  if (!layers.length && state.coefficients.length) {
    const points = Array.from({ length: 96 }, (_, index) => curvePoint(index / 96, 1));
    layers.push(makeLottieShapeLayer("Flow curve", makeLottiePathShape(points, true), {
      stroke: config.motionColor,
      strokeWidth: Math.max(1, config.strokeWidth * 5.12),
      opacity: config.motionOpacity,
    }));
  }
  return makeBasicLottieDocument("Flow", layers);
}
