// sine effect module. Loaded before the main UI script.
var sineDefaults = {
  sineLineCount: 5,
  sineSpeed: 0.9,
  sineAmplitude: 1.1,
  sineWaviness: 2.4,
  sineScale: 1.9,
  sineTaper: 3.9,
  sineRandomness: 0,
  sineStrokeWidth: 0.56,
  sineColor: "#8F959E",
};

var sineControlDefs = [
  { key: "sineLineCount", label: "线条数量", min: 2, max: 12, step: 1, tip: "控制同时出现的正弦线数量。" },
  { key: "sineSpeed", label: "速度", min: 0.15, max: 2.2, step: 0.05, tip: "控制正弦波横向流动速度。" },
  { key: "sineAmplitude", label: "波幅", min: 0.25, max: 2.4, step: 0.05, tip: "控制每条正弦线的上下摆动幅度。" },
  { key: "sineWaviness", label: "弯曲度", min: 0.7, max: 4.6, step: 0.05, tip: "控制一条线里波峰波谷的密度。" },
  { key: "sineScale", label: "横向缩放", min: 0.8, max: 2.4, step: 0.05, tip: "控制正弦线穿过轮廓时的横向覆盖范围。" },
  { key: "sineTaper", label: "收尾", min: 0, max: 5, step: 0.05, tip: "让波幅和线宽在左右两端逐渐收细，接近参考网站的 taper 效果。" },
  { key: "sineRandomness", label: "随机性", min: 0, max: 1, step: 0.01, tip: "为每根线稳定加入不同的相位、速度、波幅和弯曲度微差。0 保持当前同步状态。" },
  { key: "sineStrokeWidth", label: "线条粗细", min: 0.25, max: 2.2, step: 0.05, tip: "普通 SVG stroke 粗细，不带发光和透明度。" },
  { key: "sineColor", type: "color", label: "线条颜色", tip: "控制正弦线 stroke 颜色，默认 #8F959E。" },
];

function prepareSineEffect() {
  const contours = state.normalizedContours.length ? state.normalizedContours : [state.normalized].filter((contour) => contour.length);
  state.samples = resampleSmoothContoursAsOneStroke(contours, 360);
  state.coefficients = [];
}

function ensureSineGroup() {
  if (!state.sineGroup) {
    state.sineGroup = document.createElementNS(SVG_NS, "g");
    state.sineGroup.setAttribute("id", "sine-group");
    motionGroup.appendChild(state.sineGroup);
  }
  state.sineGroup.style.display = "";
  return state.sineGroup;
}

function hideSineGroup() {
  if (state.sineGroup) state.sineGroup.style.display = "none";
}

function ensureSineElements(count) {
  const group = ensureSineGroup();
  while (state.sinePaths.length < count) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    group.appendChild(path);
    state.sinePaths.push(path);
  }
  state.sinePaths.forEach((path, index) => {
    path.style.display = index < count ? "" : "none";
  });
}

function sineBounds() {
  return { minX: 8, minY: 8, maxX: 92, maxY: 92, width: 84, height: 84, centerX: 50, centerY: 50 };
}

function sineTaperFactor(t) {
  const strength = Math.max(0, Number(config.sineTaper) || 0);
  if (strength <= 0) return 1;
  const edge = Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1)));
  return edge ** (strength * 0.45);
}

function sineLineVariation(index) {
  const amount = clamp(Number(config.sineRandomness) || 0, 0, 1);
  if (amount <= 0) {
    return { phase: 0, speed: 1, amplitude: 1, waviness: 1, drift: 0 };
  }
  const rng = seededRandom(`sine-randomness|${index}`);
  return {
    phase: (rng() - 0.5) * Math.PI * 2 * amount,
    speed: 1 + (rng() - 0.5) * 0.32 * amount,
    amplitude: 1 + (rng() - 0.5) * 0.36 * amount,
    waviness: 1 + (rng() - 0.5) * 0.22 * amount,
    drift: (rng() - 0.5) * Math.PI * 2 * amount,
  };
}

