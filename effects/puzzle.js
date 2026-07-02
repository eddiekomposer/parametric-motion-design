// puzzle effect module. Loaded before the main UI script.
var puzzleDefaults = {
  puzzleMotionDurationMs: 1150,
  puzzleMotionIntervalMs: 2400,
  puzzleStrokeWidth: 2,
  puzzleStrokeColor: "#8F959E",
  puzzleStrokeOpacity: 0.96,
};

var puzzleControlDefs = [
  { key: "puzzleMotionDurationMs", label: "动效时长", min: 450, max: 2800, step: 50, tip: "控制一次插入、旋转、居中和淡出的总时长。" },
  { key: "puzzleMotionIntervalMs", label: "动效间隔", min: 800, max: 5200, step: 100, tip: "控制新拼图出现的周期。" },
  { key: "puzzleStrokeWidth", label: "线框粗细", min: 0, max: 8, step: 0.1, tip: "控制拼图线框的描边宽度，单位为 dp。描边会压在拼图轮廓内部。" },
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

var puzzleShapeTemplates = [
  { id: "r1c1", sides: { top: 0, right: -1, bottom: -1, left: 0 } },
  { id: "r1c2", sides: { top: 0, right: -1, bottom: 1, left: 1 } },
  { id: "r1c3", sides: { top: 0, right: -1, bottom: 1, left: -1 } },
  { id: "r1c4", sides: { top: 0, right: 0, bottom: -1, left: 1 } },
  { id: "r2c1", sides: { top: 1, right: 1, bottom: -1, left: 0 } },
  { id: "r2c2", sides: { top: -1, right: -1, bottom: 1, left: -1 } },
  { id: "r2c3", sides: { top: -1, right: 1, bottom: 1, left: 1 } },
  { id: "r2c4", sides: { top: 1, right: 0, bottom: 1, left: -1 } },
  { id: "r3c1", sides: { top: 1, right: -1, bottom: 1, left: 0 } },
  { id: "r3c2", sides: { top: -1, right: 1, bottom: -1, left: 1 } },
  { id: "r3c3", sides: { top: -1, right: -1, bottom: 1, left: 1 } },
  { id: "r3c4", sides: { top: -1, right: 0, bottom: -1, left: 1 } },
  { id: "r4c1", sides: { top: -1, right: -1, bottom: -1, left: 0 } },
  { id: "r4c2", sides: { top: 1, right: -1, bottom: -1, left: 1 } },
  { id: "r4c3", sides: { top: -1, right: -1, bottom: -1, left: 1 } },
  { id: "r4c4", sides: { top: 1, right: 0, bottom: -1, left: 1 } },
  { id: "r5c1", sides: { top: 1, right: 1, bottom: 0, left: 0 } },
  { id: "r5c2", sides: { top: 1, right: 1, bottom: 0, left: -1 } },
  { id: "r5c3", sides: { top: 1, right: 1, bottom: 0, left: 1 } },
  { id: "r5c4", sides: { top: 1, right: 0, bottom: 0, left: 1 } },
];

function preparePuzzleEffect() {
  puzzleNormalizeStrokeWidthDp();
  const seed = puzzleCreateRandomSeed("live");
  hideParticles();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideLineEditHandles();
  motionPath.setAttribute("opacity", "0");
  state.samples = [];
  state.coefficients = [];
  state.puzzleSystem = {
    seed,
    cache: [puzzleInitialState(`${seed}|initial`)],
    transitions: [],
    lastCycle: -1,
    lastFrame: null,
  };
}

function puzzleNormalizeStrokeWidthDp() {
  const width = Number(config.puzzleStrokeWidth);
  if (!Number.isFinite(width)) config.puzzleStrokeWidth = puzzleDefaults.puzzleStrokeWidth;
  else if (width < 0) config.puzzleStrokeWidth = 0;
  else config.puzzleStrokeWidth = Math.min(8, width);
}

function puzzleStrokeWidthDp() {
  const width = Number(config.puzzleStrokeWidth);
  if (!Number.isFinite(width)) return puzzleDefaults.puzzleStrokeWidth;
  return clamp(width, 0, 8);
}

function puzzleStrokeWidthLocalUnits(viewport) {
  const ratio = window.devicePixelRatio || 1;
  const canvasPx = puzzleStrokeWidthDp() * ratio;
  return canvasPx / Math.max(0.0001, viewport.size / 100);
}

function puzzleInitialState(randomSeed = "initial") {
  const first = puzzleCreatePiece(1, "right", 1, {}, randomSeed);
  first.x = 0;
  first.y = 0;
  first.angle = 0;
  return { pieces: [first], activeId: first.id, nextId: 2 };
}

function puzzleCreatePiece(id, matchSide, matchValue, requiredSides = {}, randomSeed = "") {
  const required = { ...requiredSides };
  if (matchSide) required[matchSide] = matchValue || 1;
  const template = puzzleChooseShapeTemplate(id, required, randomSeed);
  if (!template) return null;
  return { id, x: 0, y: 0, angle: 0, born: id, templateId: template.id, sides: { ...template.sides } };
}

function puzzleChooseShapeTemplate(id, requiredSides = {}, randomSeed = "") {
  return puzzleMatchingTemplates(id, requiredSides, randomSeed)[0] || null;
}

function puzzleRandomUnit() {
  const cryptoObject = window.crypto || window.msCrypto;
  if (cryptoObject?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoObject.getRandomValues(values);
    return values[0] / 0x100000000;
  }
  return Math.random();
}

function puzzleCreateRandomSeed(label = "") {
  return `${Date.now()}|${Math.floor(puzzleRandomUnit() * 0x100000000)}|${label}`;
}

function puzzleMatchingTemplates(id, requiredSides = {}, randomSeed = "") {
  const entries = Object.entries(requiredSides).filter(([, value]) => value != null);
  const matches = puzzleShapeTemplates.filter((template) => entries.every(([side, value]) => template.sides[side] === value));
  if (!matches.length) return [];
  const random = seededRandom(`puzzle-template|${randomSeed}|${id}|${entries.map(([side, value]) => `${side}:${value}`).join("|")}`);
  return matches
    .map((template) => ({ template, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ template }) => template);
}

function puzzleEnsureCycle(cycle) {
  if (!state.puzzleSystem) {
    const seed = puzzleCreateRandomSeed("live");
    state.puzzleSystem = { seed, cache: [puzzleInitialState(`${seed}|initial`)], transitions: [] };
  }
  const system = state.puzzleSystem;
  if (!system.seed) system.seed = puzzleCreateRandomSeed("live");
  if (!system.transitions) system.transitions = [];
  if (!system.cache?.length) system.cache = [puzzleInitialState(`${system.seed}|initial`)];
  for (let index = 0; index <= cycle; index += 1) {
    if (!system.transitions[index]) {
      const previous = system.cache[index];
      const transition = puzzleNextState(previous, index, `${system.seed}|cycle:${index}`);
      system.transitions[index] = transition;
      system.cache[index + 1] = transition.after;
    }
  }
  while (system.cache.length <= cycle + 1) {
    const previous = system.cache[system.cache.length - 1];
    const index = system.cache.length - 1;
    const transition = puzzleNextState(previous, index, `${system.seed}|cycle:${index}`);
    system.transitions[index] = transition;
    system.cache.push(transition.after);
  }
}

function puzzleNextState(previous, cycle, randomSeed = "") {
  const beforePieces = previous.pieces.map(puzzleClonePiece);
  const active = beforePieces.find((piece) => piece.id === previous.activeId) || beforePieces[beforePieces.length - 1];
  const insertion = puzzleChooseInsertion(active, beforePieces, previous.nextId, cycle, randomSeed);
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
  const oldest = combined.length > 3 ? combined.reduce((best, piece) => piece.id < best.id ? piece : best, combined[0]) : null;
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

function puzzleChooseInsertion(active, pieces, nextId, cycle, randomSeed = "") {
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
    const newPiece = puzzleBuildMatchingPiece(nextId, active, pieces, choice.directionName, `${randomSeed}|${choice.directionName}`);
    if (newPiece && puzzleValidateContacts([...pieces, newPiece])) return { directionName: choice.directionName, newPiece };
  }
  return { directionName: "right", newPiece: puzzleBuildMatchingPiece(nextId, active, [active], "right", `${randomSeed}|right`) };
}

function puzzleBuildMatchingPiece(id, active, pieces, directionName, randomSeed = "") {
  const direction = puzzleDirections[directionName];
  const probe = { id, x: active.x + direction.x, y: active.y + direction.y, angle: active.angle, sides: {} };
  const requiredSides = puzzleRequiredSidesForProbe(probe, pieces);
  if (!requiredSides) return null;
  const candidates = puzzleMatchingTemplates(id, requiredSides, randomSeed).map((template) => ({
    id,
    x: probe.x,
    y: probe.y,
    angle: probe.angle,
    born: id,
    templateId: template.id,
    sides: { ...template.sides },
  }));
  const validCandidates = candidates.filter((piece) => puzzleValidateContacts([...pieces, piece]));
  return validCandidates.find((piece) => puzzleHasFutureInsertion(piece, pieces, directionName, id + 1, `${randomSeed}|future`)) || validCandidates[0] || null;
}

function puzzleRequiredSidesForProbe(probe, pieces) {
  const requiredSides = {};
  pieces.forEach((neighbor) => {
    const neighborDirection = puzzleDirectionBetween(probe, neighbor);
    if (!neighborDirection) return;
    const newLocalSide = puzzleLocalSideForWorld(probe, neighborDirection);
    const neighborLocalSide = puzzleLocalSideForWorld(neighbor, puzzleOppositeSide[neighborDirection]);
    const neighborValue = neighbor.sides[neighborLocalSide];
    if (!neighborValue) {
      requiredSides.__conflict = true;
      return;
    }
    const requiredValue = -neighborValue;
    if (requiredSides[newLocalSide] != null && requiredSides[newLocalSide] !== requiredValue) {
      requiredSides.__conflict = true;
      return;
    }
    requiredSides[newLocalSide] = requiredValue;
  });
  if (requiredSides.__conflict) return null;
  delete requiredSides.__conflict;
  return requiredSides;
}

function puzzleHasFutureInsertion(newPiece, pieces, directionName, nextId, randomSeed = "") {
  const afterPieces = puzzleProjectedAfterPieces(pieces, newPiece, directionName);
  const active = afterPieces.find((piece) => piece.id === newPiece.id);
  if (!active) return false;
  return ["right", "top", "bottom"].some((futureDirectionName) => puzzleCanInsertFrom(active, afterPieces, futureDirectionName, nextId, `${randomSeed}|${futureDirectionName}`));
}

function puzzleProjectedAfterPieces(pieces, newPiece, directionName) {
  const direction = puzzleDirections[directionName];
  const targetAngle = -direction.angle;
  const combined = [...pieces, newPiece];
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
  const oldest = combined.length > 3 ? combined.reduce((best, piece) => piece.id < best.id ? piece : best, combined[0]) : null;
  return oldest ? transformed.filter((piece) => piece.id !== oldest.id) : transformed;
}

function puzzleCanInsertFrom(active, pieces, directionName, nextId, randomSeed = "") {
  const direction = puzzleDirections[directionName];
  const localSide = puzzleLocalSideForWorld(active, directionName);
  if (!active.sides[localSide]) return false;
  const occupied = new Set(pieces.filter((piece) => piece.id !== active.id).map((piece) => `${Math.round(piece.x - active.x)},${Math.round(piece.y - active.y)}`));
  if (occupied.has(`${direction.x},${direction.y}`)) return false;
  const probe = { id: nextId, x: active.x + direction.x, y: active.y + direction.y, angle: active.angle, sides: {} };
  const requiredSides = puzzleRequiredSidesForProbe(probe, pieces);
  return !!requiredSides && puzzleMatchingTemplates(nextId, requiredSides, randomSeed).length > 0;
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
  const transition = system.transitions[cycle];
  if (local > duration) {
    const settled = system.cache[cycle + 1].pieces.map((piece) => ({ ...piece, alpha: 1, fillAlpha: 0 }));
    system.lastFrame = settled;
    puzzleDrawPieces(ctx, settled);
    window.__motionDebug.puzzlePieces = system.cache[cycle + 1].pieces.length;
    return;
  }
  const rotateProgress = easedSegment(0, 0.46, raw);
  const moveProgress = easedSegment(0.3, 0.78, raw);
  const fadeIn = easedSegment(0, 0.3, raw);
  const fadeOut = rotateProgress;
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
      fillAlpha: isNew ? fadeIn * (1 - fadeOut) : 0,
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
  const visibleStrokeWidth = puzzleStrokeWidthLocalUnits(viewport);
  const skipSides = puzzleSharedSidesToSkip(pieces);
  ctx.save();
  ctx.fillStyle = config.puzzleStrokeColor;
  pieces.forEach((piece) => {
    const fillAlpha = clamp(Number(piece.fillAlpha) || 0, 0, 1);
    if (fillAlpha <= 0.01) return;
    const center = {
      x: viewport.x + (50 + piece.x * spacing) / 100 * viewport.size,
      y: viewport.y + (50 + piece.y * spacing) / 100 * viewport.size,
    };
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(piece.angle || 0);
    ctx.scale(viewport.size / 100, viewport.size / 100);
    ctx.globalAlpha = clamp(Number(config.puzzleStrokeOpacity) || 1, 0, 1) * fillAlpha;
    puzzleTracePiece(ctx, size, piece.sides);
    ctx.fill();
    ctx.restore();
  });
  if (visibleStrokeWidth > 0) {
    ctx.lineWidth = visibleStrokeWidth;
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
      puzzleTracePieceStroke(ctx, size, piece.sides, skipSides.get(piece.id));
      ctx.restore();
      ctx.restore();
    });
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function puzzleSharedSidesToSkip(pieces) {
  const skips = new Map();
  const ensure = (piece) => {
    if (!skips.has(piece.id)) skips.set(piece.id, new Set());
    return skips.get(piece.id);
  };
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const a = pieces[i];
      const b = pieces[j];
      const direction = puzzleDirectionBetween(a, b);
      if (!direction) continue;
      const aSide = puzzleLocalSideForWorld(a, direction);
      const bSide = puzzleLocalSideForWorld(b, puzzleOppositeSide[direction]);
      const aAlpha = clamp(a.alpha ?? 1, 0, 1);
      const bAlpha = clamp(b.alpha ?? 1, 0, 1);
      const aOwns = aAlpha === bAlpha ? a.id < b.id : aAlpha > bAlpha;
      if (aOwns) ensure(b).add(bSide);
      else ensure(a).add(aSide);
    }
  }
  return skips;
}

