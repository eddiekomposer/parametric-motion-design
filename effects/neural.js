// neural network effect module. Loaded before the main UI script.
var neuralDefaults = {
  neuralSource: "circle",
  neuralDensity: 13,
  neuralNodeSize: 1.15,
  neuralGravityRange: 5,
  neuralNodeColor: "#f6f7f1",
  neuralNodeOpacity: 0.88,
  neuralNodeShape: "circle",
  neuralMouseFollow: false,
  neuralSnapCursor: false,
  neuralSnapIntervalMs: 900,
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
      { value: "perspective", label: "透视" },
      { value: "reference", label: "参考图" },
    ],
    tip: "圆形、方形和透视使用程序生成点阵；参考图会按上传图片的前景区域生成点阵。",
  },
  { key: "neuralDensity", label: "点阵密度", min: 4, max: 40, step: 1, tip: "控制点阵行列数量，例如 13 表示 13x13；透视模式表示 13x13x13。" },
  { key: "neuralNodeSize", label: "点的大小", min: 0, max: 5, step: 0.05, tip: "控制基础节点大小；设为 0 时普通节点隐藏，靠近光标的节点仍会被放大显示。" },
  { key: "neuralGravityRange", label: "引力范围", min: 3, max: 30, step: 1, tip: "控制被光标改变的点阵范围，例如 5 约等于 5x5 个点受影响。" },
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
  { key: "neuralSnapIntervalMs", label: "闪烁间隔", min: 300, max: 3000, step: 50, showWhen: () => config.neuralSnapCursor && !config.neuralMouseFollow, tip: "控制吸附模式下光标刷新到下一个随机节点的时间间隔。" },
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
  state.neuralSystem.snapNextAt = 0;
  const cursor = state.neuralSystem.cursor;
  if (!Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) {
    cursor.x = 50;
    cursor.y = 50;
    cursor.z = 50;
    cursor.vx = 0.08;
    cursor.vy = -0.04;
    cursor.vz = 0.05;
  }
  if (!Number.isFinite(cursor.z)) cursor.z = 50;
  if (!Number.isFinite(cursor.vz)) cursor.vz = 0.05;
}

function buildNeuralNodes() {
  const columns = clamp(Math.round(Number(config.neuralDensity) || neuralDefaults.neuralDensity), 4, 40);
  const rows = columns;
  const step = 82 / Math.max(1, columns - 1);
  const nodes = [];
  const source = config.neuralSource || "circle";
  if (source === "perspective") return buildNeuralPerspectiveNodes(columns);
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
        z: 50,
        ox: (seed() - 0.5) * Math.min(0.9, step * 0.08),
        oy: (seed() - 0.5) * Math.min(0.9, step * 0.08),
        oz: 0,
        sizeJitter: 0.78 + seed() * 0.52,
        pulse: seed() * Math.PI * 2,
        renderInfluence: 0,
        renderCursor: 0,
      });
    }
  }
  return nodes.length ? nodes : buildNeuralFallbackNodes(columns);
}

function buildNeuralPerspectiveNodes(columns) {
  const nodes = [];
  const step = 74 / Math.max(1, columns - 1);
  for (let zIndex = 0; zIndex < columns; zIndex += 1) {
    for (let row = 0; row < columns; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = 13 + column * step;
        const y = 13 + row * step;
        const z = 13 + zIndex * step;
        const seed = seededRandom(`neural-node|perspective|${columns}|${zIndex}|${row}|${column}`);
        const jitter = Math.min(0.7, step * 0.06);
        nodes.push({
          x,
          y,
          z,
          ox: (seed() - 0.5) * jitter,
          oy: (seed() - 0.5) * jitter,
          oz: (seed() - 0.5) * jitter,
          sizeJitter: 0.72 + seed() * 0.48,
          pulse: seed() * Math.PI * 2,
          renderInfluence: 0,
          renderCursor: 0,
        });
      }
    }
  }
  return nodes;
}

function makeNeuralReferenceSampler() {
  if (state.sourceKind === "svg" && state.normalizedContours?.some((contour) => contour.length >= 3)) {
    return makeNeuralSvgReferenceSampler();
  }
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

function makeNeuralSvgReferenceSampler() {
  const contours = (state.normalizedContours || []).filter((contour) => contour.length >= 3);
  if (!contours.length) return (x, y) => Math.hypot(x - 50, y - 50) <= 41.5;
  const density = clamp(Math.round(Number(config.neuralDensity) || neuralDefaults.neuralDensity), 4, 40);
  const pathRadius = clamp(42 / density, 1.9, 5.8);
  const closed = state.normalizedContourClosed || [];
  const filled = state.normalizedContourFilled || [];
  return (x, y) => {
    const point = { x, y };
    let insideFilledShape = false;
    for (let index = 0; index < contours.length; index += 1) {
      const contour = contours[index];
      if (closed[index] !== false && filled[index] !== false && neuralPointInPolygon(point, contour)) insideFilledShape = !insideFilledShape;
      if (neuralDistanceToContour(point, contour, closed[index] !== false) <= pathRadius) return true;
    }
    return insideFilledShape;
  };
}

function neuralPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 0.000001) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function neuralDistanceToContour(point, contour, closed) {
  let best = Infinity;
  const segmentCount = closed ? contour.length : contour.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    best = Math.min(best, neuralDistanceToSegment(point, contour[index], contour[(index + 1) % contour.length]));
  }
  return best;
}

function neuralDistanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.000001) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return Math.hypot(point.x - x, point.y - y);
}

function buildNeuralFallbackNodes(columns) {
  const nodes = [];
  const step = 82 / Math.max(1, columns - 1);
  for (let row = 0; row < columns; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = 9 + column * step;
      const y = 9 + row * step;
      if (Math.hypot(x - 50, y - 50) > 41.5) continue;
      nodes.push({ x, y, z: 50, ox: 0, oy: 0, oz: 0, sizeJitter: 1, pulse: (row + column) * 0.37, renderInfluence: 0, renderCursor: 0 });
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

function updateNeuralNodeDynamics(nodes, links, cursorNodeIndex, dt) {
  const active = new Map(links.map((item) => [item.index, item.influence]));
  nodes.forEach((node, index) => {
    const targetInfluence = active.get(index) || 0;
    node.renderInfluence = neuralSmoothFollow(node.renderInfluence, targetInfluence, 10, dt);
    node.renderCursor = neuralSmoothFollow(node.renderCursor, index === cursorNodeIndex ? 1 : 0, 14, dt);
  });
}

function neuralRenderedNodeRadius(node, ratio, depth = 0) {
  if (!node) return 0;
  const influence = Number.isFinite(node.renderInfluence) ? node.renderInfluence : 0;
  const cursorBlend = Number.isFinite(node.renderCursor) ? node.renderCursor : 0;
  const baseSize = clamp(Number(config.neuralNodeSize) || 0, 0, 5) * ratio;
  const nodeSize = node.sizeJitter * (baseSize * (0.58 + influence * 1.25) + influence * ratio * 1.45);
  const cursorSize = Math.max(0.8, Number(config.neuralCursorSize) || 3.25) * ratio;
  return (nodeSize + (cursorSize - nodeSize) * cursorBlend) * neuralDepthScale(depth);
}

function neuralBoundaryInset(radius, dx, dy) {
  if (radius <= 0.02) return 0;
  if (config.neuralNodeShape === "square") {
    const axis = Math.max(Math.abs(dx), Math.abs(dy), 0.0001);
    return radius * Math.hypot(dx, dy) / axis;
  }
  return radius;
}

function neuralTrimmedSegment(from, to, fromRadius, toRadius, lineWidth) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return null;
  const padding = Math.max(0.2, lineWidth * 0.55);
  let startInset = neuralBoundaryInset(fromRadius, dx, dy) + padding;
  let endInset = neuralBoundaryInset(toRadius, -dx, -dy) + padding;
  const maxInset = Math.max(0, length * 0.48);
  startInset = Math.min(startInset, maxInset);
  endInset = Math.min(endInset, maxInset);
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: from.x + ux * startInset, y: from.y + uy * startInset },
    end: { x: to.x - ux * endInset, y: to.y - uy * endInset },
  };
}

function neuralIsPerspective() {
  return config.neuralSource === "perspective";
}

function neuralPointForNode(node) {
  return node
    ? { x: node.x + (node.ox || 0), y: node.y + (node.oy || 0), z: (node.z ?? 50) + (node.oz || 0) }
    : { x: 50, y: 50, z: 50 };
}

function neuralDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = neuralIsPerspective() ? ((a.z ?? 50) - (b.z ?? 50)) : 0;
  return Math.hypot(dx, dy, dz);
}

function neuralDensityCount() {
  return clamp(Math.round(Number(config.neuralDensity) || neuralDefaults.neuralDensity), 4, 40);
}

function neuralGravityRange() {
  return clamp(Math.round(Number(config.neuralGravityRange) || neuralDefaults.neuralGravityRange), 3, 30);
}

function neuralGridStep() {
  const density = neuralDensityCount();
  return (neuralIsPerspective() ? 74 : 82) / Math.max(1, density - 1);
}

function neuralInfluenceRadius() {
  return Math.max(neuralGridStep(), neuralGridStep() * (neuralGravityRange() - 1) * 0.5);
}

function neuralInfluenceLimit(nodes) {
  const range = neuralGravityRange();
  return Math.min(nodes.length, Math.max(9, Math.ceil(range * range * (neuralIsPerspective() ? 1.35 : 1))));
}

function neuralProjectedPoint(point) {
  if (!neuralIsPerspective()) return { x: point.x, y: point.y, depth: 0 };
  const angle = state.neuralSystem.projectionAngle || 0;
  const x = ((point.x ?? 50) - 50) / 50;
  const y = ((point.y ?? 50) - 50) / 50;
  const z = ((point.z ?? 50) - 50) / 50;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rx = x * ca + z * sa;
  const rz = -x * sa + z * ca;
  const isoCos = 0.8164965809;
  const isoSin = 0.5773502692;
  const py = y * isoCos - rz * isoSin;
  const depth = y * isoSin + rz * isoCos;
  return {
    x: 50 + rx * 34,
    y: 50 + py * 34,
    depth,
  };
}

function neuralDepthScale(depth) {
  return neuralIsPerspective() ? clamp(0.78 + (depth + 1.15) * 0.16, 0.64, 1.14) : 1;
}

