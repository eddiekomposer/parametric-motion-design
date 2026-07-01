// puzzle effect module. Loaded before the main UI script.
var puzzleDefaults = {
  puzzleMotionDurationMs: 1150,
  puzzleMotionIntervalMs: 2400,
  puzzleStrokeWidth: 0.16,
  puzzleStrokeColor: "#8F959E",
  puzzleStrokeOpacity: 0.96,
};

var puzzleControlDefs = [
  { key: "puzzleMotionDurationMs", label: "动效时长", min: 450, max: 2800, step: 50, tip: "控制一次插入、旋转、居中和淡出的总时长。" },
  { key: "puzzleMotionIntervalMs", label: "动效间隔", min: 800, max: 5200, step: 100, tip: "控制新拼图出现的周期。" },
  { key: "puzzleStrokeWidth", label: "线框粗细", min: 0.03, max: 0.72, step: 0.01, tip: "控制拼图线框的描边宽度。描边会压在拼图轮廓内部。" },
  { key: "puzzleStrokeColor", alphaKey: "puzzleStrokeOpacity", type: "colorAlpha", label: "线框颜色", tip: "控制拼图线框颜色和透明度。" },
];

var puzzleDirections = {
  top: { x: 0, y: -1, angle: -Math.PI / 2, opposite: "bottom" },
  right: { x: 1, y: 0, angle: 0, opposite: "left" },
  bottom: { x: 0, y: 1, angle: Math.PI / 2, opposite: "top" },
};

var puzzleAllDirections = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

var puzzleOppositeSide = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

function preparePuzzleEffect() {
  hideParticles();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  state.samples = [];
  state.coefficients = [];
  state.puzzleSystem = {
    cache: [puzzleInitialState()],
    lastCycle: -1,
    lastFrame: null,
  };
}

function puzzleInitialState() {
  const first = puzzleCreatePiece(1, "right", 1);
  first.x = 0;
  first.y = 0;
  first.angle = 0;
  return { pieces: [first], activeId: first.id, nextId: 2 };
}

function puzzleCreatePiece(id, matchSide, matchValue) {
  const rng = seededRandom(`puzzle-piece|${id}|${matchSide || "free"}`);
  const sides = { top: 0, right: 0, bottom: 0, left: 0 };
  ["top", "right", "bottom", "left"].forEach((side) => {
    sides[side] = rng() > 0.5 ? 1 : -1;
  });
  if (matchSide) sides[matchSide] = matchValue || 1;
  return { id, x: 0, y: 0, angle: 0, born: id, sides };
}

function puzzleEnsureCycle(cycle) {
  const system = state.puzzleSystem || (state.puzzleSystem = { cache: [puzzleInitialState()] });
  while (system.cache.length <= cycle + 1) {
    const previous = system.cache[system.cache.length - 1];
    system.cache.push(puzzleNextState(previous, system.cache.length - 1).after);
  }
}

function puzzleNextState(previous, cycle) {
  const beforePieces = previous.pieces.map(puzzleClonePiece);
  const active = beforePieces.find((piece) => piece.id === previous.activeId) || beforePieces[beforePieces.length - 1];
  const insertion = puzzleChooseInsertion(active, beforePieces, previous.nextId, cycle);
  const directionName = insertion.directionName;
  const direction = puzzleDirections[directionName];
  const targetAngle = -direction.angle;
  const newPiece = insertion.newPiece;
  const combined = [...beforePieces, newPiece];
  const target = puzzleRotatePoint({ x: newPiece.x, y: newPiece.y }, targetAngle);
  const transformed = combined.map((piece) => {
    const point = puzzleRotatePoint(piece, targetAngle);
    return {
      ...puzzleClonePiece(piece),
      x: point.x - target.x,
      y: point.y - target.y,
      angle: puzzleNormalizeAngle(piece.angle + targetAngle),
    };
  });
  const oldest = combined.length > 2 ? combined.reduce((best, piece) => piece.id < best.id ? piece : best, combined[0]) : null;
  const afterPieces = oldest ? transformed.filter((piece) => piece.id !== oldest.id) : transformed;
  return {
    before: beforePieces,
    newPiece,
    directionName,
    targetAngle,
    target,
    oldestId: oldest?.id ?? null,
    after: { pieces: afterPieces, activeId: newPiece.id, nextId: previous.nextId + 1 },
  };
}

