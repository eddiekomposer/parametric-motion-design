// particle effect module. Loaded before the main UI script.
var particleDefaults = {
  particleKeyframes: [],
  particleColors: [
    { id: 1, color: "#8F959E", ratio: 1 },
  ],
  particleStrengthenEdges: true,
  particleFrameIntervalMs: 2400,
  particleTransitionMs: 1200,
  particleSize: 1.35,
  particleDensity: 0.78,
  particleStability: 0.68,
  particleMouseForce: 1,
  particleSquareOnColor: "#8AB4EF",
  particleSquareOnOpacity: 0.98,
  particleSquareOffColor: "#202632",
  particleSquareOffOpacity: 0.34,
  particleSquareMotion: "glitch",
  particleStructure: "particle",
  particleRenderMode: "fill",
  particleType: "circle",
};

var particleControlDefs = [
  {
    key: "particleStructure",
    type: "segmented",
    label: "动效样式",
    options: [
      { value: "particle", label: "粒子" },
      { value: "matrix", label: "点阵" },
    ],
    tip: "粒子为流动点；点阵为固定网格。",
  },
  { key: "particleSquareOnColor", alphaKey: "particleSquareOnOpacity", type: "colorAlpha", label: "点阵亮色", showWhen: () => isParticleMatrixMode(), tip: "控制点阵像素亮起时的颜色和透明度。" },
  { key: "particleSquareOffColor", alphaKey: "particleSquareOffOpacity", type: "colorAlpha", label: "点阵底色", showWhen: () => isParticleMatrixMode(), tip: "控制点阵像素熄灭时的底色和透明度。" },
  {
    key: "particleRenderMode",
    type: "segmented",
    label: "绘制样式",
    options: [
      { value: "fill", label: "填充" },
      { value: "ascii", label: "ASCII" },
    ],
    tip: "填充使用圆形或点阵方块；ASCII 将对应粒子或点阵单元绘制为持续变化的字符。",
  },
  { key: "particleStrengthenEdges", type: "toggle", label: "加强边缘", tip: "开启后，图案边缘附近会得到更高采样权重，内部仍保留少量粒子填充。" },
  { key: "particleFrameIntervalMs", label: "动效周期", min: 0, max: 7000, step: 100, tip: "关键帧之间的间隔。设为 0 时不额外停留，按动效时长连续切换。" },
  { key: "particleTransitionMs", label: "动效时长", min: 400, max: 4000, step: 50, tip: "单次关键帧过渡时长，使用自然 ease 曲线；超过周期时会自动按周期收敛。" },
  { key: "particleSize", label: () => isParticleMatrixMode() ? "点阵大小" : "粒子大小", min: () => isParticleMatrixMode() ? 5 : 0.45, max: () => isParticleMatrixMode() ? 20 : 3.8, step: () => isParticleMatrixMode() ? 1 : 0.05, tip: "粒子模式控制圆形半径或 ASCII 字号；点阵模式控制行/列上的像素数量，例如 5 表示 5x5。" },
  { key: "particleDensity", label: "粒子密度", min: 0.12, max: 1.55, step: 0.01, showWhen: () => !isParticleMatrixMode(), tip: "控制参与形状重组的粒子数量。密度越高，轮廓和内部越完整。" },
  { key: "particleStability", label: "粒子稳定性", min: 0, max: 1, step: 0.01, showWhen: () => !isParticleMatrixMode(), tip: "控制随机漂浮幅度。值越高越贴合目标，值越低越有流体感。" },
  { key: "particleMouseForce", label: "鼠标推力", min: 0, max: 3, step: 0.05, showWhen: () => !isParticleMatrixMode(), tip: "控制鼠标滑过时推开粒子的力度。复原仍保持带阻尼的慢回弹。" },
  {
    key: "particleSquareMotion",
    type: "segmented",
    label: "点阵动效",
    showWhen: () => isParticleMatrixMode(),
    options: [
      { value: "glitch", label: "故障" },
      { value: "scan", label: "扫描" },
    ],
    tip: "故障为接触不良式闪烁；扫描会按顺序 sweep 方块状态。",
  },
];

function isParticleMatrixMode() {
  return config.particleStructure === "matrix";
}

function isParticleAsciiMode() {
  return config.particleRenderMode === "ascii";
}

function syncParticleTypeFromStyle() {
  config.particleType = config.particleStructure === "matrix" ? "square" : (config.particleRenderMode === "ascii" ? "ascii" : "circle");
}

function syncParticleStyleFromType() {
  if (config.particleType === "square") {
    config.particleStructure = "matrix";
    config.particleRenderMode = config.particleRenderMode || "fill";
  } else if (config.particleType === "ascii") {
    config.particleStructure = "particle";
    config.particleRenderMode = "ascii";
  } else {
    config.particleStructure = config.particleStructure === "matrix" ? "matrix" : "particle";
    config.particleRenderMode = config.particleRenderMode === "ascii" ? "ascii" : "fill";
  }
  syncParticleTypeFromStyle();
}

function particleMatrixCellCount() {
  return clamp(Math.round(Number(config.particleSize) || 5), 5, 20);
}

function normalizeParticleSizeForMode() {
  if (isParticleMatrixMode()) {
    config.particleSize = particleMatrixCellCount();
  } else {
    config.particleSize = clamp(Number(config.particleSize) || particleDefaults.particleSize, 0.45, 3.8);
  }
}

function renderParticleKeyframeEditor(container) {
  ensureParticleDefaultKeyframes();
  const editor = document.createElement("div");
  editor.className = "keyframe-editor";
  editor.innerHTML = `
    <div class="keyframe-head keyframe-head--actions-only">
      <div class="panel-actions">
        <button class="small-btn" type="button" data-particle-frame-action="add">添加图片</button>
      </div>
    </div>
    <div class="keyframe-list"></div>
  `;
  const list = editor.querySelector(".keyframe-list");
  config.particleKeyframes.forEach((frame, index) => {
    const row = document.createElement("div");
    row.className = `particle-row${config.effectType === "morph" ? " particle-row--morph" : ""}`;
    row.innerHTML = `
      <img class="particle-thumb" src="${frame.preview || ""}" alt="">
      <div>
        <div class="particle-name">${escapeHtml(frame.name || `关键帧 ${index + 1}`)}</div>
        <div class="particle-subtitle">${frame.width || 0}x${frame.height || 0}</div>
      </div>
      ${config.effectType === "morph" ? `<button class="small-btn" type="button" data-particle-frame-action="edit-regions" data-particle-frame-id="${frame.id}">${state.morphSystem.labelEditor?.frameId === frame.id ? "完成" : "编辑"}</button>` : ""}
      <button class="small-btn" type="button" data-particle-frame-action="replace" data-particle-frame-id="${frame.id}">上传</button>
      <button class="icon-btn" type="button" data-particle-frame-action="delete" data-particle-frame-id="${frame.id}" aria-label="删除参考图 ${index + 1}">×</button>
    `;
    list.appendChild(row);
  });
  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-particle-frame-action]");
    if (!button) return;
    const action = button.dataset.particleFrameAction;
    if (action === "add") {
      requestParticleFrameUpload(null);
      return;
    }
    const frameId = Number(button.dataset.particleFrameId);
    if (action === "edit-regions") {
      toggleMorphRegionLabelEditor(frameId);
      return;
    }
    if (action === "replace") {
      requestParticleFrameUpload(frameId);
      return;
    }
    if (action === "delete" && config.particleKeyframes.length > 1) {
      config.particleKeyframes = config.particleKeyframes.filter((frame) => frame.id !== frameId);
      if (state.morphSystem.labelEditor?.frameId === frameId) state.morphSystem.labelEditor = null;
      renderMotionControls();
      activeEffect().prepare();
      state.startedAt = performance.now();
      updateMeta();
      updateFormulaAndCode();
    }
  });
  container.appendChild(editor);
}