function neuralSnapInterval() {
  return clamp(Number(config.neuralSnapIntervalMs) || neuralDefaults.neuralSnapIntervalMs, 300, 3000);
}

function neuralCursorRoamRadius(speedScale) {
  return 13 + clamp(speedScale, 0, 2) * 12;
}

function neuralRandomRoamTarget(speedScale) {
  const radius = neuralCursorRoamRadius(speedScale);
  const angle = Math.random() * Math.PI * 2;
  const distance = radius * Math.sqrt(Math.random());
  const zAngle = Math.random() * Math.PI * 2;
  const zDistance = neuralIsPerspective() ? radius * (Math.random() - 0.5) * 1.45 : 0;
  return {
    x: 50 + Math.cos(angle) * distance,
    y: 50 + Math.sin(angle) * distance,
    z: 50 + Math.sin(zAngle) * Math.abs(zDistance),
  };
}

function chooseFarNeuralNode(nodes, currentIndex) {
  if (!nodes.length) return null;
  if (currentIndex < 0 || !nodes[currentIndex]) {
    const index = Math.floor(Math.random() * nodes.length);
    const node = nodes[index];
    const point = neuralPointForNode(node);
    return { node, index, x: point.x, y: point.y, z: point.z, distance: 0 };
  }
  const origin = neuralPointForNode(nodes[currentIndex]);
  const options = nodes
    .map((node, index) => {
      const point = neuralPointForNode(node);
      return { node, index, x: point.x, y: point.y, z: point.z, distance: neuralDistance(point, origin) };
    })
    .filter((item) => item.index !== currentIndex)
    .sort((a, b) => b.distance - a.distance);
  if (!options.length) return null;
  const farEnough = options.filter((item) => item.distance >= 24);
  const pool = farEnough.length >= 3 ? farEnough : options.slice(0, Math.max(1, Math.ceil(options.length * 0.45)));
  const weightedTotal = pool.reduce((sum, item) => sum + item.distance * item.distance, 0);
  let pick = Math.random() * weightedTotal;
  for (const item of pool) {
    pick -= item.distance * item.distance;
    if (pick <= 0) return item;
  }
  return pool[pool.length - 1];
}

function neuralSnapNode(system, rawCursor, now) {
  if (!config.neuralSnapCursor) return null;
  if (config.neuralMouseFollow && system.pointer.active) return nearestNeuralNode(system.nodes, rawCursor);
  const current = system.cursorNodeIndex >= 0 ? system.nodes[system.cursorNodeIndex] : null;
  if (current && now < (system.snapNextAt || 0)) {
    const point = neuralPointForNode(current);
    return { node: current, index: system.cursorNodeIndex, x: point.x, y: point.y, z: point.z, distance: 0 };
  }
  const picked = chooseFarNeuralNode(system.nodes, system.cursorNodeIndex);
  system.snapNextAt = now + neuralSnapInterval();
  return picked;
}

function updateNeuralCursor(system, dt, now) {
  const cursor = system.cursor;
  const pointer = system.pointer;
  const follow = Boolean(config.neuralMouseFollow && pointer.active);
  if (follow) {
    const ease = 1 - Math.exp(-14 * dt);
    cursor.x += (pointer.x - cursor.x) * ease;
    cursor.y += (pointer.y - cursor.y) * ease;
    if (neuralIsPerspective()) cursor.z += (50 - cursor.z) * (1 - Math.exp(-3.5 * dt));
    cursor.vx *= 0.82;
    cursor.vy *= 0.82;
    cursor.vz *= 0.82;
    return;
  }
  if (!Number.isFinite(cursor.driftAngle)) cursor.driftAngle = -0.4;
  const speedScale = clamp(Number(config.neuralCursorSpeed) || 0, 0, 2);
  const motionScale = 0.2 + speedScale * 0.8;
  const roamRadius = neuralCursorRoamRadius(speedScale);
  const targetDistance = neuralIsPerspective()
    ? Math.hypot((cursor.roamX ?? 50) - cursor.x, (cursor.roamY ?? 50) - cursor.y, ((cursor.roamZ ?? 50) - (cursor.z ?? 50)))
    : Math.hypot((cursor.roamX ?? 50) - cursor.x, (cursor.roamY ?? 50) - cursor.y);
  if (!Number.isFinite(cursor.roamX) || !Number.isFinite(cursor.roamY) || (neuralIsPerspective() && !Number.isFinite(cursor.roamZ)) || now > (cursor.roamUntil || 0) || targetDistance < 5.5) {
    const target = neuralRandomRoamTarget(speedScale);
    cursor.roamX = target.x;
    cursor.roamY = target.y;
    cursor.roamZ = target.z;
    cursor.roamUntil = now + 1150 + Math.random() * 1300;
  }
  const roamPullX = (cursor.roamX - cursor.x) * 0.0026 * motionScale;
  const roamPullY = (cursor.roamY - cursor.y) * 0.0026 * motionScale;
  const roamPullZ = neuralIsPerspective() ? ((cursor.roamZ ?? 50) - cursor.z) * 0.0026 * motionScale : 0;
  const outside = neuralIsPerspective()
    ? Math.hypot(cursor.x - 50, cursor.y - 50, (cursor.z ?? 50) - 50) / Math.max(1, roamRadius)
    : Math.hypot(cursor.x - 50, cursor.y - 50) / Math.max(1, roamRadius);
  const centerPull = Math.max(0, outside - 0.78) * 0.006 * motionScale;
  const desiredAngle = Math.atan2(roamPullY - (cursor.y - 50) * centerPull, roamPullX - (cursor.x - 50) * centerPull);
  let angleDelta = desiredAngle - cursor.driftAngle;
  angleDelta = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta));
  const turn = angleDelta * 0.045 + Math.sin(now * 0.00045 + cursor.x * 0.021) * 0.004;
  cursor.driftAngle += turn;
  cursor.vx += Math.cos(cursor.driftAngle) * 0.005 * motionScale + roamPullX - (cursor.x - 50) * centerPull;
  cursor.vy += Math.sin(cursor.driftAngle) * 0.005 * motionScale + roamPullY - (cursor.y - 50) * centerPull;
  if (neuralIsPerspective()) cursor.vz += roamPullZ - ((cursor.z ?? 50) - 50) * centerPull;
  else cursor.z = 50;
  const speed = neuralIsPerspective() ? Math.hypot(cursor.vx, cursor.vy, cursor.vz || 0) : Math.hypot(cursor.vx, cursor.vy);
  const maxSpeed = 0.18 + 0.15 * speedScale;
  if (speed > maxSpeed) {
    cursor.vx = (cursor.vx / speed) * maxSpeed;
    cursor.vy = (cursor.vy / speed) * maxSpeed;
    if (neuralIsPerspective()) cursor.vz = ((cursor.vz || 0) / speed) * maxSpeed;
  }
  cursor.x += cursor.vx;
  cursor.y += cursor.vy;
  if (neuralIsPerspective()) cursor.z += cursor.vz || 0;
  cursor.vx *= 0.992;
  cursor.vy *= 0.992;
  cursor.vz = (cursor.vz || 0) * 0.992;
  const margin = 8;
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
  if (neuralIsPerspective() && (cursor.z < margin || cursor.z > 100 - margin)) {
    cursor.vz *= -0.62;
    cursor.z = clamp(cursor.z, margin, 100 - margin);
  }
}

