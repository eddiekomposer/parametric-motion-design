// line effect module. Loaded before the main UI script.
var lineDefaults = {
  lineKeyframes: [
    { id: 1, text: "lark" },
    { id: 2, text: "lark" },
    { id: 3, text: "lark" },
  ],
  lineStyle: "organic",
  constellationPointCount: 12,
  constellationContourColor: "#f6f7f1",
  constellationContourOpacity: 0.28,
  constellationContourWidth: 0.8,
  constellationStaggerMs: 220,
  constellationFlickerMs: 150,
  lineFrameIntervalMs: 2600,
  lineTransitionMs: 900,
  lineCurveSeed: 1,
  lineStrokeWidth: 1.35,
  lineCharSize: 7.8,
  lineColor: "#f6f7f1",
  lineOpacity: 0.5,
  lineCharColor: "#f6f7f1",
  lineCharOpacity: 1,
};

var lineControlDefs = [
  {
    key: "lineStyle",
    type: "segmented",
    label: "样式",
    options: [
      { value: "organic", label: "有机物" },
      { value: "constellation", label: "星座" },
    ],
    tip: "切换连线动效的视觉规则。",
  },
  { key: "constellationPointCount", label: "端点数量", min: 5, max: 20, step: 1, showWhen: () => config.lineStyle === "constellation", tip: "只控制星座样式中视觉端点的数量，不改变图案轮廓精度。" },
  { key: "constellationContourWidth", label: "轮廓粗细", min: 0.3, max: 4, step: 0.1, showWhen: () => config.lineStyle === "constellation", tip: "控制星座样式中底层轮廓线粗细。" },
  { key: "constellationContourColor", alphaKey: "constellationContourOpacity", type: "colorAlpha", label: "轮廓颜色", showWhen: () => config.lineStyle === "constellation", tip: "控制星座样式中底层轮廓线颜色和透明度。" },
  { key: "constellationStaggerMs", label: "时间差", min: 0, max: 900, step: 20, showWhen: () => config.lineStyle === "constellation", tip: "控制星座样式中过渡时不同点和线依次亮起的延迟。" },
  { key: "constellationFlickerMs", label: "闪烁时长", min: 80, max: 240, step: 10, showWhen: () => config.lineStyle === "constellation", tip: "控制星座样式中单次接触不良闪烁持续多久；每根线会随机闪烁 0 到 2 次。" },
  { key: "lineFrameIntervalMs", label: "时间间隔", min: 900, max: 6000, step: 100, tip: "每隔这段时间切到下一个关键帧，末尾用自定义过渡时长 ease-in-out；最后一帧直接衔接回第一帧。" },
  { key: "lineTransitionMs", label: "过渡时长", min: 600, max: 1500, step: 50, tip: "控制关键帧之间 ease-in-out 过渡的时长。" },
  { key: "lineStrokeWidth", label: "连线粗细", min: 0.6, max: 4, step: 0.1, tip: "控制直线和贝塞尔曲线的线宽。" },
  { key: "lineCharSize", label: "字符大小", min: 4, max: 12, step: 0.1, tip: "控制关键帧字符的显示大小。" },
  { key: "lineColor", alphaKey: "lineOpacity", type: "colorAlpha", label: "连线颜色", tip: "控制直线和贝塞尔曲线的颜色和透明度。" },
  { key: "lineCharColor", alphaKey: "lineCharOpacity", type: "colorAlpha", label: "字符颜色", tip: "控制字符的颜色和透明度。" },
];

function renderLineKeyframeEditor(container) {
  const editor = document.createElement("div");
  editor.className = "keyframe-editor";
  editor.innerHTML = `
    <div class="keyframe-head">
      <p class="keyframe-title">关键帧</p>
      <div class="panel-actions">
        <button class="small-btn" type="button" data-keyframe-action="add">添加</button>
      </div>
    </div>
    <div class="keyframe-list"></div>
  `;
  const list = editor.querySelector(".keyframe-list");
  config.lineKeyframes.forEach((frame, index) => {
    const row = document.createElement("div");
    row.className = "keyframe-row";
    row.innerHTML = `
      <span class="keyframe-index">${index + 1}</span>
      <input class="keyframe-input" data-keyframe-id="${frame.id}" value="${escapeHtml(frame.text)}" aria-label="关键帧 ${index + 1}">
      <button class="icon-btn${state.lineEdit?.frameId === frame.id ? " is-active" : ""}" type="button" data-keyframe-action="edit" data-keyframe-id="${frame.id}" aria-label="编辑关键帧 ${index + 1} 曲线">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4"></path><path d="M14.5 4.5 19.5 9.5"></path><path d="M6 18 17.5 6.5a2.1 2.1 0 0 1 3 3L9 21H6z"></path></svg>
      </button>
      <button class="icon-btn" type="button" data-keyframe-action="delete" data-keyframe-id="${frame.id}" aria-label="删除关键帧 ${index + 1}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V5h6v2"></path><path d="M7 7l1 13h8l1-13"></path></svg>
      </button>
    `;
    list.appendChild(row);
  });
  editor.addEventListener("input", (event) => {
    const input = event.target.closest(".keyframe-input");
    if (!input) return;
    const frame = config.lineKeyframes.find((item) => String(item.id) === String(input.dataset.keyframeId));
    if (!frame) return;
    frame.text = input.value;
    resetLineFrameGeometry(frame);
    activeEffect().prepare();
    state.startedAt = performance.now();
    updateMeta();
    updateFormulaAndCode();
  });
  editor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-keyframe-action]");
    if (!button) return;
    const action = button.dataset.keyframeAction;
    if (action === "add") {
      const nextId = Math.max(0, ...config.lineKeyframes.map((frame) => frame.id)) + 1;
      config.lineKeyframes.push({ id: nextId, text: "line" });
    } else if (action === "edit") {
      const frameId = Number(button.dataset.keyframeId);
      if (state.lineEdit?.frameId === frameId) finishLineCurveEdit();
      else startLineCurveEdit(frameId);
      return;
    } else if (action === "delete" && config.lineKeyframes.length > 1) {
      config.lineKeyframes = config.lineKeyframes.filter((frame) => String(frame.id) !== String(button.dataset.keyframeId));
      if (state.lineEdit?.frameId === Number(button.dataset.keyframeId)) finishLineCurveEdit();
    }
    renderMotionControls();
    activeEffect().prepare();
    state.startedAt = performance.now();
    updateMeta();
    updateFormulaAndCode();
  });
  container.appendChild(editor);
}

function resetLineFrameGeometry(frame) {
  delete frame.points;
  delete frame.connections;
  delete frame.connectionsEdited;
  delete frame.constellationConnections;
  delete frame.constellationConnectionsEdited;
}

function resetLineReferenceGeometry() {
  config.lineKeyframes.forEach(resetLineFrameGeometry);
}

function prepareLineEffect() {
  prepareFlowEffect();
  if (config.lineStyle === "constellation") {
    prepareConstellationLineEffect();
    return;
  }
  state.constellationPoints = [];
  state.lineFrames = [];
  const previousFrames = [];
  config.lineKeyframes.forEach((frame, index) => {
    const chars = Array.from(frame.text ?? "").filter((char) => !/\s/.test(char));
    const points = ensureLineFramePoints(frame, chars, index, previousFrames);
    const connections = ensureLineFrameConnections(frame, points);
    const prepared = { id: frame.id, text: frame.text, chars, points, connections };
    state.lineFrames.push(prepared);
    previousFrames.push(prepared);
  });
  state.lineConnections = state.lineFrames[0]?.connections ?? [];
}

function prepareConstellationLineEffect() {
  state.constellationPoints = buildConstellationPoints();
  state.constellationContourPath = constellationContourBasePath();
  state.lineFrames = [];
  config.lineKeyframes.forEach((frame, index) => {
    const chars = Array.from(frame.text ?? "").filter((char) => !/\s/.test(char));
    const points = chooseConstellationFramePoints(chars, frame.id, index);
    const connections = ensureConstellationFrameConnections(frame, points, index);
    connections.forEach((connection) => {
      connection.d = constellationConnectionPath(points[connection.a], points[connection.b], connection, points);
    });
    state.lineFrames.push({ id: frame.id, text: frame.text, chars, points, connections, contourPath: constellationContourBasePath(points) });
  });
  state.lineConnections = state.lineFrames[0]?.connections ?? [];
}

function ensureLineFramePoints(frame, chars, frameIndex, previousFrames) {
  const saved = Array.isArray(frame.points) ? frame.points : [];
  const valid = saved.length === chars.length && saved.every((point, index) => point?.char === chars[index] && Number.isFinite(point.x) && Number.isFinite(point.y));
  if (valid) {
    return saved.map((point) => ({
      char: point.char,
      progress: Number.isFinite(point.progress) ? point.progress : 0,
      point: { x: Number(point.x), y: Number(point.y) },
    }));
  }
  delete frame.connections;
  delete frame.connectionsEdited;
  const points = chooseLineFramePoints(chars, frame.id, frameIndex, previousFrames);
  frame.points = serializeLineFramePoints(points);
  return points;
}

function serializeLineFramePoints(points) {
  return points.map((item) => ({
    char: item.char,
    progress: Number.isFinite(item.progress) ? Number(item.progress.toFixed(6)) : 0,
    x: Number(item.point.x.toFixed(3)),
    y: Number(item.point.y.toFixed(3)),
  }));
}

function ensureLineFrameConnections(frame, points) {
  const count = Array.isArray(points) ? points.length : Number(points);
  if (count < 2) {
    frame.connections = [];
    return [];
  }
  const seen = new Set();
  const hasSavedConnections = Array.isArray(frame.connections) && (frame.connections.length > 0 || frame.connectionsEdited);
  const valid = hasSavedConnections
    && frame.connections.every((connection) => {
      const a = Number(connection.a);
      const b = Number(connection.b);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= count || b >= count || a === b) return false;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!valid) frame.connections = buildLineConnections(points, frame.id);
  return cloneLineConnections(frame.connections);
}

function cloneLineConnections(connections) {
  return connections.map((connection) => ({
    a: connection.a,
    b: connection.b,
    curved: Boolean(connection.curved),
    bendA: Number(connection.bendA),
    bendB: Number(connection.bendB),
    tensionA: Number(connection.tensionA),
    tensionB: Number(connection.tensionB),
  }));
}

function chooseLineFramePoints(chars, frameId, frameIndex, previousFrames) {
  if (!chars.length || (!state.coefficients.length && !state.flowSampleContours?.length)) return [];
  let best = null;
  for (let variant = 0; variant < 72; variant += 1) {
    const rng = seededRandom(`${frameId}|${frameIndex}|${chars.join("")}|${variant}`);
    const offset = normalizeProgress(frameIndex * 0.38196601125 + variant * 0.137 + rng() * 0.22);
    const points = chars.map((char, index) => {
      const spread = 1 / chars.length;
      const jitter = (rng() - 0.5) * Math.min(1.12 * spread, 0.22);
      const progress = normalizeProgress(offset + (index + 0.5) * spread + jitter);
      return {
        char,
        progress,
        point: curvePoint(progress, 1),
      };
    });
    const score = lineFrameDifference(points, previousFrames) + lineFrameSpatialSpread(points) * 0.92;
    if (!best || score > best.score) best = { score, points };
  }
  return best?.points ?? [];
}

function lineFrameSpatialSpread(points) {
  if (points.length < 2) return 0;
  const coords = points.map((item) => item.point);
  const minX = Math.min(...coords.map((point) => point.x));
  const maxX = Math.max(...coords.map((point) => point.x));
  const minY = Math.min(...coords.map((point) => point.y));
  const maxY = Math.max(...coords.map((point) => point.y));
  const boxScore = Math.hypot(maxX - minX, maxY - minY) / 130;
  let nearestTotal = 0;
  coords.forEach((point, index) => {
    let nearest = Infinity;
    coords.forEach((other, otherIndex) => {
      if (index === otherIndex) return;
      nearest = Math.min(nearest, distance(point, other));
    });
    nearestTotal += Math.min(nearest, 42) / 42;
  });
  const distanceScore = nearestTotal / points.length;
  return boxScore * 0.62 + distanceScore * 0.38;
}

function lineFrameDifference(points, previousFrames) {
  const previousPoints = previousFrames.flatMap((frame) => frame.points);
  if (!previousPoints.length) return 1;
  const total = points.reduce((sum, point) => {
    const nearest = previousPoints.reduce((best, previous) => Math.min(best, circularDistance(point.progress, previous.progress)), 1);
    return sum + nearest;
  }, 0);
  return total / Math.max(1, points.length);
}

