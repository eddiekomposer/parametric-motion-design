// oscilloscope effect module. Loaded before the main UI script.
var oscilloscopeDefaults = {
  oscMode: "morph",
  oscFigures: [
    { id: 1, xFreq: 2, yFreq: 3, phaseDeg: 90, rotationDeg: 0, color: "#67d6c3" },
    { id: 2, xFreq: 3, yFreq: 5, phaseDeg: 45, rotationDeg: 0, color: "#f0c96a" },
    { id: 3, xFreq: 4, yFreq: 7, phaseDeg: 120, rotationDeg: 0, color: "#f07a7a" },
  ],
  oscStrokeWidth: 1.05,
  oscScale: 28,
  oscGlow: 0.62,
  oscMorphHoldMs: 900,
  oscMorphTransitionMs: 1800,
  oscMorphSpin: 0.72,
  oscParallelSpacing: 34,
  oscParallelIntervalMs: 3400,
  oscParallelSpinMs: 1150,
  oscRefreshMode: "spin",
  oscParallelTurns: 1,
  oscStaggerMs: 260,
  oscSwipeForce: 0.75,
};

var oscilloscopeControlDefs = [
  {
    key: "oscMode",
    type: "select",
    label: "模式",
    options: [
      { value: "morph", label: "转换" },
      { value: "parallel", label: "并列" },
    ],
    tip: "转换模式在多个李萨如关键帧之间循环；并列模式把所有图形从左到右排列。",
  },
  { key: "oscStrokeWidth", label: "线条粗细", min: 0.35, max: 2.8, step: 0.05, tip: "控制示波器曲线的 SVG stroke 粗细。" },
  { key: "oscScale", label: "图形大小", min: 12, max: 38, step: 0.5, tip: "控制李萨如图形的整体尺寸。" },
  { key: "oscGlow", label: "辉光强度", min: 0, max: 1, step: 0.01, tip: "控制曲线的示波器发光感。" },
  { key: "oscMorphHoldMs", label: "停留时长", min: 300, max: 3200, step: 100, showWhen: () => config.oscMode === "morph", tip: "转换模式中每个关键帧停住的时间。" },
  { key: "oscMorphTransitionMs", label: "转换时长", min: 800, max: 3600, step: 100, showWhen: () => config.oscMode === "morph", tip: "转换模式中过渡到下一帧的时间，包含相位旋转和缓停。" },
  { key: "oscMorphSpin", label: "转换旋转", min: 0.15, max: 1.4, step: 0.05, showWhen: () => config.oscMode === "morph", tip: "转换时通过相位变化形成的平滑旋转幅度。" },
  { key: "oscParallelSpacing", label: "图形间距", min: -16, max: 52, step: 0.5, showWhen: () => config.oscMode === "parallel", tip: "并列模式中只改变图形中心点的水平距离，允许负值重叠，不改变图形尺寸。" },
  {
    key: "oscRefreshMode",
    type: "segmented",
    label: "刷新",
    options: [
      { value: "spin", label: "旋转" },
      { value: "draw", label: "一笔画" },
    ],
    showWhen: () => config.oscMode === "parallel",
    tip: "选择并列模式每次触发的刷新动效。旋转只改变相位；一笔画只重绘路径，两者不会同时发生。",
  },
  { key: "oscParallelIntervalMs", label: "触发周期", min: 1500, max: 7000, step: 100, showWhen: () => config.oscMode === "parallel", tip: "并列模式中每个图形触发一次刷新动效的周期。" },
  { key: "oscParallelSpinMs", label: "动效时长", min: 500, max: 2400, step: 50, showWhen: () => config.oscMode === "parallel", tip: "并列模式中单次刷新动效的时长。旋转模式控制相位旋转时长；一笔画模式控制路径绘制时长。" },
  { key: "oscParallelTurns", label: "旋转圈数", min: 0.1, max: 4, step: 0.1, showWhen: () => config.oscMode === "parallel" && config.oscRefreshMode === "spin", tip: "旋转刷新中所有图形使用同一个圈数。小于 1 时为往返乒乓；大于等于 1 时取整数圈，保证停回原形。" },
  { key: "oscStaggerMs", label: "时间差", min: 0, max: 900, step: 50, showWhen: () => config.oscMode === "parallel", tip: "并列模式中相邻图形的触发延迟。" },
  { key: "oscSwipeForce", label: "滑动力度", min: 0.15, max: 3, step: 0.05, showWhen: () => config.oscMode === "parallel" && config.oscRefreshMode === "spin", tip: "鼠标左右滑过图形时叠加带阻尼的相位冲量。普通滑过只会轻微摆动，快速滑过或调高力度后才会进入完整圈数旋转。" },
];