function nearestNeuralNode(nodes, cursor) {
  let best = null;
  nodes.forEach((node, index) => {
    const point = neuralPointForNode(node);
    const distance = neuralDistance(point, cursor);
    if (!best || distance < best.distance) best = { node, index, x: point.x, y: point.y, z: point.z, distance };
  });
  return best;
}

function neuralActiveLinks(nodes, cursor, skipIndex = -1) {
  const radius = neuralInfluenceRadius();
  const limit = neuralInfluenceLimit(nodes);
  return nodes
    .map((node, index) => {
      const point = neuralPointForNode(node);
      const distanceToCursor = neuralDistance(point, cursor);
      return { node, index, x: point.x, y: point.y, z: point.z, distance: distanceToCursor, influence: clamp(1 - distanceToCursor / radius, 0, 1) };
    })
    .filter((item) => item.influence > 0 && item.index !== skipIndex)
    .sort((a, b) => b.influence - a.influence)
    .slice(0, limit)
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
  system.projectionAngle = neuralIsPerspective() ? now * 0.00016 : 0;
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
  const snapped = neuralSnapNode(system, rawCursor, now);
  const cursor = snapped ? { x: snapped.x, y: snapped.y, z: snapped.z ?? 50 } : rawCursor;
  const nextCursorNodeIndex = snapped ? snapped.index : -1;
  if (config.neuralSnapCursor && nextCursorNodeIndex !== system.cursorNodeIndex) {
    system.snapPulseAt = now;
  }
  system.cursorNodeIndex = nextCursorNodeIndex;
  const links = neuralActiveLinks(system.nodes, cursor, system.cursorNodeIndex);
  system.links = links;
  updateNeuralNodeDynamics(system.nodes, links, system.cursorNodeIndex, dt);
  const pulse = config.neuralSnapCursor ? neuralPulseState(system, now) : null;
  drawNeuralLinks(ctx, links, cursor, pulse, system.nodes[system.cursorNodeIndex]);
  drawNeuralNodes(ctx, system.nodes, links, cursor, now, system.cursorNodeIndex, dt);
  if (!snapped) drawNeuralCursor(ctx, cursor, now);
  window.__motionDebug.neuralNodeCount = system.nodes.length;
  window.__motionDebug.neuralLinkCount = links.length;
  window.__motionDebug.neuralCursor = { x: Number(cursor.x.toFixed(2)), y: Number(cursor.y.toFixed(2)), z: Number((cursor.z ?? 50).toFixed(2)) };
}

function neuralToCanvas(point) {
  const projected = neuralProjectedPoint(point);
  const canvasPoint = particleToCanvas(projected);
  canvasPoint.depth = projected.depth;
  return canvasPoint;
}