function circularDistance(a, b) {
  const delta = Math.abs(a - b);
  return Math.min(delta, 1 - delta);
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

function buildLineConnections(pointsOrCount, seedKey = "") {
  const maxPoints = Array.isArray(pointsOrCount) ? pointsOrCount.length : Number(pointsOrCount);
  if (maxPoints < 2) return [];
  const points = Array.isArray(pointsOrCount) ? pointsOrCount : [];
  const rng = seededRandom(`line-connections|${maxPoints}|${config.lineCurveSeed}|${seedKey}`);
  const closed = maxPoints > 3 && rng() > 0.48;
  const desired = closed ? maxPoints : maxPoints - 1;
  const pointOrder = chooseLinePointOrder(points, maxPoints, desired, closed, seedKey);
  const curveIndex = Math.floor(rng() * desired);
  return Array.from({ length: desired }, (_, index) => {
    const connection = { a: pointOrder[index], b: pointOrder[(index + 1) % maxPoints] };
    const curveRng = seededRandom(`line-curve-shape|${maxPoints}|${index}|${config.lineCurveSeed}|${seedKey}`);
    const sign = curveRng() > 0.5 ? 1 : -1;
    const sCurve = curveRng() > 0.42;
    return {
      ...connection,
      curved: index === curveIndex,
      bendA: sign * (0.18 + curveRng() * 0.38),
      bendB: (sCurve ? -sign : sign) * (0.18 + curveRng() * 0.42),
      tensionA: 0.22 + curveRng() * 0.2,
      tensionB: 0.66 + curveRng() * 0.22,
    };
  });
}

function chooseLinePointOrder(points, count, connectionCount, closed, seedKey) {
  let best = null;
  const attempts = points.length ? 72 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const order = shuffledLinePointOrder(count, `line-order|${count}|${connectionCount}|${closed}|${config.lineCurveSeed}|${seedKey}|${attempt}`);
    const crossingCount = points.length ? countLineOrderCrossings(points, order, connectionCount, closed) : 1;
    const target = targetLineCrossings(connectionCount);
    const tooMany = Math.max(0, crossingCount - Math.max(target + 2, Math.ceil(connectionCount * 0.55)));
    const ringPenalty = crossingCount === 0 && connectionCount > 2 ? 6 : 0;
    const score = Math.abs(crossingCount - target) + ringPenalty + tooMany * 4;
    if (!best || score < best.score) best = { order, score, crossingCount };
    if (best.score === 0) break;
  }
  return best?.order ?? shuffledLinePointOrder(count, `line-order|${count}|fallback|${seedKey}`);
}

function targetLineCrossings(connectionCount) {
  if (connectionCount < 3) return 0;
  if (connectionCount < 5) return 1;
  return Math.min(3, Math.max(1, Math.round(connectionCount * 0.32)));
}

function countLineOrderCrossings(points, order, connectionCount, closed) {
  const segments = Array.from({ length: connectionCount }, (_, index) => ({
    from: order[index],
    to: order[(index + 1) % order.length],
  }));
  let crossings = 0;
  for (let aIndex = 0; aIndex < segments.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < segments.length; bIndex += 1) {
      const first = segments[aIndex];
      const second = segments[bIndex];
      if (first.from === second.from || first.from === second.to || first.to === second.from || first.to === second.to) continue;
      if (closed && aIndex === 0 && bIndex === segments.length - 1) continue;
      if (lineSegmentsIntersect(linePointForIndex(points, first.from), linePointForIndex(points, first.to), linePointForIndex(points, second.from), linePointForIndex(points, second.to))) crossings += 1;
    }
  }
  return crossings;
}

function linePointForIndex(points, index) {
  return points[index]?.point ?? points[index] ?? { x: 0, y: 0 };
}

function lineSegmentsIntersect(a, b, c, d) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const denominator = abx * cdy - aby * cdx;
  if (Math.abs(denominator) < 0.0001) return false;
  const t = (acx * cdy - acy * cdx) / denominator;
  const u = (acx * aby - acy * abx) / denominator;
  return t > 0.03 && t < 0.97 && u > 0.03 && u < 0.97;
}

function shuffledLinePointOrder(count, seed) {
  const rng = seededRandom(seed);
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}

function ensureLineGroup() {
  if (!state.lineGroup) {
    state.lineGroup = document.createElementNS(SVG_NS, "g");
    state.lineGroup.setAttribute("id", "line-group");
    motionGroup.appendChild(state.lineGroup);
  }
  state.lineGroup.style.display = "";
  return state.lineGroup;
}

function hideLineGroup() {
  if (state.lineGroup) state.lineGroup.style.display = "none";
}

function hideParticles() {
  state.particles.forEach((circle) => { circle.style.display = "none"; });
}

function ensureLineElements(lineCount, textCount) {
  const group = ensureLineGroup();
  while (state.linePaths.length < lineCount) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "line-path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    group.appendChild(path);
    state.linePaths.push(path);
  }
  while (state.lineTexts.length < textCount) {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-family", "Inter, SF Pro Display, Arial, sans-serif");
    text.setAttribute("font-weight", "700");
    group.appendChild(text);
    state.lineTexts.push(text);
  }
  state.linePaths.forEach((path, index) => { path.style.display = index < lineCount ? "" : "none"; });
  state.lineTexts.forEach((text, index) => { text.style.display = index < textCount ? "" : "none"; });
  state.constellationDots.forEach((dot) => { dot.style.display = "none"; });
}

function ensureConstellationElements(dotCount, lineCount, textCount) {
  const group = ensureLineGroup();
  while (state.constellationDots.length < dotCount) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("vector-effect", "non-scaling-stroke");
    group.appendChild(circle);
    state.constellationDots.push(circle);
  }
  while (state.linePaths.length < lineCount) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "line-path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    group.appendChild(path);
    state.linePaths.push(path);
  }
  while (state.lineTexts.length < textCount) {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-family", "Inter, SF Pro Display, Arial, sans-serif");
    text.setAttribute("font-weight", "700");
    group.appendChild(text);
    state.lineTexts.push(text);
  }
  state.constellationDots.forEach((dot) => group.appendChild(dot));
  state.linePaths.forEach((path) => group.appendChild(path));
  state.lineTexts.forEach((text) => group.appendChild(text));
  state.constellationDots.forEach((dot, index) => { dot.style.display = index < dotCount ? "" : "none"; });
  state.linePaths.forEach((path, index) => { path.style.display = index < lineCount ? "" : "none"; });
  state.lineTexts.forEach((text, index) => { text.style.display = index < textCount ? "" : "none"; });
}

function buildConstellationPoints() {
  if (useDefaultConstellationScatter()) return buildDefaultConstellationPoints();
  const contours = state.normalizedContours.length ? state.normalizedContours : [state.normalized].filter((contour) => contour.length);
  const maxChars = Math.max(0, ...config.lineKeyframes.map((frame) => Array.from(frame.text ?? "").filter((char) => !/\s/.test(char)).length));
  const target = Math.max(5, maxChars, Math.round(config.constellationPointCount));
  if (!contours.length) return [];
  const boundaryTarget = Math.max(3, Math.min(target, Math.round(target * 0.58)));
  const contourLengths = contours.map(contourLength);
  const totalLength = contourLengths.reduce((sum, value) => sum + value, 0) || contours.length;
  const points = [];
  contours.forEach((contour, contourIndex) => {
    const count = Math.max(3, Math.round(boundaryTarget * (contourLengths[contourIndex] || 1) / totalLength));
    const sampled = resampleSmoothClosed(contour, count);
    sampled.forEach((point, pointIndex) => {
      points.push({
        x: point.x,
        y: point.y,
        onContour: true,
        contourIndex,
        contourPointIndex: pointIndex,
        contourPointCount: sampled.length,
        contourProgress: pointIndex / sampled.length,
      });
    });
  });
  const bounds = contourBounds(contours);
  const rng = seededRandom(`constellation-points|${state.fileName}|${target}|${config.constellationPointCount}|${config.simplifyPointCount}|${config.harmonicCount}`);
  const idealGap = constellationPointDistributionGap(target, bounds);
  let guard = 0;
  while (points.length < target && guard < target * 180) {
    guard += 1;
    const point = {
      x: bounds.minX + rng() * Math.max(1, bounds.maxX - bounds.minX),
      y: bounds.minY + rng() * Math.max(1, bounds.maxY - bounds.minY),
    };
    if (!pointInsideConstellationShape(point, contours)) continue;
    const relaxedGap = guard < target * 90 ? idealGap : idealGap * 0.62;
    if (!points.every((existing) => distance(point, existing) >= relaxedGap)) continue;
    points.push({ ...point, onContour: false, contourIndex: -1, contourPointIndex: -1, contourPointCount: 0 });
  }
  return points.slice(0, target);
}

function useDefaultConstellationScatter() {
  return Boolean(state.usingSampleReference && config.effectType === "line" && config.lineStyle === "constellation");
}

function buildDefaultConstellationPoints() {
  const maxChars = Math.max(0, ...config.lineKeyframes.map((frame) => Array.from(frame.text ?? "").filter((char) => !/\s/.test(char)).length));
  const target = Math.max(5, maxChars, Math.round(config.constellationPointCount));
  const rng = seededRandom(`constellation-default-scatter|${target}|${config.lineCurveSeed}|${config.lineKeyframes.map((frame) => frame.text).join("|")}`);
  const margin = 7;
  const usable = 100 - margin * 2;
  const points = [];
  while (points.length < target) {
    let best = null;
    const candidateCount = points.length ? 96 : 1;
    for (let index = 0; index < candidateCount; index += 1) {
      const candidate = {
        x: margin + rng() * usable,
        y: margin + rng() * usable,
      };
      if (!points.length) {
        best = { candidate, score: 1 };
        continue;
      }
      const nearest = points.reduce((min, point) => Math.min(min, distance(candidate, point)), Infinity);
      const edgeReach = Math.max(Math.abs(candidate.x - 50), Math.abs(candidate.y - 50)) / 50;
      const score = nearest + edgeReach * 5 + rng() * 0.35;
      if (!best || score > best.score) best = { candidate, score };
    }
    points.push(best?.candidate ?? { x: 50, y: 50 });
  }
  return points.map((point, index) => ({
    x: point.x,
    y: point.y,
    onContour: false,
    contourIndex: -1,
    contourPointIndex: -1,
    contourPointCount: 0,
    contourProgress: index / Math.max(1, target),
  }));
}

function contourLength(contour) {
  return contour.reduce((sum, point, index) => sum + distance(point, contour[(index + 1) % contour.length]), 0);
}

function contourBounds(contours) {
  const all = contours.flat();
  return all.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), { minX: 8, minY: 8, maxX: 92, maxY: 92 });
}

function pointInsideConstellationShape(point, contours) {
  let inside = false;
  contours.forEach((contour) => {
    if (pointInPolygon(point, contour)) inside = !inside;
  });
  return inside;
}

function constellationPointDistributionGap(target, bounds) {
  const diagonal = Math.hypot(Math.max(1, bounds.maxX - bounds.minX), Math.max(1, bounds.maxY - bounds.minY));
  return clamp((diagonal / Math.sqrt(Math.max(1, target))) * 0.34, 5.2, 13.5);
}

function chooseConstellationFramePoints(chars, frameId, frameIndex) {
  if (!chars.length || !state.constellationPoints.length) return [];
  const order = chooseSpreadConstellationBaseIndices(chars.length, `constellation-order|${frameId}|${frameIndex}|${chars.join("")}|${config.constellationPointCount}|${config.simplifyPointCount}|${config.harmonicCount}|${config.lineCurveSeed}`);
  return chars.slice(0, state.constellationPoints.length).map((char, index) => {
    const baseIndex = order[index % order.length];
    const base = state.constellationPoints[baseIndex];
    return {
      char,
      baseIndex,
      point: { x: base.x, y: base.y },
      onContour: base.onContour,
      contourIndex: base.contourIndex,
      contourPointIndex: base.contourPointIndex,
      contourPointCount: base.contourPointCount,
      contourProgress: base.contourProgress,
    };
  });
}

function chooseSpreadConstellationBaseIndices(count, seed) {
  const total = state.constellationPoints.length;
  const desired = Math.min(count, total);
  if (!desired) return [];
  const shuffled = shuffledLinePointOrder(total, seed);
  const chosen = [shuffled[0]];
  const used = new Set(chosen);
  const rng = seededRandom(`${seed}|spread`);
  while (chosen.length < desired) {
    let best = null;
    shuffled.forEach((candidate) => {
      if (used.has(candidate)) return;
      const point = state.constellationPoints[candidate];
      const nearest = chosen.reduce((min, index) => Math.min(min, distance(point, state.constellationPoints[index])), Infinity);
      const score = nearest + rng() * 1.8;
      if (!best || score > best.score) best = { candidate, score };
    });
    if (!best) break;
    chosen.push(best.candidate);
    used.add(best.candidate);
  }
  return chosen;
}

