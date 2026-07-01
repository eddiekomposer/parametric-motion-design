// neural network effect module. Loaded before the main UI script.
var neuralDefaults = {
  neuralSource: "circle",
  neuralDensity: 13,
  neuralNodeSize: 1.15,
  neuralNodeColor: "#f6f7f1",
  neuralNodeOpacity: 0.88,
  neuralNodeShape: "circle",
  neuralMouseFollow: false,
  neuralSnapCursor: false,
  neuralCursorSpeed: 1,
  neuralCursorColor: "#f6f7f1",
  neuralCursorOpacity: 0.98,
  neuralCursorSize: 3.25,
  neuralLineColor: "#f6f7f1",
  neuralLineOpacity: 0.82,
  neuralLineWidth: 1.05,
};

var neuralControlDefs = [
  {
    key: "neuralSource",
    type: "segmented",
    label: "点阵来源",
    options: [
      { value: "circle", label: "圆形" },
      { value: "square", label: "方形" },
      { value: "reference", label: "参考图" },
    ],
    tip: "圆形和方形使用程序生成点阵；参考图会按上传图片的前景区域生成点阵。",
  },
  { key: "neuralDensity", label: "点阵密度", min: 4, max: 20, step: 1, tip: "控制点阵行列数量，例如 13 表示 13x13。" },
  { key: "neuralNodeSize", label: "点的大小", min: 0, max: 5, step: 0.05, tip: "控制基础节点大小；设为 0 时普通节点隐藏，靠近光标的节点仍会被放大显示。" },
  { key: "neuralNodeColor", alphaKey: "neuralNodeOpacity", type: "colorAlpha", label: "点颜色", tip: "控制点阵节点颜色和透明度。" },
  {
    key: "neuralNodeShape",
    type: "segmented",
    label: "点形状",
    options: [
      { value: "circle", label: "圆形" },
      { value: "square", label: "方形" },
      { value: "cross", label: "十字" },
    ],
    tip: "选择节点以圆形、方形或十字形绘制。",
  },
  { key: "neuralMouseFollow", type: "toggle", label: "跟随鼠标", tip: "开启后光标跟随鼠标；关闭后光标在点阵中做无规律布朗运动。" },
  { key: "neuralSnapCursor", type: "toggle", label: "吸附", tip: "开启后不再绘制单独光标，而是把距离最近的点阵节点作为光标点。" },
  { key: "neuralCursorSpeed", label: "光标速度", min: 0, max: 2, step: 0.05, showWhen: () => !config.neuralMouseFollow, tip: "控制布朗运动光标的移动速度；开启跟随鼠标时不可用。" },
  { key: "neuralCursorColor", alphaKey: "neuralCursorOpacity", type: "colorAlpha", label: "光标颜色", tip: "控制中心光标颜色和透明度。" },
  { key: "neuralCursorSize", label: "光标大小", min: 1.5, max: 10, step: 0.05, tip: "控制连接中心的光标圆点大小。" },
  { key: "neuralLineColor", alphaKey: "neuralLineOpacity", type: "colorAlpha", label: "连线颜色", tip: "控制光标到附近节点的连线颜色和透明度。" },
  { key: "neuralLineWidth", label: "连线粗细", min: 0.25, max: 3.2, step: 0.05, tip: "控制神经网络连接线的基础粗细。" },
];

function prepareNeuralEffect() {
  hideLineEditHandles();
  state.samples = [];
  state.coefficients = [];
  state.neuralSystem.nodes = buildNeuralNodes();
  state.neuralSystem.links = [];
  state.neuralSystem.lastFrameAt = null;
  state.neuralSystem.cursorNodeIndex = -1;
  state.neuralSystem.snapPulseAt = 0;
  const cursor = state.neuralSystem.cursor;
  if (!Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) {
    cursor.x = 50;
    cursor.y = 50;
    cursor.vx = 0.08;
    cursor.vy = -0.04;
  }
}