function renderOscilloscopeFigureEditor(container) {
  const editor = document.createElement("div");
  editor.className = "keyframe-editor";
  editor.innerHTML = `
    <div class="keyframe-head">
      <p class="keyframe-title">李萨如图形</p>
      <div class="panel-actions">
        <button class="small-btn" type="button" data-osc-action="add">添加</button>
      </div>
    </div>
    <p class="oscilloscope-note">X &gt; Y 时看起来像上下旋转，X &lt; Y 时看起来像左右旋转。</p>
    <div class="oscilloscope-row oscilloscope-row-head" aria-hidden="true">
      <span></span><span>X</span><span>Y</span><span>相位</span><span>旋转</span><span>颜色</span><span></span>
    </div>
    <div class="keyframe-list"></div>
  `;
  const list = editor.querySelector(".keyframe-list");
  config.oscFigures.forEach((figure, index) => {
    const row = document.createElement("div");
    row.className = "oscilloscope-row";
    row.innerHTML = `
      <span class="keyframe-index">${index + 1}</span>
      <input class="keyframe-input" type="number" min="1" max="12" step="1" value="${figure.xFreq}" data-osc-id="${figure.id}" data-osc-field="xFreq" aria-label="图形 ${index + 1} X 频率">
      <input class="keyframe-input" type="number" min="1" max="12" step="1" value="${figure.yFreq}" data-osc-id="${figure.id}" data-osc-field="yFreq" aria-label="图形 ${index + 1} Y 频率">
      <input class="keyframe-input" type="number" min="0" max="360" step="1" value="${figure.phaseDeg}" data-osc-id="${figure.id}" data-osc-field="phaseDeg" aria-label="图形 ${index + 1} 相位">
      <input class="keyframe-input" type="number" min="-180" max="180" step="1" value="${figure.rotationDeg}" data-osc-id="${figure.id}" data-osc-field="rotationDeg" aria-label="图形 ${index + 1} 旋转">
      <button class="icon-btn" type="button" data-osc-action="delete" data-osc-id="${figure.id}" aria-label="删除图形 ${index + 1}">×</button>
    `;
    row.insertBefore(renderRgbaControl({
      colorKey: `osc-${figure.id}`,
      label: `图形 ${index + 1} 颜色`,
      tip: "支持 rgba(r, g, b, a) 与 HEX 输入。",
      value: figure.color,
      compact: true,
      onInput: (event) => {
        const control = rgbaControlForTarget(event.target);
        if (!control) return;
        const parts = colorPartsFromRgbaControlTarget(event.target, control);
        markRgbaControlValidity(control, Boolean(parts));
        if (!parts) return;
        const currentFigure = config.oscFigures.find((item) => String(item.id) === String(figure.id)) || figure;
        currentFigure.color = colorPartsToCss(parts);
        control.dataset.colorValue = currentFigure.color;
        control.dataset.opacityValue = parts.a;
        updateRgbaControl(control);
        activeEffect().prepare();
        state.startedAt = performance.now();
        updateMeta();
        updateFormulaAndCode();
        refreshPreviewNow();
      },
    }), row.lastElementChild);
    list.appendChild(row);
  });
  editor.addEventListener("input", (event) => {
    const input = event.target.closest("[data-osc-field]");
    if (!input) return;
    const figure = config.oscFigures.find((item) => String(item.id) === String(input.dataset.oscId));
    if (!figure) return;
    const field = input.dataset.oscField;
    if (field === "xFreq" || field === "yFreq") figure[field] = clamp(Math.round(Number(input.value)), 1, 12);
    else if (field === "phaseDeg") figure[field] = ((Number(input.value) % 360) + 360) % 360;
    else figure[field] = clamp(Number(input.value), -180, 180);
    activeEffect().prepare();
    state.startedAt = performance.now();
    updateMeta();
    updateFormulaAndCode();
  });
  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-osc-action]");
    if (!button) return;
    const action = button.dataset.oscAction;
    if (action === "add") {
      const nextId = Math.max(0, ...config.oscFigures.map((figure) => figure.id)) + 1;
      const palette = ["#67d6c3", "#f0c96a", "#f07a7a", "#9ca7ff", "#f58bc7"];
      const index = config.oscFigures.length;
      config.oscFigures.push({
        id: nextId,
        xFreq: 2 + (index % 4),
        yFreq: 4 + (index % 5),
        phaseDeg: (45 + index * 37) % 180,
        rotationDeg: 0,
        color: palette[index % palette.length],
      });
    } else if (action === "delete" && config.oscFigures.length > 1) {
      config.oscFigures = config.oscFigures.filter((figure) => String(figure.id) !== String(button.dataset.oscId));
    }
    renderMotionControls();
    activeEffect().prepare();
    state.startedAt = performance.now();
    updateMeta();
    updateFormulaAndCode();
  });
  container.appendChild(editor);
}