function ensureConstellationFrameConnections(frame, points, frameIndex) {
  const count = points.length;
  if (count < 2) return [];
  const saved = Array.isArray(frame.constellationConnections) ? frame.constellationConnections : [];
  const seen = new Set();
  const valid = (saved.length > 0 || frame.constellationConnectionsEdited) && saved.every((connection) => {
    const a = Number(connection.a);
    const b = Number(connection.b);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= count || b >= count || a === b) return false;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (valid) return saved.map((connection) => makeConstellationConnection(connection.a, connection.b, points));
  const order = chooseLinePointOrder(points, points.length, points.length - 1, false, `constellation-lines|${frame.id}|${frameIndex}|${config.lineCurveSeed}`);
  const generated = Array.from({ length: points.length - 1 }, (_, index) => makeConstellationConnection(order[index], order[index + 1], points));
  frame.constellationConnections = generated.map((connection) => ({ a: connection.a, b: connection.b }));
  return generated;
}

function makeConstellationConnection(a, b, points) {
  const connection = {
    a,
    b,
    curved: false,
    constellation: true,
    contourPath: areAdjacentConstellationContourPoints(points[a], points[b]),
  };
  connection.d = constellationConnectionPath(points[a], points[b], connection, points);
  return connection;
}

function areAdjacentConstellationContourPoints(a, b) {
  if (!a?.onContour || !b?.onContour || a.contourIndex !== b.contourIndex) return false;
  const count = Math.max(1, a.contourPointCount);
  const delta = Math.abs(a.contourPointIndex - b.contourPointIndex);
  return delta === 1 || delta === count - 1;
}

function constellationConnectionPath(a, b, connection, activePoints = []) {
  if (!a || !b) return "";
  if (connection.contourPath) {
    const contourPath = constellationContourConnectionPath(a, b, activePoints);
    if (contourPath) return contourPath;
  }
  const points = sampleConstellationLine(a.point, b.point);
  return buildClippedConstellationPath(points, constellationConnectionGapBlockers(activePoints));
}

function constellationContourConnectionPath(a, b, activePoints = []) {
  const source = (state.normalizedContours.length ? state.normalizedContours : [state.normalized])[a.contourIndex];
  if (!source?.length) return "";
  const count = Math.max(1, a.contourPointCount);
  const forward = (a.contourPointIndex + 1) % count === b.contourPointIndex;
  const backward = (b.contourPointIndex + 1) % count === a.contourPointIndex;
  if (!forward && !backward) return "";
  const samples = constellationSmoothContourSamples(source);
  const startIndex = Math.round(normalizeProgress(a.contourProgress) * samples.length) % samples.length;
  const endIndex = Math.round(normalizeProgress(b.contourProgress) * samples.length) % samples.length;
  const arc = [];
  let index = startIndex;
  arc.push(samples[index]);
  for (let guard = 0; guard <= samples.length; guard += 1) {
    if (index === endIndex) break;
    index = forward ? (index + 1) % samples.length : (index - 1 + samples.length) % samples.length;
    arc.push(samples[index]);
  }
  return buildClippedConstellationPath(arc, constellationConnectionGapBlockers(activePoints));
}

function constellationContourBasePath(activePoints = []) {
  if (useDefaultConstellationScatter()) return "";
  const contours = state.normalizedContours.length ? state.normalizedContours : [state.normalized].filter((contour) => contour.length);
  const blockers = constellationContourGapBlockers(activePoints);
  return contours.map((contour) => {
    const samples = constellationSmoothContourSamples(contour);
    return buildClippedConstellationPath(samples.concat([samples[0]]), blockers);
  }).filter(Boolean).join(" ");
}

function constellationSmoothContourSamples(contour) {
  return resampleClosed(smoothClosedPolyline(contour, 18), Math.max(240, contour.length * 30));
}

function sampleConstellationLine(a, b) {
  const steps = Math.max(8, Math.ceil(distance(a, b) / 0.55));
  return Array.from({ length: steps + 1 }, (_, index) => lerpPoint(a, b, index / steps));
}

function constellationConnectionGapBlockers(activePoints = []) {
  return activePoints.filter((item) => item?.point).map((item) => ({ point: item.point, radius: constellationEndpointRadius() }));
}

function constellationContourGapBlockers(activePoints = []) {
  const blockers = state.constellationPoints.map((point) => ({ point, radius: constellationDotGapRadius() }));
  activePoints.forEach((item) => {
    if (item?.point) blockers.push({ point: item.point, radius: constellationEndpointRadius() });
  });
  return blockers;
}

function constellationDotGapRadius() {
  return Math.max(1.75, config.lineCharSize * 0.18 + Math.max(0.45, config.lineStrokeWidth) * 0.55);
}

function constellationEndpointRadius() {
  return Math.max(0, Number(config.lineCharSize) || 0);
}

function buildClippedConstellationPath(points, blockers) {
  const segments = [];
  let current = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    const steps = Math.max(1, Math.ceil(distance(a, b) / 0.45));
    for (let step = 0; step <= steps; step += 1) {
      if (index > 0 && step === 0) continue;
      const point = lerpPoint(a, b, step / steps);
      if (blockers.some((blocker) => distance(point, blocker.point) <= blocker.radius)) {
        if (current.length > 1) segments.push(current);
        current = [];
      } else {
        current.push(point);
      }
    }
  }
  if (current.length > 1) segments.push(current);
  return segments.map(buildConstellationPolylinePath).filter(Boolean).join(" ");
}

function buildConstellationPolylinePath(points) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function renderLineEffect(now) {
  hideParticleCanvas();
  hideParticles();
  hideSineGroup();
  hideOscilloscopeGroup();
  if (state.lineEdit) {
    renderLineEditFrame();
    return;
  }
  hideLineEditHandles();
  if (config.lineStyle === "constellation") {
    renderConstellationLineEffect(now);
    return;
  }
  const frames = state.lineFrames.filter((frame) => frame.points.length);
  const interval = Math.max(300, config.lineFrameIntervalMs);
  const transition = Math.min(Math.max(600, config.lineTransitionMs), interval);
  const hold = Math.max(0, interval - transition);
  const cycle = Math.max(1, frames.length) * interval;
  const elapsed = Number.isFinite(state.startedAt) ? now - state.startedAt : 0;
  const local = ((elapsed % cycle) + cycle) % cycle;
  motionPath.setAttribute("stroke-width", String(config.lineStrokeWidth));
  motionPath.setAttribute("stroke", config.lineColor);
  motionPath.setAttribute("d", state.normalizedContours.length ? buildSmoothSvgMultiPath(state.normalizedContours, state.normalizedContourClosed) : buildPath(1));
  motionPath.setAttribute("opacity", "0");

  if (!frames.length) {
    ensureLineElements(0, 0);
    return;
  }

  const segment = Math.min(frames.length - 1, Math.floor(local / interval));
  const frameLocal = local % interval;
  const nextIndex = (segment + 1) % frames.length;
  const progress = frameLocal < hold ? 0 : standardBezierEase((frameLocal - hold) / transition);
  const current = frames[segment] ?? frames[0];
  const next = frames[nextIndex] ?? current;
  if (progress > 0 && progress < 1) drawTransitionLineFrame(current, next, progress);
  else drawLineFrame(progress <= 0 ? current.points : next.points, progress <= 0 ? current.connections : next.connections);
}

function renderConstellationLineEffect(now) {
  const frames = state.lineFrames.filter((frame) => frame.points.length);
  const interval = Math.max(300, config.lineFrameIntervalMs);
  const transition = Math.min(Math.max(600, config.lineTransitionMs), interval);
  const hold = Math.max(0, interval - transition);
  const cycle = Math.max(1, frames.length) * interval;
  const elapsed = Number.isFinite(state.startedAt) ? now - state.startedAt : 0;
  const local = ((elapsed % cycle) + cycle) % cycle;
  motionPath.setAttribute("stroke-width", String(config.constellationContourWidth));
  motionPath.setAttribute("stroke", config.constellationContourColor);
  motionPath.setAttribute("opacity", String(config.constellationContourOpacity));
  motionPath.style.filter = "";
  if (!frames.length) {
    drawConstellationBase(0, 0);
    return;
  }
  const segment = Math.min(frames.length - 1, Math.floor(local / interval));
  const frameLocal = local % interval;
  const nextIndex = (segment + 1) % frames.length;
  const progress = frameLocal < hold ? 0 : standardBezierEase((frameLocal - hold) / transition);
  const current = frames[segment] ?? frames[0];
  const next = frames[nextIndex] ?? current;
  if (progress > 0 && progress < 1) drawConstellationTransition(current, next, progress, transition);
  else drawConstellationFrame(progress <= 0 ? current : next);
}

function drawConstellationBase(lineCount, textCount, contourPath = state.constellationContourPath) {
  ensureConstellationElements(state.constellationPoints.length, lineCount, textCount);
  motionPath.setAttribute("d", contourPath || state.constellationContourPath || constellationContourBasePath());
  const dotRadius = Math.max(0.34, config.lineCharSize * 0.105);
  state.constellationPoints.forEach((point, index) => {
    const dot = state.constellationDots[index];
    dot.setAttribute("cx", point.x.toFixed(2));
    dot.setAttribute("cy", point.y.toFixed(2));
    dot.setAttribute("r", dotRadius.toFixed(2));
    dot.setAttribute("fill", config.lineCharColor);
    dot.setAttribute("opacity", String(Math.min(0.42, config.lineCharOpacity * 0.24)));
    dot.style.filter = "";
  });
}

function drawConstellationFrame(frame) {
  drawConstellationBase(frame.connections.length, frame.points.length, frame.contourPath);
  frame.connections.forEach((connection, index) => {
    drawConstellationConnection(state.linePaths[index], frame.points, connection, 1, index, 1);
  });
  highlightConstellationDots(frame.points, 1);
  drawConstellationTexts(frame.points, 0, 1, 1);
}

function drawConstellationTransition(current, next, progress, transitionMs) {
  const currentLines = current.connections.length;
  const nextLines = next.connections.length;
  drawConstellationBase(currentLines + nextLines, current.points.length + next.points.length, progress < 0.5 ? current.contourPath : next.contourPath);
  current.connections.forEach((connection, index) => {
    const local = constellationItemLocalProgress(progress, index, currentLines, transitionMs);
    const flicker = constellationFlicker(local, index, false, transitionMs);
    drawConstellationConnection(state.linePaths[index], current.points, connection, (1 - local) * constellationFlickerDrawFraction(flicker), index, (1 - local) * flicker, constellationBlackout(local, index, false, transitionMs));
  });
  next.connections.forEach((connection, index) => {
    const local = constellationItemLocalProgress(progress, index, nextLines, transitionMs);
    const flicker = constellationFlicker(local, index + currentLines, true, transitionMs);
    drawConstellationConnection(state.linePaths[currentLines + index], next.points, connection, local * constellationFlickerDrawFraction(flicker), index, local * flicker, constellationBlackout(local, index + currentLines, true, transitionMs));
  });
  highlightConstellationDots(current.points, (point, index) => 1 - constellationItemLocalProgress(progress, index, current.points.length, transitionMs));
  highlightConstellationDots(next.points, (point, index) => constellationItemLocalProgress(progress, index, next.points.length, transitionMs));
  drawConstellationTexts(current.points, 0, (point, index) => 1 - constellationItemLocalProgress(progress, index, current.points.length, transitionMs));
  drawConstellationTexts(next.points, current.points.length, (point, index) => constellationItemLocalProgress(progress, index, next.points.length, transitionMs));
}

function highlightConstellationDots(points, amount) {
  const radius = Math.max(0.34, config.lineCharSize * 0.105);
  points.forEach((point, index) => {
    const value = typeof amount === "function" ? amount(point, index) : amount;
    const dot = state.constellationDots[point.baseIndex];
    if (!dot) return;
    dot.setAttribute("r", radius.toFixed(2));
    dot.setAttribute("opacity", String(Math.max(0, Math.min(0.42, config.lineCharOpacity * 0.24) * (1 - value))));
    dot.style.filter = "";
  });
}

function drawConstellationTexts(points, offset, opacity) {
  points.forEach((point, index) => {
    const value = typeof opacity === "function" ? opacity(point, index) : opacity;
    const text = state.lineTexts[index + offset];
    if (!text) return;
    text.style.display = "";
    text.textContent = point.char;
    text.setAttribute("x", point.point.x.toFixed(2));
    text.setAttribute("y", point.point.y.toFixed(2));
    text.setAttribute("fill", config.lineCharColor);
    text.setAttribute("font-size", String(config.lineCharSize));
    text.setAttribute("opacity", (config.lineCharOpacity * value).toFixed(3));
    text.style.filter = "";
  });
}

function drawConstellationConnection(path, points, connection, fraction, index, opacityScale, blackout = false) {
  const a = points[connection.a];
  const b = points[connection.b];
  if (!path || !a || !b) {
    if (path) path.style.display = "none";
    return;
  }
  const d = connection.d || constellationConnectionPath(a, b, connection, points);
  if (!d) {
    path.style.display = "none";
    return;
  }
  path.style.display = "";
  path.style.visibility = blackout ? "hidden" : "visible";
  path.dataset.connectionIndex = String(index);
  path.classList.toggle("is-selected", false);
  path.setAttribute("d", d);
  path.setAttribute("stroke", config.lineColor);
  path.setAttribute("stroke-width", String(Math.max(0.45, config.lineStrokeWidth)));
  path.setAttribute("opacity", String(Math.min(1, config.lineOpacity * opacityScale)));
  path.style.filter = "";
  setPathDrawFraction(path, fraction);
}