function drawNeuralLinks(ctx, links, cursor, pulse = null, cursorNode = null) {
  const cursorPoint = neuralToCanvas(cursor);
  const ratio = window.devicePixelRatio || 1;
  const cursorRadius = cursorNode
    ? neuralRenderedNodeRadius(cursorNode, ratio, cursorPoint.depth || 0)
    : Math.max(0.8, Number(config.neuralCursorSize) || 3.25) * ratio * neuralDepthScale(cursorPoint.depth || 0);
  ctx.save();
  ctx.strokeStyle = config.neuralLineColor;
  ctx.lineCap = "round";
  links.forEach((item, index) => {
    const point = neuralToCanvas({ x: item.x, y: item.y, z: item.z ?? 50 });
    const rawLocal = pulse?.active ? (pulse.progress - index * 0.024) / 0.68 : 1;
    const local = pulse?.active ? neuralEaseOutCubic(rawLocal) : 1;
    if (local <= 0.001) return;
    const lineAlpha = clamp(config.neuralLineOpacity, 0, 1) * (0.14 + item.influence * 0.86);
    const electric = pulse?.active ? Math.sin(clamp(rawLocal, 0, 1) * Math.PI) : 0;
    ctx.globalAlpha = lineAlpha * Math.min(1, local * (1.05 + electric * 0.38));
    ctx.lineWidth = Math.max(0.35, Number(config.neuralLineWidth) || 1) * ratio * (0.72 + item.influence * 0.62);
    const segment = neuralTrimmedSegment(cursorPoint, point, cursorRadius, neuralRenderedNodeRadius(item.node, ratio, point.depth || 0), ctx.lineWidth);
    if (!segment) return;
    const targetX = segment.start.x + (segment.end.x - segment.start.x) * local;
    const targetY = segment.start.y + (segment.end.y - segment.start.y) * local;
    ctx.beginPath();
    ctx.moveTo(segment.start.x, segment.start.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    if (pulse?.active && electric > 0.08) {
      const head = clamp(local, 0, 1);
      const tail = clamp(head - 0.18, 0, 1);
      ctx.globalAlpha = lineAlpha * electric;
      ctx.lineWidth *= 1.55;
      ctx.beginPath();
      ctx.moveTo(segment.start.x + (segment.end.x - segment.start.x) * tail, segment.start.y + (segment.end.y - segment.start.y) * tail);
      ctx.lineTo(segment.start.x + (segment.end.x - segment.start.x) * head, segment.start.y + (segment.end.y - segment.start.y) * head);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawNeuralNodes(ctx, nodes, links, cursor, now, cursorNodeIndex = -1, dt = 1 / 60) {
  const ratio = window.devicePixelRatio || 1;
  const orderedNodes = neuralIsPerspective()
    ? nodes.map((node, index) => ({ node, index, point: neuralToCanvas(neuralPointForNode(node)) })).sort((a, b) => a.point.depth - b.point.depth)
    : nodes.map((node, index) => ({ node, index, point: neuralToCanvas(neuralPointForNode(node)) }));
  orderedNodes.forEach(({ node, index, point }) => {
    const influence = node.renderInfluence;
    const cursorBlend = node.renderCursor;
    const twinkle = 0.5 + Math.sin(now * 0.0021 + node.pulse) * 0.5;
    const size = neuralRenderedNodeRadius(node, ratio, point.depth || 0);
    if (size <= 0.02) return;
    ctx.save();
    ctx.fillStyle = neuralMixColor(config.neuralNodeColor, config.neuralCursorColor, cursorBlend);
    const depthAlpha = neuralIsPerspective() ? clamp(0.48 + (point.depth + 1.2) * 0.2, 0.34, 0.95) : 1;
    const nodeAlpha = clamp(config.neuralNodeOpacity, 0, 1) * depthAlpha * (0.18 + influence * 0.8 + twinkle * 0.12);
    const cursorAlpha = clamp(config.neuralCursorOpacity, 0, 1);
    ctx.globalAlpha = nodeAlpha + (cursorAlpha - nodeAlpha) * cursorBlend;
    drawNeuralNodeShape(ctx, point, size);
    ctx.restore();
  });
}

function drawNeuralCursor(ctx, cursor, now) {
  const ratio = window.devicePixelRatio || 1;
  const point = neuralToCanvas(cursor);
  const radius = Math.max(0.8, Number(config.neuralCursorSize) || 3.25) * ratio * neuralDepthScale(point.depth || 0);
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
    z: Number(((node.z ?? 50) + (node.oz || 0)).toFixed(3)),
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
  neuralSource: config.neuralSource,
  neuralDensity: config.neuralDensity,
  neuralNodeSize: config.neuralNodeSize,
  neuralGravityRange: config.neuralGravityRange,
  neuralNodeColor: config.neuralNodeColor,
  neuralNodeOpacity: config.neuralNodeOpacity,
  neuralNodeShape: config.neuralNodeShape,
  neuralMouseFollow: config.neuralMouseFollow,
  neuralSnapCursor: config.neuralSnapCursor,
  neuralSnapIntervalMs: config.neuralSnapIntervalMs,
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
const cursor = { x: 50, y: 50, z: 50, vx: 0.08, vy: -0.04, vz: 0.05 };
let viewport = { x: 0, y: 0, size: 1, width: 1, height: 1 };
let lastFrameAt = null;
let snapIndex = -1;
let snapPulseAt = 0;
let snapNextAt = 0;
let projectionAngle = 0;
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
function isPerspective() {
  return config.neuralSource === "perspective";
}
function pointForNode(node) {
  return node ? { x: node.x, y: node.y, z: node.z ?? 50 } : { x: 50, y: 50, z: 50 };
}
function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, isPerspective() ? ((a.z ?? 50) - (b.z ?? 50)) : 0);
}
function densityCount() {
  return clamp(Math.round(config.neuralDensity || 13), 4, 40);
}
function gravityRange() {
  return clamp(Math.round(config.neuralGravityRange || 5), 3, 30);
}
function gridStep() {
  return (isPerspective() ? 74 : 82) / Math.max(1, densityCount() - 1);
}
function influenceRadius() {
  return Math.max(gridStep(), gridStep() * (gravityRange() - 1) * 0.5);
}
function influenceLimit() {
  const range = gravityRange();
  return Math.min(nodes.length, Math.max(9, Math.ceil(range * range * (isPerspective() ? 1.35 : 1))));
}
function projectedPoint(point) {
  if (!isPerspective()) return { x: point.x, y: point.y, depth: 0 };
  const x = ((point.x ?? 50) - 50) / 50;
  const y = ((point.y ?? 50) - 50) / 50;
  const z = ((point.z ?? 50) - 50) / 50;
  const ca = Math.cos(projectionAngle);
  const sa = Math.sin(projectionAngle);
  const rx = x * ca + z * sa;
  const rz = -x * sa + z * ca;
  const isoCos = 0.8164965809;
  const isoSin = 0.5773502692;
  const py = y * isoCos - rz * isoSin;
  const depth = y * isoSin + rz * isoCos;
  return { x: 50 + rx * 34, y: 50 + py * 34, depth };
}
function depthScale(depth) {
  return isPerspective() ? clamp(0.78 + (depth + 1.15) * 0.16, 0.64, 1.14) : 1;
}
function renderedNodeRadius(node, ratio, depth = 0) {
  if (!node) return 0;
  const influence = Number.isFinite(node.renderInfluence) ? node.renderInfluence : 0;
  const cursorBlend = Number.isFinite(node.renderCursor) ? node.renderCursor : 0;
  const nodeSize = node.sizeJitter * (Math.min(5, Math.max(0, config.neuralNodeSize || 0)) * ratio * (0.58 + influence * 1.25) + influence * ratio * 1.45);
  const cursorSize = Math.max(0.8, config.neuralCursorSize || 3.25) * ratio;
  return (nodeSize + (cursorSize - nodeSize) * cursorBlend) * depthScale(depth);
}
function boundaryInset(radius, dx, dy) {
  if (radius <= 0.02) return 0;
  if (config.neuralNodeShape === "square") {
    const axis = Math.max(Math.abs(dx), Math.abs(dy), 0.0001);
    return radius * Math.hypot(dx, dy) / axis;
  }
  return radius;
}
function trimmedSegment(from, to, fromRadius, toRadius, lineWidth) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return null;
  const padding = Math.max(0.2, lineWidth * 0.55);
  let startInset = boundaryInset(fromRadius, dx, dy) + padding;
  let endInset = boundaryInset(toRadius, -dx, -dy) + padding;
  const maxInset = Math.max(0, length * 0.48);
  startInset = Math.min(startInset, maxInset);
  endInset = Math.min(endInset, maxInset);
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: from.x + ux * startInset, y: from.y + uy * startInset },
    end: { x: to.x - ux * endInset, y: to.y - uy * endInset },
  };
}
function snapInterval() {
  return clamp(config.neuralSnapIntervalMs || 900, 300, 3000);
}
function cursorRoamRadius(speedScale) {
  return 13 + Math.max(0, Math.min(2, speedScale)) * 12;
}
function randomRoamTarget(speedScale) {
  const radius = cursorRoamRadius(speedScale);
  const angle = Math.random() * Math.PI * 2;
  const distance = radius * Math.sqrt(Math.random());
  const zAngle = Math.random() * Math.PI * 2;
  const zDistance = isPerspective() ? radius * (Math.random() - 0.5) * 1.45 : 0;
  return {
    x: 50 + Math.cos(angle) * distance,
    y: 50 + Math.sin(angle) * distance,
    z: 50 + Math.sin(zAngle) * Math.abs(zDistance),
  };
}
function chooseFarNode(currentIndex) {
  if (!nodes.length) return null;
  if (currentIndex < 0 || !nodes[currentIndex]) {
    const index = Math.floor(Math.random() * nodes.length);
    const point = pointForNode(nodes[index]);
    return { node: nodes[index], index, x: point.x, y: point.y, z: point.z, distance: 0 };
  }
  const origin = pointForNode(nodes[currentIndex]);
  const options = nodes.map((node, index) => ({
    node,
    index,
    ...pointForNode(node),
    distance: distance3(pointForNode(node), origin),
  })).filter((item) => item.index !== currentIndex).sort((a, b) => b.distance - a.distance);
  if (!options.length) return null;
  const farEnough = options.filter((item) => item.distance >= 24);
  const pool = farEnough.length >= 3 ? farEnough : options.slice(0, Math.max(1, Math.ceil(options.length * 0.45)));
  const weightedTotal = pool.reduce((sum, item) => sum + item.distance * item.distance, 0);
  let pick = Math.random() * weightedTotal;
  for (const item of pool) {
    pick -= item.distance * item.distance;
    if (pick <= 0) return item;
  }
  return pool[pool.length - 1];
}
function snappedNode(now) {
  if (!config.neuralSnapCursor) return null;
  if (config.neuralMouseFollow && pointer.active) return nearestNode();
  const current = snapIndex >= 0 ? nodes[snapIndex] : null;
  if (current && now < snapNextAt) {
    const point = pointForNode(current);
    return { node: current, index: snapIndex, x: point.x, y: point.y, z: point.z, distance: 0 };
  }
  const picked = chooseFarNode(snapIndex);
  snapNextAt = now + snapInterval();
  return picked;
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
  const projected = projectedPoint(point);
  return { x: viewport.x + projected.x / 100 * viewport.size, y: viewport.y + projected.y / 100 * viewport.size, depth: projected.depth };
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
    if (isPerspective()) cursor.z += (50 - cursor.z) * (1 - Math.exp(-3.5 * dt));
    cursor.vx *= 0.82;
    cursor.vy *= 0.82;
    cursor.vz *= 0.82;
    return;
  }
  if (!Number.isFinite(cursor.driftAngle)) cursor.driftAngle = -0.4;
  const speedScale = Math.max(0, Math.min(2, config.neuralCursorSpeed || 0));
  const motionScale = 0.2 + speedScale * 0.8;
  const roamRadius = cursorRoamRadius(speedScale);
  const targetDistance = isPerspective()
    ? Math.hypot((cursor.roamX ?? 50) - cursor.x, (cursor.roamY ?? 50) - cursor.y, (cursor.roamZ ?? 50) - (cursor.z ?? 50))
    : Math.hypot((cursor.roamX ?? 50) - cursor.x, (cursor.roamY ?? 50) - cursor.y);
  if (!Number.isFinite(cursor.roamX) || !Number.isFinite(cursor.roamY) || (isPerspective() && !Number.isFinite(cursor.roamZ)) || now > (cursor.roamUntil || 0) || targetDistance < 5.5) {
    const target = randomRoamTarget(speedScale);
    cursor.roamX = target.x;
    cursor.roamY = target.y;
    cursor.roamZ = target.z;
    cursor.roamUntil = now + 1150 + Math.random() * 1300;
  }
  const roamPullX = (cursor.roamX - cursor.x) * 0.0026 * motionScale;
  const roamPullY = (cursor.roamY - cursor.y) * 0.0026 * motionScale;
  const roamPullZ = isPerspective() ? ((cursor.roamZ ?? 50) - cursor.z) * 0.0026 * motionScale : 0;
  const outside = isPerspective()
    ? Math.hypot(cursor.x - 50, cursor.y - 50, (cursor.z ?? 50) - 50) / Math.max(1, roamRadius)
    : Math.hypot(cursor.x - 50, cursor.y - 50) / Math.max(1, roamRadius);
  const centerPull = Math.max(0, outside - 0.78) * 0.006 * motionScale;
  const desiredAngle = Math.atan2(roamPullY - (cursor.y - 50) * centerPull, roamPullX - (cursor.x - 50) * centerPull);
  let angleDelta = desiredAngle - cursor.driftAngle;
  angleDelta = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta));
  const turn = angleDelta * 0.045 + Math.sin(now * 0.00045 + cursor.x * 0.021) * 0.004;
  cursor.driftAngle += turn;
  cursor.vx += Math.cos(cursor.driftAngle) * 0.005 * motionScale + roamPullX - (cursor.x - 50) * centerPull;
  cursor.vy += Math.sin(cursor.driftAngle) * 0.005 * motionScale + roamPullY - (cursor.y - 50) * centerPull;
  if (isPerspective()) cursor.vz += roamPullZ - ((cursor.z ?? 50) - 50) * centerPull;
  else cursor.z = 50;
  const speed = isPerspective() ? Math.hypot(cursor.vx, cursor.vy, cursor.vz || 0) : Math.hypot(cursor.vx, cursor.vy);
  const maxSpeed = 0.18 + 0.15 * speedScale;
  if (speed > maxSpeed) {
    cursor.vx = cursor.vx / speed * maxSpeed;
    cursor.vy = cursor.vy / speed * maxSpeed;
    if (isPerspective()) cursor.vz = (cursor.vz || 0) / speed * maxSpeed;
  }
  cursor.x += cursor.vx;
  cursor.y += cursor.vy;
  if (isPerspective()) cursor.z += cursor.vz || 0;
  cursor.vx *= 0.992;
  cursor.vy *= 0.992;
  cursor.vz = (cursor.vz || 0) * 0.992;
  const margin = 8;
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
  if (isPerspective() && (cursor.z < margin || cursor.z > 100 - margin)) {
    cursor.vz *= -0.62;
    cursor.z = clamp(cursor.z, margin, 100 - margin);
  }
}
function nearestNode() {
  let best = null;
  nodes.forEach((node, index) => {
    const point = pointForNode(node);
    const distance = distance3(point, cursor);
    if (!best || distance < best.distance) best = { node, index, x: point.x, y: point.y, z: point.z, distance };
  });
  return best;
}
function activeLinks(effectiveCursor, skipIndex) {
  const radius = influenceRadius();
  const limit = influenceLimit();
  return nodes.map((node, index) => {
    const point = pointForNode(node);
    const distance = distance3(point, effectiveCursor);
    return { node, index, x: point.x, y: point.y, z: point.z, distance, influence: clamp(1 - distance / radius, 0, 1) };
  }).filter((item) => item.influence > 0 && item.index !== skipIndex).sort((a, b) => b.influence - a.influence).slice(0, limit);
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
  projectionAngle = isPerspective() ? now * 0.00016 : 0;
  updateCursor(dt, now);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "${background}";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const ratio = window.devicePixelRatio || 1;
  const snapped = snappedNode(now);
  const nextSnapIndex = snapped ? snapped.index : -1;
  if (config.neuralSnapCursor && nextSnapIndex !== snapIndex) snapPulseAt = now;
  snapIndex = nextSnapIndex;
  const pulse = config.neuralSnapCursor ? pulseState(now) : null;
  const effectiveCursor = snapped ? { x: snapped.x, y: snapped.y, z: snapped.z ?? 50 } : cursor;
  const links = activeLinks(effectiveCursor, snapped ? snapped.index : -1);
  const active = new Map(links.map((item) => [item.index, item.influence]));
  nodes.forEach((node, index) => {
    const targetInfluence = active.get(index) || 0;
    node.renderInfluence = smoothFollow(node.renderInfluence, targetInfluence, 10, dt);
    node.renderCursor = smoothFollow(node.renderCursor, snapped && index === snapped.index ? 1 : 0, 14, dt);
  });
  const cursorPoint = toCanvas(effectiveCursor);
  const cursorRadius = snapped
    ? renderedNodeRadius(snapped.node, ratio, cursorPoint.depth || 0)
    : Math.max(0.8, config.neuralCursorSize || 3.25) * ratio * depthScale(cursorPoint.depth || 0);
  ctx.strokeStyle = config.neuralLineColor;
  ctx.lineCap = "round";
  links.forEach((item, index) => {
    const point = toCanvas(item);
    const rawLocal = pulse && pulse.active ? (pulse.progress - index * 0.024) / 0.68 : 1;
    const local = pulse && pulse.active ? easeOutCubic(rawLocal) : 1;
    if (local <= 0.001) return;
    const lineAlpha = clamp(config.neuralLineOpacity, 0, 1) * (0.14 + item.influence * 0.86);
    const electric = pulse && pulse.active ? Math.sin(clamp(rawLocal, 0, 1) * Math.PI) : 0;
    ctx.globalAlpha = lineAlpha * Math.min(1, local * (1.05 + electric * 0.38));
    ctx.lineWidth = Math.max(0.35, config.neuralLineWidth || 1) * ratio * (0.72 + item.influence * 0.62);
    const segment = trimmedSegment(cursorPoint, point, cursorRadius, renderedNodeRadius(item.node, ratio, point.depth || 0), ctx.lineWidth);
    if (!segment) return;
    const targetX = segment.start.x + (segment.end.x - segment.start.x) * local;
    const targetY = segment.start.y + (segment.end.y - segment.start.y) * local;
    ctx.beginPath();
    ctx.moveTo(segment.start.x, segment.start.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    if (pulse && pulse.active && electric > 0.08) {
      const head = clamp(local, 0, 1);
      const tail = clamp(head - 0.18, 0, 1);
      ctx.globalAlpha = lineAlpha * electric;
      ctx.lineWidth *= 1.55;
      ctx.beginPath();
      ctx.moveTo(segment.start.x + (segment.end.x - segment.start.x) * tail, segment.start.y + (segment.end.y - segment.start.y) * tail);
      ctx.lineTo(segment.start.x + (segment.end.x - segment.start.x) * head, segment.start.y + (segment.end.y - segment.start.y) * head);
      ctx.stroke();
    }
  });
  ctx.fillStyle = config.neuralNodeColor;
  const orderedNodes = isPerspective()
    ? nodes.map((node, index) => ({ node, index, point: toCanvas(pointForNode(node)) })).sort((a, b) => a.point.depth - b.point.depth)
    : nodes.map((node, index) => ({ node, index, point: toCanvas(pointForNode(node)) }));
  orderedNodes.forEach(({ node, index, point }) => {
    const influence = node.renderInfluence;
    const cursorBlend = node.renderCursor;
    const twinkle = 0.5 + Math.sin(now * 0.0021 + node.pulse) * 0.5;
    const size = renderedNodeRadius(node, ratio, point.depth || 0);
    if (size <= 0.02) return;
    ctx.fillStyle = mixColor(config.neuralNodeColor, config.neuralCursorColor, cursorBlend);
    const depthAlpha = isPerspective() ? clamp(0.48 + (point.depth + 1.2) * 0.2, 0.34, 0.95) : 1;
    const nodeAlpha = clamp(config.neuralNodeOpacity, 0, 1) * depthAlpha * (0.18 + influence * 0.8 + twinkle * 0.12);
    const cursorAlpha = clamp(config.neuralCursorOpacity, 0, 1);
    ctx.globalAlpha = nodeAlpha + (cursorAlpha - nodeAlpha) * cursorBlend;
    drawNodeShape(point, size);
  });
  if (!snapped) {
    ctx.fillStyle = config.neuralCursorColor;
    ctx.globalAlpha = clamp(config.neuralCursorOpacity, 0, 1);
    drawNodeShape(cursorPoint, Math.max(0.8, config.neuralCursorSize || 3.25) * ratio * depthScale(cursorPoint.depth || 0) * (1 + Math.sin(now * 0.0042) * 0.035));
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