function prepareOscilloscopeEffect() {
  state.samples = [];
  state.coefficients = [];
  const existing = Array.isArray(config.oscFigures) ? config.oscFigures : [];
  const normalized = sanitizeOscilloscopeFigures(existing).map((figure, index) => Object.assign(existing[index] && typeof existing[index] === "object" ? existing[index] : {}, figure));
  if (Array.isArray(config.oscFigures)) config.oscFigures.splice(0, config.oscFigures.length, ...normalized);
  else config.oscFigures = normalized;
  state.oscilloscopeHoverForces = config.oscFigures.map(() => ({ offset: 0, velocity: 0 }));
  state.oscilloscopeLastFrameAt = null;
}

function sanitizeOscilloscopeFigures(figures) {
  const source = Array.isArray(figures) && figures.length ? figures : cloneDefaults(oscilloscopeDefaults.oscFigures);
  return source.map((figure, index) => ({
    id: Number.isFinite(Number(figure.id)) ? Number(figure.id) : index + 1,
    xFreq: clamp(Math.round(Number(figure.xFreq) || 3), 1, 12),
    yFreq: clamp(Math.round(Number(figure.yFreq) || 2), 1, 12),
    phaseDeg: ((Number(figure.phaseDeg) || 0) % 360 + 360) % 360,
    rotationDeg: clamp(Number(figure.rotationDeg) || 0, -180, 180),
    color: isValidColorString(figure.color) ? String(figure.color) : "#67d6c3",
  }));
}

function ensureOscilloscopeGroup() {
  if (!state.oscilloscopeGroup) {
    state.oscilloscopeGroup = document.createElementNS(SVG_NS, "g");
    state.oscilloscopeGroup.setAttribute("id", "oscilloscope-group");
    motionGroup.appendChild(state.oscilloscopeGroup);
  }
  state.oscilloscopeGroup.style.display = "";
  return state.oscilloscopeGroup;
}

function hideOscilloscopeGroup() {
  if (state.oscilloscopeGroup) state.oscilloscopeGroup.style.display = "none";
}

function ensureOscilloscopeElements(count) {
  const group = ensureOscilloscopeGroup();
  while (state.oscilloscopePaths.length < count) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "oscilloscope-path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("pointer-events", "stroke");
    group.appendChild(path);
    state.oscilloscopePaths.push(path);
  }
  state.oscilloscopePaths.forEach((path, index) => {
    path.style.display = index < count ? "" : "none";
  });
}

function degToRad(value) {
  return (Number(value) * Math.PI) / 180;
}

function lissajousPoints(figure, phaseOffset = 0, center = { x: 50, y: 50 }, scale = config.oscScale, samples = 260) {
  const points = [];
  const phase = degToRad(figure.phaseDeg) + phaseOffset;
  const rotation = degToRad(figure.rotationDeg);
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const amp = Math.max(1, scale);
  for (let index = 0; index <= samples; index += 1) {
    const t = (index / samples) * Math.PI * 2;
    const rawX = Math.sin(figure.xFreq * t + phase);
    const rawY = Math.sin(figure.yFreq * t);
    points.push({
      x: center.x + (rawX * cosR - rawY * sinR) * amp,
      y: center.y + (rawX * sinR + rawY * cosR) * amp,
    });
  }
  return points;
}

function buildPolylineSvgPath(points) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function buildProgressivePolylineSvgPath(points, fraction) {
  const value = clamp(fraction, 0, 1);
  if (!points.length || value <= 0.001) return "";
  if (value >= 0.999 || points.length < 2) return buildPolylineSvgPath(points);
  const scaled = value * (points.length - 1);
  const fullIndex = Math.floor(scaled);
  const partial = scaled - fullIndex;
  const visible = points.slice(0, Math.min(points.length, fullIndex + 1));
  if (fullIndex < points.length - 1) {
    visible.push(lerpPoint(points[fullIndex], points[fullIndex + 1], partial));
  }
  return buildPolylineSvgPath(visible);
}