function puzzleTracePiece(ctx, size, sides) {
  const half = size / 2;
  const knob = size * 0.17;
  const span = size * 0.34;
  ctx.beginPath();
  ctx.moveTo(-half, -half);
  puzzleTraceHorizontal(ctx, -half, half, -half, sides.top || 0, -1, knob, span);
  puzzleTraceVertical(ctx, half, -half, half, sides.right || 0, 1, knob, span);
  puzzleTraceHorizontal(ctx, half, -half, half, sides.bottom || 0, 1, knob, span);
  puzzleTraceVertical(ctx, -half, half, -half, sides.left || 0, -1, knob, span);
  ctx.closePath();
}

function puzzleTracePieceStroke(ctx, size, sides, skipSides = new Set()) {
  const half = size / 2;
  const knob = size * 0.17;
  const span = size * 0.34;
  if (!skipSides.has("top")) {
    ctx.beginPath();
    ctx.moveTo(-half, -half);
    puzzleTraceHorizontal(ctx, -half, half, -half, sides.top || 0, -1, knob, span);
    ctx.stroke();
  }
  if (!skipSides.has("right")) {
    ctx.beginPath();
    ctx.moveTo(half, -half);
    puzzleTraceVertical(ctx, half, -half, half, sides.right || 0, 1, knob, span);
    ctx.stroke();
  }
  if (!skipSides.has("bottom")) {
    ctx.beginPath();
    ctx.moveTo(half, half);
    puzzleTraceHorizontal(ctx, half, -half, half, sides.bottom || 0, 1, knob, span);
    ctx.stroke();
  }
  if (!skipSides.has("left")) {
    ctx.beginPath();
    ctx.moveTo(-half, half);
    puzzleTraceVertical(ctx, -half, half, -half, sides.left || 0, -1, knob, span);
    ctx.stroke();
  }
}