function puzzleChooseDirection(active, pieces, cycle) {
  return puzzleChooseInsertion(active, pieces, Number(active.id || 1) + cycle + 1, cycle).directionName;
}

function puzzleChooseInsertion(active, pieces, nextId, cycle) {
  const occupied = new Set(pieces.filter((piece) => piece.id !== active.id).map((piece) => `${Math.round(piece.x - active.x)},${Math.round(piece.y - active.y)}`));
  const choices = ["right", "top", "bottom"]
    .map((directionName) => ({
      directionName,
      sort: seededRandom(`puzzle-direction|${cycle}|${active.id}|${directionName}`)(),
    }))
    .sort((a, b) => a.sort - b.sort);
  for (const choice of choices) {
    const dir = puzzleDirections[choice.directionName];
    if (occupied.has(`${dir.x},${dir.y}`)) continue;
    const newPiece = puzzleBuildMatchingPiece(nextId, active, pieces, choice.directionName);
    if (newPiece && puzzleValidateContacts([...pieces, newPiece])) return { directionName: choice.directionName, newPiece };
  }
  const fallbackDirection = choices.find((choice) => {
    const dir = puzzleDirections[choice.directionName];
    return !occupied.has(`${dir.x},${dir.y}`);
  })?.directionName || "right";
  return {
    directionName: fallbackDirection,
    newPiece: puzzleBuildMatchingPiece(nextId, active, pieces, fallbackDirection, true),
  };
}

function puzzleBuildMatchingPiece(id, active, pieces, directionName, force = false) {
  const direction = puzzleDirections[directionName];
  const newPiece = puzzleCreatePiece(id, null, 1);
  newPiece.x = active.x + direction.x;
  newPiece.y = active.y + direction.y;
  newPiece.angle = active.angle;
  const constraints = [];
  pieces.forEach((neighbor) => {
    const neighborDirection = puzzleDirectionBetween(newPiece, neighbor);
    if (!neighborDirection) return;
    const newLocalSide = puzzleLocalSideForWorld(newPiece, neighborDirection);
    const neighborLocalSide = puzzleLocalSideForWorld(neighbor, puzzleOppositeSide[neighborDirection]);
    const neighborValue = neighbor.sides[neighborLocalSide];
    if (!neighborValue) return;
    constraints.push({ side: newLocalSide, value: -neighborValue });
  });
  const seen = new Map();
  for (const constraint of constraints) {
    const current = seen.get(constraint.side);
    if (current != null && current !== constraint.value && !force) return null;
    seen.set(constraint.side, constraint.value);
  }
  seen.forEach((value, side) => { newPiece.sides[side] = value; });
  return newPiece;
}

function puzzleValidateContacts(pieces) {
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const direction = puzzleDirectionBetween(pieces[i], pieces[j]);
      if (!direction) continue;
      const aSide = puzzleLocalSideForWorld(pieces[i], direction);
      const bSide = puzzleLocalSideForWorld(pieces[j], puzzleOppositeSide[direction]);
      if (!pieces[i].sides[aSide] || !pieces[j].sides[bSide]) return false;
      if (pieces[i].sides[aSide] + pieces[j].sides[bSide] !== 0) return false;
    }
  }
  return true;
}

function puzzleDirectionBetween(from, to) {
  const dx = Math.round(to.x - from.x);
  const dy = Math.round(to.y - from.y);
  return Object.entries(puzzleAllDirections).find(([, dir]) => dir.x === dx && dir.y === dy)?.[0] || null;
}