function lerpLissajousFigures(a, b, progress) {
  const hueColor = progress < 0.5 ? a.color : b.color;
  return {
    id: a.id,
    xFreq: a.xFreq + (b.xFreq - a.xFreq) * progress,
    yFreq: a.yFreq + (b.yFreq - a.yFreq) * progress,
    phaseDeg: a.phaseDeg + shortestAngleDelta(a.phaseDeg, b.phaseDeg) * progress,
    rotationDeg: a.rotationDeg + shortestAngleDelta(a.rotationDeg, b.rotationDeg) * progress,
    color: hueColor,
  };
}

function shortestAngleDelta(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

function drawOscilloscopePath(path, points, color, opacity = 1, drawFraction = 1) {
  path.setAttribute("d", buildProgressivePolylineSvgPath(points, drawFraction));
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", String(config.oscStrokeWidth));
  path.setAttribute("opacity", opacity.toFixed(3));
  path.style.filter = config.oscGlow > 0 ? `drop-shadow(0 0 ${(1 + config.oscGlow * 6).toFixed(1)}px ${hexToRgba(color, 0.68 * config.oscGlow)})` : "";
  path.style.strokeDasharray = "";
  path.style.strokeDashoffset = "";
}

function hexToRgba(hex, alpha) {
  const value = String(hex).replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function renderOscilloscopeEffect(now) {
  hideParticleCanvas();
  hideParticles();
  hideLineGroup();
  hideSineGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  motionGroup.removeAttribute("transform");
  const figures = config.oscFigures;
  if (config.oscMode === "parallel") renderOscilloscopeParallel(now, figures);
  else renderOscilloscopeMorph(now, figures);
  state.oscilloscopeLastFrameAt = now;
}

function renderOscilloscopeMorph(now, figures) {
  ensureOscilloscopeElements(1);
  const path = state.oscilloscopePaths[0];
  if (!figures.length) return;
  if (figures.length === 1) {
    drawOscilloscopePath(path, lissajousPoints(figures[0]), figures[0].color);
    return;
  }
  const elapsed = now - state.startedAt;
  const transition = Math.max(300, config.oscMorphTransitionMs);
  const hold = Math.max(0, config.oscMorphHoldMs);
  const segmentDuration = hold + transition;
  const segment = ((Math.floor(elapsed / segmentDuration) % figures.length) + figures.length) % figures.length;
  const local = ((elapsed % segmentDuration) + segmentDuration) % segmentDuration;
  const current = figures[segment];
  const next = figures[(segment + 1) % figures.length];
  if (local < hold) {
    drawOscilloscopePath(path, lissajousPoints(current), current.color);
    return;
  }
  const raw = (local - hold) / transition;
  const phaseEase = standardBezierEase(raw);
  const shapeWindow = 0.5;
  const shapeStart = 0.5 - shapeWindow / 2;
  const shapeProgress = standardBezierEase(clamp((raw - shapeStart) / shapeWindow, 0, 1));
  const spin = config.oscMorphSpin * Math.PI * 2;
  const fromPoints = lissajousPoints(current, phaseEase * spin);
  const toPoints = lissajousPoints(next, (phaseEase - 1) * spin);
  const points = fromPoints.map((point, index) => lerpPoint(point, toPoints[index], shapeProgress));
  const mixed = lerpLissajousFigures(current, next, shapeProgress);
  drawOscilloscopePath(path, points, mixed.color);
}

function renderOscilloscopeParallel(now, figures) {
  ensureOscilloscopeElements(figures.length);
  decayOscilloscopeHoverForces(now);
  const centers = oscilloscopeParallelCenters(figures.length);
  figures.forEach((figure, index) => {
    const path = state.oscilloscopePaths[index];
    const isSpinMode = config.oscRefreshMode === "spin";
    const hover = oscilloscopeHoverState(index);
    const motion = isSpinMode ? parallelSpinMotion(now - state.startedAt, index) : { phase: 0 };
    const phase = motion.phase + (isSpinMode ? hover.offset : 0);
    const scale = oscilloscopeParallelScale(figures.length);
    const points = lissajousPoints(figure, phase, centers[index], scale);
    const drawFraction = config.oscRefreshMode === "draw" ? oscilloscopeDrawFraction(now - state.startedAt, index) : 1;
    path.dataset.oscIndex = String(index);
    drawOscilloscopePath(path, points, figure.color, 1, drawFraction);
  });
}

function oscilloscopeParallelCenters(count) {
  const spacing = config.oscParallelSpacing;
  const start = 50 - ((count - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, index) => ({ x: start + index * spacing, y: 50 }));
}

function oscilloscopeParallelScale(count) {
  return Math.max(5, config.oscScale);
}

function parallelSpinMotion(elapsed, index) {
  const interval = Math.max(800, config.oscParallelIntervalMs);
  const spinDuration = Math.min(Math.max(250, config.oscParallelSpinMs), interval);
  const shifted = elapsed - index * config.oscStaggerMs;
  const local = ((shifted % interval) + interval) % interval;
  if (local > spinDuration) return { phase: 0 };
  const progress = local / spinDuration;
  const direction = index % 2 === 0 ? 1 : -1;
  const configuredTurns = Math.max(0.1, Number(config.oscParallelTurns) || 1);
  if (configuredTurns < 1) {
    return {
      phase: direction * Math.sin(progress * Math.PI) * Math.PI * 2 * configuredTurns,
    };
  }
  const phaseProgress = standardBezierEase(progress);
  const turns = Math.max(1, Math.round(configuredTurns));
  return {
    phase: direction * phaseProgress * Math.PI * 2 * turns,
  };
}

function oscilloscopeDrawFraction(elapsed, index) {
  const drawMs = Math.max(250, config.oscParallelSpinMs);
  const cycle = Math.max(drawMs, config.oscParallelIntervalMs);
  const local = (((elapsed - index * config.oscStaggerMs) % cycle) + cycle) % cycle;
  return local < drawMs ? standardBezierEase(local / drawMs) : 1;
}

function decayOscilloscopeHoverForces(now) {
  const previous = state.oscilloscopeLastFrameAt ?? now;
  const dt = Math.min(0.08, Math.max(0, (now - previous) / 1000));
  state.oscilloscopeHoverForces = config.oscFigures.map((_, index) => {
    const item = oscilloscopeHoverState(index);
    if (item.spin) {
      const progress = clamp((now - item.spin.startedAt) / Math.max(1, item.spin.duration), 0, 1);
      item.offset = item.spin.baseOffset + item.spin.direction * standardBezierEase(progress) * Math.PI * 2 * item.spin.turns;
      item.velocity = 0;
      if (progress >= 1) {
        item.offset = item.spin.baseOffset;
        item.spin = null;
      }
      return item;
    }
    item.velocity += -item.offset * 20 * dt;
    item.velocity *= Math.exp(-10.5 * dt);
    item.offset = clamp(item.offset + item.velocity * dt, -Math.PI * 0.72, Math.PI * 0.72);
    if (Math.abs(item.offset) < 0.0005 && Math.abs(item.velocity) < 0.0005) {
      item.offset = 0;
      item.velocity = 0;
    }
    return item;
  });
}

function oscilloscopeHoverState(index) {
  const item = state.oscilloscopeHoverForces[index];
  if (item && typeof item === "object") return item;
  const fallback = { offset: Number(item) || 0, velocity: 0 };
  state.oscilloscopeHoverForces[index] = fallback;
  return fallback;
}

function handleOscilloscopePointerMove(event) {
  if (config.effectType !== "oscilloscope" || config.oscMode !== "parallel" || config.oscRefreshMode !== "spin") {
    state.oscilloscopeLastPointerX = event.clientX;
    return;
  }
  const dx = state.oscilloscopeLastPointerX == null ? 0 : event.clientX - state.oscilloscopeLastPointerX;
  state.oscilloscopeLastPointerX = event.clientX;
  if (Math.abs(dx) < 0.5) return;
  const svgPoint = svgPointFromEvent(event);
  const centers = oscilloscopeParallelCenters(config.oscFigures.length);
  const influenceRadius = Math.max(12, config.oscParallelSpacing > 0 ? Math.abs(config.oscParallelSpacing) * 0.75 : config.oscScale * 0.9);
  const direction = Math.sign(dx);
  centers.forEach((center, index) => {
    const distanceFromPointer = Math.hypot(svgPoint.x - center.x, svgPoint.y - center.y);
    const influence = clamp(1 - distanceFromPointer / influenceRadius, 0, 1);
    if (influence <= 0) return;
    const hover = oscilloscopeHoverState(index);
    const normalizedDx = Math.min(18, Math.abs(dx)) / 18;
    const rawTurns = Math.pow(normalizedDx, 1.15) * config.oscSwipeForce * 0.45 * influence;
    if (rawTurns >= 1) {
      hover.spin = {
        startedAt: performance.now(),
        duration: clamp(config.oscParallelSpinMs * Math.min(1.18, 0.82 + rawTurns * 0.12), 420, 2200),
        direction,
        turns: Math.min(2, Math.max(1, Math.round(rawTurns))),
        baseOffset: hover.offset,
      };
      hover.velocity = 0;
    } else {
      hover.velocity = clamp(hover.velocity + direction * rawTurns * 4.4, -4.8, 4.8);
    }
  });
}

function generateOscilloscopeStandaloneHTML() {
  const figures = sanitizeOscilloscopeFigures(config.oscFigures).map((figure) => ({
    id: figure.id,
    xFreq: figure.xFreq,
    yFreq: figure.yFreq,
    phaseDeg: Number(figure.phaseDeg.toFixed(3)),
    rotationDeg: Number(figure.rotationDeg.toFixed(3)),
    color: figure.color,
  }));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Oscilloscope Lissajous Motion</title>
  <style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050507; }
svg { width: min(78vmin, 620px); height: min(78vmin, 620px); overflow: visible; }
path { pointer-events: stroke; }
  </style>
</head>
<body>
  <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
<g id="oscilloscope"></g>
  </svg>
  <script>
const SVG_NS = "http://www.w3.org/2000/svg";
const figures = ${JSON.stringify(figures)};
const config = ${JSON.stringify({
  oscMode: config.oscMode,
  oscStrokeWidth: config.oscStrokeWidth,
  oscScale: config.oscScale,
  oscGlow: config.oscGlow,
  oscMorphHoldMs: config.oscMorphHoldMs,
  oscMorphTransitionMs: config.oscMorphTransitionMs,
  oscMorphSpin: config.oscMorphSpin,
  oscParallelSpacing: config.oscParallelSpacing,
  oscParallelIntervalMs: config.oscParallelIntervalMs,
  oscParallelSpinMs: config.oscParallelSpinMs,
  oscRefreshMode: config.oscRefreshMode,
  oscParallelTurns: config.oscParallelTurns,
  oscStaggerMs: config.oscStaggerMs,
  oscSwipeForce: config.oscSwipeForce,
})};
const group = document.querySelector("#oscilloscope");
const paths = [];
let startedAt = performance.now();
let lastFrameAt = null;
let lastPointerX = null;
let hoverForces = figures.map(() => ({ offset: 0, velocity: 0 }));
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function degToRad(value) { return Number(value) * Math.PI / 180; }
function cubicBezierAxis(t, p1, p2) {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}
function standardBezierEase(value) {
  const target = clamp(value, 0, 1);
  let low = 0, high = 1, t = target;
  for (let i = 0; i < 14; i += 1) {
    t = (low + high) / 2;
    const x = cubicBezierAxis(t, 0.5, 0);
    if (x < target) low = t;
    else high = t;
  }
  return cubicBezierAxis(t, 0, 1);
}
function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function shortestAngleDelta(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}
function lissajousPoints(figure, phaseOffset = 0, center = { x: 50, y: 50 }, scale = config.oscScale, samples = 260) {
  const points = [];
  const phase = degToRad(figure.phaseDeg) + phaseOffset;
  const rotation = degToRad(figure.rotationDeg);
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  for (let index = 0; index <= samples; index += 1) {
    const t = (index / samples) * Math.PI * 2;
    const rawX = Math.sin(figure.xFreq * t + phase);
    const rawY = Math.sin(figure.yFreq * t);
    points.push({
      x: center.x + (rawX * cosR - rawY * sinR) * scale,
      y: center.y + (rawX * sinR + rawY * cosR) * scale,
    });
  }
  return points;
}
function pathData(points) {
  return points.map((point, index) => (index === 0 ? "M" : "L") + " " + point.x.toFixed(2) + " " + point.y.toFixed(2)).join(" ");
}
function progressivePathData(points, fraction) {
  const value = clamp(fraction, 0, 1);
  if (!points.length || value <= 0.001) return "";
  if (value >= 0.999 || points.length < 2) return pathData(points);
  const scaled = value * (points.length - 1);
  const fullIndex = Math.floor(scaled);
  const partial = scaled - fullIndex;
  const visible = points.slice(0, Math.min(points.length, fullIndex + 1));
  if (fullIndex < points.length - 1) {
    visible.push(lerpPoint(points[fullIndex], points[fullIndex + 1], partial));
  }
  return pathData(visible);
}
function hexToRgba(hex, alpha) {
  const value = String(hex).replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + clamp(alpha, 0, 1).toFixed(3) + ")";
}
function ensurePaths(count) {
  while (paths.length < count) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    group.appendChild(path);
    paths.push(path);
  }
  paths.forEach((path, index) => { path.style.display = index < count ? "" : "none"; });
}
function draw(path, points, color, fraction = 1) {
  path.setAttribute("d", progressivePathData(points, fraction));
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", config.oscStrokeWidth);
  path.setAttribute("opacity", "1");
  path.style.filter = config.oscGlow > 0 ? "drop-shadow(0 0 " + (1 + config.oscGlow * 6).toFixed(1) + "px " + hexToRgba(color, 0.68 * config.oscGlow) + ")" : "";
  path.style.strokeDasharray = "";
  path.style.strokeDashoffset = "";
}
function renderMorph(now) {
  ensurePaths(1);
  if (figures.length === 1) {
    draw(paths[0], lissajousPoints(figures[0]), figures[0].color);
    return;
  }
  const elapsed = now - startedAt;
  const transition = Math.max(300, config.oscMorphTransitionMs);
  const hold = Math.max(0, config.oscMorphHoldMs);
  const segmentDuration = hold + transition;
  const segment = ((Math.floor(elapsed / segmentDuration) % figures.length) + figures.length) % figures.length;
  const local = ((elapsed % segmentDuration) + segmentDuration) % segmentDuration;
  const current = figures[segment];
  const next = figures[(segment + 1) % figures.length];
  if (local < hold) {
    draw(paths[0], lissajousPoints(current), current.color);
    return;
  }
  const raw = (local - hold) / transition;
  const phaseEase = standardBezierEase(raw);
  const shapeWindow = 0.5;
  const shapeStart = 0.5 - shapeWindow / 2;
  const shapeProgress = standardBezierEase(clamp((raw - shapeStart) / shapeWindow, 0, 1));
  const spin = config.oscMorphSpin * Math.PI * 2;
  const fromPoints = lissajousPoints(current, phaseEase * spin);
  const toPoints = lissajousPoints(next, (phaseEase - 1) * spin);
  const points = fromPoints.map((point, index) => lerpPoint(point, toPoints[index], shapeProgress));
  draw(paths[0], points, shapeProgress < 0.5 ? current.color : next.color);
}
function centers(count) {
  const start = 50 - ((count - 1) * config.oscParallelSpacing) / 2;
  return Array.from({ length: count }, (_, index) => ({ x: start + index * config.oscParallelSpacing, y: 50 }));
}
function parallelScale(count) {
  return Math.max(5, config.oscScale);
}
function spinMotion(elapsed, index) {
  const interval = Math.max(800, config.oscParallelIntervalMs);
  const spinDuration = Math.min(Math.max(250, config.oscParallelSpinMs), interval);
  const local = (((elapsed - index * config.oscStaggerMs) % interval) + interval) % interval;
  if (local > spinDuration) return { phase: 0 };
  const progress = local / spinDuration;
  const configuredTurns = Math.max(0.1, Number(config.oscParallelTurns) || 1);
  if (configuredTurns < 1) {
    return {
      phase: (index % 2 === 0 ? 1 : -1) * Math.sin(progress * Math.PI) * Math.PI * 2 * configuredTurns,
    };
  }
  const phaseProgress = standardBezierEase(progress);
  const turns = Math.max(1, Math.round(configuredTurns));
  return {
    phase: (index % 2 === 0 ? 1 : -1) * phaseProgress * Math.PI * 2 * turns,
  };
}
function drawFraction(elapsed, index) {
  const drawMs = Math.max(250, config.oscParallelSpinMs);
  const cycle = Math.max(drawMs, config.oscParallelIntervalMs);
  const local = (((elapsed - index * config.oscStaggerMs) % cycle) + cycle) % cycle;
  return local < drawMs ? standardBezierEase(local / drawMs) : 1;
}
function decayHover(now) {
  const previous = lastFrameAt ?? now;
  const dt = Math.min(0.08, Math.max(0, (now - previous) / 1000));
  hoverForces = figures.map((_, index) => {
    const item = hoverState(index);
    if (item.spin) {
      const progress = clamp((now - item.spin.startedAt) / Math.max(1, item.spin.duration), 0, 1);
      item.offset = item.spin.baseOffset + item.spin.direction * standardBezierEase(progress) * Math.PI * 2 * item.spin.turns;
      item.velocity = 0;
      if (progress >= 1) {
        item.offset = item.spin.baseOffset;
        item.spin = null;
      }
      return item;
    }
    item.velocity += -item.offset * 20 * dt;
    item.velocity *= Math.exp(-10.5 * dt);
    item.offset = clamp(item.offset + item.velocity * dt, -Math.PI * 0.72, Math.PI * 0.72);
    if (Math.abs(item.offset) < 0.0005 && Math.abs(item.velocity) < 0.0005) {
      item.offset = 0;
      item.velocity = 0;
    }
    return item;
  });
}
function hoverState(index) {
  const item = hoverForces[index];
  if (item && typeof item === "object") return item;
  const fallback = { offset: Number(item) || 0, velocity: 0 };
  hoverForces[index] = fallback;
  return fallback;
}
function renderParallel(now) {
  ensurePaths(figures.length);
  decayHover(now);
  const layout = centers(figures.length);
  const size = parallelScale(figures.length);
  figures.forEach((figure, index) => {
    paths[index].dataset.index = String(index);
    const isSpinMode = config.oscRefreshMode === "spin";
    const hover = hoverState(index);
    const motion = isSpinMode ? spinMotion(now - startedAt, index) : { phase: 0 };
    const points = lissajousPoints(figure, motion.phase + (isSpinMode ? hover.offset : 0), layout[index], size);
    draw(paths[index], points, figure.color, config.oscRefreshMode === "draw" ? drawFraction(now - startedAt, index) : 1);
  });
}
function tick(now) {
  if (config.oscMode === "parallel") renderParallel(now);
  else renderMorph(now);
  lastFrameAt = now;
  requestAnimationFrame(tick);
}
group.addEventListener("pointermove", (event) => {
  const dx = lastPointerX == null ? 0 : event.clientX - lastPointerX;
  lastPointerX = event.clientX;
  if (config.oscMode !== "parallel" || config.oscRefreshMode !== "spin" || Math.abs(dx) < 0.5) return;
  const rect = event.currentTarget.ownerSVGElement.getBoundingClientRect();
  const point = {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100,
  };
  const layout = centers(figures.length);
  const influenceRadius = Math.max(12, config.oscParallelSpacing > 0 ? Math.abs(config.oscParallelSpacing) * 0.75 : config.oscScale * 0.9);
  const direction = Math.sign(dx);
  layout.forEach((center, index) => {
    const distanceFromPointer = Math.hypot(point.x - center.x, point.y - center.y);
    const influence = clamp(1 - distanceFromPointer / influenceRadius, 0, 1);
    if (influence <= 0) return;
    const hover = hoverState(index);
    const normalizedDx = Math.min(18, Math.abs(dx)) / 18;
    const rawTurns = Math.pow(normalizedDx, 1.15) * config.oscSwipeForce * 0.45 * influence;
    if (rawTurns >= 1) {
      hover.spin = {
        startedAt: performance.now(),
        duration: clamp(config.oscParallelSpinMs * Math.min(1.18, 0.82 + rawTurns * 0.12), 420, 2200),
        direction,
        turns: Math.min(2, Math.max(1, Math.round(rawTurns))),
        baseOffset: hover.offset,
      };
      hover.velocity = 0;
    } else {
      hover.velocity = clamp(hover.velocity + direction * rawTurns * 4.4, -4.8, 4.8);
    }
  });
});
group.addEventListener("pointerleave", () => { lastPointerX = null; });
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function generateOscilloscopeLottie() {
  const figures = sanitizeOscilloscopeFigures(config.oscFigures);
  const centers = config.oscMode === "parallel" ? oscilloscopeParallelCenters(figures.length) : figures.map(() => ({ x: 50, y: 50 }));
  const scale = config.oscMode === "parallel" ? oscilloscopeParallelScale(figures.length) : config.oscScale;
  const layers = figures.map((figure, index) => makeLottieShapeLayer(
    `Oscilloscope ${index + 1}`,
    makeLottiePathShape(lissajousPoints(figure, 0, centers[index], scale, 180), false),
    {
      index: index + 1,
      stroke: figure.color,
      strokeWidth: Math.max(1, config.oscStrokeWidth * 5.12),
      opacity: 1,
    },
  ));
  return makeBasicLottieDocument("Oscilloscope", layers);
}