function puzzleTraceHorizontal(ctx, fromX, toX, y, connector, outwardY, knob, span) {
  const dir = Math.sign(toX - fromX) || 1;
  const mid = (fromX + toX) / 2;
  const a = mid - span / 2 * dir;
  const b = mid + span / 2 * dir;
  const radiusX = (span / 2) * dir;
  const kappa = 0.5522847498;
  ctx.lineTo(a, y);
  if (!connector) {
    ctx.lineTo(b, y);
  } else {
    const depth = knob * outwardY * connector;
    ctx.bezierCurveTo(a, y + depth * kappa, mid - radiusX * kappa, y + depth, mid, y + depth);
    ctx.bezierCurveTo(mid + radiusX * kappa, y + depth, b, y + depth * kappa, b, y);
  }
  ctx.lineTo(toX, y);
}

function puzzleTraceVertical(ctx, x, fromY, toY, connector, outwardX, knob, span) {
  const dir = Math.sign(toY - fromY) || 1;
  const mid = (fromY + toY) / 2;
  const a = mid - span / 2 * dir;
  const b = mid + span / 2 * dir;
  const radiusY = (span / 2) * dir;
  const kappa = 0.5522847498;
  ctx.lineTo(x, a);
  if (!connector) {
    ctx.lineTo(x, b);
  } else {
    const depth = knob * outwardX * connector;
    ctx.bezierCurveTo(x + depth * kappa, a, x + depth, mid - radiusY * kappa, x + depth, mid);
    ctx.bezierCurveTo(x + depth, mid + radiusY * kappa, x + depth * kappa, b, x, b);
  }
  ctx.lineTo(x, toY);
}