function puzzleLocalSideForWorld(piece, worldSide) {
  const worldIndex = ["top", "right", "bottom", "left"].indexOf(worldSide);
  const turns = puzzleQuarterTurns(piece.angle || 0);
  return ["top", "right", "bottom", "left"][((worldIndex - turns) % 4 + 4) % 4];
}

function puzzleQuarterTurns(angle) {
  const quarter = Math.PI / 2;
  return ((Math.round(angle / quarter) % 4) + 4) % 4;
}

function renderPuzzleEffect(now) {
  hideParticles();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  showParticleCanvas();
  resizeParticleCanvas();
  const ctx = particleCanvas.getContext("2d");
  ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  const interval = Math.max(800, Number(config.puzzleMotionIntervalMs) || puzzleDefaults.puzzleMotionIntervalMs);
  const duration = Math.min(Math.max(260, Number(config.puzzleMotionDurationMs) || puzzleDefaults.puzzleMotionDurationMs), interval);
  const elapsed = now - state.startedAt;
  const cycle = Math.max(0, Math.floor(elapsed / interval));
  const local = ((elapsed % interval) + interval) % interval;
  const raw = clamp(local / duration, 0, 1);
  puzzleEnsureCycle(cycle);
  const system = state.puzzleSystem;
  const previous = system.cache[cycle];
  const transition = puzzleNextState(previous, cycle);
  if (local > duration) {
    const settled = system.cache[cycle + 1].pieces.map((piece) => ({ ...piece, alpha: 1 }));
    system.lastFrame = settled;
    puzzleDrawPieces(ctx, settled);
    window.__motionDebug.puzzlePieces = system.cache[cycle + 1].pieces.length;
    return;
  }
  const rotateProgress = easedSegment(0, 0.46, raw);
  const moveProgress = easedSegment(0.3, 0.78, raw);
  const fadeIn = easedSegment(0, 0.3, raw);
  const fadeOut = easedSegment(0.72, 1, raw);
  const angle = transition.targetAngle * rotateProgress;
  const fullTarget = transition.target || { x: 1, y: 0 };
  const pieces = [...transition.before, transition.newPiece].map((piece) => {
    const point = puzzleRotatePoint(piece, angle);
    const isNew = piece.id === transition.newPiece.id;
    const isOldest = piece.id === transition.oldestId;
    const alpha = (isNew ? fadeIn : 1) * (isOldest ? (1 - fadeOut) : 1);
    return {
      ...puzzleClonePiece(piece),
      x: point.x - fullTarget.x * moveProgress,
      y: point.y - fullTarget.y * moveProgress,
      angle: puzzleNormalizeAngle(piece.angle + angle),
      alpha,
    };
  }).filter((piece) => piece.alpha > 0.01);
  system.lastFrame = pieces;
  puzzleDrawPieces(ctx, pieces);
  window.__motionDebug.puzzlePieces = pieces.length;
  window.__motionDebug.puzzleCycle = cycle;
}