function sinePointAt(index, count, bounds, time, t) {
  const variation = sineLineVariation(index);
  const progress = (time * config.sineSpeed * variation.speed) / 1000;
  const amplitude = config.sineAmplitude * variation.amplitude * Math.max(1.8, bounds.height * 0.045);
  const xSpan = Math.max(bounds.width, bounds.height) * config.sineScale;
  const startX = bounds.centerX - xSpan * 0.58;
  const endX = bounds.centerX + xSpan * 0.58;
  const baseY = bounds.centerY;
  const phase = progress * Math.PI * 2 + index * 0.74 + variation.phase;
  const taper = sineTaperFactor(t);
  const x = startX + (endX - startX) * t;
  const waviness = config.sineWaviness * variation.waviness;
  const wave = Math.sin(t * Math.PI * 2 * waviness + phase);
  const drift = Math.sin(t * Math.PI * 2 * (waviness * 0.42 + 0.35) - phase * 0.62 + index + variation.drift);
  const y = baseY + (wave + drift * 0.28) * amplitude * taper;
  return { x, y, taper };
}

function sineWaveSegments(index, count, bounds, time) {
  const steps = 96;
  const segments = [];
  let previous = sinePointAt(index, count, bounds, time, 0);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const next = sinePointAt(index, count, bounds, time, t);
    const taper = sineTaperFactor((step - 0.5) / steps);
    segments.push({
      d: `M ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} L ${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
      width: config.sineStrokeWidth * (0.08 + Math.pow(taper, 0.42) * 0.92),
    });
    previous = next;
  }
  return segments;
}

function renderSineEffect(now) {
  hideParticleCanvas();
  hideParticles();
  hideLineGroup();
  hideOscilloscopeGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  const bounds = sineBounds();
  const count = Math.max(2, Math.round(config.sineLineCount));
  const segmentCount = count * 96;
  ensureSineElements(segmentCount);
  let pathIndex = 0;
  for (let lineIndex = 0; lineIndex < count; lineIndex += 1) {
    sineWaveSegments(lineIndex, count, bounds, now - state.startedAt).forEach((segment) => {
      const path = state.sinePaths[pathIndex];
      path.setAttribute("d", segment.d);
      path.setAttribute("stroke", config.sineColor);
      path.setAttribute("stroke-width", segment.width.toFixed(3));
      path.setAttribute("opacity", "1");
      pathIndex += 1;
    });
  }
}

function generateSineStandaloneHTML() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${state.fileName.replace(/[<>&"]/g, "")} Sine Loader</title>
  <style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050507; }
svg { width: min(72vmin, 560px); height: min(72vmin, 560px); overflow: visible; }
  </style>
</head>
<body>
  <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
<g id="sine-group"></g>
  </svg>
  <script>
const SVG_NS = "http://www.w3.org/2000/svg";
const config = ${JSON.stringify({
  sineLineCount: Math.round(config.sineLineCount),
  sineSpeed: config.sineSpeed,
  sineAmplitude: config.sineAmplitude,
  sineWaviness: config.sineWaviness,
  sineScale: config.sineScale,
  sineTaper: config.sineTaper,
  sineRandomness: config.sineRandomness,
  sineStrokeWidth: config.sineStrokeWidth,
  sineColor: config.sineColor,
})};
const group = document.querySelector("#sine-group");
const paths = Array.from({ length: config.sineLineCount }, () => {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke", config.sineColor);
  path.setAttribute("stroke-width", config.sineStrokeWidth);
  group.appendChild(path);
  return path;
});
while (paths.length < config.sineLineCount * 96) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke", config.sineColor);
  group.appendChild(path);
  paths.push(path);
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
function buildSmoothSvgPath(points) {
  if (!points.length) return "";
  const parts = ["M " + points[0].x.toFixed(2) + " " + points[0].y.toFixed(2)];
  if (points.length < 3) {
    points.slice(1).forEach((p) => parts.push("L " + p.x.toFixed(2) + " " + p.y.toFixed(2)));
    return parts.join(" ") + " Z";
  }
  for (let i = 0; i < points.length; i += 1) {
    const end = closedPoint(points, i + 1);
    const cp = bezierControls(points, i);
    parts.push("C " + cp.c1.x.toFixed(2) + " " + cp.c1.y.toFixed(2) + " " + cp.c2.x.toFixed(2) + " " + cp.c2.y.toFixed(2) + " " + end.x.toFixed(2) + " " + end.y.toFixed(2));
  }
  return parts.join(" ") + " Z";
}
function buildSmoothSvgMultiPath(contours) {
  return contours.map(buildSmoothSvgPath).filter(Boolean).join(" ");
}
function sineBounds() {
  return { minX: 8, minY: 8, maxX: 92, maxY: 92, width: 84, height: 84, centerX: 50, centerY: 50 };
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function sineTaperFactor(t) {
  const strength = Math.max(0, Number(config.sineTaper) || 0);
  if (strength <= 0) return 1;
  const edge = Math.max(0, Math.sin(Math.PI * clamp(t, 0, 1)));
  return edge ** (strength * 0.45);
}
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
function sineLineVariation(index) {
  const amount = clamp(Number(config.sineRandomness) || 0, 0, 1);
  if (amount <= 0) {
    return { phase: 0, speed: 1, amplitude: 1, waviness: 1, drift: 0 };
  }
  const rng = seededRandom("sine-randomness|" + index);
  return {
    phase: (rng() - 0.5) * Math.PI * 2 * amount,
    speed: 1 + (rng() - 0.5) * 0.32 * amount,
    amplitude: 1 + (rng() - 0.5) * 0.36 * amount,
    waviness: 1 + (rng() - 0.5) * 0.22 * amount,
    drift: (rng() - 0.5) * Math.PI * 2 * amount,
  };
}
function sinePointAt(index, count, bounds, now, t) {
  const variation = sineLineVariation(index);
  const progress = (now * config.sineSpeed * variation.speed) / 1000;
  const amplitude = config.sineAmplitude * variation.amplitude * Math.max(1.8, bounds.height * 0.045);
  const xSpan = Math.max(bounds.width, bounds.height) * config.sineScale;
  const startX = bounds.centerX - xSpan * 0.58;
  const endX = bounds.centerX + xSpan * 0.58;
  const baseY = bounds.centerY;
  const phase = progress * Math.PI * 2 + index * 0.74 + variation.phase;
  const taper = sineTaperFactor(t);
  const x = startX + (endX - startX) * t;
  const waviness = config.sineWaviness * variation.waviness;
  const wave = Math.sin(t * Math.PI * 2 * waviness + phase);
  const drift = Math.sin(t * Math.PI * 2 * (waviness * 0.42 + 0.35) - phase * 0.62 + index + variation.drift);
  const y = baseY + (wave + drift * 0.28) * amplitude * taper;
  return { x, y, taper };
}
function drawSineWave(index, count, bounds, now, offset) {
  const steps = 96;
  let previous = sinePointAt(index, count, bounds, now, 0);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const next = sinePointAt(index, count, bounds, now, t);
    const taper = sineTaperFactor((step - 0.5) / steps);
    const path = paths[offset + step - 1];
    path.setAttribute("d", "M " + previous.x.toFixed(2) + " " + previous.y.toFixed(2) + " L " + next.x.toFixed(2) + " " + next.y.toFixed(2));
    path.setAttribute("stroke", config.sineColor);
    path.setAttribute("stroke-width", (config.sineStrokeWidth * (0.08 + Math.pow(taper, 0.42) * 0.92)).toFixed(3));
    previous = next;
  }
}
const bounds = sineBounds();
function tick(now) {
  for (let index = 0; index < config.sineLineCount; index += 1) {
    drawSineWave(index, config.sineLineCount, bounds, now, index * 96);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function generateSineLottie() {
  const bounds = sineBounds();
  const count = Math.max(2, Math.round(config.sineLineCount));
  const layers = Array.from({ length: count }, (_, lineIndex) => {
    const points = Array.from({ length: 72 }, (__, step) => sinePointAt(lineIndex, count, bounds, 0, step / 71));
    return makeLottieShapeLayer(`Sine ${lineIndex + 1}`, makeLottiePathShape(points, false), {
      index: lineIndex + 1,
      stroke: config.sineColor,
      strokeWidth: Math.max(1, config.sineStrokeWidth * 5.12),
      opacity: 1,
    });
  });
  return makeBasicLottieDocument("Sine", layers);
}