function constellationItemLocalProgress(progress, index, total, transitionMs = config.lineTransitionMs) {
  const count = Math.max(1, total);
  const staggerRatio = clamp((Number(config.constellationStaggerMs) || 0) / Math.max(1, transitionMs), 0, 0.62);
  const delay = count <= 1 ? 0 : (index / (count - 1)) * staggerRatio;
  return standardBezierEase(clamp((progress - delay) / Math.max(0.001, 1 - staggerRatio), 0, 1));
}

function constellationFlashSpec(index = 0, transitionMs = config.lineTransitionMs) {
  const rng = seededRandom(`constellation-flicker|${index}|${Math.round(Number(config.lineCurveSeed) || 0)}`);
  const count = Math.floor(rng() * 3);
  const durationRatio = clamp((Number(config.constellationFlickerMs) || 150) / Math.max(1, transitionMs), 0.04, 0.45);
  if (count <= 0) return { centers: [], durationRatio };
  if (count === 1) return { centers: [0.24 + rng() * 0.46], durationRatio };
  const first = 0.18 + rng() * 0.22;
  const second = Math.max(first + durationRatio * 1.35, 0.54 + rng() * 0.24);
  return { centers: [first, Math.min(0.82, second)], durationRatio };
}

function constellationFlicker(progress, index = 0, appearing = true, transitionMs = config.lineTransitionMs) {
  const t = clamp(progress, 0, 1);
  if (t <= 0 || t >= 1) return 1;
  const spec = constellationFlashSpec(index, transitionMs);
  let value = 1;
  const softWidth = spec.durationRatio * (appearing ? 0.72 : 0.64);
  spec.centers.forEach((center) => {
    const distance = Math.abs(t - center);
    if (distance >= softWidth) return;
    const pulse = 1 - standardBezierEase(distance / Math.max(0.001, softWidth));
    value *= 1 - pulse * (appearing ? 0.94 : 0.84);
  });
  return clamp(value, appearing ? 0.015 : 0.05, 1);
}

function constellationFlickerDrawFraction(flicker) {
  return clamp(0.82 + flicker * 0.18, 0.82, 1);
}

function constellationBlackout(progress, index = 0, appearing = true, transitionMs = config.lineTransitionMs) {
  const t = clamp(progress, 0, 1);
  if (t <= 0.04 || t >= 0.96) return false;
  const spec = constellationFlashSpec(index, transitionMs);
  const halfWidth = spec.durationRatio * (appearing ? 0.22 : 0.18);
  return spec.centers.some((center) => Math.abs(t - center) < halfWidth);
}

function interpolateLineFrame(current, next, progress) {
  if (!current?.points?.length && !next?.points?.length) return [];
  current = current?.points?.length ? current : next;
  next = next?.points?.length ? next : current;
  if (progress <= 0) return current.points;
  if (progress >= 1) return next.points;
  const count = next.points.length;
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const from = sampleLineFramePoint(current, index, count);
    const to = next.points[index];
    points.push({
      char: to.char,
      point: {
        x: from.point.x + (to.point.x - from.point.x) * progress,
        y: from.point.y + (to.point.y - from.point.y) * progress,
      },
      opacity: 1,
    });
  }
  return points;
}

function sampleLineFramePoint(frame, index, count) {
  const points = frame.points;
  if (points.length === 1) return points[0];
  const position = (index / count) * points.length;
  const leftIndex = Math.floor(position) % points.length;
  const rightIndex = (leftIndex + 1) % points.length;
  const local = position - Math.floor(position);
  const left = points[leftIndex];
  const right = points[rightIndex];
  return {
    char: left.char,
    point: {
      x: left.point.x + (right.point.x - left.point.x) * local,
      y: left.point.y + (right.point.y - left.point.y) * local,
    },
  };
}

function drawLineFrame(points, connections = buildLineConnections(points)) {
  const maxConnections = connections;
  ensureLineElements(maxConnections.length, points.length);
  maxConnections.forEach((connection, index) => {
    const a = points[connection.a];
    const b = points[connection.b];
    const path = state.linePaths[index];
    drawConnectionPath(path, a, b, connection, 1, index);
  });
  drawLineTexts(points, 0);
}

function drawLineTexts(points, offset) {
  points.forEach((point, index) => {
    const text = state.lineTexts[index];
    const target = state.lineTexts[index + offset];
    const node = target ?? text;
    node.textContent = point.char;
    node.setAttribute("x", point.point.x.toFixed(2));
    node.setAttribute("y", point.point.y.toFixed(2));
    node.setAttribute("fill", config.lineCharColor);
    node.setAttribute("font-size", String(config.lineCharSize));
    node.setAttribute("opacity", (config.lineCharOpacity * (point.opacity ?? 1)).toFixed(3));
  });
}

function drawTransitionLineFrame(current, next, progress) {
  const currentPoints = morphLineFramePoints(current, next, progress, current.points.length, "current", 1 - progress);
  const nextPoints = morphLineFramePoints(current, next, progress, next.points.length, "next", progress);
  const pairs = pairTransitionConnections(current, next);
  const currentLineCount = pairs.currentUnmatched.length;
  const nextLineCount = pairs.nextUnmatched.length;
  ensureLineElements(pairs.matched.length + currentLineCount + nextLineCount, currentPoints.length + nextPoints.length);
  let pathIndex = 0;
  pairs.matched.forEach((pair) => {
    const path = state.linePaths[pathIndex];
    drawMatchedTransitionConnection(path, current, next, pair, progress, pathIndex);
    pathIndex += 1;
  });
  pairs.currentUnmatched.forEach(({ connection, index }) => {
    const path = state.linePaths[pathIndex];
    drawConnectionPath(path, currentPoints[connection.a], currentPoints[connection.b], connection, 1 - progress, index, 1 - progress);
    pathIndex += 1;
  });
  pairs.nextUnmatched.forEach(({ connection, index }) => {
    const path = state.linePaths[pathIndex];
    drawConnectionPath(path, nextPoints[connection.a], nextPoints[connection.b], connection, progress, index, progress);
    pathIndex += 1;
  });
  drawLineTexts(currentPoints, 0);
  drawLineTexts(nextPoints, currentPoints.length);
}

function pairTransitionConnections(current, next) {
  const nextBuckets = new Map();
  next.connections.forEach((connection, index) => {
    const key = lineConnectionCharKey(next.points, connection);
    if (!key) return;
    if (!nextBuckets.has(key)) nextBuckets.set(key, []);
    nextBuckets.get(key).push({ connection, index });
  });
  const matched = [];
  const currentUnmatched = [];
  const usedNext = new Set();
  current.connections.forEach((connection, index) => {
    const key = lineConnectionCharKey(current.points, connection);
    const bucket = key ? nextBuckets.get(key) : null;
    const candidate = bucket?.find((item) => !usedNext.has(item.index));
    if (candidate) {
      usedNext.add(candidate.index);
      matched.push({ currentConnection: connection, currentIndex: index, nextConnection: candidate.connection, nextIndex: candidate.index });
    } else {
      currentUnmatched.push({ connection, index });
    }
  });
  const nextUnmatched = next.connections
    .map((connection, index) => ({ connection, index }))
    .filter((item) => !usedNext.has(item.index));
  return { matched, currentUnmatched, nextUnmatched };
}

function lineConnectionCharKey(points, connection) {
  const a = points[connection.a]?.char;
  const b = points[connection.b]?.char;
  if (a == null || b == null) return "";
  return a <= b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function drawMatchedTransitionConnection(path, current, next, pair, progress, index) {
  const currentConnection = pair.currentConnection;
  const nextConnection = pair.nextConnection;
  const currentA = current.points[currentConnection.a];
  const currentB = current.points[currentConnection.b];
  const nextA = next.points[nextConnection.a];
  const nextB = next.points[nextConnection.b];
  if (!currentA || !currentB || !nextA || !nextB) {
    path.style.display = "none";
    return;
  }
  const reversed = currentA.char !== nextA.char || currentB.char !== nextB.char;
  const currentControls = transitionConnectionControls(currentA.point, currentB.point, currentConnection);
  const nextControls = transitionConnectionControlsForDirection(nextA.point, nextB.point, nextConnection, reversed);
  if (!currentControls || !nextControls) {
    path.style.display = "none";
    return;
  }
  const controls = {
    start: lerpPoint(currentControls.start, nextControls.start, progress),
    c1: lerpPoint(currentControls.c1, nextControls.c1, progress),
    c2: lerpPoint(currentControls.c2, nextControls.c2, progress),
    end: lerpPoint(currentControls.end, nextControls.end, progress),
  };
  const curved = currentConnection.curved || nextConnection.curved;
  path.style.display = "";
  path.style.visibility = "visible";
  path.dataset.connectionIndex = String(index);
  path.classList.toggle("is-selected", false);
  path.setAttribute("d", curved
    ? `M ${controls.start.x.toFixed(2)} ${controls.start.y.toFixed(2)} C ${controls.c1.x.toFixed(2)} ${controls.c1.y.toFixed(2)} ${controls.c2.x.toFixed(2)} ${controls.c2.y.toFixed(2)} ${controls.end.x.toFixed(2)} ${controls.end.y.toFixed(2)}`
    : `M ${controls.start.x.toFixed(2)} ${controls.start.y.toFixed(2)} L ${controls.end.x.toFixed(2)} ${controls.end.y.toFixed(2)}`);
  path.setAttribute("stroke", config.lineColor);
  path.setAttribute("stroke-width", String(config.lineStrokeWidth));
  path.setAttribute("opacity", String(config.lineOpacity));
  setPathDrawFraction(path, 1);
}

function transitionConnectionControls(a, b, connection) {
  const controls = visibleConnectionControlPoints(a, b, connection);
  if (!controls) return null;
  if (connection.curved) return controls;
  return {
    start: controls.start,
    c1: lerpPoint(controls.start, controls.end, 1 / 3),
    c2: lerpPoint(controls.start, controls.end, 2 / 3),
    end: controls.end,
  };
}

function transitionConnectionControlsForDirection(a, b, connection, reversed) {
  const controls = transitionConnectionControls(a, b, connection);
  if (!controls || !reversed) return controls;
  return {
    start: controls.end,
    c1: controls.c2,
    c2: controls.c1,
    end: controls.start,
  };
}

function morphLineFramePoints(current, next, progress, count, charSource, opacity) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const from = charSource === "current" ? current.points[index] : sampleLineFramePoint(current, index, count);
    const to = charSource === "current" ? sampleLineFramePoint(next, index, count) : next.points[index];
    if (!from || !to) continue;
    points.push({
      char: charSource === "current" ? from.char : to.char,
      point: {
        x: from.point.x + (to.point.x - from.point.x) * progress,
        y: from.point.y + (to.point.y - from.point.y) * progress,
      },
      opacity,
    });
  }
  return points;
}

function drawConnectionPath(path, a, b, connection, fraction = 1, index = 0, opacityScale = 1) {
  if (!a || !b || !connection) {
    path.style.display = "none";
    return;
  }
  const pointA = a.point ?? a;
  const pointB = b.point ?? b;
  const d = lineConnectionPath(pointA, pointB, connection);
  if (!d) {
    path.style.display = "none";
    return;
  }
  path.style.display = "";
  path.style.visibility = "visible";
  path.dataset.connectionIndex = String(index);
  const selected = Boolean(state.lineEdit && state.lineEdit.selectedConnection === index);
  path.classList.toggle("is-selected", selected);
  path.setAttribute("d", d);
  path.setAttribute("stroke", selected ? "#7ee1cf" : config.lineColor);
  path.setAttribute("stroke-width", String(config.lineStrokeWidth));
  path.setAttribute("opacity", String(config.lineOpacity * opacityScale));
  setPathDrawFraction(path, fraction);
}