function puzzleDrawPieces(ctx, pieces) {
  const viewport = state.particleSystem.viewport;
  const size = 17.5;
  const spacing = size;
  const visibleStrokeWidth = Math.max(0.03, Number(config.puzzleStrokeWidth) || 0.16) * (viewport.size / 100);
  ctx.save();
  ctx.lineWidth = visibleStrokeWidth * 2;
  ctx.strokeStyle = config.puzzleStrokeColor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  pieces.forEach((piece) => {
    const center = {
      x: viewport.x + (50 + piece.x * spacing) / 100 * viewport.size,
      y: viewport.y + (50 + piece.y * spacing) / 100 * viewport.size,
    };
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(piece.angle || 0);
    ctx.scale(viewport.size / 100, viewport.size / 100);
    ctx.globalAlpha = clamp(Number(config.puzzleStrokeOpacity) || 1, 0, 1) * clamp(piece.alpha ?? 1, 0, 1);
    puzzleTracePiece(ctx, size, piece.sides);
    ctx.save();
    ctx.clip();
    puzzleTracePiece(ctx, size, piece.sides);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

function puzzleTracePiece(ctx, size, sides) {
  const half = size / 2;
  const knob = size * 0.22;
  const span = size * 0.46;
  ctx.beginPath();
  ctx.moveTo(-half, -half);
  puzzleTraceHorizontal(ctx, -half, half, -half, sides.top || 0, -1, knob, span);
  puzzleTraceVertical(ctx, half, -half, half, sides.right || 0, 1, knob, span);
  puzzleTraceHorizontal(ctx, half, -half, half, sides.bottom || 0, 1, knob, span);
  puzzleTraceVertical(ctx, -half, half, -half, sides.left || 0, -1, knob, span);
  ctx.closePath();
}

function puzzleTraceHorizontal(ctx, fromX, toX, y, connector, outwardY, knob, span) {
  const dir = Math.sign(toX - fromX) || 1;
  const mid = (fromX + toX) / 2;
  const a = mid - span / 2 * dir;
  const b = mid + span / 2 * dir;
  const neck = span * 0.22;
  ctx.lineTo(a, y);
  if (!connector) {
    ctx.lineTo(b, y);
  } else {
    const depth = knob * outwardY * connector;
    ctx.bezierCurveTo(a + neck * 0.54 * dir, y, a + neck * 0.54 * dir, y + depth * 0.46, mid - neck * 0.32 * dir, y + depth * 0.58);
    ctx.bezierCurveTo(mid - neck * 0.72 * dir, y + depth, mid + neck * 0.72 * dir, y + depth, mid + neck * 0.32 * dir, y + depth * 0.58);
    ctx.bezierCurveTo(b - neck * 0.54 * dir, y + depth * 0.46, b - neck * 0.54 * dir, y, b, y);
  }
  ctx.lineTo(toX, y);
}

function puzzleTraceVertical(ctx, x, fromY, toY, connector, outwardX, knob, span) {
  const dir = Math.sign(toY - fromY) || 1;
  const mid = (fromY + toY) / 2;
  const a = mid - span / 2 * dir;
  const b = mid + span / 2 * dir;
  const neck = span * 0.22;
  ctx.lineTo(x, a);
  if (!connector) {
    ctx.lineTo(x, b);
  } else {
    const depth = knob * outwardX * connector;
    ctx.bezierCurveTo(x, a + neck * 0.54 * dir, x + depth * 0.46, a + neck * 0.54 * dir, x + depth * 0.58, mid - neck * 0.32 * dir);
    ctx.bezierCurveTo(x + depth, mid - neck * 0.72 * dir, x + depth, mid + neck * 0.72 * dir, x + depth * 0.58, mid + neck * 0.32 * dir);
    ctx.bezierCurveTo(x + depth * 0.46, b - neck * 0.54 * dir, x, b - neck * 0.54 * dir, x, b);
  }
  ctx.lineTo(x, toY);
}

function puzzlePiecePolyline(piece, size = 17.5) {
  const points = [];
  const half = size / 2;
  const knob = size * 0.22;
  const span = size * 0.46;
  const add = (x, y) => points.push({ x, y });
  const addHorizontal = (fromX, toX, y, connector, outwardY) => {
    const dir = Math.sign(toX - fromX) || 1;
    const mid = (fromX + toX) / 2;
    const a = mid - span / 2 * dir;
    const b = mid + span / 2 * dir;
    add(a, y);
    if (connector) {
      const depth = knob * outwardY * connector;
      add(mid - span * 0.22 * dir, y + depth);
      add(mid, y + depth);
      add(mid + span * 0.22 * dir, y + depth);
    }
    add(b, y);
    add(toX, y);
  };
  const addVertical = (x, fromY, toY, connector, outwardX) => {
    const dir = Math.sign(toY - fromY) || 1;
    const mid = (fromY + toY) / 2;
    const a = mid - span / 2 * dir;
    const b = mid + span / 2 * dir;
    add(x, a);
    if (connector) {
      const depth = knob * outwardX * connector;
      add(x + depth, mid - span * 0.22 * dir);
      add(x + depth, mid);
      add(x + depth, mid + span * 0.22 * dir);
    }
    add(x, b);
    add(x, toY);
  };
  add(-half, -half);
  addHorizontal(-half, half, -half, piece.sides.top || 0, -1);
  addVertical(half, -half, half, piece.sides.right || 0, 1);
  addHorizontal(half, -half, half, piece.sides.bottom || 0, 1);
  addVertical(-half, half, -half, piece.sides.left || 0, -1);
  return points.map((point) => {
    const rotated = puzzleRotatePoint(point, piece.angle || 0);
    return { x: 50 + piece.x * size + rotated.x, y: 50 + piece.y * size + rotated.y };
  });
}

function generatePuzzleStandaloneHTML() {
  const standaloneConfig = {
    puzzleMotionDurationMs: config.puzzleMotionDurationMs,
    puzzleMotionIntervalMs: config.puzzleMotionIntervalMs,
    puzzleStrokeWidth: config.puzzleStrokeWidth,
    puzzleStrokeColor: config.puzzleStrokeColor,
    puzzleStrokeOpacity: config.puzzleStrokeOpacity,
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Puzzle Motion</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #090a0d; overflow: hidden; }
    canvas { width: 100vw; height: 100vh; display: block; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
const config = ${JSON.stringify(standaloneConfig)};
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const puzzleDirections = ${JSON.stringify(puzzleDirections)};
const puzzleAllDirections = ${JSON.stringify(puzzleAllDirections)};
const puzzleOppositeSide = ${JSON.stringify(puzzleOppositeSide)};
let viewport = { x: 0, y: 0, size: 1 };
let startedAt = performance.now();
const system = { cache: [puzzleInitialState()] };
function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function random() {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return ((h >>> 0) % 1000000) / 1000000;
  };
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function cubicBezierAxis(t, p1, p2) {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}
function standardBezierEase(value) {
  const target = clamp(value, 0, 1);
  let low = 0, high = 1, t = target;
  for (let i = 0; i < 16; i += 1) {
    t = (low + high) / 2;
    const x = cubicBezierAxis(t, 0.2, 0);
    if (x < target) low = t;
    else high = t;
  }
  return cubicBezierAxis(t, 0, 1);
}
function easedSegment(edge0, edge1, value) {
  return standardBezierEase(clamp((value - edge0) / Math.max(0.000001, edge1 - edge0), 0, 1));
}
${puzzleStandaloneCoreSource()}
function resize() {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(innerWidth * ratio));
  const height = Math.max(1, Math.round(innerHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const size = Math.min(width, height) * 0.72;
  viewport = { x: (width - size) / 2, y: (height - size) / 2, size };
}
function draw(now) {
  resize();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const interval = Math.max(800, config.puzzleMotionIntervalMs);
  const duration = Math.min(Math.max(260, config.puzzleMotionDurationMs), interval);
  const elapsed = now - startedAt;
  const cycle = Math.max(0, Math.floor(elapsed / interval));
  const local = ((elapsed % interval) + interval) % interval;
  const raw = clamp(local / duration, 0, 1);
  puzzleEnsureCycle(cycle);
  if (local > duration) {
    puzzleDrawPieces(system.cache[cycle + 1].pieces.map((piece) => ({ ...piece, alpha: 1 })));
    requestAnimationFrame(draw);
    return;
  }
  const previous = system.cache[cycle];
  const transition = puzzleNextState(previous, cycle);
  const rotateProgress = easedSegment(0, 0.46, raw);
  const moveProgress = easedSegment(0.3, 0.78, raw);
  const fadeIn = easedSegment(0, 0.3, raw);
  const fadeOut = easedSegment(0.72, 1, raw);
  const angle = transition.targetAngle * rotateProgress;
  const pieces = [...transition.before, transition.newPiece].map((piece) => {
    const point = puzzleRotatePoint(piece, angle);
    const isNew = piece.id === transition.newPiece.id;
    const isOldest = piece.id === transition.oldestId;
    return {
      ...puzzleClonePiece(piece),
      x: point.x - transition.target.x * moveProgress,
      y: point.y - transition.target.y * moveProgress,
      angle: puzzleNormalizeAngle(piece.angle + angle),
      alpha: (isNew ? fadeIn : 1) * (isOldest ? (1 - fadeOut) : 1),
    };
  }).filter((piece) => piece.alpha > 0.01);
  puzzleDrawPieces(pieces);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
  <\/script>
</body>
</html>`;
}

function puzzleStandaloneCoreSource() {
  return `
function puzzleInitialState() {
  const first = puzzleCreatePiece(1, "right", 1);
  first.x = 0; first.y = 0; first.angle = 0;
  return { pieces: [first], activeId: first.id, nextId: 2 };
}
function puzzleCreatePiece(id, matchSide, matchValue) {
  const rng = seededRandom("puzzle-piece|" + id + "|" + (matchSide || "free"));
  const sides = { top: 0, right: 0, bottom: 0, left: 0 };
  ["top", "right", "bottom", "left"].forEach((side) => { sides[side] = rng() > 0.5 ? 1 : -1; });
  if (matchSide) sides[matchSide] = matchValue || 1;
  return { id, x: 0, y: 0, angle: 0, born: id, sides };
}
function puzzleClonePiece(piece) { return { ...piece, sides: { ...piece.sides } }; }
function puzzleEnsureCycle(cycle) {
  while (system.cache.length <= cycle + 1) {
    const previous = system.cache[system.cache.length - 1];
    system.cache.push(puzzleNextState(previous, system.cache.length - 1).after);
  }
}
function puzzleNextState(previous, cycle) {
  const before = previous.pieces.map(puzzleClonePiece);
  const active = before.find((piece) => piece.id === previous.activeId) || before[before.length - 1];
  const insertion = puzzleChooseInsertion(active, before, previous.nextId, cycle);
  const directionName = insertion.directionName;
  const direction = puzzleDirections[directionName];
  const targetAngle = -direction.angle;
  const newPiece = insertion.newPiece;
  const combined = [...before, newPiece];
  const target = puzzleRotatePoint({ x: newPiece.x, y: newPiece.y }, targetAngle);
  const transformed = combined.map((piece) => {
    const point = puzzleRotatePoint(piece, targetAngle);
    return { ...puzzleClonePiece(piece), x: point.x - target.x, y: point.y - target.y, angle: puzzleNormalizeAngle(piece.angle + targetAngle) };
  });
  const oldest = combined.length > 2 ? combined.reduce((best, piece) => piece.id < best.id ? piece : best, combined[0]) : null;
  return { before, newPiece, targetAngle, target, oldestId: oldest && oldest.id, after: { pieces: oldest ? transformed.filter((piece) => piece.id !== oldest.id) : transformed, activeId: newPiece.id, nextId: previous.nextId + 1 } };
}
function puzzleChooseDirection(active, pieces, cycle) {
  return puzzleChooseInsertion(active, pieces, Number(active.id || 1) + cycle + 1, cycle).directionName;
}
function puzzleChooseInsertion(active, pieces, nextId, cycle) {
  const occupied = new Set(pieces.filter((piece) => piece.id !== active.id).map((piece) => Math.round(piece.x - active.x) + "," + Math.round(piece.y - active.y)));
  const choices = ["right", "top", "bottom"].map((directionName) => ({ directionName, sort: seededRandom("puzzle-direction|" + cycle + "|" + active.id + "|" + directionName)() })).sort((a, b) => a.sort - b.sort);
  for (const choice of choices) {
    const dir = puzzleDirections[choice.directionName];
    if (occupied.has(dir.x + "," + dir.y)) continue;
    const newPiece = puzzleBuildMatchingPiece(nextId, active, pieces, choice.directionName);
    if (newPiece && puzzleValidateContacts([...pieces, newPiece])) return { directionName: choice.directionName, newPiece };
  }
  const fallbackDirection = (choices.find((choice) => {
    const dir = puzzleDirections[choice.directionName];
    return !occupied.has(dir.x + "," + dir.y);
  }) || choices[0] || { directionName: "right" }).directionName;
  return { directionName: fallbackDirection, newPiece: puzzleBuildMatchingPiece(nextId, active, pieces, fallbackDirection, true) };
}
function puzzleBuildMatchingPiece(id, active, pieces, directionName, force) {
  const direction = puzzleDirections[directionName];
  const newPiece = puzzleCreatePiece(id, null, 1);
  newPiece.x = active.x + direction.x;
  newPiece.y = active.y + direction.y;
  newPiece.angle = active.angle;
  const seen = new Map();
  for (const neighbor of pieces) {
    const neighborDirection = puzzleDirectionBetween(newPiece, neighbor);
    if (!neighborDirection) continue;
    const newLocalSide = puzzleLocalSideForWorld(newPiece, neighborDirection);
    const neighborLocalSide = puzzleLocalSideForWorld(neighbor, puzzleOppositeSide[neighborDirection]);
    const value = -neighbor.sides[neighborLocalSide];
    const current = seen.get(newLocalSide);
    if (current != null && current !== value && !force) return null;
    seen.set(newLocalSide, value);
  }
  seen.forEach((value, side) => { newPiece.sides[side] = value; });
  return newPiece;
}
function puzzleValidateContacts(pieces) {
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const direction = puzzleDirectionBetween(pieces[i], pieces[j]);
      if (!direction) continue;
      const aSide = puzzleLocalSideForWorld(pieces[i], direction);
      const bSide = puzzleLocalSideForWorld(pieces[j], puzzleOppositeSide[direction]);
      if (!pieces[i].sides[aSide] || !pieces[j].sides[bSide]) return false;
      if (pieces[i].sides[aSide] + pieces[j].sides[bSide] !== 0) return false;
    }
  }
  return true;
}
function puzzleDirectionBetween(from, to) {
  const dx = Math.round(to.x - from.x);
  const dy = Math.round(to.y - from.y);
  return Object.entries(puzzleAllDirections).find(([, dir]) => dir.x === dx && dir.y === dy)?.[0] || null;
}
function puzzleLocalSideForWorld(piece, worldSide) {
  const worldIndex = ["top", "right", "bottom", "left"].indexOf(worldSide);
  const turns = puzzleQuarterTurns(piece.angle || 0);
  return ["top", "right", "bottom", "left"][((worldIndex - turns) % 4 + 4) % 4];
}
function puzzleQuarterTurns(angle) {
  const quarter = Math.PI / 2;
  return ((Math.round(angle / quarter) % 4) + 4) % 4;
}
function puzzleRotatePoint(point, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}
function puzzleNormalizeAngle(angle) {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}
function puzzleDrawPieces(pieces) {
  const size = 17.5, spacing = size;
  const visibleStrokeWidth = Math.max(0.03, config.puzzleStrokeWidth || 0.16) * (viewport.size / 100);
  ctx.save();
  ctx.lineWidth = visibleStrokeWidth * 2;
  ctx.strokeStyle = config.puzzleStrokeColor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  pieces.forEach((piece) => {
    const center = { x: viewport.x + (50 + piece.x * spacing) / 100 * viewport.size, y: viewport.y + (50 + piece.y * spacing) / 100 * viewport.size };
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(piece.angle || 0);
    ctx.scale(viewport.size / 100, viewport.size / 100);
    ctx.globalAlpha = clamp(config.puzzleStrokeOpacity == null ? 1 : config.puzzleStrokeOpacity, 0, 1) * clamp(piece.alpha == null ? 1 : piece.alpha, 0, 1);
    puzzleTracePiece(size, piece.sides);
    ctx.save();
    ctx.clip();
    puzzleTracePiece(size, piece.sides);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}
function puzzleTracePiece(size, sides) {
  const half = size / 2, knob = size * 0.22, span = size * 0.46;
  ctx.beginPath();
  ctx.moveTo(-half, -half);
  puzzleTraceHorizontal(-half, half, -half, sides.top || 0, -1, knob, span);
  puzzleTraceVertical(half, -half, half, sides.right || 0, 1, knob, span);
  puzzleTraceHorizontal(half, -half, half, sides.bottom || 0, 1, knob, span);
  puzzleTraceVertical(-half, half, -half, sides.left || 0, -1, knob, span);
  ctx.closePath();
}
function puzzleTraceHorizontal(fromX, toX, y, connector, outwardY, knob, span) {
  const dir = Math.sign(toX - fromX) || 1, mid = (fromX + toX) / 2, a = mid - span / 2 * dir, b = mid + span / 2 * dir;
  const neck = span * 0.22;
  ctx.lineTo(a, y);
  if (!connector) ctx.lineTo(b, y);
  else {
    const depth = knob * outwardY * connector;
    ctx.bezierCurveTo(a + neck * 0.54 * dir, y, a + neck * 0.54 * dir, y + depth * 0.46, mid - neck * 0.32 * dir, y + depth * 0.58);
    ctx.bezierCurveTo(mid - neck * 0.72 * dir, y + depth, mid + neck * 0.72 * dir, y + depth, mid + neck * 0.32 * dir, y + depth * 0.58);
    ctx.bezierCurveTo(b - neck * 0.54 * dir, y + depth * 0.46, b - neck * 0.54 * dir, y, b, y);
  }
  ctx.lineTo(toX, y);
}
function puzzleTraceVertical(x, fromY, toY, connector, outwardX, knob, span) {
  const dir = Math.sign(toY - fromY) || 1, mid = (fromY + toY) / 2, a = mid - span / 2 * dir, b = mid + span / 2 * dir;
  const neck = span * 0.22;
  ctx.lineTo(x, a);
  if (!connector) ctx.lineTo(x, b);
  else {
    const depth = knob * outwardX * connector;
    ctx.bezierCurveTo(x, a + neck * 0.54 * dir, x + depth * 0.46, a + neck * 0.54 * dir, x + depth * 0.58, mid - neck * 0.32 * dir);
    ctx.bezierCurveTo(x + depth, mid - neck * 0.72 * dir, x + depth, mid + neck * 0.72 * dir, x + depth * 0.58, mid + neck * 0.32 * dir);
    ctx.bezierCurveTo(x + depth * 0.46, b - neck * 0.54 * dir, x, b - neck * 0.54 * dir, x, b);
  }
  ctx.lineTo(x, toY);
}
`;
}

function generatePuzzleLottie() {
  const stateForLottie = state.puzzleSystem?.cache?.[0] || puzzleInitialState();
  const layers = stateForLottie.pieces.map((piece, index) => makeLottieShapeLayer(
    `Puzzle Piece ${index + 1}`,
    makeLottiePathShape(puzzlePiecePolyline(piece), true),
    {
      index: index + 1,
      stroke: config.puzzleStrokeColor,
      strokeWidth: Math.max(0.03, Number(config.puzzleStrokeWidth) || 0.16),
      opacity: config.puzzleStrokeOpacity,
    },
  ));
  return makeBasicLottieDocument("Puzzle", layers);
}

function puzzleClonePiece(piece) {
  return { ...piece, sides: { ...piece.sides } };
}

function puzzleRotatePoint(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function puzzleNormalizeAngle(angle) {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}