function buildNeuralNodes() {
  const columns = clamp(Math.round(Number(config.neuralDensity) || neuralDefaults.neuralDensity), 4, 20);
  const rows = columns;
  const step = 82 / Math.max(1, columns - 1);
  const nodes = [];
  const source = config.neuralSource || "circle";
  const referenceSampler = source === "reference" ? makeNeuralReferenceSampler() : null;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = 9 + column * step;
      const y = 9 + row * step;
      const dx = x - 50;
      const dy = y - 50;
      const circleInside = Math.hypot(dx, dy) <= 41.5;
      const inside = source === "circle" ? circleInside : (source === "reference" ? referenceSampler(x, y) : true);
      if (!inside) continue;
      const seed = seededRandom(`neural-node|${source}|${columns}|${row}|${column}`);
      nodes.push({
        x,
        y,
        ox: (seed() - 0.5) * Math.min(0.9, step * 0.08),
        oy: (seed() - 0.5) * Math.min(0.9, step * 0.08),
        sizeJitter: 0.78 + seed() * 0.52,
        pulse: seed() * Math.PI * 2,
        renderInfluence: 0,
        renderCursor: 0,
      });
    }
  }
  return nodes.length ? nodes : buildNeuralFallbackNodes(columns);
}

function makeNeuralReferenceSampler() {
  if (!state.imageData) return (x, y) => Math.hypot(x - 50, y - 50) <= 41.5;
  const field = makeScalarField(state.imageData, imageMode || "auto");
  const level = automaticContourLevel(field);
  const { mask, width, height } = foregroundMaskFromField(field, level);
  const candidates = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return (x, y) => Math.hypot(x - 50, y - 50) <= 41.5;
  const bounds = particleCandidateBounds(candidates);
  const sourceW = Math.max(1, bounds.maxX - bounds.minX || width);
  const sourceH = Math.max(1, bounds.maxY - bounds.minY || height);
  const scale = 82 / Math.max(sourceW, sourceH);
  const offsetX = 50 - ((bounds.minX + bounds.maxX) / 2) * scale;
  const offsetY = 50 - ((bounds.minY + bounds.maxY) / 2) * scale;
  return (x, y) => {
    const sx = Math.round((x - offsetX) / scale);
    const sy = Math.round((y - offsetY) / scale);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;
    const radius = Math.max(1, Math.round(1.2 / Math.max(0.001, scale)));
    for (let yy = sy - radius; yy <= sy + radius; yy += 1) {
      for (let xx = sx - radius; xx <= sx + radius; xx += 1) {
        if (xx >= 0 && yy >= 0 && xx < width && yy < height && mask[yy * width + xx]) return true;
      }
    }
    return false;
  };
}

function buildNeuralFallbackNodes(columns) {
  const nodes = [];
  const step = 82 / Math.max(1, columns - 1);
  for (let row = 0; row < columns; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = 9 + column * step;
      const y = 9 + row * step;
      if (Math.hypot(x - 50, y - 50) > 41.5) continue;
      nodes.push({ x, y, ox: 0, oy: 0, sizeJitter: 1, pulse: (row + column) * 0.37, renderInfluence: 0, renderCursor: 0 });
    }
  }
  return nodes;
}