function setPathDrawFraction(path, fraction) {
  const value = clamp(fraction, 0, 1);
  if (value >= 0.999) {
    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "";
    return;
  }
  let length = 1;
  try {
    length = Math.max(1, path.getTotalLength());
  } catch {
    length = 1;
  }
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length * (1 - value)}`;
}

function lineConnectionPath(a, b, connection) {
  const controls = visibleConnectionControlPoints(a, b, connection);
  if (!controls) return "";
  const { start, end, c1, c2 } = controls;
  if (!connection.curved) return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function connectionControlPoints(a, b, connection) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const c1 = {
    x: a.x + dx * connection.tensionA + normalX * length * connection.bendA,
    y: a.y + dy * connection.tensionA + normalY * length * connection.bendA,
  };
  const c2 = {
    x: a.x + dx * connection.tensionB + normalX * length * connection.bendB,
    y: a.y + dy * connection.tensionB + normalY * length * connection.bendB,
  };
  return { start: a, end: b, c1, c2 };
}

function visibleConnectionControlPoints(a, b, connection) {
  const center = connectionControlPoints(a, b, connection);
  if (!center) return null;
  if (!connection.curved) {
    const endpoints = trimmedConnectionEndpoints(a, b);
    if (!endpoints) return null;
    return { ...center, start: endpoints.start, end: endpoints.end };
  }
  const gap = connectionEndpointGap(a, b);
  const startT = approximateCubicTAtDistance(center.start, center.c1, center.c2, center.end, gap, false);
  const endT = approximateCubicTAtDistance(center.start, center.c1, center.c2, center.end, gap, true);
  return trimCubicSegment(center.start, center.c1, center.c2, center.end, startT, endT);
}

function trimmedConnectionEndpoints(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { start: a, end: b };
  const gap = connectionEndpointGap(a, b);
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: a.x + ux * gap, y: a.y + uy * gap },
    end: { x: b.x - ux * gap, y: b.y - uy * gap },
  };
}

function connectionEndpointGap(a, b) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.min(Math.max(0, Number(config.lineCharSize) || 0), length * 0.45);
}

function approximateCubicTAtDistance(p0, c1, c2, p1, distance, fromEnd) {
  const samples = [];
  let length = 0;
  let previous = p0;
  samples.push({ t: 0, length: 0 });
  for (let step = 1; step <= 36; step += 1) {
    const t = step / 36;
    const point = cubicAt(p0, c1, c2, p1, t);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    samples.push({ t, length });
    previous = point;
  }
  const target = fromEnd ? Math.max(0, length - distance) : Math.min(length, distance);
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].length >= target) {
      const before = samples[index - 1];
      const after = samples[index];
      const span = Math.max(0.0001, after.length - before.length);
      return before.t + (after.t - before.t) * ((target - before.length) / span);
    }
  }
  return fromEnd ? 1 : 0;
}

function trimCubicSegment(p0, c1, c2, p1, startT, endT) {
  if (endT <= startT) {
    const point = cubicAt(p0, c1, c2, p1, 0.5);
    return { start: point, c1: point, c2: point, end: point };
  }
  const left = splitCubic(p0, c1, c2, p1, startT).right;
  const localEnd = (endT - startT) / Math.max(0.0001, 1 - startT);
  return splitCubic(left[0], left[1], left[2], left[3], localEnd).leftObject;
}

function splitCubic(p0, c1, c2, p1, t) {
  const p01 = lerpPoint(p0, c1, t);
  const p12 = lerpPoint(c1, c2, t);
  const p23 = lerpPoint(c2, p1, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const p0123 = lerpPoint(p012, p123, t);
  return {
    left: [p0, p01, p012, p0123],
    right: [p0123, p123, p23, p1],
    leftObject: { start: p0, c1: p01, c2: p012, end: p0123 },
  };
}

function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function startLineCurveEdit(frameId) {
  if (config.effectType !== "line") return;
  activeEffect().prepare();
  const frame = state.lineFrames.find((item) => item.id === frameId);
  if (!frame?.points?.length) return;
  state.lineEdit = { frameId, selectedPoint: null, selectedConnection: null };
  state.lineEditDrag = null;
  lineEditBar.hidden = false;
  updateLineEditToolbar();
  renderMotionControls();
  state.startedAt = performance.now();
  updateFormulaAndCode();
}

function finishLineCurveEdit() {
  state.lineEdit = null;
  state.lineEditDrag = null;
  lineEditBar.hidden = true;
  lineEditPopover.hidden = true;
  updateLineEditToolbar();
  hideLineEditHandles();
  renderMotionControls();
  state.startedAt = performance.now();
}

function renderLineEditFrame() {
  if (config.lineStyle === "constellation") {
    const frame = currentLineEditFrame();
    if (!frame) {
      finishLineCurveEdit();
      return;
    }
    motionPath.setAttribute("stroke-width", String(config.constellationContourWidth));
    motionPath.setAttribute("stroke", config.constellationContourColor);
    motionPath.setAttribute("opacity", String(config.constellationContourOpacity));
    motionPath.style.filter = "";
    drawConstellationFrame(frame);
    renderLineEditHandles(frame);
    updateLineEditToolbar();
    return;
  }
  motionPath.setAttribute("stroke-width", String(config.lineStrokeWidth));
  motionPath.setAttribute("stroke", config.lineColor);
  motionPath.setAttribute("d", state.normalizedContours.length ? buildSmoothSvgMultiPath(state.normalizedContours, state.normalizedContourClosed) : buildPath(1));
  motionPath.setAttribute("opacity", "0");
  const frame = currentLineEditFrame();
  if (!frame) {
    finishLineCurveEdit();
    return;
  }
  drawLineFrame(frame.points, frame.connections);
  renderLineEditHandles(frame);
  updateLineEditToolbar();
}

function currentLineEditFrame() {
  if (!state.lineEdit) return null;
  return state.lineFrames.find((frame) => frame.id === state.lineEdit.frameId) ?? null;
}

function currentConfigLineFrame() {
  if (!state.lineEdit) return null;
  return config.lineKeyframes.find((frame) => frame.id === state.lineEdit.frameId) ?? null;
}

function saveLineEditFrame() {
  const frame = currentLineEditFrame();
  const configFrame = currentConfigLineFrame();
  if (!frame || !configFrame) return false;
  if (config.lineStyle === "constellation") {
    configFrame.constellationConnections = frame.connections.map((connection) => ({ a: connection.a, b: connection.b }));
    configFrame.constellationConnectionsEdited = true;
    updateFormulaAndCode();
    return true;
  }
  configFrame.points = serializeLineFramePoints(frame.points);
  configFrame.connections = cloneLineConnections(frame.connections);
  configFrame.connectionsEdited = true;
  updateFormulaAndCode();
  return true;
}

function randomizeCurrentLineFrame() {
  const frame = currentLineEditFrame();
  const configFrame = currentConfigLineFrame();
  if (!frame || !configFrame) return;
  const previousFrames = state.lineFrames.filter((item) => item.id !== frame.id);
  const points = chooseLineFramePoints(frame.chars, `${frame.id}|random|${Date.now()}`, 0, previousFrames);
  frame.points = points;
  configFrame.points = serializeLineFramePoints(points);
  config.lineCurveSeed += 1;
  frame.connections = buildLineConnections(points, `${frame.id}|manual|${Date.now()}`);
  configFrame.connections = cloneLineConnections(frame.connections);
  configFrame.connectionsEdited = true;
  state.lineEdit.selectedPoint = null;
  state.lineEdit.selectedConnection = null;
  drawLineFrame(frame.points, frame.connections);
  renderLineEditHandles(frame);
  updateLineEditToolbar();
  updateFormulaAndCode();
}

function updateLineEditToolbar() {
  if (!state.lineEdit) {
    lineEditHint.textContent = "选择两个字符点添加连线";
    lineEditPopover.hidden = true;
    lineEditTabs.hidden = false;
    lineEditStraight.hidden = false;
    lineEditCurve.hidden = false;
    lineEditStraight.disabled = true;
    lineEditCurve.disabled = true;
    lineEditDelete.disabled = true;
    lineEditStraight.classList.remove("is-active");
    lineEditCurve.classList.remove("is-active");
    return;
  }
  const frame = currentLineEditFrame();
  const selectedConnection = Number.isInteger(state.lineEdit.selectedConnection) ? frame?.connections[state.lineEdit.selectedConnection] : null;
  if (selectedConnection) {
    lineEditHint.textContent = config.lineStyle === "constellation" ? "可删除连线" : "可切换线型或删除";
    lineEditPopover.hidden = false;
    positionLineEditPopover(frame, selectedConnection, state.lineEdit.selectedConnection);
    lineEditTabs.hidden = config.lineStyle === "constellation";
    lineEditStraight.hidden = config.lineStyle === "constellation";
    lineEditCurve.hidden = config.lineStyle === "constellation";
    lineEditStraight.disabled = config.lineStyle === "constellation";
    lineEditCurve.disabled = config.lineStyle === "constellation";
    lineEditDelete.disabled = false;
    lineEditStraight.classList.toggle("is-active", !selectedConnection.curved);
    lineEditCurve.classList.toggle("is-active", selectedConnection.curved);
  } else if (Number.isInteger(state.lineEdit.selectedPoint)) {
    lineEditHint.textContent = "再选择一个字符点完成连线";
    lineEditPopover.hidden = true;
    lineEditTabs.hidden = config.lineStyle === "constellation";
    lineEditStraight.hidden = config.lineStyle === "constellation";
    lineEditCurve.hidden = config.lineStyle === "constellation";
    lineEditStraight.disabled = true;
    lineEditCurve.disabled = true;
    lineEditDelete.disabled = true;
    lineEditStraight.classList.remove("is-active");
    lineEditCurve.classList.remove("is-active");
  } else {
    lineEditHint.textContent = "选择两个字符点添加连线";
    lineEditPopover.hidden = true;
    lineEditTabs.hidden = config.lineStyle === "constellation";
    lineEditStraight.hidden = config.lineStyle === "constellation";
    lineEditCurve.hidden = config.lineStyle === "constellation";
    lineEditStraight.disabled = true;
    lineEditCurve.disabled = true;
    lineEditDelete.disabled = true;
    lineEditStraight.classList.remove("is-active");
    lineEditCurve.classList.remove("is-active");
  }
}

function positionLineEditPopover(frame, connection, connectionIndex) {
  const a = frame.points[connection.a]?.point;
  const b = frame.points[connection.b]?.point;
  if (!a || !b) return;
  const placement = lineConnectionToolbarPlacement(a, b, connection);
  const svgRect = motionSvg.getBoundingClientRect();
  const wrapRect = canvasWrap.getBoundingClientRect();
  const popoverRect = lineEditPopover.getBoundingClientRect();
  const width = Math.max(88, popoverRect.width || 120);
  const height = Math.max(36, popoverRect.height || 38);
  const baseX = svgRect.left - wrapRect.left + (placement.point.x / 100) * svgRect.width;
  const pathBox = selectedLineScreenBox(connectionIndex, wrapRect);
  const gap = 12;
  const lineCenterY = pathBox ? pathBox.top + pathBox.height / 2 : svgRect.top - wrapRect.top + (placement.point.y / 100) * svgRect.height;
  const lineCenterX = pathBox ? pathBox.left + pathBox.width / 2 : baseX;
  const candidates = pathBox ? [
    { x: baseX - width / 2, y: pathBox.top - height - gap },
    { x: baseX - width / 2, y: pathBox.bottom + gap },
    { x: pathBox.left - width - gap, y: lineCenterY - height / 2 },
    { x: pathBox.right + gap, y: lineCenterY - height / 2 },
    { x: lineCenterX - width / 2, y: pathBox.top - height - gap * 2.4 },
    { x: lineCenterX - width / 2, y: pathBox.bottom + gap * 2.4 },
    { x: pathBox.left - width - gap, y: pathBox.top - height - gap },
    { x: pathBox.right + gap, y: pathBox.top - height - gap },
    { x: pathBox.left - width - gap, y: pathBox.bottom + gap },
    { x: pathBox.right + gap, y: pathBox.bottom + gap },
  ] : [
    { x: baseX - width / 2, y: svgRect.top - wrapRect.top + (placement.point.y / 100) * svgRect.height - height - gap },
  ];
  const avoidBoxes = lineEditAvoidBoxes(frame, connection, connectionIndex, wrapRect);
  let chosen = null;
  let best = null;
  for (const candidate of candidates) {
    const rect = clampPopoverRect(candidate, width, height, wrapRect);
    const overlap = avoidBoxes.reduce((total, box) => total + rectOverlapArea(rect, box), 0);
    const distancePenalty = Math.hypot(rect.left + width / 2 - lineCenterX, rect.top + height / 2 - lineCenterY) * 0.001;
    const score = overlap + distancePenalty;
    if (!best || score < best.score) best = { rect, score };
    if (overlap === 0) {
      chosen = rect;
      break;
    }
  }
  if (!chosen) chosen = best?.rect ?? clampPopoverRect(candidates[0], width, height, wrapRect);
  const x = chosen.left;
  const y = chosen.top;
  lineEditPopover.style.left = `${x}px`;
  lineEditPopover.style.top = `${y}px`;
}

function clampPopoverRect(candidate, width, height, wrapRect) {
  const left = clamp(candidate.x, 8, Math.max(8, wrapRect.width - width - 8));
  const top = clamp(candidate.y, 8, Math.max(8, wrapRect.height - height - 8));
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function lineEditAvoidBoxes(frame, connection, connectionIndex, wrapRect) {
  const boxes = [];
  const pathBox = selectedLineScreenBox(connectionIndex, wrapRect);
  if (pathBox) boxes.push(expandBox(pathBox, 8));
  [connection.a, connection.b].forEach((pointIndex) => {
    const point = frame.points[pointIndex]?.point;
    if (!point) return;
    boxes.push(pointScreenBox(point, wrapRect, Math.max(12, config.lineCharSize * 4.2)));
  });
  state.lineEditHandles.forEach((handle) => {
    if (handle.style.display === "none") return;
    const rect = handle.getBoundingClientRect();
    boxes.push(expandBox({
      left: rect.left - wrapRect.left,
      top: rect.top - wrapRect.top,
      right: rect.right - wrapRect.left,
      bottom: rect.bottom - wrapRect.top,
      width: rect.width,
      height: rect.height,
    }, 10));
  });
  return boxes;
}

function pointScreenBox(point, wrapRect, size) {
  const svgRect = motionSvg.getBoundingClientRect();
  const x = svgRect.left - wrapRect.left + (point.x / 100) * svgRect.width;
  const y = svgRect.top - wrapRect.top + (point.y / 100) * svgRect.height;
  const half = size / 2;
  return { left: x - half, top: y - half, right: x + half, bottom: y + half, width: size, height: size };
}

function expandBox(box, amount) {
  return {
    left: box.left - amount,
    top: box.top - amount,
    right: box.right + amount,
    bottom: box.bottom + amount,
    width: box.width + amount * 2,
    height: box.height + amount * 2,
  };
}

function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function rectOverlapArea(a, b) {
  if (!rectsOverlap(a, b)) return 0;
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function selectedLineScreenBox(connectionIndex, wrapRect) {
  const path = state.linePaths[connectionIndex];
  if (!path || path.style.display === "none") return null;
  let box;
  try {
    box = path.getBBox();
  } catch {
    return null;
  }
  const svgRect = motionSvg.getBoundingClientRect();
  const scaleX = svgRect.width / 100;
  const scaleY = svgRect.height / 100;
  return {
    left: svgRect.left - wrapRect.left + box.x * scaleX,
    top: svgRect.top - wrapRect.top + box.y * scaleY,
    right: svgRect.left - wrapRect.left + (box.x + box.width) * scaleX,
    bottom: svgRect.top - wrapRect.top + (box.y + box.height) * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY,
  };
}

function lineConnectionToolbarPlacement(a, b, connection) {
  const controls = connectionControlPoints(a, b, connection);
  if (!controls) return { point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, normal: { x: 0, y: -1 } };
  const point = connection.curved ? cubicAt(controls.start, controls.c1, controls.c2, controls.end, 0.5) : { x: (controls.start.x + controls.end.x) / 2, y: (controls.start.y + controls.end.y) / 2 };
  const tangent = connection.curved
    ? cubicDerivativeAt(controls.start, controls.c1, controls.c2, controls.end, 0.5)
    : { x: controls.end.x - controls.start.x, y: controls.end.y - controls.start.y };
  const length = Math.max(0.0001, Math.hypot(tangent.x, tangent.y));
  let normal = { x: -tangent.y / length, y: tangent.x / length };
  if (normal.y > 0.35) normal = { x: -normal.x, y: -normal.y };
  return { point, normal };
}

function cubicAt(a, c1, c2, b, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * inv * a.x + 3 * inv * inv * t * c1.x + 3 * inv * t * t * c2.x + t * t * t * b.x,
    y: inv * inv * inv * a.y + 3 * inv * inv * t * c1.y + 3 * inv * t * t * c2.y + t * t * t * b.y,
  };
}

function cubicDerivativeAt(a, c1, c2, b, t) {
  const inv = 1 - t;
  return {
    x: 3 * inv * inv * (c1.x - a.x) + 6 * inv * t * (c2.x - c1.x) + 3 * t * t * (b.x - c2.x),
    y: 3 * inv * inv * (c1.y - a.y) + 6 * inv * t * (c2.y - c1.y) + 3 * t * t * (b.y - c2.y),
  };
}

function ensureLineEditGroup() {
  if (!state.lineEditGroup) {
    state.lineEditGroup = document.createElementNS(SVG_NS, "g");
    state.lineEditGroup.setAttribute("id", "line-edit-controls");
    motionGroup.appendChild(state.lineEditGroup);
  }
  state.lineEditGroup.style.display = "";
  return state.lineEditGroup;
}

function renderLineEditHandles(frame) {
  const group = ensureLineEditGroup();
  while (state.lineEditPointHandles.length < frame.points.length) {
    const point = document.createElementNS(SVG_NS, "circle");
    point.setAttribute("class", "line-edit-point");
    point.setAttribute("r", "1.25");
    group.appendChild(point);
    state.lineEditPointHandles.push(point);
  }
  state.lineEditPointHandles.forEach((pointHandle, index) => {
    const point = frame.points[index]?.point;
    if (!point) {
      pointHandle.style.display = "none";
      return;
    }
    pointHandle.style.display = "";
    pointHandle.dataset.pointIndex = String(index);
    pointHandle.classList.toggle("is-selected", state.lineEdit?.selectedPoint === index);
    pointHandle.setAttribute("cx", point.x.toFixed(2));
    pointHandle.setAttribute("cy", point.y.toFixed(2));
  });
  for (let index = frame.points.length; index < state.lineEditPointHandles.length; index += 1) {
    state.lineEditPointHandles[index].style.display = "none";
  }
  const curvedConnections = frame.connections
    .map((connection, index) => ({ connection, index }))
    .filter(({ connection, index }) => connection.curved && state.lineEdit?.selectedConnection === index);
  const handleCount = curvedConnections.length * 2;
  while (state.lineEditHandleLines.length < handleCount) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", "line-edit-handle-line");
    group.appendChild(line);
    state.lineEditHandleLines.push(line);
  }
  while (state.lineEditHandles.length < handleCount) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", "line-edit-handle");
    circle.setAttribute("r", "1.35");
    group.appendChild(circle);
    state.lineEditHandles.push(circle);
  }
  let handleIndex = 0;
  curvedConnections.forEach(({ connection, index }) => {
    const a = frame.points[connection.a]?.point;
    const b = frame.points[connection.b]?.point;
    if (!a || !b) return;
    const controls = connectionControlPoints(a, b, connection);
    if (!controls) return;
    setLineEditHandle(handleIndex, index, "a", controls.start, controls.c1);
    handleIndex += 1;
    setLineEditHandle(handleIndex, index, "b", controls.end, controls.c2);
    handleIndex += 1;
  });
  for (let index = handleIndex; index < state.lineEditHandleLines.length; index += 1) {
    state.lineEditHandleLines[index].style.display = "none";
  }
  for (let index = handleIndex; index < state.lineEditHandles.length; index += 1) {
    state.lineEditHandles[index].style.display = "none";
  }
}

function setLineEditHandle(handleIndex, connectionIndex, handleName, anchor, control) {
  const line = state.lineEditHandleLines[handleIndex];
  const circle = state.lineEditHandles[handleIndex];
  line.style.display = "";
  line.setAttribute("x1", anchor.x.toFixed(2));
  line.setAttribute("y1", anchor.y.toFixed(2));
  line.setAttribute("x2", control.x.toFixed(2));
  line.setAttribute("y2", control.y.toFixed(2));
  circle.style.display = "";
  circle.dataset.connectionIndex = String(connectionIndex);
  circle.dataset.handle = handleName;
  circle.setAttribute("cx", control.x.toFixed(2));
  circle.setAttribute("cy", control.y.toFixed(2));
}

function hideLineEditHandles() {
  if (state.lineEditGroup) state.lineEditGroup.style.display = "none";
  lineEditPopover.hidden = true;
  state.lineEditHandleLines.forEach((line) => { line.style.display = "none"; });
  state.lineEditHandles.forEach((handle) => { handle.style.display = "none"; });
  state.lineEditPointHandles.forEach((handle) => { handle.style.display = "none"; });
  state.lineEditDrag = null;
}

function svgPointFromEvent(event) {
  const rect = motionSvg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100,
  };
}

function updateLineEditHandle(connectionIndex, handleName, point) {
  const frame = currentLineEditFrame();
  if (!frame) return;
  const connection = frame.connections[connectionIndex];
  const a = frame.points[connection?.a]?.point;
  const b = frame.points[connection?.b]?.point;
  if (!connection || !a || !b) return;
  const endpoints = trimmedConnectionEndpoints(a, b);
  if (!endpoints) return;
  const start = endpoints.start;
  const end = endpoints.end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const dirX = dx / length;
  const dirY = dy / length;
  const normalX = -dirY;
  const normalY = dirX;
  const relX = point.x - start.x;
  const relY = point.y - start.y;
  const tension = (relX * dirX + relY * dirY) / length;
  const bend = (relX * normalX + relY * normalY) / length;
  if (handleName === "a") {
    connection.tensionA = tension;
    connection.bendA = bend;
  } else {
    connection.tensionB = tension;
    connection.bendB = bend;
  }
  saveLineEditFrame();
  redrawCurrentLineEditFrame(frame);
  renderLineEditHandles(frame);
}

function selectLineEditPoint(pointIndex) {
  if (!state.lineEdit) return;
  const frame = currentLineEditFrame();
  if (!frame || !frame.points[pointIndex]) return;
  state.lineEdit.selectedConnection = null;
  if (!Number.isInteger(state.lineEdit.selectedPoint)) {
    state.lineEdit.selectedPoint = pointIndex;
  } else if (state.lineEdit.selectedPoint === pointIndex) {
    state.lineEdit.selectedPoint = null;
  } else {
    const a = state.lineEdit.selectedPoint;
    const b = pointIndex;
    let existingIndex = frame.connections.findIndex((connection) => (connection.a === a && connection.b === b) || (connection.a === b && connection.b === a));
    if (existingIndex < 0) {
      frame.connections.push(config.lineStyle === "constellation" ? makeConstellationConnection(a, b, frame.points) : makeManualConnection(a, b, false));
      existingIndex = frame.connections.length - 1;
    }
    state.lineEdit.selectedPoint = null;
    state.lineEdit.selectedConnection = existingIndex;
    saveLineEditFrame();
  }
  redrawCurrentLineEditFrame(frame);
  renderLineEditHandles(frame);
  updateLineEditToolbar();
}

function makeManualConnection(a, b, curved) {
  return {
    a,
    b,
    curved,
    bendA: 0.28,
    bendB: -0.28,
    tensionA: 0.28,
    tensionB: 0.72,
  };
}

function selectLineEditConnection(connectionIndex) {
  if (!state.lineEdit) return;
  const frame = currentLineEditFrame();
  if (!frame?.connections[connectionIndex]) return;
  state.lineEdit.selectedPoint = null;
  state.lineEdit.selectedConnection = connectionIndex;
  redrawCurrentLineEditFrame(frame);
  renderLineEditHandles(frame);
  updateLineEditToolbar();
}

function setSelectedLineCurved(curved) {
  const frame = currentLineEditFrame();
  const index = state.lineEdit?.selectedConnection;
  if (!frame || !Number.isInteger(index) || !frame.connections[index]) return;
  frame.connections[index].curved = curved;
  saveLineEditFrame();
  redrawCurrentLineEditFrame(frame);
  renderLineEditHandles(frame);
  updateLineEditToolbar();
}

function deleteSelectedLine() {
  const frame = currentLineEditFrame();
  const index = state.lineEdit?.selectedConnection;
  if (!frame || !Number.isInteger(index) || !frame.connections[index]) return;
  frame.connections.splice(index, 1);
  state.lineEdit.selectedConnection = null;
  saveLineEditFrame();
  redrawCurrentLineEditFrame(frame);
  renderLineEditHandles(frame);
  updateLineEditToolbar();
}

function clearLineEditSelection() {
  if (!state.lineEdit) return;
  state.lineEdit.selectedPoint = null;
  state.lineEdit.selectedConnection = null;
  const frame = currentLineEditFrame();
  if (frame) {
    redrawCurrentLineEditFrame(frame);
    renderLineEditHandles(frame);
  }
  updateLineEditToolbar();
}

function redrawCurrentLineEditFrame(frame) {
  if (config.lineStyle === "constellation") drawConstellationFrame(frame);
  else drawLineFrame(frame.points, frame.connections);
}


function generateConstellationLineStandaloneHTML() {
  const dots = state.constellationPoints.map((point) => ({ x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) }));
  const frames = state.lineFrames.map((frame) => ({
    contourPath: frame.contourPath || state.constellationContourPath,
    points: frame.points.map((item) => ({ char: item.char, x: Number(item.point.x.toFixed(3)), y: Number(item.point.y.toFixed(3)), baseIndex: item.baseIndex })),
    connections: frame.connections.map((connection) => ({ d: connection.d || "" })),
  }));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${state.fileName.replace(/[<>&"]/g, "")} Constellation Loader</title>
  <style>
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f7f4; font-family: Inter, system-ui, sans-serif; }
svg { width: min(72vmin, 560px); height: min(72vmin, 560px); overflow: visible; }
text { user-select: none; }
  </style>
</head>
<body>
  <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
<path id="contour" fill="none" stroke="${config.constellationContourColor}" stroke-width="${config.constellationContourWidth}" opacity="${config.constellationContourOpacity}"></path>
<g id="dots"></g>
<g id="lines"></g>
<g id="chars"></g>
  </svg>
  <script>
const SVG_NS = "http://www.w3.org/2000/svg";
const dots = ${JSON.stringify(dots)};
const frames = ${JSON.stringify(frames)};
const config = ${JSON.stringify({
  lineFrameIntervalMs: config.lineFrameIntervalMs,
  lineTransitionMs: config.lineTransitionMs,
  lineStrokeWidth: config.lineStrokeWidth,
  lineCharSize: config.lineCharSize,
  lineColor: config.lineColor,
  lineOpacity: config.lineOpacity,
  lineCharColor: config.lineCharColor,
  lineCharOpacity: config.lineCharOpacity,
  constellationStaggerMs: config.constellationStaggerMs,
  constellationFlickerMs: config.constellationFlickerMs,
})};
const contour = document.querySelector("#contour");
const dotGroup = document.querySelector("#dots");
const lineGroup = document.querySelector("#lines");
const charGroup = document.querySelector("#chars");
dots.forEach((dot) => {
  const node = document.createElementNS(SVG_NS, "circle");
  node.setAttribute("cx", dot.x);
  node.setAttribute("cy", dot.y);
  node.setAttribute("r", Math.max(0.34, config.lineCharSize * 0.105));
  node.setAttribute("fill", config.lineCharColor);
  node.setAttribute("opacity", Math.min(0.42, config.lineCharOpacity * 0.24));
  dotGroup.appendChild(node);
});
const paths = [];
const texts = [];
function ensure(frame) {
  while (paths.length < frame.connections.length) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    lineGroup.appendChild(path);
    paths.push(path);
  }
  while (texts.length < frame.points.length) {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("font-family", "Inter, system-ui, sans-serif");
    text.setAttribute("font-weight", "700");
    charGroup.appendChild(text);
    texts.push(text);
  }
}
function setPathDrawFraction(path, fraction) {
  const value = Math.max(0, Math.min(1, fraction));
  try {
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length * (1 - value));
  } catch (error) {
    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "";
  }
}
function cubicBezierAxis(t, p1, p2) {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}
function standardBezierEase(value) {
  const target = Math.max(0, Math.min(1, value));
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
function seededRandom(seed) {
  let hash = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return function () {
    hash += 0x6D2B79F5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function localProgress(progress, index, total, transitionMs) {
  const count = Math.max(1, total);
  const staggerRatio = Math.max(0, Math.min(0.62, (Number(config.constellationStaggerMs) || 0) / Math.max(1, transitionMs)));
  const delay = count <= 1 ? 0 : (index / (count - 1)) * staggerRatio;
  return standardBezierEase(Math.max(0, Math.min(1, (progress - delay) / Math.max(0.001, 1 - staggerRatio))));
}
function flashSpec(index, transitionMs) {
  const rng = seededRandom("constellation-flicker|" + index);
  const count = Math.floor(rng() * 3);
  const durationRatio = Math.max(0.04, Math.min(0.45, (Number(config.constellationFlickerMs) || 150) / Math.max(1, transitionMs)));
  if (count <= 0) return { centers: [], durationRatio };
  if (count === 1) return { centers: [0.24 + rng() * 0.46], durationRatio };
  const first = 0.18 + rng() * 0.22;
  const second = Math.max(first + durationRatio * 1.35, 0.54 + rng() * 0.24);
  return { centers: [first, Math.min(0.82, second)], durationRatio };
}
function flicker(progress, index, appearing) {
  const t = Math.max(0, Math.min(1, progress));
  if (t <= 0 || t >= 1) return 1;
  const spec = flashSpec(index, Math.max(1, config.lineTransitionMs));
  let value = 1;
  const softWidth = spec.durationRatio * (appearing ? 0.72 : 0.64);
  spec.centers.forEach((center) => {
    const distance = Math.abs(t - center);
    if (distance >= softWidth) return;
    const pulse = 1 - standardBezierEase(distance / Math.max(0.001, softWidth));
    value *= 1 - pulse * (appearing ? 0.94 : 0.84);
  });
  return Math.max(appearing ? 0.015 : 0.05, Math.min(1, value));
}
function blackout(progress, index, appearing) {
  const t = Math.max(0, Math.min(1, progress));
  if (t <= 0.04 || t >= 0.96) return false;
  const spec = flashSpec(index, Math.max(1, config.lineTransitionMs));
  const halfWidth = spec.durationRatio * (appearing ? 0.22 : 0.18);
  return spec.centers.some((center) => Math.abs(t - center) < halfWidth);
}
function drawConnection(path, connection, fraction, opacity, hidden) {
  if (!connection) {
    path.style.display = "none";
    return;
  }
  path.style.display = "";
  path.style.visibility = hidden ? "hidden" : "visible";
  path.setAttribute("d", connection.d);
  path.setAttribute("stroke", config.lineColor);
  path.setAttribute("stroke-width", config.lineStrokeWidth);
  path.setAttribute("opacity", Math.max(0, Math.min(1, config.lineOpacity * opacity)));
  setPathDrawFraction(path, fraction);
}
function drawText(text, point, opacity) {
  if (!point) {
    text.style.display = "none";
    return;
  }
  text.style.display = "";
  text.textContent = point.char;
  text.setAttribute("x", point.x);
  text.setAttribute("y", point.y);
  text.setAttribute("fill", config.lineCharColor);
  text.setAttribute("font-size", config.lineCharSize);
  text.setAttribute("opacity", Math.max(0, Math.min(1, config.lineCharOpacity * opacity)));
}
function draw(frame) {
  ensure(frame);
  contour.setAttribute("d", frame.contourPath || "");
  paths.forEach((path, index) => {
    const connection = frame.connections[index];
    drawConnection(path, connection, 1, 1, false);
  });
  texts.forEach((text, index) => {
    drawText(text, frame.points[index], 1);
  });
}
function drawTransition(current, next, progress, transitionMs) {
  ensure({
    contourPath: progress < 0.5 ? current.contourPath : next.contourPath,
    connections: current.connections.concat(next.connections),
    points: current.points.concat(next.points),
  });
  contour.setAttribute("d", progress < 0.5 ? current.contourPath || "" : next.contourPath || "");
  const currentLines = current.connections.length;
  current.connections.forEach((connection, index) => {
    const local = localProgress(progress, index, currentLines, transitionMs);
    const spark = flicker(local, index, false);
    drawConnection(paths[index], connection, (1 - local) * (0.82 + spark * 0.18), (1 - local) * spark, blackout(local, index, false));
  });
  next.connections.forEach((connection, index) => {
    const local = localProgress(progress, index, next.connections.length, transitionMs);
    const spark = flicker(local, index + currentLines, true);
    drawConnection(paths[currentLines + index], connection, local * (0.82 + spark * 0.18), local * spark, blackout(local, index + currentLines, true));
  });
  current.points.forEach((point, index) => drawText(texts[index], point, 1 - localProgress(progress, index, current.points.length, transitionMs)));
  next.points.forEach((point, index) => drawText(texts[current.points.length + index], point, localProgress(progress, index, next.points.length, transitionMs)));
}
function tick(now) {
  const active = frames.filter((frame) => frame.points.length);
  if (active.length) {
    const transition = Math.max(80, Number(config.lineTransitionMs) || 900);
    const interval = Math.max(transition + 120, Number(config.lineFrameIntervalMs) || 2600);
    const segment = Math.floor(now / interval) % active.length;
    const frameLocal = now % interval;
    const hold = Math.max(0, interval - transition);
    const current = active[segment];
    const next = active[(segment + 1) % active.length];
    if (frameLocal < hold) draw(current);
    else drawTransition(current, next, standardBezierEase((frameLocal - hold) / transition), transition);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function generateLineStandaloneHTML() {
  if (config.lineStyle === "constellation") return generateConstellationLineStandaloneHTML();
  const frames = state.lineFrames.map((frame) => ({
    id: frame.id,
    text: frame.text,
    points: frame.points.map((item) => ({
      char: item.char,
      x: Number(item.point.x.toFixed(3)),
      y: Number(item.point.y.toFixed(3)),
    })),
    connections: frame.connections.map((connection) => ({
      a: connection.a,
      b: connection.b,
      curved: connection.curved,
      bendA: Number(connection.bendA.toFixed(4)),
      bendB: Number(connection.bendB.toFixed(4)),
      tensionA: Number(connection.tensionA.toFixed(4)),
      tensionB: Number(connection.tensionB.toFixed(4)),
    })),
  }));
  const maxPoints = Math.max(0, ...frames.map((frame) => frame.points.length));
  const maxLineCount = Math.max(0, ...frames.map((frame) => frame.connections.length));
  const pathNodeCount = maxLineCount * 2;
  const textNodeCount = maxPoints * 2;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${state.fileName.replace(/[<>&"]/g, "")} Line Loader</title>
  <style>
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f7f4; font-family: Inter, system-ui, sans-serif; }
svg { width: min(72vmin, 560px); height: min(72vmin, 560px); overflow: visible; }
text { user-select: none; }
  </style>
</head>
<body>
  <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
<g id="line-group"></g>
  </svg>
  <script>
const SVG_NS = "http://www.w3.org/2000/svg";
const frames = ${JSON.stringify(frames)};
const config = ${JSON.stringify({
  effectType: config.effectType,
  lineFrameIntervalMs: config.lineFrameIntervalMs,
  lineTransitionMs: config.lineTransitionMs,
  lineStrokeWidth: config.lineStrokeWidth,
  lineCharSize: config.lineCharSize,
  lineColor: config.lineColor,
  lineOpacity: config.lineOpacity,
  lineCharColor: config.lineCharColor,
  lineCharOpacity: config.lineCharOpacity,
})};
const group = document.querySelector("#line-group");
const pathNodes = Array.from({ length: ${pathNodeCount} }, () => {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  group.appendChild(path);
  return path;
});
const textNodes = Array.from({ length: ${textNodeCount} }, () => {
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.setAttribute("font-family", "Inter, system-ui, sans-serif");
  text.setAttribute("font-weight", "700");
  group.appendChild(text);
  return text;
});
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
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
function interpolateFrame(current, next, progress) {
  if (!current?.points?.length && !next?.points?.length) return [];
  current = current?.points?.length ? current : next;
  next = next?.points?.length ? next : current;
  if (progress <= 0) return current.points;
  if (progress >= 1) return next.points;
  const count = next.points.length;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const from = sampleFramePoint(current, i, count);
    const to = next.points[i];
    points.push({
      char: to.char,
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      opacity: 1,
    });
  }
  return points;
}
function sampleFramePoint(frame, index, count) {
  const points = frame.points;
  if (points.length === 1) return points[0];
  const position = (index / count) * points.length;
  const leftIndex = Math.floor(position) % points.length;
  const rightIndex = (leftIndex + 1) % points.length;
  const local = position - Math.floor(position);
  const left = points[leftIndex];
  const right = points[rightIndex];
  return {
    char: left.char,
    x: left.x + (right.x - left.x) * local,
    y: left.y + (right.y - left.y) * local,
  };
}
function trimmedConnectionEndpoints(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { start: a, end: b };
  const gap = connectionEndpointGap(a, b);
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: a.x + ux * gap, y: a.y + uy * gap },
    end: { x: b.x - ux * gap, y: b.y - uy * gap },
  };
}
function connectionEndpointGap(a, b) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.min(Math.max(0, Number(config.lineCharSize) || 0), length * 0.45);
}
function linePath(a, b, connection) {
  const controls = visibleConnectionControlPoints(a, b, connection);
  if (!controls) return "";
  const start = controls.start;
  const end = controls.end;
  if (!connection.curved) return "M " + start.x.toFixed(2) + " " + start.y.toFixed(2) + " L " + end.x.toFixed(2) + " " + end.y.toFixed(2);
  return "M " + start.x.toFixed(2) + " " + start.y.toFixed(2) + " C " + controls.c1.x.toFixed(2) + " " + controls.c1.y.toFixed(2) + " " + controls.c2.x.toFixed(2) + " " + controls.c2.y.toFixed(2) + " " + end.x.toFixed(2) + " " + end.y.toFixed(2);
}
function connectionControlPoints(a, b, connection) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const c1 = {
    x: a.x + dx * connection.tensionA + nx * length * connection.bendA,
    y: a.y + dy * connection.tensionA + ny * length * connection.bendA,
  };
  const c2 = {
    x: a.x + dx * connection.tensionB + nx * length * connection.bendB,
    y: a.y + dy * connection.tensionB + ny * length * connection.bendB,
  };
  return { start: a, end: b, c1, c2 };
}
function visibleConnectionControlPoints(a, b, connection) {
  const center = connectionControlPoints(a, b, connection);
  if (!center) return null;
  if (!connection.curved) {
    const endpoints = trimmedConnectionEndpoints(a, b);
    if (!endpoints) return null;
    return { ...center, start: endpoints.start, end: endpoints.end };
  }
  const gap = connectionEndpointGap(a, b);
  const startT = approximateCubicTAtDistance(center.start, center.c1, center.c2, center.end, gap, false);
  const endT = approximateCubicTAtDistance(center.start, center.c1, center.c2, center.end, gap, true);
  return trimCubicSegment(center.start, center.c1, center.c2, center.end, startT, endT);
}
function approximateCubicTAtDistance(p0, c1, c2, p1, distance, fromEnd) {
  const samples = [];
  let length = 0;
  let previous = p0;
  samples.push({ t: 0, length: 0 });
  for (let step = 1; step <= 36; step += 1) {
    const t = step / 36;
    const point = cubicAt(p0, c1, c2, p1, t);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    samples.push({ t, length });
    previous = point;
  }
  const target = fromEnd ? Math.max(0, length - distance) : Math.min(length, distance);
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].length >= target) {
      const before = samples[index - 1];
      const after = samples[index];
      const span = Math.max(0.0001, after.length - before.length);
      return before.t + (after.t - before.t) * ((target - before.length) / span);
    }
  }
  return fromEnd ? 1 : 0;
}
function trimCubicSegment(p0, c1, c2, p1, startT, endT) {
  if (endT <= startT) {
    const point = cubicAt(p0, c1, c2, p1, 0.5);
    return { start: point, c1: point, c2: point, end: point };
  }
  const left = splitCubic(p0, c1, c2, p1, startT).right;
  const localEnd = (endT - startT) / Math.max(0.0001, 1 - startT);
  return splitCubic(left[0], left[1], left[2], left[3], localEnd).leftObject;
}
function splitCubic(p0, c1, c2, p1, t) {
  const p01 = lerpPoint(p0, c1, t);
  const p12 = lerpPoint(c1, c2, t);
  const p23 = lerpPoint(c2, p1, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const p0123 = lerpPoint(p012, p123, t);
  return {
    left: [p0, p01, p012, p0123],
    right: [p0123, p123, p23, p1],
    leftObject: { start: p0, c1: p01, c2: p012, end: p0123 },
  };
}
function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function cubicAt(a, c1, c2, b, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * inv * a.x + 3 * inv * inv * t * c1.x + 3 * inv * t * t * c2.x + t * t * t * b.x,
    y: inv * inv * inv * a.y + 3 * inv * inv * t * c1.y + 3 * inv * t * t * c2.y + t * t * t * b.y,
  };
}
function draw(points, connections) {
  pathNodes.forEach((path) => { path.style.display = "none"; });
  textNodes.forEach((text) => { text.style.display = "none"; });
  drawLayer(points, connections, null, 0, 0, 1);
}
function drawLayer(points, connections, fractions, pathOffset, textOffset, opacityScale) {
  pathNodes.forEach((path, index) => {
    if (index < pathOffset || index >= pathOffset + (connections?.length ?? 0)) return;
    const connection = connections?.[index - pathOffset];
    if (!connection) {
      path.style.display = "none";
      return;
    }
    const a = points[connection.a];
    const b = points[connection.b];
    if (!a || !b) {
      path.style.display = "none";
      return;
    }
    const d = linePath(a, b, connection);
    if (!d) {
      path.style.display = "none";
      return;
    }
    path.style.display = "";
    path.setAttribute("d", d);
    path.setAttribute("stroke", config.lineColor);
    path.setAttribute("stroke-width", config.lineStrokeWidth);
    path.setAttribute("opacity", config.lineOpacity * opacityScale);
    setPathDrawFraction(path, fractions?.[index - pathOffset] ?? 1);
  });
  points.forEach((point, index) => {
    const text = textNodes[index + textOffset];
    if (!text) return;
    if (!point) {
      text.style.display = "none";
      return;
    }
    text.style.display = "";
    text.textContent = point.char;
    text.setAttribute("x", point.x.toFixed(2));
    text.setAttribute("y", point.y.toFixed(2));
    text.setAttribute("fill", config.lineCharColor);
    text.setAttribute("font-size", config.lineCharSize);
    text.setAttribute("opacity", (config.lineCharOpacity * (point.opacity ?? 1)).toFixed(3));
  });
}
function drawTransition(current, next, progress) {
  pathNodes.forEach((path) => { path.style.display = "none"; });
  textNodes.forEach((text) => { text.style.display = "none"; });
  const currentPoints = morphFramePoints(current, next, progress, current.points.length, "current", 1 - progress);
  const nextPoints = morphFramePoints(current, next, progress, next.points.length, "next", progress);
  const pairs = pairTransitionConnections(current, next);
  let pathOffset = 0;
  pairs.matched.forEach((pair) => {
    drawMatchedConnection(pathNodes[pathOffset], current, next, pair, progress);
    pathOffset += 1;
  });
  drawLayer(currentPoints, pairs.currentUnmatched.map((item) => item.connection), pairs.currentUnmatched.map(() => 1 - progress), pathOffset, 0, 1 - progress);
  pathOffset += pairs.currentUnmatched.length;
  drawLayer(nextPoints, pairs.nextUnmatched.map((item) => item.connection), pairs.nextUnmatched.map(() => progress), pathOffset, currentPoints.length, progress);
}
function pairTransitionConnections(current, next) {
  const nextBuckets = new Map();
  next.connections.forEach((connection, index) => {
    const key = lineConnectionCharKey(next.points, connection);
    if (!key) return;
    if (!nextBuckets.has(key)) nextBuckets.set(key, []);
    nextBuckets.get(key).push({ connection, index });
  });
  const matched = [];
  const currentUnmatched = [];
  const usedNext = new Set();
  current.connections.forEach((connection, index) => {
    const key = lineConnectionCharKey(current.points, connection);
    const candidate = key ? nextBuckets.get(key)?.find((item) => !usedNext.has(item.index)) : null;
    if (candidate) {
      usedNext.add(candidate.index);
      matched.push({ currentConnection: connection, nextConnection: candidate.connection });
    } else {
      currentUnmatched.push({ connection, index });
    }
  });
  const nextUnmatched = next.connections
    .map((connection, index) => ({ connection, index }))
    .filter((item) => !usedNext.has(item.index));
  return { matched, currentUnmatched, nextUnmatched };
}
function lineConnectionCharKey(points, connection) {
  const a = points[connection.a]?.char;
  const b = points[connection.b]?.char;
  if (a == null || b == null) return "";
  return a <= b ? a + "\\u0000" + b : b + "\\u0000" + a;
}
function drawMatchedConnection(path, current, next, pair, progress) {
  if (!path) return;
  const currentConnection = pair.currentConnection;
  const nextConnection = pair.nextConnection;
  const currentA = current.points[currentConnection.a];
  const currentB = current.points[currentConnection.b];
  const nextA = next.points[nextConnection.a];
  const nextB = next.points[nextConnection.b];
  if (!currentA || !currentB || !nextA || !nextB) {
    path.style.display = "none";
    return;
  }
  const reversed = currentA.char !== nextA.char || currentB.char !== nextB.char;
  const currentControls = transitionConnectionControls(currentA, currentB, currentConnection);
  const nextControls = transitionConnectionControlsForDirection(nextA, nextB, nextConnection, reversed);
  if (!currentControls || !nextControls) {
    path.style.display = "none";
    return;
  }
  const controls = {
    start: lerpPoint(currentControls.start, nextControls.start, progress),
    c1: lerpPoint(currentControls.c1, nextControls.c1, progress),
    c2: lerpPoint(currentControls.c2, nextControls.c2, progress),
    end: lerpPoint(currentControls.end, nextControls.end, progress),
  };
  const curved = currentConnection.curved || nextConnection.curved;
  path.style.display = "";
  path.setAttribute("d", curved
    ? "M " + controls.start.x.toFixed(2) + " " + controls.start.y.toFixed(2) + " C " + controls.c1.x.toFixed(2) + " " + controls.c1.y.toFixed(2) + " " + controls.c2.x.toFixed(2) + " " + controls.c2.y.toFixed(2) + " " + controls.end.x.toFixed(2) + " " + controls.end.y.toFixed(2)
    : "M " + controls.start.x.toFixed(2) + " " + controls.start.y.toFixed(2) + " L " + controls.end.x.toFixed(2) + " " + controls.end.y.toFixed(2));
  path.setAttribute("stroke", config.lineColor);
  path.setAttribute("stroke-width", config.lineStrokeWidth);
  path.setAttribute("opacity", config.lineOpacity);
  setPathDrawFraction(path, 1);
}
function transitionConnectionControls(a, b, connection) {
  const controls = visibleConnectionControlPoints(a, b, connection);
  if (!controls) return null;
  if (connection.curved) return controls;
  return {
    start: controls.start,
    c1: lerpPoint(controls.start, controls.end, 1 / 3),
    c2: lerpPoint(controls.start, controls.end, 2 / 3),
    end: controls.end,
  };
}
function transitionConnectionControlsForDirection(a, b, connection, reversed) {
  const controls = transitionConnectionControls(a, b, connection);
  if (!controls || !reversed) return controls;
  return {
    start: controls.end,
    c1: controls.c2,
    c2: controls.c1,
    end: controls.start,
  };
}
function morphFramePoints(current, next, progress, count, charSource, opacity) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const from = charSource === "current" ? current.points[index] : sampleFramePoint(current, index, count);
    const to = charSource === "current" ? sampleFramePoint(next, index, count) : next.points[index];
    if (!from || !to) continue;
    points.push({
      char: charSource === "current" ? from.char : to.char,
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      opacity,
    });
  }
  return points;
}
function setPathDrawFraction(path, fraction) {
  const value = clamp(fraction, 0, 1);
  if (value >= 0.999) {
    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "";
    return;
  }
  let length = 1;
  try {
    length = Math.max(1, path.getTotalLength());
  } catch {
    length = 1;
  }
  path.style.strokeDasharray = String(length);
  path.style.strokeDashoffset = String(length * (1 - value));
}
function tick(now) {
  const activeFrames = frames.filter((frame) => frame.points.length);
  const interval = Math.max(300, config.lineFrameIntervalMs);
  const transition = Math.min(Math.max(600, config.lineTransitionMs), interval);
  const hold = Math.max(0, interval - transition);
  const cycle = Math.max(1, activeFrames.length) * interval;
  const local = now % cycle;
  if (!activeFrames.length) {
    draw([], []);
  } else {
    const segment = Math.min(activeFrames.length - 1, Math.floor(local / interval));
    const frameLocal = local % interval;
    const current = activeFrames[segment];
    const next = activeFrames[(segment + 1) % activeFrames.length];
    const progress = frameLocal < hold ? 0 : standardBezierEase((frameLocal - hold) / transition);
    if (progress > 0 && progress < 1) drawTransition(current, next, progress);
    else draw(progress <= 0 ? current.points : next.points, progress <= 0 ? current.connections : next.connections);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function previewConstellationTransitionPhase() {
  if (config.effectType !== "line" || config.lineStyle !== "constellation") return false;
  const interval = Math.max(300, Number(config.lineFrameIntervalMs) || 300);
  const transition = Math.min(Math.max(600, Number(config.lineTransitionMs) || 600), interval);
  const hold = Math.max(0, interval - transition);
  state.startedAt = performance.now() - hold - transition * 0.46;
  return true;
}

function applyConstellationPointCountChange() {
  if (config.effectType !== "line" || config.lineStyle !== "constellation") return false;
  config.lineKeyframes.forEach((frame) => {
    delete frame.constellationConnections;
    delete frame.constellationConnectionsEdited;
  });
  prepareLineEffect();
  if (!state.lineEdit) previewConstellationTransitionPhase();
  updateMeta();
  updateFormulaAndCode();
  refreshPreviewNow();
  return true;
}

function generateLineLottie() {
  const frame = state.lineFrames.find((item) => item.points?.length) ?? state.lineFrames[0];
  const layers = [];
  if (!frame) return makeBasicLottieDocument("Line", layers);
  if (config.lineStyle === "constellation") {
    frame.connections.forEach((connection, index) => {
      const a = frame.points[connection.a];
      const b = frame.points[connection.b];
      if (!a || !b) return;
      layers.push(makeLottieShapeLayer(`Constellation line ${index + 1}`, makeLottiePathShape([a.point, b.point], false), {
        index: layers.length + 1,
        stroke: config.lineColor,
        strokeWidth: Math.max(1, config.lineStrokeWidth * 5.12),
        opacity: config.lineOpacity,
      }));
    });
  } else {
    frame.connections.forEach((connection, index) => {
      const a = frame.points[connection.a]?.point;
      const b = frame.points[connection.b]?.point;
      if (!a || !b) return;
      layers.push(makeLottieShapeLayer(`Line ${index + 1}`, makeLottiePathShape([a, b], false), {
        index: layers.length + 1,
        stroke: config.lineColor,
        strokeWidth: Math.max(1, config.lineStrokeWidth * 5.12),
        opacity: config.lineOpacity,
      }));
    });
  }
  frame.points.forEach((point, index) => {
    layers.push(makeLottieEllipseLayer(`Point ${index + 1}`, point.point, Math.max(0.35, config.lineCharSize * 0.16), {
      index: layers.length + 1,
      fill: config.lineCharColor,
      opacity: config.lineCharOpacity,
    }));
  });
  return makeBasicLottieDocument("Line", layers);
}