function renderParticleColorEditor(container) {
  sanitizeParticleColors();
  const editor = document.createElement("div");
  editor.className = "keyframe-editor";
  editor.innerHTML = `
    <div class="keyframe-head">
      <p class="keyframe-title">粒子颜色</p>
      <div class="panel-actions">
        <button class="small-btn" type="button" data-particle-color-action="add">添加</button>
      </div>
    </div>
    <div class="keyframe-list"></div>
  `;
  const list = editor.querySelector(".keyframe-list");
  config.particleColors.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "particle-color-row";
    row.innerHTML = `
      <input class="keyframe-input" type="range" min="0.05" max="5" step="0.05" value="${item.ratio}" data-particle-color-id="${item.id}" data-particle-color-field="ratio" aria-label="粒子颜色 ${index + 1} 比例">
      <span class="control-value">${Number(item.ratio).toFixed(2)}</span>
      <button class="icon-btn" type="button" data-particle-color-action="delete" data-particle-color-id="${item.id}" aria-label="删除粒子颜色 ${index + 1}">×</button>
    `;
    row.insertBefore(renderRgbaControl({
      colorKey: `particle-color-${item.id}`,
      label: `粒子颜色 ${index + 1}`,
      tip: "支持 rgba(r, g, b, a) 与 HEX 输入。",
      value: item.color,
      onInput: (event) => {
        const control = rgbaControlForTarget(event.target);
        const parts = colorPartsFromRgbaControlTarget(event.target, control);
        markRgbaControlValidity(control, Boolean(parts));
        if (!parts) return;
        item.color = colorPartsToCss(parts);
        control.dataset.colorValue = item.color;
        control.dataset.opacityValue = parts.a;
        updateRgbaControl(control);
        refreshParticleColors();
        updateFormulaAndCode();
      },
    }), row.firstElementChild);
    const ratioInput = row.querySelector('input[type="range"]');
    updateRangeProgress(ratioInput);
    list.appendChild(row);
  });
  editor.addEventListener("input", (event) => {
    const input = event.target.closest("[data-particle-color-field]");
    if (!input) return;
    const item = config.particleColors.find((color) => color.id === Number(input.dataset.particleColorId));
    if (!item) return;
    item.ratio = clamp(Number(input.value) || 1, 0.05, 5);
    updateRangeProgress(input);
    renderParticleColorEditorValue(input);
    refreshParticleColors();
    updateFormulaAndCode();
  });
  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-particle-color-action]");
    if (!button) return;
    const action = button.dataset.particleColorAction;
    if (action === "add") {
      const palette = ["#8F959E", "#67d6c3", "#f0c96a", "#f07a7a", "#f5f7fb"];
      const nextId = Math.max(0, ...config.particleColors.map((item) => item.id)) + 1;
      config.particleColors.push({ id: nextId, color: palette[config.particleColors.length % palette.length], ratio: 1 });
    } else if (action === "delete" && config.particleColors.length > 1) {
      config.particleColors = config.particleColors.filter((item) => item.id !== Number(button.dataset.particleColorId));
    }
    renderMotionControls();
    refreshParticleColors();
    updateFormulaAndCode();
  });
  container.appendChild(editor);
}

function renderParticleColorEditorValue(input) {
  const value = input.closest(".particle-color-row")?.querySelector(".control-value");
  if (value && input.dataset.particleColorField === "ratio") value.textContent = Number(input.value).toFixed(2);
}

function particleTargetCount() {
  if (isParticleMatrixMode()) return 1800;
  return clamp(Math.round(340 + config.particleDensity * 1280), 220, 2400);
}

function sanitizeParticleColors() {
  const source = Array.isArray(config.particleColors) && config.particleColors.length ? config.particleColors : particleDefaults.particleColors;
  config.particleColors = source.map((item, index) => ({
    id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
    color: isValidColorString(item.color) ? String(item.color) : "#8F959E",
    ratio: clamp(Number(item.ratio) || 1, 0.05, 5),
  }));
}

function ensureParticleDefaultKeyframes() {
  if (Array.isArray(config.particleKeyframes) && config.particleKeyframes.length) return;
  config.particleKeyframes = ["a", "h", "i", "o"].map((label, index) => {
    const imageData = makeParticleTextImage(label);
    return makeParticleFrameFromImageData(imageData, `${label}.png`, index + 1);
  });
}