function puzzlePiecePolyline(piece, size = 17.5) {
  const points = [];
  const half = size / 2;
  const knob = size * 0.17;
  const span = size * 0.34;
  const add = (x, y) => points.push({ x, y });
  const addHorizontal = (fromX, toX, y, connector, outwardY) => {
    const dir = Math.sign(toX - fromX) || 1;
    const mid = (fromX + toX) / 2;
    const a = mid - span / 2 * dir;
    const b = mid + span / 2 * dir;
    add(a, y);
    if (connector) {
      const depth = knob * outwardY * connector;
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        const theta = Math.PI * t;
        add(
          mid - Math.cos(theta) * (span / 2) * dir,
          y + Math.sin(theta) * depth,
        );
      }
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
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        const theta = Math.PI * t;
        add(
          x + Math.sin(theta) * depth,
          mid - Math.cos(theta) * (span / 2) * dir,
        );
      }
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
  puzzleNormalizeStrokeWidthDp();
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
const puzzleShapeTemplates = ${JSON.stringify(puzzleShapeTemplates)};
let viewport = { x: 0, y: 0, size: 1 };
let startedAt = performance.now();
const system = { seed: puzzleCreateRandomSeed("standalone"), cache: [], transitions: [] };
system.cache = [puzzleInitialState(system.seed + "|initial")];
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
    puzzleDrawPieces(system.cache[cycle + 1].pieces.map((piece) => ({ ...piece, alpha: 1, fillAlpha: 0 })));
    requestAnimationFrame(draw);
    return;
  }
  const transition = system.transitions[cycle];
  const rotateProgress = easedSegment(0, 0.46, raw);
  const moveProgress = easedSegment(0.3, 0.78, raw);
  const fadeIn = easedSegment(0, 0.3, raw);
  const fadeOut = rotateProgress;
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
      fillAlpha: isNew ? fadeIn * (1 - fadeOut) : 0,
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
  const first = puzzleCreatePiece(1, "right", 1, null, system.seed + "|initial");
  first.x = 0; first.y = 0; first.angle = 0;
  return { pieces: [first], activeId: first.id, nextId: 2 };
}
function puzzleCreatePiece(id, matchSide, matchValue, requiredSides, randomSeed) {
  const required = { ...(requiredSides || {}) };
  if (matchSide) required[matchSide] = matchValue || 1;
  const template = puzzleChooseShapeTemplate(id, required, randomSeed || "");
  if (!template) return null;
  return { id, x: 0, y: 0, angle: 0, born: id, templateId: template.id, sides: { ...template.sides } };
}
function puzzleChooseShapeTemplate(id, requiredSides, randomSeed) {
  return puzzleMatchingTemplates(id, requiredSides, randomSeed || "")[0] || null;
}
function puzzleRandomUnit() {
  const cryptoObject = window.crypto || window.msCrypto;
  if (cryptoObject && cryptoObject.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoObject.getRandomValues(values);
    return values[0] / 0x100000000;
  }
  return Math.random();
}
function puzzleCreateRandomSeed(label) {
  return Date.now() + "|" + Math.floor(puzzleRandomUnit() * 0x100000000) + "|" + (label || "");
}
function puzzleMatchingTemplates(id, requiredSides, randomSeed) {
  const entries = Object.entries(requiredSides || {}).filter(([, value]) => value != null);
  const matches = puzzleShapeTemplates.filter((template) => entries.every(([side, value]) => template.sides[side] === value));
  if (!matches.length) return [];
  const key = entries.map(([side, value]) => side + ":" + value).join("|");
  const random = seededRandom("puzzle-template|" + (randomSeed || "") + "|" + id + "|" + key);
  return matches.map((template) => ({ template, sort: random() })).sort((a, b) => a.sort - b.sort).map(({ template }) => template);
}
function puzzleClonePiece(piece) { return { ...piece, sides: { ...piece.sides } }; }
function puzzleEnsureCycle(cycle) {
  if (!system.transitions) system.transitions = [];
  if (!system.cache.length) system.cache = [puzzleInitialState(system.seed + "|initial")];
  for (let index = 0; index <= cycle; index += 1) {
    if (!system.transitions[index]) {
      const transition = puzzleNextState(system.cache[index], index, system.seed + "|cycle:" + index);
      system.transitions[index] = transition;
      system.cache[index + 1] = transition.after;
    }
  }
  while (system.cache.length <= cycle + 1) {
    const previous = system.cache[system.cache.length - 1];
    const index = system.cache.length - 1;
    const transition = puzzleNextState(previous, index, system.seed + "|cycle:" + index);
    system.transitions[index] = transition;
    system.cache.push(transition.after);
  }
}
function puzzleNextState(previous, cycle, randomSeed) {
  const before = previous.pieces.map(puzzleClonePiece);
  const active = before.find((piece) => piece.id === previous.activeId) || before[before.length - 1];
  const insertion = puzzleChooseInsertion(active, before, previous.nextId, cycle, randomSeed || "");
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
  const oldest = combined.length > 3 ? combined.reduce((best, piece) => piece.id < best.id ? piece : best, combined[0]) : null;
  return { before, newPiece, targetAngle, target, oldestId: oldest && oldest.id, after: { pieces: oldest ? transformed.filter((piece) => piece.id !== oldest.id) : transformed, activeId: newPiece.id, nextId: previous.nextId + 1 } };
}
function puzzleChooseDirection(active, pieces, cycle) {
  return puzzleChooseInsertion(active, pieces, Number(active.id || 1) + cycle + 1, cycle).directionName;
}
function puzzleChooseInsertion(active, pieces, nextId, cycle, randomSeed) {
  const occupied = new Set(pieces.filter((piece) => piece.id !== active.id).map((piece) => Math.round(piece.x - active.x) + "," + Math.round(piece.y - active.y)));
  const choices = ["right", "top", "bottom"].map((directionName) => ({ directionName, sort: seededRandom("puzzle-direction|" + cycle + "|" + active.id + "|" + directionName)() })).sort((a, b) => a.sort - b.sort);
  for (const choice of choices) {
    const dir = puzzleDirections[choice.directionName];
    if (occupied.has(dir.x + "," + dir.y)) continue;
    const newPiece = puzzleBuildMatchingPiece(nextId, active, pieces, choice.directionName, (randomSeed || "") + "|" + choice.directionName);
    if (newPiece && puzzleValidateContacts([...pieces, newPiece])) return { directionName: choice.directionName, newPiece };
  }
  return { directionName: "right", newPiece: puzzleBuildMatchingPiece(nextId, active, [active], "right", (randomSeed || "") + "|right") };
}
function puzzleBuildMatchingPiece(id, active, pieces, directionName, randomSeed) {
  const direction = puzzleDirections[directionName];
  const probe = { id, x: active.x + direction.x, y: active.y + direction.y, angle: active.angle, sides: {} };
  const requiredSides = puzzleRequiredSidesForProbe(probe, pieces);
  if (!requiredSides) return null;
  const candidates = puzzleMatchingTemplates(id, requiredSides, randomSeed || "").map((template) => ({ id, x: probe.x, y: probe.y, angle: probe.angle, born: id, templateId: template.id, sides: { ...template.sides } }));
  const validCandidates = candidates.filter((piece) => puzzleValidateContacts([...pieces, piece]));
  return validCandidates.find((piece) => puzzleHasFutureInsertion(piece, pieces, directionName, id + 1, (randomSeed || "") + "|future")) || validCandidates[0] || null;
}
function puzzleRequiredSidesForProbe(probe, pieces) {
  const requiredSides = {};
  for (const neighbor of pieces) {
    const neighborDirection = puzzleDirectionBetween(probe, neighbor);
    if (!neighborDirection) continue;
    const newLocalSide = puzzleLocalSideForWorld(probe, neighborDirection);
    const neighborLocalSide = puzzleLocalSideForWorld(neighbor, puzzleOppositeSide[neighborDirection]);
    const neighborValue = neighbor.sides[neighborLocalSide];
    if (!neighborValue) return null;
    const requiredValue = -neighborValue;
    if (requiredSides[newLocalSide] != null && requiredSides[newLocalSide] !== requiredValue) return null;
    requiredSides[newLocalSide] = requiredValue;
  }
  return requiredSides;
}
function puzzleHasFutureInsertion(newPiece, pieces, directionName, nextId, randomSeed) {
  const afterPieces = puzzleProjectedAfterPieces(pieces, newPiece, directionName);
  const active = afterPieces.find((piece) => piece.id === newPiece.id);
  if (!active) return false;
  return ["right", "top", "bottom"].some((futureDirectionName) => puzzleCanInsertFrom(active, afterPieces, futureDirectionName, nextId, (randomSeed || "") + "|" + futureDirectionName));
}
function puzzleProjectedAfterPieces(pieces, newPiece, directionName) {
  const direction = puzzleDirections[directionName];
  const targetAngle = -direction.angle;
  const combined = [...pieces, newPiece];
  const target = puzzleRotatePoint({ x: newPiece.x, y: newPiece.y }, targetAngle);
  const transformed = combined.map((piece) => {
    const point = puzzleRotatePoint(piece, targetAngle);
    return { ...puzzleClonePiece(piece), x: point.x - target.x, y: point.y - target.y, angle: puzzleNormalizeAngle(piece.angle + targetAngle) };
  });
  const oldest = combined.length > 3 ? combined.reduce((best, piece) => piece.id < best.id ? piece : best, combined[0]) : null;
  return oldest ? transformed.filter((piece) => piece.id !== oldest.id) : transformed;
}
function puzzleCanInsertFrom(active, pieces, directionName, nextId, randomSeed) {
  const direction = puzzleDirections[directionName];
  const localSide = puzzleLocalSideForWorld(active, directionName);
  if (!active.sides[localSide]) return false;
  const occupied = new Set(pieces.filter((piece) => piece.id !== active.id).map((piece) => Math.round(piece.x - active.x) + "," + Math.round(piece.y - active.y)));
  if (occupied.has(direction.x + "," + direction.y)) return false;
  const probe = { id: nextId, x: active.x + direction.x, y: active.y + direction.y, angle: active.angle, sides: {} };
  const requiredSides = puzzleRequiredSidesForProbe(probe, pieces);
  return !!requiredSides && puzzleMatchingTemplates(nextId, requiredSides, randomSeed || "").length > 0;
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
function puzzleStrokeWidthDp() {
  const width = Number(config.puzzleStrokeWidth);
  if (!Number.isFinite(width)) return 2;
  return clamp(width, 0, 8);
}
function puzzleDrawPieces(pieces) {
  const size = 17.5, spacing = size;
  const visibleStrokeWidth = puzzleStrokeWidthDp() * (window.devicePixelRatio || 1) / Math.max(0.0001, viewport.size / 100);
  const skipSides = puzzleSharedSidesToSkip(pieces);
  ctx.save();
  ctx.fillStyle = config.puzzleStrokeColor;
  pieces.forEach((piece) => {
    const fillAlpha = clamp(Number(piece.fillAlpha) || 0, 0, 1);
    if (fillAlpha <= 0.01) return;
    const center = { x: viewport.x + (50 + piece.x * spacing) / 100 * viewport.size, y: viewport.y + (50 + piece.y * spacing) / 100 * viewport.size };
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(piece.angle || 0);
    ctx.scale(viewport.size / 100, viewport.size / 100);
    ctx.globalAlpha = clamp(config.puzzleStrokeOpacity == null ? 1 : config.puzzleStrokeOpacity, 0, 1) * fillAlpha;
    puzzleTracePiece(size, piece.sides);
    ctx.fill();
    ctx.restore();
  });
  if (visibleStrokeWidth > 0) {
    ctx.lineWidth = visibleStrokeWidth;
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
      puzzleTracePieceStroke(size, piece.sides, skipSides.get(piece.id));
      ctx.restore();
      ctx.restore();
    });
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function puzzleSharedSidesToSkip(pieces) {
  const skips = new Map();
  const ensure = (piece) => {
    if (!skips.has(piece.id)) skips.set(piece.id, new Set());
    return skips.get(piece.id);
  };
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const a = pieces[i], b = pieces[j];
      const direction = puzzleDirectionBetween(a, b);
      if (!direction) continue;
      const aSide = puzzleLocalSideForWorld(a, direction);
      const bSide = puzzleLocalSideForWorld(b, puzzleOppositeSide[direction]);
      const aAlpha = clamp(a.alpha == null ? 1 : a.alpha, 0, 1);
      const bAlpha = clamp(b.alpha == null ? 1 : b.alpha, 0, 1);
      const aOwns = aAlpha === bAlpha ? a.id < b.id : aAlpha > bAlpha;
      if (aOwns) ensure(b).add(bSide);
      else ensure(a).add(aSide);
    }
  }
  return skips;
}
function puzzleTracePiece(size, sides) {
  const half = size / 2, knob = size * 0.17, span = size * 0.34;
  ctx.beginPath();
  ctx.moveTo(-half, -half);
  puzzleTraceHorizontal(-half, half, -half, sides.top || 0, -1, knob, span);
  puzzleTraceVertical(half, -half, half, sides.right || 0, 1, knob, span);
  puzzleTraceHorizontal(half, -half, half, sides.bottom || 0, 1, knob, span);
  puzzleTraceVertical(-half, half, -half, sides.left || 0, -1, knob, span);
  ctx.closePath();
}
function puzzleTracePieceStroke(size, sides, skipSides) {
  skipSides = skipSides || new Set();
  const half = size / 2, knob = size * 0.17, span = size * 0.34;
  if (!skipSides.has("top")) {
    ctx.beginPath(); ctx.moveTo(-half, -half);
    puzzleTraceHorizontal(-half, half, -half, sides.top || 0, -1, knob, span);
    ctx.stroke();
  }
  if (!skipSides.has("right")) {
    ctx.beginPath(); ctx.moveTo(half, -half);
    puzzleTraceVertical(half, -half, half, sides.right || 0, 1, knob, span);
    ctx.stroke();
  }
  if (!skipSides.has("bottom")) {
    ctx.beginPath(); ctx.moveTo(half, half);
    puzzleTraceHorizontal(half, -half, half, sides.bottom || 0, 1, knob, span);
    ctx.stroke();
  }
  if (!skipSides.has("left")) {
    ctx.beginPath(); ctx.moveTo(-half, half);
    puzzleTraceVertical(-half, half, -half, sides.left || 0, -1, knob, span);
    ctx.stroke();
  }
}
function puzzleTraceHorizontal(fromX, toX, y, connector, outwardY, knob, span) {
  const dir = Math.sign(toX - fromX) || 1, mid = (fromX + toX) / 2, a = mid - span / 2 * dir, b = mid + span / 2 * dir;
  const radiusX = (span / 2) * dir;
  const kappa = 0.5522847498;
  ctx.lineTo(a, y);
  if (!connector) ctx.lineTo(b, y);
  else {
    const depth = knob * outwardY * connector;
    ctx.bezierCurveTo(a, y + depth * kappa, mid - radiusX * kappa, y + depth, mid, y + depth);
    ctx.bezierCurveTo(mid + radiusX * kappa, y + depth, b, y + depth * kappa, b, y);
  }
  ctx.lineTo(toX, y);
}
function puzzleTraceVertical(x, fromY, toY, connector, outwardX, knob, span) {
  const dir = Math.sign(toY - fromY) || 1, mid = (fromY + toY) / 2, a = mid - span / 2 * dir, b = mid + span / 2 * dir;
  const radiusY = (span / 2) * dir;
  const kappa = 0.5522847498;
  ctx.lineTo(x, a);
  if (!connector) ctx.lineTo(x, b);
  else {
    const depth = knob * outwardX * connector;
    ctx.bezierCurveTo(x + depth * kappa, a, x + depth, mid - radiusY * kappa, x + depth, mid);
    ctx.bezierCurveTo(x + depth, mid + radiusY * kappa, x + depth * kappa, b, x, b);
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
      strokeWidth: puzzleStrokeWidthDp(),
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