function neuralEaseOutCubic(value) {
  const t = clamp(value, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function neuralSmoothFollow(current, target, rate, dt) {
  const from = Number.isFinite(current) ? current : 0;
  return from + (target - from) * (1 - Math.exp(-rate * dt));
}

function neuralPulseState(system, now) {
  const age = Math.max(0, now - (system.snapPulseAt || 0));
  return {
    active: age < 720,
    progress: clamp(age / 620, 0, 1),
  };
}

function neuralHexToRgb(color) {
  const hex = String(color || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function neuralMixColor(from, to, mix) {
  const a = neuralHexToRgb(from);
  const b = neuralHexToRgb(to);
  const t = clamp(mix, 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function updateNeuralCursor(system, dt, now) {
  const cursor = system.cursor;
  const pointer = system.pointer;
  const follow = Boolean(config.neuralMouseFollow && pointer.active);
  if (follow) {
    const ease = 1 - Math.exp(-14 * dt);
    cursor.x += (pointer.x - cursor.x) * ease;
    cursor.y += (pointer.y - cursor.y) * ease;
    cursor.vx *= 0.82;
    cursor.vy *= 0.82;
    return;
  }
  if (!Number.isFinite(cursor.driftAngle)) cursor.driftAngle = -0.4;
  const speedScale = clamp(Number(config.neuralCursorSpeed) || 0, 0, 2);
  const motionScale = 0.12 + speedScale * 0.88;
  const turn = Math.sin(now * 0.00031 + cursor.x * 0.017) * 0.010 + Math.cos(now * 0.00023 + cursor.y * 0.019) * 0.008;
  cursor.driftAngle += turn;
  const centerPullX = (50 - cursor.x) * 0.0019 * motionScale;
  const centerPullY = (50 - cursor.y) * 0.0019 * motionScale;
  cursor.vx += Math.cos(cursor.driftAngle) * 0.010 * motionScale + centerPullX;
  cursor.vy += Math.sin(cursor.driftAngle) * 0.010 * motionScale + centerPullY;
  const speed = Math.hypot(cursor.vx, cursor.vy);
  const maxSpeed = 0.19 * motionScale;
  if (speed > maxSpeed) {
    cursor.vx = (cursor.vx / speed) * maxSpeed;
    cursor.vy = (cursor.vy / speed) * maxSpeed;
  }
  cursor.x += cursor.vx;
  cursor.y += cursor.vy;
  cursor.vx *= 0.992;
  cursor.vy *= 0.992;
  const margin = 11;
  if (cursor.x < margin || cursor.x > 100 - margin) {
    cursor.vx *= -0.62;
    cursor.driftAngle = Math.PI - cursor.driftAngle;
    cursor.x = clamp(cursor.x, margin, 100 - margin);
  }
  if (cursor.y < margin || cursor.y > 100 - margin) {
    cursor.vy *= -0.62;
    cursor.driftAngle = -cursor.driftAngle;
    cursor.y = clamp(cursor.y, margin, 100 - margin);
  }
}

function nearestNeuralNode(nodes, cursor) {
  let best = null;
  nodes.forEach((node, index) => {
    const x = node.x + node.ox;
    const y = node.y + node.oy;
    const distance = Math.hypot(x - cursor.x, y - cursor.y);
    if (!best || distance < best.distance) best = { node, index, x, y, distance };
  });
  return best;
}

function neuralActiveLinks(nodes, cursor, skipIndex = -1) {
  const radius = 29;
  return nodes
    .map((node, index) => {
      const x = node.x + node.ox;
      const y = node.y + node.oy;
      const distanceToCursor = Math.hypot(x - cursor.x, y - cursor.y);
      return { node, index, x, y, distance: distanceToCursor, influence: clamp(1 - distanceToCursor / radius, 0, 1) };
    })
    .filter((item) => item.influence > 0 && item.index !== skipIndex)
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 18)
    .sort((a, b) => Math.atan2(a.y - cursor.y, a.x - cursor.x) - Math.atan2(b.y - cursor.y, b.x - cursor.x));
}

function renderNeuralEffect(now) {
  hideParticles();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  showParticleCanvas();
  resizeParticleCanvas();
  const ctx = particleCanvas.getContext("2d");
  const system = state.neuralSystem;
  const previous = system.lastFrameAt ?? now;
  const dt = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
  system.lastFrameAt = now;
  updateNeuralCursor(system, dt, now);
  const width = particleCanvas.width;
  const height = particleCanvas.height;
  const size = Math.min(width, height) * 0.96;
  state.particleSystem.viewport = {
    x: (width - size) / 2,
    y: (height - size) / 2,
    size,
    width,
    height,
  };
  const viewport = state.particleSystem.viewport;
  ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  if (document.body.dataset.theme === "dark") {
    ctx.fillStyle = "#050507";
    ctx.fillRect(0, 0, particleCanvas.width, particleCanvas.height);
  }
  const rawCursor = system.cursor;
  const snapped = config.neuralSnapCursor ? nearestNeuralNode(system.nodes, rawCursor) : null;
  const cursor = snapped ? { x: snapped.x, y: snapped.y } : rawCursor;
  const nextCursorNodeIndex = snapped ? snapped.index : -1;
  if (config.neuralSnapCursor && nextCursorNodeIndex !== system.cursorNodeIndex) {
    system.snapPulseAt = now;
  }
  system.cursorNodeIndex = nextCursorNodeIndex;
  const links = neuralActiveLinks(system.nodes, cursor, system.cursorNodeIndex);
  system.links = links;
  const pulse = config.neuralSnapCursor ? neuralPulseState(system, now) : null;
  drawNeuralLinks(ctx, links, cursor, pulse);
  drawNeuralNodes(ctx, system.nodes, links, cursor, now, system.cursorNodeIndex, dt);
  if (!snapped) drawNeuralCursor(ctx, cursor, now);
  window.__motionDebug.neuralNodeCount = system.nodes.length;
  window.__motionDebug.neuralLinkCount = links.length;
  window.__motionDebug.neuralCursor = { x: Number(cursor.x.toFixed(2)), y: Number(cursor.y.toFixed(2)) };
}

function neuralToCanvas(point) {
  return particleToCanvas(point);
}

function drawNeuralLinks(ctx, links, cursor, pulse = null) {
  const cursorPoint = neuralToCanvas(cursor);
  const ratio = window.devicePixelRatio || 1;
  ctx.save();
  ctx.strokeStyle = config.neuralLineColor;
  ctx.lineCap = "round";
  links.forEach((item, index) => {
    const point = neuralToCanvas({ x: item.x, y: item.y });
    const rawLocal = pulse?.active ? (pulse.progress - index * 0.024) / 0.68 : 1;
    const local = pulse?.active ? neuralEaseOutCubic(rawLocal) : 1;
    if (local <= 0.001) return;
    const lineAlpha = clamp(config.neuralLineOpacity, 0, 1) * (0.14 + item.influence * 0.86);
    const electric = pulse?.active ? Math.sin(clamp(rawLocal, 0, 1) * Math.PI) : 0;
    const targetX = cursorPoint.x + (point.x - cursorPoint.x) * local;
    const targetY = cursorPoint.y + (point.y - cursorPoint.y) * local;
    ctx.globalAlpha = lineAlpha * Math.min(1, local * (1.05 + electric * 0.38));
    ctx.lineWidth = Math.max(0.35, Number(config.neuralLineWidth) || 1) * ratio * (0.72 + item.influence * 0.62);
    ctx.beginPath();
    ctx.moveTo(cursorPoint.x, cursorPoint.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    if (pulse?.active && electric > 0.08) {
      const head = clamp(local, 0, 1);
      const tail = clamp(head - 0.18, 0, 1);
      ctx.globalAlpha = lineAlpha * electric;
      ctx.lineWidth *= 1.55;
      ctx.beginPath();
      ctx.moveTo(cursorPoint.x + (point.x - cursorPoint.x) * tail, cursorPoint.y + (point.y - cursorPoint.y) * tail);
      ctx.lineTo(cursorPoint.x + (point.x - cursorPoint.x) * head, cursorPoint.y + (point.y - cursorPoint.y) * head);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawNeuralNodes(ctx, nodes, links, cursor, now, cursorNodeIndex = -1, dt = 1 / 60) {
  const active = new Map(links.map((item) => [item.index, item.influence]));
  const ratio = window.devicePixelRatio || 1;
  const baseSize = clamp(Number(config.neuralNodeSize) || 0, 0, 5) * ratio;
  nodes.forEach((node, index) => {
    const targetInfluence = active.get(index) || 0;
    node.renderInfluence = neuralSmoothFollow(node.renderInfluence, targetInfluence, 10, dt);
    node.renderCursor = neuralSmoothFollow(node.renderCursor, index === cursorNodeIndex ? 1 : 0, 14, dt);
    const influence = node.renderInfluence;
    const cursorBlend = node.renderCursor;
    const twinkle = 0.5 + Math.sin(now * 0.0021 + node.pulse) * 0.5;
    const nodeSize = node.sizeJitter * (baseSize * (0.58 + influence * 1.25) + influence * ratio * 1.45);
    const cursorSize = Math.max(0.8, Number(config.neuralCursorSize) || 3.25) * ratio;
    const size = nodeSize + (cursorSize - nodeSize) * cursorBlend;
    if (size <= 0.02) return;
    const point = neuralToCanvas({ x: node.x + node.ox, y: node.y + node.oy });
    ctx.save();
    ctx.fillStyle = neuralMixColor(config.neuralNodeColor, config.neuralCursorColor, cursorBlend);
    const nodeAlpha = clamp(config.neuralNodeOpacity, 0, 1) * (0.18 + influence * 0.8 + twinkle * 0.12);
    const cursorAlpha = clamp(config.neuralCursorOpacity, 0, 1);
    ctx.globalAlpha = nodeAlpha + (cursorAlpha - nodeAlpha) * cursorBlend;
    drawNeuralNodeShape(ctx, point, size);
    ctx.restore();
  });
}

function drawNeuralCursor(ctx, cursor, now) {
  const ratio = window.devicePixelRatio || 1;
  const point = neuralToCanvas(cursor);
  const radius = Math.max(0.8, Number(config.neuralCursorSize) || 3.25) * ratio;
  ctx.save();
  ctx.fillStyle = config.neuralCursorColor;
  ctx.globalAlpha = clamp(config.neuralCursorOpacity, 0, 1);
  drawNeuralNodeShape(ctx, point, radius * (1 + Math.sin(now * 0.0042) * 0.035));
  ctx.restore();
}

function drawNeuralNodeShape(ctx, point, radius) {
  if (config.neuralNodeShape === "square") {
    ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    return;
  }
  if (config.neuralNodeShape === "cross") {
    const arm = Math.max(0.75, radius * 0.36);
    ctx.fillRect(point.x - radius, point.y - arm / 2, radius * 2, arm);
    ctx.fillRect(point.x - arm / 2, point.y - radius, arm, radius * 2);
    return;
  }
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function neuralEncodedNodes() {
  if (!state.neuralSystem.nodes.length) prepareNeuralEffect();
  return state.neuralSystem.nodes.map((node) => ({
    x: Number((node.x + node.ox).toFixed(3)),
    y: Number((node.y + node.oy).toFixed(3)),
    sizeJitter: Number(node.sizeJitter.toFixed(3)),
    pulse: Number(node.pulse.toFixed(3)),
  }));
}

function generateNeuralStandaloneHTML() {
  const nodes = neuralEncodedNodes();
  const background = document.body.dataset.theme === "light" ? "#ffffff" : "#050507";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Neural Network Motion</title>
  <style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: ${background}; overflow: hidden; }
canvas { width: min(82vmin, 720px); height: min(82vmin, 720px); display: block; touch-action: none; }
  </style>
</head>
<body>
  <canvas id="stage" aria-hidden="true"></canvas>
  <script>
const nodes = ${JSON.stringify(nodes)};
const config = ${JSON.stringify({
  neuralNodeSize: config.neuralNodeSize,
  neuralNodeColor: config.neuralNodeColor,
  neuralNodeOpacity: config.neuralNodeOpacity,
  neuralNodeShape: config.neuralNodeShape,
  neuralMouseFollow: config.neuralMouseFollow,
  neuralSnapCursor: config.neuralSnapCursor,
  neuralCursorSpeed: config.neuralCursorSpeed,
  neuralCursorColor: config.neuralCursorColor,
  neuralCursorOpacity: config.neuralCursorOpacity,
  neuralCursorSize: config.neuralCursorSize,
  neuralLineColor: config.neuralLineColor,
  neuralLineOpacity: config.neuralLineOpacity,
  neuralLineWidth: config.neuralLineWidth,
})};
const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const pointer = { x: 50, y: 50, active: false };
const cursor = { x: 50, y: 50, vx: 0.08, vy: -0.04 };
let viewport = { x: 0, y: 0, size: 1, width: 1, height: 1 };
let lastFrameAt = null;
let snapIndex = -1;
let snapPulseAt = 0;
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function easeOutCubic(value) {
  const t = clamp(value, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}
function smoothFollow(current, target, rate, dt) {
  const from = Number.isFinite(current) ? current : 0;
  return from + (target - from) * (1 - Math.exp(-rate * dt));
}
function pulseState(now) {
  const age = Math.max(0, now - snapPulseAt);
  return { active: age < 720, progress: clamp(age / 620, 0, 1) };
}
function hexToRgb(color) {
  const hex = String(color || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}
function mixColor(from, to, mix) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const t = clamp(mix, 0, 1);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return "rgb(" + r + ", " + g + ", " + bl + ")";
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
  const size = Math.min(width, height) * 0.98;
  viewport = { x: (width - size) / 2, y: (height - size) / 2, size, width, height };
}
function toCanvas(point) {
  return { x: viewport.x + point.x / 100 * viewport.size, y: viewport.y + point.y / 100 * viewport.size };
}
function fromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const px = (event.clientX - rect.left) * ratio;
  const py = (event.clientY - rect.top) * ratio;
  return { x: (px - viewport.x) / viewport.size * 100, y: (py - viewport.y) / viewport.size * 100 };
}
function updateCursor(dt, now) {
  if (config.neuralMouseFollow && pointer.active) {
    const ease = 1 - Math.exp(-14 * dt);
    cursor.x += (pointer.x - cursor.x) * ease;
    cursor.y += (pointer.y - cursor.y) * ease;
    cursor.vx *= 0.82;
    cursor.vy *= 0.82;
    return;
  }
  if (!Number.isFinite(cursor.driftAngle)) cursor.driftAngle = -0.4;
  const speedScale = Math.max(0, Math.min(2, config.neuralCursorSpeed || 0));
  const motionScale = 0.12 + speedScale * 0.88;
  const turn = Math.sin(now * 0.00031 + cursor.x * 0.017) * 0.010 + Math.cos(now * 0.00023 + cursor.y * 0.019) * 0.008;
  cursor.driftAngle += turn;
  cursor.vx += Math.cos(cursor.driftAngle) * 0.010 * motionScale + (50 - cursor.x) * 0.0019 * motionScale;
  cursor.vy += Math.sin(cursor.driftAngle) * 0.010 * motionScale + (50 - cursor.y) * 0.0019 * motionScale;
  const speed = Math.hypot(cursor.vx, cursor.vy);
  if (speed > 0.19 * motionScale) {
    cursor.vx = cursor.vx / speed * 0.19 * motionScale;
    cursor.vy = cursor.vy / speed * 0.19 * motionScale;
  }
  cursor.x += cursor.vx;
  cursor.y += cursor.vy;
  cursor.vx *= 0.992;
  cursor.vy *= 0.992;
  const margin = 11;
  if (cursor.x < margin || cursor.x > 100 - margin) {
    cursor.vx *= -0.62;
    cursor.driftAngle = Math.PI - cursor.driftAngle;
    cursor.x = clamp(cursor.x, margin, 100 - margin);
  }
  if (cursor.y < margin || cursor.y > 100 - margin) {
    cursor.vy *= -0.62;
    cursor.driftAngle = -cursor.driftAngle;
    cursor.y = clamp(cursor.y, margin, 100 - margin);
  }
}
function nearestNode() {
  let best = null;
  nodes.forEach((node, index) => {
    const distance = Math.hypot(node.x - cursor.x, node.y - cursor.y);
    if (!best || distance < best.distance) best = { node, index, distance };
  });
  return best;
}
function activeLinks(effectiveCursor, skipIndex) {
  return nodes.map((node, index) => {
    const distance = Math.hypot(node.x - effectiveCursor.x, node.y - effectiveCursor.y);
    return { node, index, distance, influence: clamp(1 - distance / 29, 0, 1) };
  }).filter((item) => item.influence > 0 && item.index !== skipIndex).sort((a, b) => b.influence - a.influence).slice(0, 18);
}
function drawNodeShape(point, radius) {
  if (config.neuralNodeShape === "square") ctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  else if (config.neuralNodeShape === "cross") {
    const arm = Math.max(0.75, radius * 0.36);
    ctx.fillRect(point.x - radius, point.y - arm / 2, radius * 2, arm);
    ctx.fillRect(point.x - arm / 2, point.y - radius, arm, radius * 2);
  }
  else { ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill(); }
}
function draw(now) {
  resize();
  const previous = lastFrameAt || now;
  const dt = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
  lastFrameAt = now;
  updateCursor(dt, now);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "${background}";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const ratio = window.devicePixelRatio || 1;
  const snapped = config.neuralSnapCursor ? nearestNode() : null;
  const nextSnapIndex = snapped ? snapped.index : -1;
  if (config.neuralSnapCursor && nextSnapIndex !== snapIndex) snapPulseAt = now;
  snapIndex = nextSnapIndex;
  const pulse = config.neuralSnapCursor ? pulseState(now) : null;
  const effectiveCursor = snapped ? snapped.node : cursor;
  const links = activeLinks(effectiveCursor, snapped ? snapped.index : -1);
  const cursorPoint = toCanvas(effectiveCursor);
  ctx.strokeStyle = config.neuralLineColor;
  ctx.lineCap = "round";
  links.forEach((item, index) => {
    const point = toCanvas(item.node);
    const rawLocal = pulse && pulse.active ? (pulse.progress - index * 0.024) / 0.68 : 1;
    const local = pulse && pulse.active ? easeOutCubic(rawLocal) : 1;
    if (local <= 0.001) return;
    const lineAlpha = clamp(config.neuralLineOpacity, 0, 1) * (0.14 + item.influence * 0.86);
    const electric = pulse && pulse.active ? Math.sin(clamp(rawLocal, 0, 1) * Math.PI) : 0;
    const targetX = cursorPoint.x + (point.x - cursorPoint.x) * local;
    const targetY = cursorPoint.y + (point.y - cursorPoint.y) * local;
    ctx.globalAlpha = lineAlpha * Math.min(1, local * (1.05 + electric * 0.38));
    ctx.lineWidth = Math.max(0.35, config.neuralLineWidth || 1) * ratio * (0.72 + item.influence * 0.62);
    ctx.beginPath();
    ctx.moveTo(cursorPoint.x, cursorPoint.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    if (pulse && pulse.active && electric > 0.08) {
      const head = clamp(local, 0, 1);
      const tail = clamp(head - 0.18, 0, 1);
      ctx.globalAlpha = lineAlpha * electric;
      ctx.lineWidth *= 1.55;
      ctx.beginPath();
      ctx.moveTo(cursorPoint.x + (point.x - cursorPoint.x) * tail, cursorPoint.y + (point.y - cursorPoint.y) * tail);
      ctx.lineTo(cursorPoint.x + (point.x - cursorPoint.x) * head, cursorPoint.y + (point.y - cursorPoint.y) * head);
      ctx.stroke();
    }
  });
  const active = new Map(links.map((item) => [item.index, item.influence]));
  ctx.fillStyle = config.neuralNodeColor;
  nodes.forEach((node, index) => {
    const targetInfluence = active.get(index) || 0;
    node.renderInfluence = smoothFollow(node.renderInfluence, targetInfluence, 10, dt);
    node.renderCursor = smoothFollow(node.renderCursor, snapped && index === snapped.index ? 1 : 0, 14, dt);
    const influence = node.renderInfluence;
    const cursorBlend = node.renderCursor;
    const twinkle = 0.5 + Math.sin(now * 0.0021 + node.pulse) * 0.5;
    const nodeSize = node.sizeJitter * (Math.min(5, Math.max(0, config.neuralNodeSize || 0)) * ratio * (0.58 + influence * 1.25) + influence * ratio * 1.45);
    const cursorSize = Math.max(0.8, config.neuralCursorSize || 3.25) * ratio;
    const size = nodeSize + (cursorSize - nodeSize) * cursorBlend;
    if (size <= 0.02) return;
    const point = toCanvas(node);
    ctx.fillStyle = mixColor(config.neuralNodeColor, config.neuralCursorColor, cursorBlend);
    const nodeAlpha = clamp(config.neuralNodeOpacity, 0, 1) * (0.18 + influence * 0.8 + twinkle * 0.12);
    const cursorAlpha = clamp(config.neuralCursorOpacity, 0, 1);
    ctx.globalAlpha = nodeAlpha + (cursorAlpha - nodeAlpha) * cursorBlend;
    drawNodeShape(point, size);
  });
  if (!snapped) {
    ctx.fillStyle = config.neuralCursorColor;
    ctx.globalAlpha = clamp(config.neuralCursorOpacity, 0, 1);
    drawNodeShape(cursorPoint, Math.max(0.8, config.neuralCursorSize || 3.25) * ratio * (1 + Math.sin(now * 0.0042) * 0.035));
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}
canvas.addEventListener("pointermove", (event) => {
  const point = fromEvent(event);
  pointer.x = point.x;
  pointer.y = point.y;
  pointer.active = true;
});
canvas.addEventListener("pointerleave", () => { pointer.active = false; });
canvas.addEventListener("pointercancel", () => { pointer.active = false; });
requestAnimationFrame(draw);
  <\/script>
</body>
</html>`;
}

function generateNeuralLottie() {
  const nodes = neuralEncodedNodes();
  const cursor = state.neuralSystem.cursor || { x: 50, y: 50 };
  const snapped = config.neuralSnapCursor ? nearestNeuralNode(state.neuralSystem.nodes, cursor) : null;
  const layers = nodes.slice(0, 120).map((node, index) => {
    const isCursor = snapped?.index === index;
    return makeNeuralLottieNodeLayer(
      `Neural Node ${index + 1}`,
      node,
      isCursor
        ? Math.max(0.3, Number(config.neuralCursorSize) * 0.45)
        : Math.max(0.01, Number(config.neuralNodeSize) * 0.28 * (node.sizeJitter || 1)),
      {
        index: index + 1,
        fill: isCursor ? config.neuralCursorColor : config.neuralNodeColor,
        opacity: isCursor ? config.neuralCursorOpacity : config.neuralNodeOpacity,
      },
    );
  });
  const center = snapped ? { x: snapped.x, y: snapped.y } : cursor;
  neuralActiveLinks(state.neuralSystem.nodes, center, snapped?.index ?? -1).slice(0, 12).forEach((item, index) => {
    layers.unshift(makeLottieShapeLayer(`Neural Link ${index + 1}`, makeLottiePathShape([center, item.node], false), {
      index: 200 + index,
      stroke: config.neuralLineColor,
      strokeWidth: Math.max(0.5, Number(config.neuralLineWidth) || 1),
      opacity: config.neuralLineOpacity * (0.2 + item.influence * 0.8),
    }));
  });
  if (!snapped) {
    layers.unshift(makeNeuralLottieNodeLayer("Neural Cursor", center, Math.max(0.3, Number(config.neuralCursorSize) * 0.45), {
      index: 300,
      fill: config.neuralCursorColor,
      opacity: config.neuralCursorOpacity,
    }));
  }
  return makeBasicLottieDocument("Neural Network", layers);
}

function makeNeuralLottieNodeLayer(name, point, radius, options = {}) {
  if (config.neuralNodeShape === "circle") return makeLottieEllipseLayer(name, point, radius, options);
  const [x, y] = lottiePoint(point);
  const size = Math.max(1, radius * 10.24);
  const rectShape = (rectName, width, height) => ({
    ty: "rc",
    p: { a: 0, k: [x, y] },
    s: { a: 0, k: [Math.max(1, width), Math.max(1, height)] },
    r: { a: 0, k: 0 },
    nm: rectName,
  });
  if (config.neuralNodeShape === "cross") {
    const arm = Math.max(1, size * 0.36);
    return makeLottieShapeLayer(name, [
      rectShape("Cross H", size, arm),
      rectShape("Cross V", arm, size),
    ], options);
  }
  return makeLottieShapeLayer(name, rectShape("Square", size, size), options);
}