function makeParticleTextImage(text) {
  const size = 360;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${text === "i" ? 270 : 250}px SF Pro Display, Helvetica Neue, Arial, sans-serif`;
  ctx.fillText(text, size / 2, size / 2 + (text === "i" ? 2 : 8));
  return ctx.getImageData(0, 0, size, size);
}

function makeParticleFrameFromImageData(imageData, name, id = Date.now()) {
  return {
    id,
    name,
    width: imageData.width,
    height: imageData.height,
    imageData,
    preview: imageDataToPreviewURL(imageData),
    morphRegionLabels: [],
  };
}

function imageDataToPreviewURL(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function particleTargetsFromImageData(imageData, seedKey, desiredCount, strengthenEdges = config.particleStrengthenEdges) {
  const field = makeScalarField(imageData, "auto");
  const level = automaticContourLevel(field);
  const { mask, width, height } = foregroundMaskFromField(field, level);
  const candidates = [];
  const foregroundCandidates = [];
  const step = Math.max(1, Math.floor(Math.sqrt(Math.max(1, width * height) / 24000)));
  const inside = (x, y) => x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x];
  const edgeRadius = Math.max(2, step * 4);
  const featherRadius = Math.max(edgeRadius * 2.8, step * 9);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (!inside(x, y)) continue;
      const edge = isMaskEdgePoint(inside, x, y, edgeRadius);
      const point = { x, y, weight: edge ? 1 : 0.6, edge, halo: false };
      candidates.push(point);
      foregroundCandidates.push(point);
    }
  }
  if (!candidates.length) return fallbackParticleTargets(seedKey, desiredCount);
  const bounds = particleCandidateBounds(foregroundCandidates);
  const haloStep = Math.max(step * 2, 2);
  for (let y = Math.max(0, bounds.minY - featherRadius); y <= Math.min(height - 1, bounds.maxY + featherRadius); y += haloStep) {
    for (let x = Math.max(0, bounds.minX - featherRadius); x <= Math.min(width - 1, bounds.maxX + featherRadius); x += haloStep) {
      if (inside(x, y)) continue;
      const distance = nearestMaskDistance(inside, x, y, featherRadius, step);
      if (!Number.isFinite(distance)) continue;
      const fade = 1 - distance / featherRadius;
      candidates.push({
        x,
        y,
        weight: 0.08 + fade * fade * 0.24,
        edge: false,
        halo: true,
      });
    }
  }
  const normalized = normalizeParticleCandidates(candidates, width, height, foregroundCandidates);
  const rng = seededRandom(`particle-targets|${seedKey}|${desiredCount}|${strengthenEdges}`);
  const haloPoints = normalized.filter((point) => point.halo);
  if (!strengthenEdges) {
    const haloCount = haloPoints.length ? Math.round(desiredCount * 0.08) : 0;
    return [
      ...sampleParticleBucket(normalized.filter((point) => !point.halo), desiredCount - haloCount, rng, 0.52),
      ...sampleParticleBucket(haloPoints, haloCount, rng, 1.35),
    ].sort(() => rng() - 0.5);
  }
  const edgePoints = normalized.filter((point) => point.edge);
  const interiorPoints = normalized.filter((point) => !point.edge && !point.halo);
  if (!edgePoints.length || !interiorPoints.length) return sampleParticleBucket(normalized, desiredCount, rng, 0.48);
  const haloCount = haloPoints.length ? Math.round(desiredCount * 0.12) : 0;
  const edgeCount = clamp(Math.round(desiredCount * 0.44), 0, desiredCount - haloCount);
  const interiorCount = Math.max(0, desiredCount - edgeCount - haloCount);
  return [
    ...sampleParticleBucket(edgePoints, edgeCount, rng, 0.18),
    ...sampleParticleBucket(interiorPoints, interiorCount, rng, 0.68),
    ...sampleParticleBucket(haloPoints, haloCount, rng, 1.45),
  ].sort(() => rng() - 0.5);
}

function particleCandidateBounds(candidates) {
  return candidates.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxX: Math.max(acc.maxX, point.x),
    maxY: Math.max(acc.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function nearestMaskDistance(inside, x, y, maxRadius, step) {
  const ringStep = Math.max(1, step);
  for (let radius = ringStep; radius <= maxRadius; radius += ringStep) {
    for (let dy = -radius; dy <= radius; dy += ringStep) {
      if (inside(x - radius, y + dy) || inside(x + radius, y + dy)) return radius;
    }
    for (let dx = -radius + ringStep; dx <= radius - ringStep; dx += ringStep) {
      if (inside(x + dx, y - radius) || inside(x + dx, y + radius)) return radius;
    }
  }
  return Infinity;
}

function isMaskEdgePoint(inside, x, y, radius) {
  const offsets = [
    [-radius, 0], [radius, 0], [0, -radius], [0, radius],
    [-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius],
  ];
  return offsets.some(([dx, dy]) => !inside(x + dx, y + dy));
}

function sampleParticleBucket(points, count, rng, jitter) {
  if (!points.length || count <= 0) return [];
  const ordered = points
    .map((point) => ({ point, key: rng() / Math.max(0.001, point.weight ?? 1) }))
    .sort((a, b) => a.key - b.key)
    .map((item) => item.point);
  const sampled = [];
  for (let index = 0; index < count; index += 1) {
    const base = ordered[index % ordered.length];
    const wrap = Math.floor(index / ordered.length);
    const spread = jitter * (wrap > 0 ? 1 + Math.min(3, wrap) * 0.18 : 1);
    sampled.push({
      x: clamp(base.x + (rng() - 0.5) * spread, 5, 95),
      y: clamp(base.y + (rng() - 0.5) * spread, 5, 95),
      edge: Boolean(base.edge),
      halo: Boolean(base.halo),
      weight: base.weight,
    });
  }
  return sampled;
}

function normalizeParticleCandidates(candidates, width, height, boundsSource = candidates) {
  const bounds = particleCandidateBounds(boundsSource);
  const sourceW = Math.max(1, bounds.maxX - bounds.minX || width);
  const sourceH = Math.max(1, bounds.maxY - bounds.minY || height);
  const scale = 82 / Math.max(sourceW, sourceH);
  const offsetX = 50 - ((bounds.minX + bounds.maxX) / 2) * scale;
  const offsetY = 50 - ((bounds.minY + bounds.maxY) / 2) * scale;
  return candidates.map((point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
    edge: point.edge,
    halo: point.halo,
    weight: point.weight,
  }));
}

function particleSquareFrameFromImageData(imageData) {
  const field = makeScalarField(imageData, "auto");
  const level = automaticContourLevel(field);
  const { mask, width, height } = foregroundMaskFromField(field, level);
  const candidates = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) candidates.push({ x, y });
    }
  }
  if (!candidates.length) return null;
  const bounds = particleCandidateBounds(candidates);
  const sourceW = Math.max(1, bounds.maxX - bounds.minX || width);
  const sourceH = Math.max(1, bounds.maxY - bounds.minY || height);
  const scale = 82 / Math.max(sourceW, sourceH);
  return {
    mask,
    width,
    height,
    scale,
    offsetX: 50 - ((bounds.minX + bounds.maxX) / 2) * scale,
    offsetY: 50 - ((bounds.minY + bounds.maxY) / 2) * scale,
  };
}

function particleSquareFrameLit(point, frame, cellPercent) {
  if (!frame) return 0;
  const sourceX = (point.x - frame.offsetX) / frame.scale;
  const sourceY = (point.y - frame.offsetY) / frame.scale;
  if (sourceX < 0 || sourceY < 0 || sourceX >= frame.width || sourceY >= frame.height) return 0;
  const radius = Math.max(0.75, (cellPercent / Math.max(0.001, frame.scale)) * 0.58);
  const minX = Math.max(0, Math.floor(sourceX - radius));
  const maxX = Math.min(frame.width - 1, Math.ceil(sourceX + radius));
  const minY = Math.max(0, Math.floor(sourceY - radius));
  const maxY = Math.min(frame.height - 1, Math.ceil(sourceY + radius));
  const step = Math.max(1, Math.floor(radius / 2));
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      if (frame.mask[y * frame.width + x]) return 1;
    }
  }
  return frame.mask[Math.round(sourceY) * frame.width + Math.round(sourceX)] ? 1 : 0;
}

function encodeParticleSquareFrame(frame) {
  if (!frame) return null;
  const runs = [];
  let index = 0;
  while (index < frame.mask.length) {
    while (index < frame.mask.length && !frame.mask[index]) index += 1;
    if (index >= frame.mask.length) break;
    const start = index;
    while (index < frame.mask.length && frame.mask[index]) index += 1;
    runs.push([start, index - start]);
  }
  return {
    width: frame.width,
    height: frame.height,
    scale: Number(frame.scale.toFixed(6)),
    offsetX: Number(frame.offsetX.toFixed(6)),
    offsetY: Number(frame.offsetY.toFixed(6)),
    runs,
  };
}

function fallbackParticleTargets(seedKey, desiredCount) {
  const rng = seededRandom(`particle-fallback|${seedKey}`);
  return Array.from({ length: desiredCount }, (_, index) => {
    const t = (index / desiredCount) * Math.PI * 2;
    const r = 23 + Math.sin(t * 3) * 5 + (rng() - 0.5) * 3;
    return { x: 50 + Math.cos(t) * r, y: 50 + Math.sin(t) * r, edge: true, weight: 1 };
  });
}

function prepareParticleEffect() {
  hideLineEditHandles();
  if (state.particleSystem.prepareTimer) {
    clearTimeout(state.particleSystem.prepareTimer);
    state.particleSystem.prepareTimer = null;
  }
  ensureParticleDefaultKeyframes();
  sanitizeParticleColors();
  const desired = particleTargetCount();
  state.particleTargets = config.particleKeyframes.map((frame, index) => (
    particleTargetsFromImageData(frame.imageData, `${frame.id}|${frame.name}|${index}`, desired)
  ));
  state.particleSquareFrames = config.particleKeyframes.map((frame) => particleSquareFrameFromImageData(frame.imageData));
  ensureParticleSystem(desired);
  state.particleSystem.squareCache = { key: "", states: [] };
  state.particleSystem.lastFrameAt = null;
}

function refreshParticleColors() {
  sanitizeParticleColors();
  ensureParticleSystem(state.particleSystem.particles.length || particleTargetCount());
}

function scheduleParticlePrepare(delay = 160) {
  if (state.particleSystem.prepareTimer) clearTimeout(state.particleSystem.prepareTimer);
  state.particleSystem.prepareTimer = setTimeout(() => {
    state.particleSystem.prepareTimer = null;
    prepareParticleEffect();
    updateMeta();
    updateFormulaAndCode();
  }, delay);
}

function ensureParticleSystem(count) {
  const system = state.particleSystem;
  const rng = seededRandom(`particle-system|${count}|${config.particleColors.map((item) => `${item.color}:${item.ratio}`).join("|")}`);
  while (system.particles.length < count) {
    system.particles.push(makeParticle(system.particles.length, rng));
  }
  if (system.particles.length > count) system.particles.length = count;
  system.particles.forEach((particle, index) => {
    particle.color = particleColorForIndex(index);
    particle.char = particleCharForIndex(index);
    particle.sizeJitter = 0.72 + seededRandom(`particle-size|${index}`)() * 0.7;
    particle.weightJitter = Math.round(420 + seededRandom(`particle-weight|${index}`)() * 380);
    if (!Number.isFinite(particle.ox)) particle.ox = 0;
    if (!Number.isFinite(particle.oy)) particle.oy = 0;
    if (!Number.isFinite(particle.hoverX)) particle.hoverX = 0;
    if (!Number.isFinite(particle.hoverY)) particle.hoverY = 0;
    if (!Number.isFinite(particle.ringJitter)) particle.ringJitter = seededRandom(`particle-ring|${index}`)() * 2 - 1;
    if (!Number.isFinite(particle.hoverScale)) particle.hoverScale = 1;
  });
}

function makeParticle(index, rng) {
  const angle = rng() * Math.PI * 2;
  const radius = 18 + rng() * 18;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
    vx: 0,
    vy: 0,
    ox: 0,
    oy: 0,
    hoverX: 0,
    hoverY: 0,
    color: particleColorForIndex(index),
    char: particleCharForIndex(index),
    seed: rng() * 1000,
    sizeJitter: 0.75 + rng() * 0.6,
    weightJitter: Math.round(420 + rng() * 380),
    ringJitter: rng() * 2 - 1,
    hoverScale: 1,
  };
}

function particleColorForIndex(index) {
  sanitizeParticleColors();
  const total = config.particleColors.reduce((sum, item) => sum + item.ratio, 0) || 1;
  const roll = seededRandom(`particle-color|${index}`)() * total;
  let cursor = 0;
  for (const item of config.particleColors) {
    cursor += item.ratio;
    if (roll <= cursor) return item.color;
  }
  return config.particleColors[config.particleColors.length - 1]?.color ?? "#8F959E";
}

function particleCharForIndex(index) {
  const chars = [".", "*", "+", "#", "@"]; 
  return chars[Math.floor(seededRandom(`particle-char|${index}`)() * chars.length) % chars.length];
}

function showParticleCanvas() {
  particleCanvas.style.display = "block";
  motionSvg.style.display = "none";
}

function hideParticleCanvas() {
  if (particleCanvas) particleCanvas.style.display = "none";
  motionSvg.style.display = "";
  state.particleSystem.pointer.active = false;
}

function resizeParticleCanvas() {
  const rect = particleCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (particleCanvas.width !== width || particleCanvas.height !== height) {
    particleCanvas.width = width;
    particleCanvas.height = height;
  }
  const size = Math.min(width, height) * 0.72;
  state.particleSystem.viewport = {
    x: (width - size) / 2,
    y: (height - size) / 2,
    size,
    width,
    height,
  };
}

function particleToCanvas(point) {
  const viewport = state.particleSystem.viewport;
  return {
    x: viewport.x + (point.x / 100) * viewport.size,
    y: viewport.y + (point.y / 100) * viewport.size,
  };
}

function canvasToParticlePoint(event) {
  const rect = particleCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const px = (event.clientX - rect.left) * ratio;
  const py = (event.clientY - rect.top) * ratio;
  const viewport = state.particleSystem.viewport;
  return {
    x: ((px - viewport.x) / Math.max(1, viewport.size)) * 100,
    y: ((py - viewport.y) / Math.max(1, viewport.size)) * 100,
  };
}

function particleFrameMix(now) {
  const frames = state.particleTargets.filter((targets) => targets.length);
  if (!frames.length) return { current: [], next: [], progress: 0, index: 0 };
  const requestedInterval = Math.max(0, config.particleFrameIntervalMs);
  const transitionBase = Math.max(100, config.particleTransitionMs);
  const interval = requestedInterval <= 0 ? transitionBase : requestedInterval;
  const transition = requestedInterval <= 0 ? transitionBase : Math.min(transitionBase, interval);
  const hold = requestedInterval <= 0 ? 0 : Math.max(0, interval - transition);
  const elapsed = Number.isFinite(state.startedAt) ? now - state.startedAt : 0;
  const cycle = frames.length * interval;
  const local = ((elapsed % cycle) + cycle) % cycle;
  const index = Math.min(frames.length - 1, Math.floor(local / interval));
  const frameLocal = local % interval;
  const progress = frameLocal < hold ? 0 : standardBezierEase((frameLocal - hold) / transition);
  return {
    current: frames[index],
    next: frames[(index + 1) % frames.length],
    progress,
    index,
  };
}

function particleSquarePixelSize(ratio = window.devicePixelRatio || 1) {
  const viewport = state.particleSystem.viewport;
  const cells = particleMatrixCellCount();
  const cellPercent = 100 / (cells + (cells - 1) * 0.1);
  return Math.max(1.25, viewport.size * cellPercent / 100);
}

function particleSquareGridSpec() {
  const viewport = state.particleSystem.viewport;
  const ratio = window.devicePixelRatio || 1;
  const cells = particleMatrixCellCount();
  const cellPercent = 100 / (cells + (cells - 1) * 0.1);
  const stepPercent = cellPercent * 1.1;
  const sidePx = particleSquarePixelSize(ratio);
  const columns = cells;
  const rows = cells;
  const startX = cellPercent / 2;
  const startY = cellPercent / 2;
  return { columns, rows, count: columns * rows, stepPercent, cellPercent, sidePx, startX, startY };
}

function particleGridPoint(index, spec) {
  const column = index % spec.columns;
  const row = Math.floor(index / spec.columns);
  return {
    x: spec.startX + column * spec.stepPercent,
    y: spec.startY + row * spec.stepPercent,
  };
}

function nearestParticleTargetDistance(point, targets) {
  let best = Infinity;
  const step = Math.max(1, Math.floor(targets.length / 420));
  for (let index = 0; index < targets.length; index += step) {
    const target = targets[index];
    const dx = point.x - target.x;
    const dy = point.y - target.y;
    const dist = dx * dx + dy * dy;
    if (dist < best) best = dist;
  }
  return Math.sqrt(best);
}

function particleSquareCoverage(distance, stepPercent) {
  const threshold = Math.max(1.25, stepPercent * 1.55);
  return distance <= threshold ? 1 : 0;
}

function getParticleSquareGridStates(mix) {
  const system = state.particleSystem;
  const spec = particleSquareGridSpec();
  const key = `${mix.index}|${state.particleSquareFrames.length}|${spec.columns}|${spec.rows}|${spec.stepPercent.toFixed(4)}|${spec.cellPercent.toFixed(4)}`;
  if (system.squareCache?.key === key) return system.squareCache.states;
  const currentFrame = state.particleSquareFrames[mix.index] ?? null;
  const nextFrame = state.particleSquareFrames[(mix.index + 1) % Math.max(1, state.particleSquareFrames.length)] ?? currentFrame;
  const states = Array.from({ length: spec.count }, (_, index) => {
    const point = particleGridPoint(index, spec);
    const currentAlpha = particleSquareFrameLit(point, currentFrame, spec.cellPercent);
    const nextAlpha = particleSquareFrameLit(point, nextFrame, spec.cellPercent);
    return {
      x: point.x,
      y: point.y,
      sidePx: spec.sidePx,
      currentAlpha,
      nextAlpha,
      currentEdge: currentAlpha > 0.72,
      nextEdge: nextAlpha > 0.72,
    };
  });
  system.squareCache = { key, states };
  return states;
}

function particleSquareGridState(index, mix, now, states) {
  const cached = states[index] ?? { x: 50, y: 50, currentAlpha: 0, nextAlpha: 0, currentEdge: false, nextEdge: false };
  const progress = clamp(mix.progress, 0, 1);
  const currentLit = cached.currentAlpha > 0.5 ? 1 : 0;
  const nextLit = cached.nextAlpha > 0.5 ? 1 : 0;
  const changed = currentLit !== nextLit;
  if (config.particleSquareMotion === "scan") {
    const diagonalOrder = clamp((cached.x + cached.y) / 200, 0, 1);
    const localJitter = ((Math.sin(index * 19.191 + mix.index * 31.733) * 43758.5453) % 1 + 1) % 1;
    const fadeDuration = 0.3;
    const offLead = 0.035;
    const sweepAt = clamp(diagonalOrder * 0.68 + localJitter * 0.02, 0, 1 - fadeDuration);
    let alpha = currentLit;
    if (progress >= 1) alpha = nextLit;
    else if (progress > 0 && progress >= sweepAt && progress < sweepAt + offLead) alpha = 0;
    else if (progress >= sweepAt + offLead) {
      const fadeProgress = clamp((progress - sweepAt - offLead) / fadeDuration, 0, 1);
      alpha = nextLit ? 1 : 1 - fadeProgress;
    }
    return {
      x: cached.x,
      y: cached.y,
      sidePx: cached.sidePx,
      alpha: clamp(alpha, 0, 1),
      scanFlash: 0,
      edge: alpha ? cached.nextEdge : cached.currentEdge,
      halo: false,
    };
  }
  const delay = ((Math.sin(index * 12.9898 + mix.index * 78.233) * 43758.5453) % 1 + 1) % 1;
  const contact = clamp((progress - delay * 0.56) / 0.3, 0, 1);
  let alpha = progress <= 0 ? currentLit : nextLit;
  if (changed && progress > 0 && progress < 1 && contact > 0 && contact < 1) {
    const spark = Math.sin(contact * Math.PI * 5 + delay * 12 + index * 0.21);
    alpha = spark > 0.08 + contact * 0.18 ? nextLit : currentLit;
  } else if (changed && progress < delay * 0.56) {
    alpha = currentLit;
  }
  return {
    x: cached.x,
    y: cached.y,
    sidePx: cached.sidePx,
    alpha: clamp(alpha, 0, 1),
    scanFlash: 0,
    edge: cached.nextAlpha > cached.currentAlpha ? cached.nextEdge : cached.currentEdge,
    halo: false,
  };
}

function particleTransitionPoint(a, b, index, mix, now) {
  const progress = particleLocalProgress(mix.progress, index, mix.index);
  if (progress <= 0) return particleIdlePoint(a, index, now);
  const cluster = particleScatterPoint(a, b, index, mix.index, now);
  const clusterInEnd = 0.46;
  const clusterOutStart = 0.58;
  if (progress < clusterInEnd) {
    const t = easeInBack(progress / clusterInEnd);
    return lerpPoint(particleIdlePoint(a, index, now), cluster, t);
  }
  if (progress < clusterOutStart) {
    const drift = (1 - clamp(config.particleStability, 0, 1)) * 1.2 + 0.55;
    return {
      x: clamp(cluster.x + Math.sin(now * 0.0032 + index * 0.31) * drift, 3, 97),
      y: clamp(cluster.y + Math.cos(now * 0.0027 + index * 0.23) * drift, 3, 97),
    };
  }
  const t = easeOutBack((progress - clusterOutStart) / (1 - clusterOutStart));
  return lerpPoint(cluster, particleIdlePoint(b, index, now), t);
}

function particleLocalProgress(progress, index, segmentIndex) {
  const p = clamp(progress, 0, 1);
  if (p <= 0 || p >= 1) return p;
  const rng = seededRandom(`particle-progress|${segmentIndex}|${index}`);
  const window = Math.sin(Math.PI * p);
  const delay = (rng() - 0.5) * 0.18 * window;
  const wave = Math.sin(p * Math.PI * 2 + index * 0.39 + segmentIndex * 1.17) * 0.07 * window;
  return clamp(p + delay + wave, 0, 1);
}

function particleFlowOffset(point, index, mix, now) {
  const stability = clamp(config.particleStability, 0, 1);
  const transitionEnergy = mix.progress > 0 ? Math.sin(Math.PI * clamp(mix.progress, 0, 1)) : 0.18;
  const clusterDamping = 1 - transitionEnergy * 0.34;
  const amplitude = (0.55 + (1 - stability) * 1.85) * (0.65 + transitionEnergy * 0.85) * clusterDamping;
  const phase = now * 0.0022 + index * 0.41 + point.y * 0.08;
  const crossPhase = now * 0.0016 + index * 0.29 + point.x * 0.065;
  return {
    x: Math.sin(phase) * amplitude + Math.sin(crossPhase * 0.73) * amplitude * 0.32,
    y: Math.cos(crossPhase) * amplitude * 0.86 + Math.sin(phase * 0.61) * amplitude * 0.28,
  };
}

function particleIdlePoint(point, index, now) {
  const drift = (1 - clamp(config.particleStability, 0, 1)) * 1.35;
  if (drift <= 0.001) return point;
  const seed = index * 0.017;
  return {
    x: point.x + Math.sin(now * 0.0015 + seed * 91.7) * drift,
    y: point.y + Math.cos(now * 0.0012 + seed * 63.1) * drift,
  };
}

function updateParticleVirtualPointer(system, dt) {
  if (!system.virtualPointer) system.virtualPointer = { x: system.pointer.x, y: system.pointer.y };
  if (!system.pointer.active) return;
  const smooth = 1 - Math.pow(0.94, dt * 60);
  system.virtualPointer.x += (system.pointer.x - system.virtualPointer.x) * smooth;
  system.virtualPointer.y += (system.pointer.y - system.virtualPointer.y) * smooth;
}

function particleAntigravityPoint(base, particle, index, system, now, dt) {
  let targetX = 0;
  let targetY = 0;
  let influence = 0;
  particle.hoverScale = 1;
  const pointer = system.virtualPointer ?? system.pointer;
  if (system.pointer.active) {
    const dx = base.x - pointer.x;
    const dy = base.y - pointer.y;
    const dist = Math.hypot(dx, dy);
    const magnetRadius = 38;
    if (dist < magnetRadius) {
      const rawInfluence = 1 - dist / magnetRadius;
      influence = rawInfluence * rawInfluence * (3 - 2 * rawInfluence) * 0.34;
      const baseAngle = dist > 0.001 ? Math.atan2(dy, dx) : particle.seed;
      const angle = baseAngle + Math.sin(now * 0.00042 + index * 0.017) * 0.05;
      const force = clamp(config.particleMouseForce, 0, 3);
      const displacement = (2.05 + Math.sin(now * 0.003 + particle.seed * 0.21) * 0.22 + particle.ringJitter * 0.18) * influence * force;
      targetX = Math.cos(angle) * displacement;
      targetY = Math.sin(angle) * displacement;
      particle.hoverScale = 1 + influence * (0.04 + Math.sin(now * 0.005 + particle.seed) * 0.012);
    }
  }
  const rate = system.pointer.active ? 18 : 4.2;
  const ease = 1 - Math.exp(-rate * dt);
  particle.hoverX += (targetX - particle.hoverX) * ease;
  particle.hoverY += (targetY - particle.hoverY) * ease;
  return {
    x: clamp(base.x + particle.hoverX, 2, 98),
    y: clamp(base.y + particle.hoverY, 2, 98),
  };
}

function particleScatterPoint(a, b, index, segmentIndex, now) {
  const rng = seededRandom(`particle-scatter|${segmentIndex}|${index}`);
  const center = {
    x: 50 + Math.sin(segmentIndex * 1.91) * 2.2,
    y: 50 + Math.cos(segmentIndex * 1.37) * 2.2,
  };
  const direction = rng() < 0.5 ? -1 : 1;
  const angle = rng() * Math.PI * 2 + now * 0.0008 * direction;
  const stability = clamp(config.particleStability, 0, 1);
  const radius = 1.4 + Math.pow(rng(), 0.62) * (7.8 + (1 - stability) * 4.2);
  const ring = (a.edge || b.edge) ? 0.86 : 1;
  return {
    x: clamp(center.x + Math.cos(angle) * radius * ring, 34, 66),
    y: clamp(center.y + Math.sin(angle) * radius * ring, 34, 66),
  };
}

function easeOutCubic(value) {
  const t = clamp(value, 0, 1);
  return 1 - (1 - t) ** 3;
}

function easeInBack(value) {
  const t = clamp(value, 0, 1);
  const c1 = 1.16;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

function easeOutBack(value) {
  const t = clamp(value, 0, 1) - 1;
  const c1 = 1.16;
  const c3 = c1 + 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}

function renderParticleEffect(now) {
  hideParticles();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  showParticleCanvas();
  resizeParticleCanvas();
  const ctx = particleCanvas.getContext("2d");
  const system = state.particleSystem;
  const previous = system.lastFrameAt ?? now;
  const dt = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
  system.lastFrameAt = now;
  const mix = particleFrameMix(now);
  ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  updateParticleVirtualPointer(system, dt);
  const squareStates = isParticleMatrixMode() ? getParticleSquareGridStates(mix) : null;
  if (squareStates && system.particles.length < squareStates.length) ensureParticleSystem(squareStates.length);
  const count = squareStates ? squareStates.length : system.particles.length;
  for (let index = 0; index < count; index += 1) {
    const particle = system.particles[index];
    if (squareStates) {
      const square = particleSquareGridState(index, mix, now, squareStates);
      particle.x = square.x;
      particle.y = square.y;
      particle.edge = square.edge;
      particle.halo = false;
      particle.alpha = square.alpha;
      particle.scanFlash = square.scanFlash || 0;
      particle.squareSize = square.sidePx;
      particle.hoverScale = 1;
      drawParticle(ctx, particle);
      continue;
    }
    const a = mix.current[index % Math.max(1, mix.current.length)] ?? { x: 50, y: 50 };
    const b = mix.next[index % Math.max(1, mix.next.length)] ?? a;
    particle.edge = Boolean(config.particleStrengthenEdges && (a.edge || b.edge));
    particle.halo = Boolean(a.halo || b.halo);
    particle.alpha = null;
    particle.scanFlash = 0;
    const pathPoint = particleTransitionPoint(a, b, index, mix, now);
    const flow = particleFlowOffset(pathPoint, index, mix, now);
    const base = {
      x: clamp(pathPoint.x + flow.x, 3, 97),
      y: clamp(pathPoint.y + flow.y, 3, 97),
    };
    const antigravity = particleAntigravityPoint(base, particle, index, system, now, dt);
    particle.x = antigravity.x;
    particle.y = antigravity.y;
    drawParticle(ctx, particle);
  }
  if (now - (system.lastDebugAt || 0) > 250) {
    system.lastDebugAt = now;
    window.__motionDebug.particleCount = count;
    window.__motionDebug.particleFrameCount = config.particleKeyframes.length;
    window.__motionDebug.particleEdgeCount = mix.current.filter((point) => point.edge).length;
    window.__motionDebug.particleInteriorCount = mix.current.filter((point) => !point.edge && !point.halo).length;
    window.__motionDebug.particleHaloCount = mix.current.filter((point) => point.halo).length;
    window.__motionDebug.particleInteriorDensityRatio = particleInteriorDensityRatio(mix.current);
  }
}

function particleInteriorDensityRatio(points) {
  const edgeUnique = new Set();
  const interiorUnique = new Set();
  points.forEach((point) => {
    const key = `${Math.round(point.x * 2)},${Math.round(point.y * 2)}`;
    if (point.edge) edgeUnique.add(key);
    else if (!point.halo) interiorUnique.add(key);
  });
  const edgeCount = points.filter((point) => point.edge).length;
  const interiorCount = points.filter((point) => !point.edge && !point.halo).length;
  const edgeDensity = edgeCount / Math.max(1, edgeUnique.size);
  const interiorDensity = interiorCount / Math.max(1, interiorUnique.size);
  return interiorDensity / Math.max(0.001, edgeDensity);
}

function drawParticle(ctx, particle) {
  const point = particleToCanvas(particle);
  const ratio = window.devicePixelRatio || 1;
  const sizeBoost = particle.edge ? 1.1 : 0.96;
  const size = Math.max(0.55, config.particleSize * particle.sizeJitter * sizeBoost * (particle.hoverScale || 1)) * ratio;
  ctx.globalAlpha = particle.alpha ?? (particle.halo ? 0.34 : (particle.edge ? 0.96 : 0.78));
  ctx.fillStyle = particle.color;
  if (isParticleMatrixMode()) {
    const litAlpha = clamp(particle.alpha ?? 0, 0, 1);
    const scanFlash = clamp(particle.scanFlash ?? 0, 0, 1);
    const squareSize = particle.squareSize ?? particleSquarePixelSize(ratio);
    const drawMatrixCell = (alpha, color) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      if (isParticleAsciiMode()) {
        ctx.font = `${particle.weightJitter || 650} ${Math.max(7, squareSize * 0.92)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const chars = [".", "*", "+", "#", "@"];
        const charTick = Math.floor(performance.now() / (420 + (particle.seed % 260)));
        const char = chars[(charTick + Math.floor(particle.seed + particle.x * 0.31 + particle.y * 0.17)) % chars.length];
        ctx.fillText(char, point.x, point.y);
      } else {
        ctx.fillRect(point.x - squareSize / 2, point.y - squareSize / 2, squareSize, squareSize);
      }
    };
    drawMatrixCell(clamp(config.particleSquareOffOpacity, 0, 1), config.particleSquareOffColor);
    const onAlpha = Math.max(litAlpha * clamp(config.particleSquareOnOpacity, 0, 1), scanFlash * clamp(config.particleSquareOnOpacity, 0, 1) * 0.72);
    if (onAlpha > 0.015) {
      drawMatrixCell(onAlpha, config.particleSquareOnColor);
    }
  } else if (isParticleAsciiMode()) {
    ctx.globalAlpha = 0.94;
    ctx.font = `${particle.weightJitter || 650} ${Math.max(8, size * 5.2)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chars = [".", "*", "+", "#", "@"];
    const charTick = Math.floor(performance.now() / (420 + (particle.seed % 260)));
    const char = chars[(charTick + Math.floor(particle.seed + particle.x * 0.31 + particle.y * 0.17)) % chars.length];
    ctx.fillText(char, point.x, point.y);
  } else {
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}


function requestParticleFrameUpload(frameId) {
  pendingParticleUploadFrameId = frameId;
  particleFrameInput.multiple = frameId == null;
  particleFrameInput.value = "";
  particleFrameInput.click();
}

async function loadParticleKeyframeFiles(files, frameId) {
  const list = Array.from(files || []).filter((file) => file?.type?.startsWith("image/"));
  if (!list.length) return;
  if (frameId != null) {
    await loadParticleKeyframeFile(list[0], frameId);
    return;
  }
  for (const file of list) {
    await loadParticleKeyframeFile(file, null);
  }
}

async function loadParticleKeyframeFile(file, frameId) {
  if (!file || !file.type.startsWith("image/")) return;
  setStatus("Loading");
  const image = await loadImage(await fileToDataURL(file));
  const imageData = readImageToImageData(image, 360);
  const nextId = frameId ?? (Math.max(0, ...config.particleKeyframes.map((frame) => frame.id)) + 1);
  const frame = makeParticleFrameFromImageData(imageData, file.name, nextId);
  if (frameId == null) {
    config.particleKeyframes.push(frame);
  } else {
    const index = config.particleKeyframes.findIndex((item) => item.id === frameId);
    if (index >= 0) config.particleKeyframes.splice(index, 1, frame);
  }
  renderMotionControls();
  activeEffect().prepare();
  state.startedAt = performance.now();
  updateMeta();
  updateFormulaAndCode();
  setStatus("Ready");
}

function readImageToImageData(image, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(8, Math.round(image.naturalWidth * scale));
  const height = Math.max(8, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function generateParticleStandaloneHTML() {
  ensureParticleDefaultKeyframes();
  if (!state.particleTargets.length) prepareParticleEffect();
  const targets = state.particleTargets.map((frame) => frame.map((point) => ({
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3)),
    edge: Boolean(point.edge),
    halo: Boolean(point.halo),
  })));
  const squareFrames = state.particleSquareFrames.map(encodeParticleSquareFrame);
  const colors = config.particleColors.map((item) => ({
    color: item.color,
    ratio: Number(item.ratio.toFixed(3)),
  }));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Particle Attractor Motion</title>
  <style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050507; overflow: hidden; }
canvas { width: min(82vmin, 720px); height: min(82vmin, 720px); display: block; touch-action: none; }
  </style>
</head>
<body>
  <canvas id="stage" aria-hidden="true"></canvas>
  <script>
const frames = ${JSON.stringify(targets)};
const squareFrameData = ${JSON.stringify(squareFrames)};
const config = ${JSON.stringify({
  particleFrameIntervalMs: config.particleFrameIntervalMs,
  particleTransitionMs: config.particleTransitionMs,
  particleSize: isParticleMatrixMode() ? particleMatrixCellCount() : config.particleSize,
  particleStability: config.particleStability,
  particleMouseForce: config.particleMouseForce,
  particleSquareOnColor: config.particleSquareOnColor,
  particleSquareOnOpacity: config.particleSquareOnOpacity,
  particleSquareOffColor: config.particleSquareOffColor,
  particleSquareOffOpacity: config.particleSquareOffOpacity,
  particleSquareMotion: config.particleSquareMotion,
  particleStructure: isParticleMatrixMode() ? "matrix" : "particle",
  particleRenderMode: isParticleAsciiMode() ? "ascii" : "fill",
  particleType: config.particleType,
})};
const colors = ${JSON.stringify(colors)};
const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const pointer = { x: 50, y: 50, active: false };
const virtualPointer = { x: 50, y: 50 };
let viewport = { x: 0, y: 0, size: 1, width: 1, height: 1 };
let lastFrameAt = null;
let squareCache = { key: "", states: [] };
const startedAt = performance.now();
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function isMatrixMode() { return config.particleStructure === "matrix"; }
function isAsciiMode() { return config.particleRenderMode === "ascii"; }
function matrixCellCount() { return clamp(Math.round(Number(config.particleSize) || 5), 5, 20); }
function decodeSquareFrame(frame) {
  if (!frame) return null;
  const mask = new Uint8Array(frame.width * frame.height);
  frame.runs.forEach(([start, length]) => mask.fill(1, start, start + length));
  return { ...frame, mask };
}
const squareFrames = squareFrameData.map(decodeSquareFrame);
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
function colorForIndex(index) {
  const total = colors.reduce((sum, item) => sum + item.ratio, 0) || 1;
  const roll = seededRandom("particle-color|" + index)() * total;
  let cursor = 0;
  for (const item of colors) {
    cursor += item.ratio;
    if (roll <= cursor) return item.color;
  }
  return colors[colors.length - 1]?.color || "#8F959E";
}
function charForIndex(index) {
  const chars = [".", "*", "+", "#", "@"];
  return chars[Math.floor(seededRandom("particle-char|" + index)() * chars.length) % chars.length];
}
const count = Math.max(1, frames[0]?.length || 1);
const rng = seededRandom("particle-system|" + count);
const particles = Array.from({ length: count }, (_, index) => {
  const angle = rng() * Math.PI * 2;
  const radius = 18 + rng() * 18;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
    vx: 0,
    vy: 0,
    ox: 0,
    oy: 0,
    hoverX: 0,
    hoverY: 0,
    seed: rng() * 1000,
    ringJitter: rng() * 2 - 1,
    hoverScale: 1,
    color: colorForIndex(index),
    char: charForIndex(index),
    weightJitter: Math.round(420 + seededRandom("particle-weight|" + index)() * 380),
    sizeJitter: 0.72 + seededRandom("particle-size|" + index)() * 0.7,
  };
});
function ensureParticleCount(total) {
  while (particles.length < total) {
    const index = particles.length;
    const local = seededRandom("particle-extra|" + index);
    const angle = local() * Math.PI * 2;
    const radius = 18 + local() * 18;
    particles.push({
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
      hoverX: 0,
      hoverY: 0,
      seed: local() * 1000,
      ringJitter: local() * 2 - 1,
      hoverScale: 1,
      color: colorForIndex(index),
      char: charForIndex(index),
      weightJitter: Math.round(420 + seededRandom("particle-weight|" + index)() * 380),
      sizeJitter: 0.72 + seededRandom("particle-size|" + index)() * 0.7,
    });
  }
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
  const size = Math.min(width, height) * 0.9;
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
function frameMix(now) {
  const requestedInterval = Math.max(0, config.particleFrameIntervalMs);
  const transitionBase = Math.max(100, config.particleTransitionMs);
  const interval = requestedInterval <= 0 ? transitionBase : requestedInterval;
  const transition = requestedInterval <= 0 ? transitionBase : Math.min(transitionBase, interval);
  const hold = requestedInterval <= 0 ? 0 : Math.max(0, interval - transition);
  const elapsed = now - startedAt;
  const cycle = Math.max(1, frames.length) * interval;
  const local = ((elapsed % cycle) + cycle) % cycle;
  const index = Math.min(frames.length - 1, Math.floor(local / interval));
  const frameLocal = local % interval;
  const progress = frameLocal < hold ? 0 : standardBezierEase((frameLocal - hold) / transition);
  return { current: frames[index] || [], next: frames[(index + 1) % frames.length] || frames[index] || [], progress, index };
}
function squarePixelSize(ratio = window.devicePixelRatio || 1) {
  const cells = matrixCellCount();
  const cellPercent = 100 / (cells + (cells - 1) * 0.1);
  return Math.max(1.25, viewport.size * cellPercent / 100);
}
function squareGridSpec() {
  const ratio = window.devicePixelRatio || 1;
  const cells = matrixCellCount();
  const cellPercent = 100 / (cells + (cells - 1) * 0.1);
  const stepPercent = cellPercent * 1.1;
  const sidePx = squarePixelSize(ratio);
  return {
    columns: cells,
    rows: cells,
    count: cells * cells,
    stepPercent,
    cellPercent,
    sidePx,
    startX: cellPercent / 2,
    startY: cellPercent / 2,
  };
}
function gridPoint(index, spec) {
  const column = index % spec.columns;
  const row = Math.floor(index / spec.columns);
  return {
    x: spec.startX + column * spec.stepPercent,
    y: spec.startY + row * spec.stepPercent,
  };
}
function nearestTargetDistance(point, targets) {
  let best = Infinity;
  const step = Math.max(1, Math.floor(targets.length / 420));
  for (let index = 0; index < targets.length; index += step) {
    const target = targets[index];
    const dx = point.x - target.x;
    const dy = point.y - target.y;
    const dist = dx * dx + dy * dy;
    if (dist < best) best = dist;
  }
  return Math.sqrt(best);
}
function squareCoverage(distance, stepPercent) {
  const threshold = Math.max(1.25, stepPercent * 1.55);
  return distance <= threshold ? 1 : 0;
}
function squareFrameLit(point, frame, cellPercent) {
  if (!frame) return 0;
  const sourceX = (point.x - frame.offsetX) / frame.scale;
  const sourceY = (point.y - frame.offsetY) / frame.scale;
  if (sourceX < 0 || sourceY < 0 || sourceX >= frame.width || sourceY >= frame.height) return 0;
  const radius = Math.max(0.75, (cellPercent / Math.max(0.001, frame.scale)) * 0.58);
  const minX = Math.max(0, Math.floor(sourceX - radius));
  const maxX = Math.min(frame.width - 1, Math.ceil(sourceX + radius));
  const minY = Math.max(0, Math.floor(sourceY - radius));
  const maxY = Math.min(frame.height - 1, Math.ceil(sourceY + radius));
  const step = Math.max(1, Math.floor(radius / 2));
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      if (frame.mask[y * frame.width + x]) return 1;
    }
  }
  return frame.mask[Math.round(sourceY) * frame.width + Math.round(sourceX)] ? 1 : 0;
}
function squareGridStates(mix) {
  const spec = squareGridSpec();
  const key = mix.index + "|" + squareFrames.length + "|" + spec.columns + "|" + spec.rows + "|" + spec.stepPercent.toFixed(4) + "|" + spec.cellPercent.toFixed(4);
  if (squareCache.key === key) return squareCache.states;
  const currentFrame = squareFrames[mix.index] || null;
  const nextFrame = squareFrames[(mix.index + 1) % Math.max(1, squareFrames.length)] || currentFrame;
  const states = Array.from({ length: spec.count }, (_, index) => {
    const point = gridPoint(index, spec);
    const currentAlpha = squareFrameLit(point, currentFrame, spec.cellPercent);
    const nextAlpha = squareFrameLit(point, nextFrame, spec.cellPercent);
    return {
      x: point.x,
      y: point.y,
      sidePx: spec.sidePx,
      currentAlpha,
      nextAlpha,
      currentEdge: currentAlpha > 0.72,
      nextEdge: nextAlpha > 0.72,
    };
  });
  squareCache = { key, states };
  return states;
}
function squareState(index, mix, now, states) {
  const cached = states[index] || { x: 50, y: 50, currentAlpha: 0, nextAlpha: 0, currentEdge: false, nextEdge: false };
  const progress = clamp(mix.progress, 0, 1);
  const currentLit = cached.currentAlpha > 0.5 ? 1 : 0;
  const nextLit = cached.nextAlpha > 0.5 ? 1 : 0;
  const changed = currentLit !== nextLit;
  if (config.particleSquareMotion === "scan") {
    const diagonalOrder = clamp((cached.x + cached.y) / 200, 0, 1);
    const localJitter = ((Math.sin(index * 19.191 + mix.index * 31.733) * 43758.5453) % 1 + 1) % 1;
    const fadeDuration = 0.3;
    const offLead = 0.035;
    const sweepAt = clamp(diagonalOrder * 0.68 + localJitter * 0.02, 0, 1 - fadeDuration);
    let alpha = currentLit;
    if (progress >= 1) alpha = nextLit;
    else if (progress > 0 && progress >= sweepAt && progress < sweepAt + offLead) alpha = 0;
    else if (progress >= sweepAt + offLead) {
      const fadeProgress = clamp((progress - sweepAt - offLead) / fadeDuration, 0, 1);
      alpha = nextLit ? 1 : 1 - fadeProgress;
    }
    return {
      x: cached.x,
      y: cached.y,
      sidePx: cached.sidePx,
      alpha: clamp(alpha, 0, 1),
      scanFlash: 0,
      edge: alpha ? cached.nextEdge : cached.currentEdge,
    };
  }
  const delay = ((Math.sin(index * 12.9898 + mix.index * 78.233) * 43758.5453) % 1 + 1) % 1;
  const contact = clamp((progress - delay * 0.56) / 0.3, 0, 1);
  let alpha = progress <= 0 ? currentLit : nextLit;
  if (changed && progress > 0 && progress < 1 && contact > 0 && contact < 1) {
    const spark = Math.sin(contact * Math.PI * 5 + delay * 12 + index * 0.21);
    alpha = spark > 0.08 + contact * 0.18 ? nextLit : currentLit;
  } else if (changed && progress < delay * 0.56) {
    alpha = currentLit;
  }
  return {
    x: cached.x,
    y: cached.y,
    sidePx: cached.sidePx,
    alpha: clamp(alpha, 0, 1),
    scanFlash: 0,
    edge: cached.nextAlpha > cached.currentAlpha ? cached.nextEdge : cached.currentEdge,
  };
}
function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function easeOutCubic(value) {
  const t = clamp(value, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}
function easeInBack(value) {
  const t = clamp(value, 0, 1);
  const c1 = 1.16;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}
function easeOutBack(value) {
  const t = clamp(value, 0, 1) - 1;
  const c1 = 1.16;
  const c3 = c1 + 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}
function idlePoint(point, index, now) {
  const drift = (1 - clamp(config.particleStability, 0, 1)) * 1.35;
  if (drift <= 0.001) return point;
  const seed = index * 0.017;
  return {
    x: point.x + Math.sin(now * 0.0015 + seed * 91.7) * drift,
    y: point.y + Math.cos(now * 0.0012 + seed * 63.1) * drift,
  };
}
function scatterPoint(a, b, index, segmentIndex, now) {
  const rng = seededRandom("particle-scatter|" + segmentIndex + "|" + index);
  const center = {
    x: 50 + Math.sin(segmentIndex * 1.91) * 2.2,
    y: 50 + Math.cos(segmentIndex * 1.37) * 2.2,
  };
  const direction = rng() < 0.5 ? -1 : 1;
  const angle = rng() * Math.PI * 2 + now * 0.0008 * direction;
  const stability = clamp(config.particleStability, 0, 1);
  const radius = 1.4 + Math.pow(rng(), 0.62) * (7.8 + (1 - stability) * 4.2);
  const ring = (a.edge || b.edge) ? 0.86 : 1;
  return {
    x: clamp(center.x + Math.cos(angle) * radius * ring, 34, 66),
    y: clamp(center.y + Math.sin(angle) * radius * ring, 34, 66),
  };
}
function transitionPoint(a, b, index, mix, now) {
  const progress = localProgress(mix.progress, index, mix.index);
  if (progress <= 0) return idlePoint(a, index, now);
  const cluster = scatterPoint(a, b, index, mix.index, now);
  const clusterInEnd = 0.46;
  const clusterOutStart = 0.58;
  if (progress < clusterInEnd) {
    return lerpPoint(idlePoint(a, index, now), cluster, easeInBack(progress / clusterInEnd));
  }
  if (progress < clusterOutStart) {
    const drift = (1 - clamp(config.particleStability, 0, 1)) * 1.2 + 0.55;
    return {
      x: clamp(cluster.x + Math.sin(now * 0.0032 + index * 0.31) * drift, 3, 97),
      y: clamp(cluster.y + Math.cos(now * 0.0027 + index * 0.23) * drift, 3, 97),
    };
  }
  return lerpPoint(cluster, idlePoint(b, index, now), easeOutBack((progress - clusterOutStart) / (1 - clusterOutStart)));
}
function localProgress(progress, index, segmentIndex) {
  const p = clamp(progress, 0, 1);
  if (p <= 0 || p >= 1) return p;
  const rng = seededRandom("particle-progress|" + segmentIndex + "|" + index);
  const window = Math.sin(Math.PI * p);
  const delay = (rng() - 0.5) * 0.18 * window;
  const wave = Math.sin(p * Math.PI * 2 + index * 0.39 + segmentIndex * 1.17) * 0.07 * window;
  return clamp(p + delay + wave, 0, 1);
}
function flowOffset(point, index, mix, now) {
  const stability = clamp(config.particleStability, 0, 1);
  const transitionEnergy = mix.progress > 0 ? Math.sin(Math.PI * clamp(mix.progress, 0, 1)) : 0.18;
  const clusterDamping = 1 - transitionEnergy * 0.34;
  const amplitude = (0.55 + (1 - stability) * 1.85) * (0.65 + transitionEnergy * 0.85) * clusterDamping;
  const phase = now * 0.0022 + index * 0.41 + point.y * 0.08;
  const crossPhase = now * 0.0016 + index * 0.29 + point.x * 0.065;
  return {
    x: Math.sin(phase) * amplitude + Math.sin(crossPhase * 0.73) * amplitude * 0.32,
    y: Math.cos(crossPhase) * amplitude * 0.86 + Math.sin(phase * 0.61) * amplitude * 0.28,
  };
}
function updateVirtualPointer(dt) {
  if (!pointer.active) return;
  const smooth = 1 - Math.pow(0.94, dt * 60);
  virtualPointer.x += (pointer.x - virtualPointer.x) * smooth;
  virtualPointer.y += (pointer.y - virtualPointer.y) * smooth;
}
function antigravityPoint(base, particle, index, now, dt) {
  let targetX = 0;
  let targetY = 0;
  let influence = 0;
  particle.hoverScale = 1;
  if (pointer.active) {
    const dx = base.x - virtualPointer.x;
    const dy = base.y - virtualPointer.y;
    const dist = Math.hypot(dx, dy);
    const magnetRadius = 38;
    if (dist < magnetRadius) {
      const rawInfluence = 1 - dist / magnetRadius;
      influence = rawInfluence * rawInfluence * (3 - 2 * rawInfluence) * 0.34;
      const baseAngle = dist > 0.001 ? Math.atan2(dy, dx) : particle.seed;
      const angle = baseAngle + Math.sin(now * 0.00042 + index * 0.017) * 0.05;
      const force = clamp(config.particleMouseForce, 0, 3);
      const displacement = (2.05 + Math.sin(now * 0.003 + particle.seed * 0.21) * 0.22 + particle.ringJitter * 0.18) * influence * force;
      targetX = Math.cos(angle) * displacement;
      targetY = Math.sin(angle) * displacement;
      particle.hoverScale = 1 + influence * (0.04 + Math.sin(now * 0.005 + particle.seed) * 0.012);
    }
  }
  const rate = pointer.active ? 18 : 4.2;
  const ease = 1 - Math.exp(-rate * dt);
  particle.hoverX += (targetX - particle.hoverX) * ease;
  particle.hoverY += (targetY - particle.hoverY) * ease;
  return {
    x: clamp(base.x + particle.hoverX, 2, 98),
    y: clamp(base.y + particle.hoverY, 2, 98),
  };
}
function drawParticle(particle) {
  const point = toCanvas(particle);
  const ratio = window.devicePixelRatio || 1;
  const sizeBoost = particle.edge ? 1.1 : 0.96;
  const size = Math.max(0.55, config.particleSize * particle.sizeJitter * sizeBoost * (particle.hoverScale || 1)) * ratio;
  ctx.globalAlpha = particle.alpha ?? (particle.halo ? 0.34 : (particle.edge ? 0.96 : 0.78));
  ctx.fillStyle = particle.color;
  if (isMatrixMode()) {
    const litAlpha = clamp(particle.alpha || 0, 0, 1);
    const scanFlash = clamp(particle.scanFlash || 0, 0, 1);
    const squareSize = particle.squareSize || squarePixelSize(ratio);
    function drawMatrixCell(alpha, color) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      if (isAsciiMode()) {
        ctx.font = (particle.weightJitter || 650) + " " + Math.max(7, squareSize * 0.92) + "px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const chars = [".", "*", "+", "#", "@"];
        const charTick = Math.floor(performance.now() / (420 + (particle.seed % 260)));
        const char = chars[(charTick + Math.floor(particle.seed + particle.x * 0.31 + particle.y * 0.17)) % chars.length];
        ctx.fillText(char, point.x, point.y);
      } else {
        ctx.fillRect(point.x - squareSize / 2, point.y - squareSize / 2, squareSize, squareSize);
      }
    }
    drawMatrixCell(clamp(config.particleSquareOffOpacity, 0, 1), config.particleSquareOffColor);
    const onAlpha = Math.max(litAlpha * clamp(config.particleSquareOnOpacity, 0, 1), scanFlash * clamp(config.particleSquareOnOpacity, 0, 1) * 0.72);
    if (onAlpha > 0.015) {
      drawMatrixCell(onAlpha, config.particleSquareOnColor);
    }
  } else if (isAsciiMode()) {
    ctx.font = (particle.weightJitter || 650) + " " + Math.max(8, size * 5.2) + "px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chars = [".", "*", "+", "#", "@"];
    const charTick = Math.floor(performance.now() / (420 + (particle.seed % 260)));
    const char = chars[(charTick + Math.floor(particle.seed + particle.x * 0.31 + particle.y * 0.17)) % chars.length];
    ctx.fillText(char, point.x, point.y);
  } else {
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function tick(now) {
  resize();
  const previous = lastFrameAt ?? now;
  const dt = Math.min(0.05, Math.max(0.001, (now - previous) / 1000));
  lastFrameAt = now;
  const mix = frameMix(now);
  updateVirtualPointer(dt);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const squareStates = isMatrixMode() ? squareGridStates(mix) : null;
  if (squareStates) ensureParticleCount(squareStates.length);
  const renderCount = squareStates ? squareStates.length : particles.length;
  for (let index = 0; index < renderCount; index += 1) {
    const particle = particles[index];
    if (squareStates) {
      const square = squareState(index, mix, now, squareStates);
      particle.x = square.x;
      particle.y = square.y;
      particle.edge = square.edge;
      particle.halo = false;
      particle.alpha = square.alpha;
      particle.scanFlash = square.scanFlash || 0;
      particle.squareSize = square.sidePx;
      particle.hoverScale = 1;
      drawParticle(particle);
      continue;
    }
    const a = mix.current[index % Math.max(1, mix.current.length)] || { x: 50, y: 50 };
    const b = mix.next[index % Math.max(1, mix.next.length)] || a;
    particle.edge = Boolean(a.edge || b.edge);
    particle.halo = Boolean(a.halo || b.halo);
    particle.alpha = null;
    particle.scanFlash = 0;
    const pathPoint = transitionPoint(a, b, index, mix, now);
    const flow = flowOffset(pathPoint, index, mix, now);
    const base = {
      x: clamp(pathPoint.x + flow.x, 3, 97),
      y: clamp(pathPoint.y + flow.y, 3, 97),
    };
    const antigravity = antigravityPoint(base, particle, index, now, dt);
    particle.x = antigravity.x;
    particle.y = antigravity.y;
    drawParticle(particle);
  }
  requestAnimationFrame(tick);
}
canvas.addEventListener("pointermove", (event) => {
  resize();
  const wasActive = pointer.active;
  Object.assign(pointer, fromEvent(event), { active: true });
  if (!wasActive) {
    virtualPointer.x = pointer.x;
    virtualPointer.y = pointer.y;
  }
});
canvas.addEventListener("pointerleave", () => { pointer.active = false; });
canvas.addEventListener("pointercancel", () => { pointer.active = false; });
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function generateParticleLottie() {
  const targets = state.particleTargets[0] ?? [];
  const layers = targets.slice(0, 140).map((point, index) => makeLottieEllipseLayer(
    `Particle ${index + 1}`,
    point,
    Math.max(0.18, Number(config.particleSize) * 0.22),
    {
      index: index + 1,
      fill: particleColorForIndex(index),
      opacity: point.halo ? 0.34 : (point.edge ? 0.96 : 0.78),
    },
  ));
  return makeBasicLottieDocument("Particle", layers);
}
