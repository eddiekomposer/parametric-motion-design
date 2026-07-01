// cell effect module. Loaded before the main UI script.
var cellDefaults = {
  cellMotionType: "swap",
  cellCount: 10,
  cellSeed: 1,
  cellOverallSize: 1,
  cellDiversity: 3,
  cellGrowStrength: 0.6,
  cellMotionDurationMs: 900,
  cellMotionIntervalMs: 2200,
  cellColor: "#f6f7f1",
  cellOpacity: 0.94,
};

var cellControlDefs = [
  {
    key: "cellMotionType",
    type: "select",
    label: "动效类型",
    options: [
      { value: "swap", label: "换位" },
      { value: "blink", label: "闪烁" },
      { value: "grow", label: "生长" },
      { value: "rotate", label: "旋转" },
    ],
    tip: "选择细胞圆形的运动方式：换位、闪烁、生长或整体旋转。",
  },
  { key: "cellRandomize", type: "button", label: "随机布局", buttonLabel: "重新生成细胞", tip: "重新生成所有细胞的位置与尺寸组合。" },
  { key: "cellCount", label: "细胞数量", min: 3, max: 10, step: 1, tip: "控制填充轮廓的目标细胞数量。数量越多，单个圆会自动变小。" },
  { key: "cellOverallSize", label: "整体大小", min: 0.55, max: 1.45, step: 0.01, tip: "整体缩放细胞簇的占画面比例。" },
  { key: "cellDiversity", label: "细胞多样性", min: 0, max: 5, step: 1, tip: "控制细胞尺寸种类。0 为统一大小，3 为三种尺寸，最多 5 种。" },
  { key: "cellGrowStrength", label: "生长强度", min: 0.2, max: 1.2, step: 0.01, tip: "控制生长模式下距离场放大细胞的幅度。" },
  { key: "cellMotionDurationMs", label: "动效时长", min: 250, max: 2600, step: 50, tip: "控制一次换位、闪烁、生长或旋转完成所需的时间。" },
  { key: "cellMotionIntervalMs", label: "动效间隔", min: 700, max: 5200, step: 100, tip: "控制两次细胞动效触发之间的周期。" },
  { key: "cellColor", alphaKey: "cellOpacity", type: "colorAlpha", label: "圆形颜色", tip: "控制细胞圆形的颜色和透明度。" },
];

function prepareCellEffect() {
  hideLineEditHandles();
  state.samples = [];
  state.coefficients = [];
  state.cellSystem.cells = buildCellCells();
  state.cellSystem.rings = buildCellRings(state.cellSystem.cells);
  state.cellSystem.lastSignature = `cell|${config.cellCount}|${config.cellSeed}|${config.cellOverallSize}|${config.cellDiversity}|${state.cellSystem.cells.length}`;
  state.cellSystem.growCache = null;
}

function buildCellCells() {
  const desiredCount = clamp(Math.round(Number(config.cellCount) || 10), 3, 10);
  const scale = clamp(Number(config.cellOverallSize) || 1, 0.55, 1.45);
  const diversity = clamp(Math.round(Number(config.cellDiversity) || 0), 0, 5);
  const rng = seededRandom(`cell-generated|${desiredCount}|${config.cellSeed}|${Math.round(scale * 100)}|${diversity}`);
  const unit = clamp(7.3 - desiredCount * 0.28, 4.6, 6.8) * scale;
  const palette = cellSizePalette(diversity);
  const levels = Array.from({ length: desiredCount }, (_, index) => index % palette.length)
    .sort((a, b) => (rng() - 0.5) || a - b);
  const radii = levels.map((level) => unit * palette[level]).sort((a, b) => b - a);
  const clusterRadius = unit * (Math.sqrt(desiredCount) * 1.35 + 1.05);
  const cells = [];
  radii.forEach((radius, index) => {
    let best = null;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.pow(rng(), 0.78) * clusterRadius;
      const wobble = 1 + Math.sin(angle * 2.7 + rng() * 2.4) * 0.13;
      const candidate = {
        x: 50 + Math.cos(angle) * dist * wobble,
        y: 50 + Math.sin(angle) * dist * (0.86 + rng() * 0.22),
        r: radius,
        baseR: radius,
        seed: rng(),
      };
      const overlap = cells.reduce((sum, placed) => Math.max(sum, placed.r + candidate.r + unit * 0.045 - distance(placed, candidate)), 0);
      const centerPenalty = Math.hypot(candidate.x - 50, candidate.y - 50) / Math.max(1, clusterRadius);
      const score = overlap * 12 + centerPenalty + rng() * 0.08;
      if (!best || score < best.score) best = { ...candidate, score };
      if (overlap <= 0) break;
    }
    cells.push(best ?? { x: 50, y: 50, r: radius, baseR: radius, seed: rng() });
  });
  relaxCellLayout(cells, unit);
  state.cellSystem.bounds = { minX: 50 - clusterRadius, minY: 50 - clusterRadius, maxX: 50 + clusterRadius, maxY: 50 + clusterRadius, centerX: 50, centerY: 50 };
  return assignCellGeometry(cells.map((cell) => {
    const radial = Math.hypot(cell.x - 50, cell.y - 50);
    return {
      ...cell,
      centerRatio: 1 - clamp(radial / Math.max(1, clusterRadius), 0, 1),
      edgeRatio: clamp((clusterRadius - radial) / Math.max(1, clusterRadius), 0, 1),
    };
  }));
}

function cellSizePalette(diversity) {
  const count = diversity <= 1 ? 1 : clamp(Math.round(diversity), 2, 5);
  if (count === 1) return [1];
  const max = 1.46;
  const min = 0.58;
  const palette = Array.from({ length: count }, (_, index) => max + ((min - max) * index) / Math.max(1, count - 1));
  const average = palette.reduce((sum, value) => sum + value, 0) / palette.length;
  return palette.map((value) => value / average);
}

function relaxCellLayout(cells, unit) {
  const padding = Math.max(0.012, unit * 0.014);
  for (let pass = 0; pass < 90; pass += 1) {
    cells.forEach((cell) => {
      cell.x += (50 - cell.x) * 0.004;
      cell.y += (50 - cell.y) * 0.004;
    });
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const a = cells[i];
        const b = cells[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(0.001, Math.hypot(dx, dy));
        const minDist = a.r + b.r + padding;
        if (dist >= minDist) continue;
        const push = (minDist - dist) * 0.52;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

function limitCellCount(cells, desiredCount) {
  const target = clamp(Math.round(desiredCount), 3, 10);
  if (cells.length <= target) return cells;
  return cells
    .map((cell, index) => ({
      cell,
      score: cell.centerRatio * 1.35 + cell.edgeRatio * 0.42 + seededRandom(`cell-limit|${state.fileName}|${target}|${index}`)() * 0.16,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, target)
    .map((item) => item.cell)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function packCellCandidates(candidates, base) {
  const padding = Math.max(0.08, base * 0.08);
  const minRadius = Math.max(0.36, base * 0.26);
  const ordered = candidates
    .map((cell, index) => ({
      ...cell,
      order: seededRandom(`cell-pack|${state.fileName}|${index}|${Math.round(base * 100)}`)(),
    }))
    .sort((a, b) => (b.centerRatio + b.edgeRatio * 0.38 + b.order * 0.08) - (a.centerRatio + a.edgeRatio * 0.38 + a.order * 0.08));
  const packed = [];
  ordered.forEach((candidate) => {
    let available = candidate.r;
    for (const placed of packed) {
      available = Math.min(available, distance(candidate, placed) - placed.r - padding);
      if (available < minRadius) break;
    }
    if (available >= minRadius) {
      packed.push({
        ...candidate,
        r: available,
        baseR: available,
      });
    }
  });
  return packed.sort((a, b) => a.y - b.y || a.x - b.x);
}

function assignCellGeometry(cells) {
  const bounds = state.cellSystem.bounds;
  return cells.map((cell, index) => {
    const dx = cell.x - bounds.centerX;
    const dy = cell.y - bounds.centerY;
    return {
      ...cell,
      index,
      angle: Math.atan2(dy, dx),
      radial: Math.hypot(dx, dy),
    };
  });
}

function buildCellRings(cells) {
  const bounds = state.cellSystem.bounds;
  if (!cells.length) return [];
  if (cells.length <= 5) {
    return [[...cells].sort((a, b) => Math.atan2(a.y - bounds.centerY, a.x - bounds.centerX) - Math.atan2(b.y - bounds.centerY, b.x - bounds.centerX))];
  }
  const maxRadial = Math.max(1, ...cells.map((cell) => Math.hypot(cell.x - bounds.centerX, cell.y - bounds.centerY)));
  const ringCount = clamp(Math.round(Math.sqrt(cells.length) * 0.55), 1, 4);
  const rings = Array.from({ length: ringCount }, () => []);
  cells.forEach((cell, index) => {
    const radial = Math.hypot(cell.x - bounds.centerX, cell.y - bounds.centerY);
    const ringIndex = clamp(Math.floor((radial / maxRadial) * ringCount), 0, ringCount - 1);
    rings[ringIndex].push({ ...cell, index, radial });
  });
  return rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.sort((a, b) => Math.atan2(a.y - bounds.centerY, a.x - bounds.centerX) - Math.atan2(b.y - bounds.centerY, b.x - bounds.centerX)));
}

function maskBounds(mask, width, height) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  }
  return bounds;
}

function nearestOutsideMaskDistance(inside, x, y, maxRadius) {
  if (!inside(x, y)) return 0;
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      if (!inside(x - radius, y + dy) || !inside(x + radius, y + dy)) return radius;
    }
    for (let dx = -radius + 1; dx <= radius - 1; dx += 1) {
      if (!inside(x + dx, y - radius) || !inside(x + dx, y + radius)) return radius;
    }
  }
  return maxRadius;
}

function fallbackCellCells() {
  const cells = [];
  const desiredCount = clamp(Math.round(Number(config.cellCount) || 10), 3, 10);
  const center = { x: 50, y: 50 };
  const maxR = 33;
  const base = clamp(Math.sqrt((Math.PI * maxR * maxR) / (desiredCount * 3.1)), 1.05, 6.2);
  const rng = seededRandom(`cell-fallback-organic|${desiredCount}`);
  for (let attempt = 0; attempt < desiredCount * 90; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * maxR;
    const wobble = 1 + Math.sin(angle * 3.1 + rng() * 2) * 0.08;
    const x = center.x + Math.cos(angle) * dist * wobble;
    const y = center.y + Math.sin(angle) * dist * (0.86 + rng() * 0.2);
    const actualDist = Math.hypot(x - center.x, y - center.y);
    if (actualDist > maxR) continue;
    const centerRatio = 1 - actualDist / maxR;
    const edgeRatio = clamp((maxR - actualDist) / 16, 0, 1);
    const r = base * (0.38 + edgeRatio * 0.5 + centerRatio * 0.55 + (rng() - 0.5) * 0.12);
    cells.push({ x, y, r, baseR: r, centerRatio, edgeRatio, seed: rng() });
  }
  state.cellSystem.bounds = { minX: 17, minY: 17, maxX: 83, maxY: 83, centerX: 50, centerY: 50 };
  return assignCellGeometry(limitCellCount(packCellCandidates(cells, base), desiredCount));
}

function renderCellEffect(now) {
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
  const cells = state.cellSystem.cells.length ? state.cellSystem.cells : buildCellCells();
  const elapsed = now - state.startedAt;
  const interval = Math.max(350, config.cellMotionIntervalMs);
  const duration = Math.min(Math.max(120, config.cellMotionDurationMs), interval);
  const cycle = Math.floor(elapsed / interval);
  const local = ((elapsed % interval) + interval) % interval;
  const raw = clamp(local / duration, 0, 1);
  const active = local <= duration;
  const progress = active ? (config.cellMotionType === "rotate" ? naturalBezierEase(raw) : organicEase(raw)) : 1;
  const pulse = active ? organicPulse(progress) : 0;
  ctx.fillStyle = config.cellColor;
  const renderedCells = preventCellOverlaps(cells.map((cell, index) => (
    cellAnimatedState(cell, index, cells, cycle, progress, pulse, elapsed, local, duration, interval)
  )), false);
  renderedCells.forEach((cell) => drawCellCircle(ctx, cell));
  window.__motionDebug.cellCount = cells.length;
  window.__motionDebug.cellMotionType = config.cellMotionType;
  window.__motionDebug.cellOverlapCount = countCellOverlaps(renderedCells);
}

function cellAnimatedState(cell, index, cells, cycle, progress, pulse, elapsed, local, duration, interval) {
  if (config.cellMotionType === "swap") return cellSwapState(cell, index, cells, cycle, progress);
  if (config.cellMotionType === "blink") return cellBlinkState(cell, index, cells.length, cycle, local, duration, interval);
  if (config.cellMotionType === "grow") return cellGrowState(cell, index, cells, cycle, local, duration);
  if (config.cellMotionType === "rotate") return cellRotateState(cell, index, cycle, progress, pulse);
  return { ...cell, opacity: config.cellOpacity, scale: 1 };
}

function cellSwapState(cell, index, cells, cycle, progress) {
  const previousTarget = cells[cellSwapTarget(index, cells, cycle - 1)] ?? cell;
  const nextTarget = cells[cellSwapTarget(index, cells, cycle)] ?? cell;
  const point = pairedCellSwapMove(previousTarget, nextTarget, index, progress);
  return {
    ...cell,
    x: point.x,
    y: point.y,
    r: mixCellValue(previousTarget.r, nextTarget.r, progress),
    opacity: config.cellOpacity,
  };
}

function cellSwapTarget(index, cells, cycle) {
  return cellSwapPairs(cells, cycle).get(index) ?? index;
}

function cellSwapPairs(cells, cycle) {
  const pairs = new Map();
  const available = new Set(cells.map((_, index) => index));
  const order = cells
    .map((cell, index) => ({ index, key: seededRandom(`cell-swap-order|${state.fileName}|${cycle}|${index}`)() }))
    .sort((a, b) => a.key - b.key);
  const unit = cellAverageRadius(cells);
  const maxDistance = Math.max(unit * 5.2, 9);
  order.forEach(({ index }) => {
    if (!available.has(index)) return;
    available.delete(index);
    const cell = cells[index];
    let best = null;
    available.forEach((candidateIndex) => {
      const candidate = cells[candidateIndex];
      const d = distance(cell, candidate);
      const radialPenalty = Math.abs((cell.radial ?? 0) - (candidate.radial ?? 0)) * 0.28;
      const score = d + radialPenalty;
      if (d <= maxDistance && (!best || score < best.score)) best = { index: candidateIndex, score };
    });
    if (!best) {
      pairs.set(index, index);
      return;
    }
    available.delete(best.index);
    pairs.set(index, best.index);
    pairs.set(best.index, index);
  });
  available.forEach((index) => pairs.set(index, index));
  return pairs;
}

function cellBlinkState(cell, index, count, cycle, local, duration, interval) {
  const motion = cellBlinkMotion(index, count, cycle, local, duration, interval);
  if (!motion) return { ...cell, opacity: config.cellOpacity };
  const raw = clamp(motion.local / motion.duration, 0, 1);
  if (raw <= 0 || raw >= 1) return { ...cell, opacity: config.cellOpacity };
  const shrinkProgress = raw < 0.5 ? organicEase(raw * 2) : 1 - organicEase((raw - 0.5) * 2);
  const scale = mixCellValue(1, 0.035, shrinkProgress);
  return {
    ...cell,
    r: cell.r * scale,
    opacity: config.cellOpacity,
  };
}

function cellBlinkMotion(index, count, cycle, local, duration, interval) {
  const safeCount = Math.max(1, count);
  const slotDuration = clamp(Math.min(180, interval / Math.min(safeCount, 12)), 70, 180);
  const activeDuration = Math.min(Math.max(260, slotDuration * 3.2), Math.max(slotDuration, duration));
  const absolute = cycle * interval + local;
  const currentTrigger = Math.floor(absolute / slotDuration);
  const activeSlots = Math.ceil(activeDuration / slotDuration) + 1;
  for (let offset = 0; offset < activeSlots; offset += 1) {
    const trigger = currentTrigger - offset;
    const startedAt = trigger * slotDuration;
    const age = absolute - startedAt;
    if (age < 0 || age > activeDuration) continue;
    if (cellBlinkTriggeredIndex(safeCount, trigger) !== index) continue;
    return { local: age, duration: activeDuration };
  }
  return null;
}

function cellBlinkTriggeredIndex(count, trigger) {
  const group = Math.floor(trigger / Math.max(1, count));
  const offset = Math.floor(seededRandom(`cell-blink-order|${state.fileName}|${group}`)() * count);
  return ((trigger + offset) % count + count) % count;
}

function cellGrowState(cell, index, cells, cycle, local, duration) {
  const raw = clamp(local / Math.max(1, duration), 0, 1);
  return cellGrowProximityLayout(cells, cycle, raw)[index] ?? { ...cell, opacity: config.cellOpacity };
}

function cellGrowProximityLayout(cells, cycle, raw) {
  if (!cells.length) return [];
  const unit = cellAverageRadius(cells);
  const order = cellGrowRoundOrder(cells.length);
  const slot = ((Math.floor(cycle) % cells.length) + cells.length) % cells.length;
  const fromIndex = order[slot] ?? 0;
  const toIndex = order[(slot + 1) % order.length] ?? fromIndex;
  const travel = organicEase(raw);
  const growStrength = clamp(Number(config.cellGrowStrength) || 0.6, 0.2, 1.2);
  const fromCell = cells[fromIndex] ?? cells[0];
  const toCell = cells[toIndex] ?? fromCell;
  const nullPoint = {
    x: mixCellValue(fromCell.x, toCell.x, travel),
    y: mixCellValue(fromCell.y, toCell.y, travel),
  };
  const sourceArea = cells.reduce((sum, cell) => sum + (cell.baseR ?? cell.r) ** 2, 0);
  const layout = cells.map((cell) => {
    const base = cell.baseR ?? cell.r;
    const dist = Math.max(0.001, distance(cell, nullPoint));
    const field = Math.pow(clamp(1 - dist / Math.max(unit * 4.8, 7.5), 0, 1), 1.55);
    const smallBoost = clamp((unit * 1.1 - base) / Math.max(0.001, unit * 0.72), 0, 1);
    const grow = field * growStrength * (0.72 + smallBoost * 0.42);
    return {
      ...cell,
      r: clamp(base * (1 + grow), base * 0.36, base * (1.18 + growStrength * 1.18)),
      _growField: field,
      opacity: config.cellOpacity,
    };
  });
  cellBalanceProximityArea(layout, sourceArea);
  cellApplyGrowSway(layout, raw, cycle);
  cellRelaxGrowLayout(layout, Math.max(0.012, unit * 0.014), state.cellSystem.bounds);
  return cellAssignGrowGeometry(layout).map(({ _growField, ...cell }) => cell);
}

function cellBalanceProximityArea(cells, sourceArea) {
  const area = cells.reduce((sum, cell) => sum + cell.r * cell.r, 0);
  if (area <= sourceArea * 1.02) return;
  let excess = area - sourceArea;
  const shrinkers = cells
    .map((cell, index) => {
      const base = cell.baseR ?? cell.r;
      const minR = base * 0.18;
      const capacity = Math.max(0, cell.r * cell.r - minR * minR);
      const field = clamp(cell._growField ?? 0, 0, 1);
      return { cell, index, minR, capacity, weight: Math.pow(1 - field, 1.7) + 0.08 };
    })
    .filter((item) => item.capacity > 0);
  for (let pass = 0; pass < 3 && excess > sourceArea * 0.005; pass += 1) {
    const totalWeight = shrinkers.reduce((sum, item) => sum + item.weight * item.capacity, 0);
    if (totalWeight <= 0) break;
    shrinkers.forEach((item) => {
      if (excess <= 0 || item.capacity <= 0) return;
      const areaDrop = Math.min(item.capacity, excess * (item.weight * item.capacity) / totalWeight);
      item.cell.r = Math.sqrt(Math.max(item.minR * item.minR, item.cell.r * item.cell.r - areaDrop));
      item.capacity -= areaDrop;
    });
    excess = cells.reduce((sum, cell) => sum + cell.r * cell.r, 0) - sourceArea;
  }
  cells.forEach((cell) => {
    const base = cell.baseR ?? cell.r;
    const field = clamp(cell._growField ?? 0, 0, 1);
    const edgeShrink = Math.pow(1 - field, 2.2) * 0.08;
    cell.r = Math.max(base * 0.18, cell.r * (1 - edgeShrink));
  });
}

function cellApplyGrowSway(cells, raw, cycle) {
  const bounds = state.cellSystem.bounds;
  const angle = Math.sin((cycle + raw) * Math.PI * 2) * 0.035;
  const anchor = { x: bounds.centerX, y: bounds.minY };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  cells.forEach((cell) => {
    const dx = cell.x - anchor.x;
    const dy = cell.y - anchor.y;
    cell.x = anchor.x + dx * cos - dy * sin;
    cell.y = anchor.y + dx * sin + dy * cos;
  });
}

function cellGrowAmount(raw) {
  if (raw >= 1) return 1;
  if (raw < 0.72) return organicEase(raw / 0.72);
  const phase = (raw - 0.72) / 0.28;
  return 1 + Math.pow(Math.sin(phase * Math.PI), 2) * 0.075;
}

function cellGrowStepScale(cell, unit, step) {
  const sizeRatio = cell.r / Math.max(0.001, unit);
  const smallBoost = clamp((1.15 - sizeRatio) / 0.65, 0, 1);
  const largeBrake = clamp((sizeRatio - 1) / 0.8, 0, 1);
  const jitter = seededRandom(`cell-grow-scale|${state.fileName}|${step}|${cell.index ?? 0}`)() * 0.055;
  return clamp(1.28 + smallBoost * 0.34 - largeBrake * 0.16 + jitter, 1.16, 1.68);
}

function cellGrowRadiusCap(cell, unit) {
  const base = cell.baseR || cell.r;
  const sizeRatio = base / Math.max(0.001, unit);
  const smallBoost = clamp((1.15 - sizeRatio) / 0.65, 0, 1);
  const largeBrake = clamp((sizeRatio - 1) / 0.8, 0, 1);
  return base * clamp(1.62 + smallBoost * 0.62 - largeBrake * 0.28, 1.32, 2.35);
}

function cellGrowLayoutForCycle(cells, cycle) {
  const safeCycle = Math.floor(cycle);
  const signature = state.cellSystem.lastSignature;
  if (!state.cellSystem.growCache || state.cellSystem.growCache.signature !== signature) {
    state.cellSystem.growCache = {
      signature,
      layouts: [cellAssignGrowGeometry(cells.map((cell) => ({ ...cell })))],
      focuses: [],
    };
  }
  const cache = state.cellSystem.growCache;
  const targetIndex = Math.max(0, safeCycle + 1);
  while (cache.layouts.length <= targetIndex) {
    const step = cache.layouts.length - 1;
    const previous = cache.layouts[cache.layouts.length - 1];
    const previousFocus = cache.focuses[cache.focuses.length - 1] ?? -1;
    const focusIndex = cellGrowFocusIndex(previous, step, previousFocus);
    cache.layouts.push(cellApplyGrowMutation(previous, focusIndex, step));
    cache.focuses.push(focusIndex);
  }
  return cache.layouts[targetIndex];
}

function cellApplyGrowMutation(source, focusIndex, step) {
  if (!source.length) return [];
  const unit = cellAverageRadius(source);
  const bounds = state.cellSystem.bounds;
  const padding = Math.max(0.012, unit * 0.014);
  const focusCell = source[focusIndex] ?? source[0];
  const focusCap = cellGrowRadiusCap(focusCell, unit);
  const nextFocusR = Math.min(focusCap, Math.max(focusCell.r * cellGrowStepScale(focusCell, unit, step), focusCell.r + unit * 0.36));
  const growthDelta = Math.max(0, nextFocusR - focusCell.r);
  const influenceDistance = Math.max(unit * 8.6, 15);
  const influenceGap = Math.max(unit * 4.4, 5.4);
  const mutated = source.map((cell, index) => {
    if (index === focusIndex) {
      return { ...cell, r: nextFocusR, opacity: config.cellOpacity };
    }
    const dist = Math.max(0.001, distance(cell, focusCell));
    const edgeGap = Math.max(0, dist - cell.r - focusCell.r);
    const gapInfluence = clamp(1 - edgeGap / influenceGap, 0, 1);
    const distanceInfluence = clamp(1 - dist / influenceDistance, 0, 1);
    const influence = Math.pow(gapInfluence, 0.52) * Math.pow(distanceInfluence, 0.28);
    const nx = (cell.x - focusCell.x) / dist;
    const ny = (cell.y - focusCell.y) / dist;
    const tangent = (seededRandom(`cell-grow-tangent|${state.fileName}|${step}|${index}`)() - 0.5) * unit * 0.2 * influence;
    const push = influence * Math.max(unit * 0.22, growthDelta * 1.22);
    const base = cell.baseR || cell.r;
    const minR = base * 0.34;
    const maxR = base * 1.62;
    const shrinkInfluence = Math.max(0.16, influence);
    return {
      ...cell,
      x: cell.x + nx * push - ny * tangent,
      y: cell.y + ny * push + nx * tangent,
      r: clamp(cell.r * (1 - shrinkInfluence * 0.2), minR, maxR),
      opacity: config.cellOpacity,
    };
  });
  cellConserveGrowArea(mutated, focusIndex, source.reduce((sum, cell) => sum + cell.r * cell.r, 0));
  cellRelaxGrowLayout(mutated, padding, bounds);
  return cellAssignGrowGeometry(mutated);
}

function cellConserveGrowArea(cells, focusIndex, sourceArea) {
  const otherArea = cells.reduce((sum, cell, index) => index === focusIndex ? sum : sum + cell.r * cell.r, 0);
  if (otherArea <= 0) return;
  const focusArea = (cells[focusIndex]?.r ?? 0) ** 2;
  const targetOtherArea = Math.max(sourceArea - focusArea, sourceArea * 0.1);
  if (otherArea <= targetOtherArea) return;
  const scale = Math.sqrt(targetOtherArea / otherArea);
  cells.forEach((cell, index) => {
    if (index === focusIndex) return;
    const base = cell.baseR || cell.r;
    cell.r = Math.max(base * 0.28, cell.r * scale);
  });
  const totalArea = cells.reduce((sum, cell) => sum + cell.r * cell.r, 0);
  if (totalArea <= sourceArea * 1.03) return;
  const remainingArea = cells.reduce((sum, cell, index) => index === focusIndex ? sum : sum + cell.r * cell.r, 0);
  const hardTarget = Math.max(sourceArea - focusArea, sourceArea * 0.06);
  const hardScale = Math.sqrt(Math.max(0.001, hardTarget) / Math.max(0.001, remainingArea));
  cells.forEach((cell, index) => {
    if (index === focusIndex) return;
    const base = cell.baseR || cell.r;
    cell.r = Math.max(base * 0.12, cell.r * hardScale);
  });
}

function cellRelaxGrowLayout(cells, padding, bounds) {
  const center = { x: bounds.centerX, y: bounds.centerY };
  const maxRadius = Math.max(18, Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.58);
  const unit = cellAverageRadius(cells);
  for (let pass = 0; pass < 110; pass += 1) {
    const centerPull = pass < 76 ? 0.024 : 0.008;
    cells.forEach((cell) => {
      const dx = cell.x - center.x;
      const dy = cell.y - center.y;
      const radial = Math.max(0.001, Math.hypot(dx, dy));
      const limit = maxRadius - cell.r;
      if (radial > limit) {
        const pull = (radial - limit) * 0.18;
        cell.x -= (dx / radial) * pull;
        cell.y -= (dy / radial) * pull;
      }
      cell.x += (center.x - cell.x) * centerPull;
      cell.y += (center.y - cell.y) * centerPull;
    });
    cellPullNearestGrowNeighbors(cells, padding, unit);
    for (let i = 0; i < cells.length; i += 1) {
      for (let j = i + 1; j < cells.length; j += 1) {
        const a = cells[i];
        const b = cells[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(0.001, Math.hypot(dx, dy));
        const minDistance = a.r + b.r + padding;
        if (dist >= minDistance) continue;
        const overlap = minDistance - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const aWeight = b.r / Math.max(0.001, a.r + b.r);
        const bWeight = a.r / Math.max(0.001, a.r + b.r);
        a.x -= nx * overlap * aWeight;
        a.y -= ny * overlap * aWeight;
        b.x += nx * overlap * bWeight;
        b.y += ny * overlap * bWeight;
      }
    }
  }
}

function cellPullNearestGrowNeighbors(cells, padding, unit) {
  const moves = cells.map(() => ({ x: 0, y: 0 }));
  cells.forEach((cell, index) => {
    let nearest = null;
    for (let otherIndex = 0; otherIndex < cells.length; otherIndex += 1) {
      if (otherIndex === index) continue;
      const other = cells[otherIndex];
      const dx = other.x - cell.x;
      const dy = other.y - cell.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      const surfaceGap = dist - cell.r - other.r - padding;
      const score = surfaceGap + Math.abs((cell.radial ?? 0) - (other.radial ?? 0)) * 0.018;
      if (!nearest || score < nearest.score) nearest = { otherIndex, dx, dy, dist, surfaceGap, score };
    }
    if (!nearest || nearest.surfaceGap <= padding * 0.8) return;
    const pull = Math.min(nearest.surfaceGap * 0.34, unit * 0.11);
    const nx = nearest.dx / nearest.dist;
    const ny = nearest.dy / nearest.dist;
    moves[index].x += nx * pull;
    moves[index].y += ny * pull;
    moves[nearest.otherIndex].x -= nx * pull * 0.45;
    moves[nearest.otherIndex].y -= ny * pull * 0.45;
  });
  cells.forEach((cell, index) => {
    cell.x += moves[index].x;
    cell.y += moves[index].y;
  });
}

function cellAssignGrowGeometry(cells) {
  const bounds = state.cellSystem.bounds;
  return cells.map((cell, index) => {
    const dx = cell.x - bounds.centerX;
    const dy = cell.y - bounds.centerY;
    return {
      ...cell,
      index,
      angle: Math.atan2(dy, dx),
      radial: Math.hypot(dx, dy),
      centerRatio: 1 - clamp(Math.hypot(dx, dy) / Math.max(1, Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.5), 0, 1),
    };
  });
}

function cellGrowFocusIndex(cells, cycle) {
  const count = cells.length;
  if (!count) return 0;
  const safeCycle = Math.max(0, Math.floor(cycle));
  const slot = safeCycle % count;
  return cellGrowRoundOrder(count)[slot] ?? 0;
}

function cellGrowRoundOrder(count) {
  return Array.from({ length: count }, (_, index) => ({
    index,
    key: seededRandom(`cell-grow-order|${state.fileName}|${count}|${index}`)(),
  })).sort((a, b) => a.key - b.key).map((item) => item.index);
}

function cellRotateState(cell, index, cycle, progress, pulse) {
  const ringInfo = cellRingInfo(index);
  if (!ringInfo || ringInfo.ring.length < 3) return { ...cell, opacity: config.cellOpacity };
  const { ring, position } = ringInfo;
  const from = cellRingItem(ring, position + cycle);
  const to = cellRingItem(ring, position + cycle + 1);
  if (!from || !to) return { ...cell, opacity: config.cellOpacity };
  const point = arcCellMove(from, to, progress);
  return {
    ...cell,
    x: point.x,
    y: point.y,
    r: mixCellValue(from.r, to.r, progress) * (0.98 + pulse * 0.03),
    opacity: config.cellOpacity,
  };
}

function cellRingInfo(index) {
  for (const ring of state.cellSystem.rings) {
    const position = ring.findIndex((item) => item.index === index);
    if (position >= 0) return { ring, position };
  }
  return null;
}

function cellRingItem(ring, index) {
  if (!ring?.length) return null;
  return ring[((Math.round(index) % ring.length) + ring.length) % ring.length] ?? null;
}

function curvedCellMove(from, to, index, progress, bendRatio) {
  const t = organicEase(progress);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const sign = seededRandom(`cell-curve|${state.fileName}|${index}`)() > 0.5 ? 1 : -1;
  const bend = Math.min(length * bendRatio, cellAverageRadius(state.cellSystem.cells) * 2.2) * sign;
  const wave = Math.sin(Math.PI * t);
  return {
    x: mixCellValue(from.x, to.x, t) + (-dy / length) * bend * wave,
    y: mixCellValue(from.y, to.y, t) + (dx / length) * bend * wave,
  };
}

function pairedCellSwapMove(from, to, index, progress) {
  const t = organicEase(progress);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  if (length < 0.05) return { x: from.x, y: from.y };
  const direction = seededRandom(`cell-swap-arc|${state.fileName}|${index}`)() > 0.5 ? 1 : -1;
  const arcHeight = Math.min(cellAverageRadius(state.cellSystem.cells) * 1.85, length * 0.42) * direction;
  const wave = Math.sin(Math.PI * t);
  return {
    x: mixCellValue(from.x, to.x, t) + (-dy / length) * arcHeight * wave,
    y: mixCellValue(from.y, to.y, t) + (dx / length) * arcHeight * wave,
  };
}

function arcCellMove(from, to, progress) {
  const bounds = state.cellSystem.bounds;
  const t = organicEase(progress);
  const fromAngle = Math.atan2(from.y - bounds.centerY, from.x - bounds.centerX);
  const toAngle = Math.atan2(to.y - bounds.centerY, to.x - bounds.centerX);
  let delta = toAngle - fromAngle;
  if (delta <= 0) delta += Math.PI * 2;
  const angle = fromAngle + delta * t;
  const radial = mixCellValue(from.radial ?? Math.hypot(from.x - bounds.centerX, from.y - bounds.centerY), to.radial ?? Math.hypot(to.x - bounds.centerX, to.y - bounds.centerY), t);
  return {
    x: bounds.centerX + Math.cos(angle) * radial,
    y: bounds.centerY + Math.sin(angle) * radial,
  };
}

function organicEase(value) {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function naturalBezierEase(value) {
  const target = clamp(value, 0, 1);
  let low = 0;
  let high = 1;
  let t = target;
  for (let i = 0; i < 16; i += 1) {
    t = (low + high) / 2;
    const x = cubicBezierAxis(t, 0.5, 0);
    if (x < target) low = t;
    else high = t;
  }
  return cubicBezierAxis(t, 0, 1);
}

function cellAverageRadius(cells) {
  if (!cells?.length) return 2.75;
  return cells.reduce((sum, cell) => sum + (cell.baseR ?? cell.r ?? 2.75), 0) / cells.length;
}

function organicPulse(value) {
  return Math.sin(clamp(value, 0, 1) * Math.PI);
}

function mixCellValue(from, to, progress) {
  return from + (to - from) * progress;
}

function preventCellOverlaps(cells, allowMove = true) {
  const padding = Math.max(0.03, cellAverageRadius(cells) * 0.035);
  const resolved = cells.map((cell) => ({ ...cell }));
  for (let pass = 0; pass < 5; pass += 1) {
    for (let i = 0; i < resolved.length; i += 1) {
      for (let j = i + 1; j < resolved.length; j += 1) {
        const a = resolved[i];
        const b = resolved[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distanceValue = Math.max(0.001, Math.hypot(dx, dy));
        const minDistance = a.r + b.r + padding;
        if (distanceValue >= minDistance) continue;
        if (!allowMove) continue;
        const overlap = minDistance - distanceValue;
        const nx = dx / distanceValue;
        const ny = dy / distanceValue;
        const movableA = a.r / Math.max(0.001, a.r + b.r);
        const movableB = 1 - movableA;
        a.x -= nx * overlap * movableA;
        a.y -= ny * overlap * movableA;
        b.x += nx * overlap * movableB;
        b.y += ny * overlap * movableB;
        if (pass > 2) {
          const shrink = Math.max(0.88, distanceValue / minDistance);
          a.r *= shrink;
          b.r *= shrink;
        }
      }
    }
  }
  for (let i = 0; i < resolved.length; i += 1) {
    for (let j = i + 1; j < resolved.length; j += 1) {
      const a = resolved[i];
      const b = resolved[j];
      const distanceValue = Math.max(0.001, distance(a, b));
      const maxRadiusSum = Math.max(0.001, distanceValue - padding);
      const radiusSum = a.r + b.r;
      if (radiusSum <= maxRadiusSum) continue;
      const shrink = Math.max(0.04, maxRadiusSum / radiusSum);
      a.r *= shrink;
      b.r *= shrink;
    }
  }
  return resolved;
}

function countCellOverlaps(cells) {
  let count = 0;
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      if (distance(cells[i], cells[j]) + 0.02 < cells[i].r + cells[j].r) count += 1;
    }
  }
  return count;
}

function drawCellCircle(ctx, cell) {
  const point = particleToCanvas(cell);
  const radius = Math.max(0.4, cell.r) * state.particleSystem.viewport.size / 100;
  ctx.globalAlpha = clamp(cell.opacity ?? config.cellOpacity, 0, 1);
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function generateCellStandaloneHTML() {
  const cells = state.cellSystem.cells.map((cell) => ({
    index: Number(cell.index ?? 0),
    x: Number(cell.x.toFixed(3)),
    y: Number(cell.y.toFixed(3)),
    r: Number(cell.r.toFixed(3)),
    centerRatio: Number(cell.centerRatio.toFixed(4)),
    seed: Number(cell.seed.toFixed(5)),
    radial: Number((cell.radial ?? Math.hypot(cell.x - state.cellSystem.bounds.centerX, cell.y - state.cellSystem.bounds.centerY)).toFixed(3)),
  }));
  const bounds = Object.fromEntries(Object.entries(state.cellSystem.bounds).map(([key, value]) => [key, Number(value.toFixed(3))]));
  const title = "Cell Motion";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050507; }
canvas { width: min(76vmin, 560px); height: min(76vmin, 560px); display: block; }
  </style>
</head>
<body>
  <canvas id="stage" aria-hidden="true"></canvas>
  <script>
const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const cells = ${JSON.stringify(cells)};
const bounds = ${JSON.stringify(bounds)};
const config = ${JSON.stringify({
  seed: `cell-motion-${config.cellSeed}`,
  cellMotionType: config.cellMotionType,
  cellMotionDurationMs: config.cellMotionDurationMs,
  cellMotionIntervalMs: config.cellMotionIntervalMs,
  cellGrowStrength: config.cellGrowStrength,
  cellColor: config.cellColor,
  cellOpacity: config.cellOpacity,
})};
const rings = buildRings(cells);
let viewport = { x: 0, y: 0, size: 1, width: 1, height: 1 };
const startedAt = performance.now();
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
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
function naturalBezierEase(value) {
  const target = clamp(value, 0, 1);
  let low = 0;
  let high = 1;
  let t = target;
  for (let i = 0; i < 16; i += 1) {
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
function organicPulse(value) {
  return Math.sin(clamp(value, 0, 1) * Math.PI);
}
function mixValue(from, to, progress) {
  return from + (to - from) * progress;
}
function averageRadius(source) {
  if (!source.length) return 2.75;
  return source.reduce((sum, cell) => sum + (cell.r || 2.75), 0) / source.length;
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
function pointToCanvas(point) {
  return { x: viewport.x + (point.x / 100) * viewport.size, y: viewport.y + (point.y / 100) * viewport.size };
}
function buildRings(source) {
  if (!source.length) return [];
  if (source.length <= 5) {
    return [[...source].sort((a, b) => Math.atan2(a.y - bounds.centerY, a.x - bounds.centerX) - Math.atan2(b.y - bounds.centerY, b.x - bounds.centerX))];
  }
  const maxRadial = Math.max(1, ...source.map((cell) => Math.hypot(cell.x - bounds.centerX, cell.y - bounds.centerY)));
  const ringCount = clamp(Math.round(Math.sqrt(source.length) * 0.55), 1, 4);
  const groups = Array.from({ length: ringCount }, () => []);
  source.forEach((cell, index) => {
    const radial = Math.hypot(cell.x - bounds.centerX, cell.y - bounds.centerY);
    const ringIndex = clamp(Math.floor((radial / maxRadial) * ringCount), 0, ringCount - 1);
    groups[ringIndex].push({ ...cell, index, radial });
  });
  return groups
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.sort((a, b) => Math.atan2(a.y - bounds.centerY, a.x - bounds.centerX) - Math.atan2(b.y - bounds.centerY, b.x - bounds.centerX)));
}
function swapTarget(index, count, cycle) {
  return swapPairs(cycle).get(index) ?? index;
}
function swapPairs(cycle) {
  const pairs = new Map();
  const available = new Set(cells.map((_, index) => index));
  const order = cells
    .map((cell, index) => ({ index, key: seededRandom("cell-swap-order|" + config.seed + "|" + cycle + "|" + index)() }))
    .sort((a, b) => a.key - b.key);
  const unit = averageRadius(cells);
  const maxDistance = Math.max(unit * 5.2, 9);
  order.forEach(({ index }) => {
    if (!available.has(index)) return;
    available.delete(index);
    const cell = cells[index];
    let best = null;
    available.forEach((candidateIndex) => {
      const candidate = cells[candidateIndex];
      const d = distance(cell, candidate);
      const radialPenalty = Math.abs((cell.radial || 0) - (candidate.radial || 0)) * 0.28;
      const score = d + radialPenalty;
      if (d <= maxDistance && (!best || score < best.score)) best = { index: candidateIndex, score };
    });
    if (!best) {
      pairs.set(index, index);
      return;
    }
    available.delete(best.index);
    pairs.set(index, best.index);
    pairs.set(best.index, index);
  });
  available.forEach((index) => pairs.set(index, index));
  return pairs;
}
function animatedState(cell, index, cycle, progress, pulse, local, duration, interval) {
  if (config.cellMotionType === "swap") {
    const from = cells[swapTarget(index, cells.length, cycle - 1)] || cell;
    const to = cells[swapTarget(index, cells.length, cycle)] || cell;
    const point = pairedSwapMove(from, to, index, progress);
    return { ...cell, x: point.x, y: point.y, r: mixValue(from.r, to.r, progress), opacity: config.cellOpacity };
  }
  if (config.cellMotionType === "blink") {
    const motion = blinkMotion(index, cells.length, cycle, local, duration, interval);
    if (!motion) return { ...cell, opacity: config.cellOpacity };
    const raw = clamp(motion.local / motion.duration, 0, 1);
    if (raw <= 0 || raw >= 1) return { ...cell, opacity: config.cellOpacity };
    const shrinkProgress = raw < 0.5 ? organicEase(raw * 2) : 1 - organicEase((raw - 0.5) * 2);
    return { ...cell, r: cell.r * mixValue(1, 0.035, shrinkProgress), opacity: config.cellOpacity };
  }
  if (config.cellMotionType === "grow") {
    const raw = clamp(local / Math.max(1, duration), 0, 1);
    return growProximityLayout(cycle, raw)[index] || { ...cell, opacity: config.cellOpacity };
  }
  if (config.cellMotionType === "rotate") {
    const info = ringInfo(index);
    if (!info || info.ring.length < 3) return { ...cell, opacity: config.cellOpacity };
    const from = ringItem(info.ring, info.position + cycle);
    const to = ringItem(info.ring, info.position + cycle + 1);
    if (!from || !to) return { ...cell, opacity: config.cellOpacity };
    const point = arcMove(from, to, progress);
    return { ...cell, x: point.x, y: point.y, r: mixValue(from.r, to.r, progress) * (0.98 + pulse * 0.03), opacity: config.cellOpacity };
  }
  return { ...cell, opacity: config.cellOpacity };
}
function blinkMotion(index, count, cycle, local, duration, interval) {
  const safeCount = Math.max(1, count);
  const slotDuration = clamp(Math.min(180, interval / Math.min(safeCount, 12)), 70, 180);
  const activeDuration = Math.min(Math.max(260, slotDuration * 3.2), Math.max(slotDuration, duration));
  const absolute = cycle * interval + local;
  const currentTrigger = Math.floor(absolute / slotDuration);
  const activeSlots = Math.ceil(activeDuration / slotDuration) + 1;
  for (let offset = 0; offset < activeSlots; offset += 1) {
    const trigger = currentTrigger - offset;
    const age = absolute - trigger * slotDuration;
    if (age < 0 || age > activeDuration) continue;
    if (blinkTriggeredIndex(safeCount, trigger) !== index) continue;
    return { local: age, duration: activeDuration };
  }
  return null;
}
function blinkTriggeredIndex(count, trigger) {
  const group = Math.floor(trigger / Math.max(1, count));
  const offset = Math.floor(seededRandom("cell-blink-order|" + config.seed + "|" + group)() * count);
  return ((trigger + offset) % count + count) % count;
}
function growAmount(raw) {
  if (raw >= 1) return 1;
  if (raw < 0.72) return organicEase(raw / 0.72);
  const phase = (raw - 0.72) / 0.28;
  return 1 + Math.pow(Math.sin(phase * Math.PI), 2) * 0.075;
}
function growProximityLayout(cycle, raw) {
  if (!cells.length) return [];
  const unit = averageRadius(cells);
  const order = growRoundOrder(cells.length);
  const slot = ((Math.floor(cycle) % cells.length) + cells.length) % cells.length;
  const fromIndex = order[slot] || 0;
  const toIndex = order[(slot + 1) % order.length] || fromIndex;
  const travel = organicEase(raw);
  const growStrength = clamp(Number(config.cellGrowStrength) || 0.6, 0.2, 1.2);
  const fromCell = cells[fromIndex] || cells[0];
  const toCell = cells[toIndex] || fromCell;
  const nullPoint = { x: mixValue(fromCell.x, toCell.x, travel), y: mixValue(fromCell.y, toCell.y, travel) };
  const sourceArea = cells.reduce((sum, cell) => sum + Math.pow(cell.baseR || cell.r, 2), 0);
  const layout = cells.map((cell) => {
    const base = cell.baseR || cell.r;
    const dist = Math.max(0.001, distance(cell, nullPoint));
    const field = Math.pow(clamp(1 - dist / Math.max(unit * 4.8, 7.5), 0, 1), 1.55);
    const smallBoost = clamp((unit * 1.1 - base) / Math.max(0.001, unit * 0.72), 0, 1);
    const grow = field * growStrength * (0.72 + smallBoost * 0.42);
    return { ...cell, r: clamp(base * (1 + grow), base * 0.36, base * (1.18 + growStrength * 1.18)), _growField: field, opacity: config.cellOpacity };
  });
  balanceProximityArea(layout, sourceArea);
  applyGrowSway(layout, raw, cycle);
  relaxGrowLayout(layout, Math.max(0.012, unit * 0.014));
  return assignGrowGeometry(layout).map(({ _growField, ...cell }) => cell);
}
function balanceProximityArea(layout, sourceArea) {
  const area = layout.reduce((sum, cell) => sum + cell.r * cell.r, 0);
  if (area <= sourceArea * 1.02) return;
  let excess = area - sourceArea;
  const shrinkers = layout
    .map((cell) => {
      const base = cell.baseR || cell.r;
      const minR = base * 0.18;
      const capacity = Math.max(0, cell.r * cell.r - minR * minR);
      const field = clamp(cell._growField || 0, 0, 1);
      return { cell, minR, capacity, weight: Math.pow(1 - field, 1.7) + 0.08 };
    })
    .filter((item) => item.capacity > 0);
  for (let pass = 0; pass < 3 && excess > sourceArea * 0.005; pass += 1) {
    const totalWeight = shrinkers.reduce((sum, item) => sum + item.weight * item.capacity, 0);
    if (totalWeight <= 0) break;
    shrinkers.forEach((item) => {
      if (excess <= 0 || item.capacity <= 0) return;
      const areaDrop = Math.min(item.capacity, excess * (item.weight * item.capacity) / totalWeight);
      item.cell.r = Math.sqrt(Math.max(item.minR * item.minR, item.cell.r * item.cell.r - areaDrop));
      item.capacity -= areaDrop;
    });
    excess = layout.reduce((sum, cell) => sum + cell.r * cell.r, 0) - sourceArea;
  }
  layout.forEach((cell) => {
    const base = cell.baseR || cell.r;
    const field = clamp(cell._growField || 0, 0, 1);
    const edgeShrink = Math.pow(1 - field, 2.2) * 0.08;
    cell.r = Math.max(base * 0.18, cell.r * (1 - edgeShrink));
  });
}
function applyGrowSway(layout, raw, cycle) {
  const angle = Math.sin((cycle + raw) * Math.PI * 2) * 0.035;
  const anchor = { x: bounds.centerX, y: bounds.minY };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  layout.forEach((cell) => {
    const dx = cell.x - anchor.x;
    const dy = cell.y - anchor.y;
    cell.x = anchor.x + dx * cos - dy * sin;
    cell.y = anchor.y + dx * sin + dy * cos;
  });
}
function growStepScale(cell, unit, step) {
  const sizeRatio = cell.r / Math.max(0.001, unit);
  const smallBoost = clamp((1.15 - sizeRatio) / 0.65, 0, 1);
  const largeBrake = clamp((sizeRatio - 1) / 0.8, 0, 1);
  const jitter = seededRandom("cell-grow-scale|" + config.seed + "|" + step + "|" + (cell.index || 0))() * 0.055;
  return clamp(1.28 + smallBoost * 0.34 - largeBrake * 0.16 + jitter, 1.16, 1.68);
}
function growRadiusCap(cell, unit) {
  const base = cell.baseR || cell.r;
  const sizeRatio = base / Math.max(0.001, unit);
  const smallBoost = clamp((1.15 - sizeRatio) / 0.65, 0, 1);
  const largeBrake = clamp((sizeRatio - 1) / 0.8, 0, 1);
  return base * clamp(1.62 + smallBoost * 0.62 - largeBrake * 0.28, 1.32, 2.35);
}
const growCache = { layouts: [assignGrowGeometry(cells.map((cell) => ({ ...cell, baseR: cell.baseR || cell.r })))], focuses: [] };
function growLayoutForCycle(cycle) {
  const targetIndex = Math.max(0, Math.floor(cycle) + 1);
  while (growCache.layouts.length <= targetIndex) {
    const step = growCache.layouts.length - 1;
    const previous = growCache.layouts[growCache.layouts.length - 1];
    const previousFocus = growCache.focuses[growCache.focuses.length - 1] ?? -1;
    const focusIndex = growFocusIndexForLayout(previous, step, previousFocus);
    growCache.layouts.push(applyGrowMutation(previous, focusIndex, step));
    growCache.focuses.push(focusIndex);
  }
  return growCache.layouts[targetIndex];
}
function growFocusIndexForLayout(layout, cycle, excludeIndex) {
  const count = layout.length;
  if (!count) return 0;
  const safeCycle = Math.max(0, Math.floor(cycle));
  const slot = safeCycle % count;
  return growRoundOrder(count)[slot] || 0;
}
function growRoundOrder(count) {
  return Array.from({ length: count }, (_, index) => ({
    index,
    key: seededRandom("cell-grow-order|" + config.seed + "|" + count + "|" + index)(),
  })).sort((a, b) => a.key - b.key).map((item) => item.index);
}
function applyGrowMutation(source, focusIndex, step) {
  if (!cells.length) return [];
  const unit = averageRadius(source);
  const padding = Math.max(0.012, unit * 0.014);
  const focusCell = source[focusIndex] || source[0];
  const focusRadius = Math.min(growRadiusCap(focusCell, unit), Math.max(focusCell.r * growStepScale(focusCell, unit, step), focusCell.r + unit * 0.36));
  const growthDelta = Math.max(0, focusRadius - focusCell.r);
  const influenceGap = Math.max(unit * 4.2, 5.2);
  const influenceDistance = Math.max(unit * 8.2, 16);
  const targets = source.map((cell, index) => {
    if (index === focusIndex) return { ...cell, r: focusRadius, opacity: config.cellOpacity };
    const dist = Math.max(0.001, distance(cell, focusCell));
    const edgeGap = Math.max(0, dist - cell.r - focusCell.r);
    const gapInfluence = clamp(1 - edgeGap / influenceGap, 0, 1);
    const distanceInfluence = clamp(1 - dist / influenceDistance, 0, 1);
    const influence = Math.pow(gapInfluence, 0.55) * Math.pow(distanceInfluence, 0.22);
    const nx = (cell.x - focusCell.x) / dist;
    const ny = (cell.y - focusCell.y) / dist;
    const tangent = (seededRandom("cell-grow-tangent|" + config.seed + "|" + step + "|" + index)() - 0.5) * unit * 0.2 * influence;
    const push = influence * Math.max(unit * 0.22, growthDelta * 1.22);
    const base = cell.baseR || cell.r;
    const shrinkInfluence = Math.max(0.16, influence);
    return {
      ...cell,
      x: cell.x + nx * push - ny * tangent,
      y: cell.y + ny * push + nx * tangent,
      r: clamp(cell.r * (1 - shrinkInfluence * 0.2), base * 0.34, base * 1.62),
      opacity: config.cellOpacity,
    };
  });
  conserveGrowArea(targets, focusIndex, source.reduce((sum, cell) => sum + cell.r * cell.r, 0));
  relaxGrowLayout(targets, Math.max(0.012, unit * 0.014));
  return assignGrowGeometry(targets);
}
function conserveGrowArea(layout, focusIndex, sourceArea) {
  const otherArea = layout.reduce((sum, cell, index) => index === focusIndex ? sum : sum + cell.r * cell.r, 0);
  if (otherArea <= 0) return;
  const focusArea = Math.pow((layout[focusIndex] && layout[focusIndex].r) || 0, 2);
  const targetOtherArea = Math.max(sourceArea - focusArea, sourceArea * 0.1);
  if (otherArea <= targetOtherArea) return;
  const scale = Math.sqrt(targetOtherArea / otherArea);
  layout.forEach((cell, index) => {
    if (index === focusIndex) return;
    const base = cell.baseR || cell.r;
    cell.r = Math.max(base * 0.28, cell.r * scale);
  });
  const totalArea = layout.reduce((sum, cell) => sum + cell.r * cell.r, 0);
  if (totalArea <= sourceArea * 1.03) return;
  const remainingArea = layout.reduce((sum, cell, index) => index === focusIndex ? sum : sum + cell.r * cell.r, 0);
  const hardTarget = Math.max(sourceArea - focusArea, sourceArea * 0.06);
  const hardScale = Math.sqrt(Math.max(0.001, hardTarget) / Math.max(0.001, remainingArea));
  layout.forEach((cell, index) => {
    if (index === focusIndex) return;
    const base = cell.baseR || cell.r;
    cell.r = Math.max(base * 0.12, cell.r * hardScale);
  });
}
function relaxGrowLayout(layout, padding) {
  const center = { x: bounds.centerX, y: bounds.centerY };
  const maxRadius = Math.max(18, Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.58);
  const unit = averageRadius(layout);
  for (let pass = 0; pass < 110; pass += 1) {
    const centerPull = pass < 76 ? 0.024 : 0.008;
    layout.forEach((cell) => {
      const dx = cell.x - center.x;
      const dy = cell.y - center.y;
      const radial = Math.max(0.001, Math.hypot(dx, dy));
      const limit = maxRadius - cell.r;
      if (radial > limit) {
        const pull = (radial - limit) * 0.18;
        cell.x -= (dx / radial) * pull;
        cell.y -= (dy / radial) * pull;
      }
      cell.x += (center.x - cell.x) * centerPull;
      cell.y += (center.y - cell.y) * centerPull;
    });
    pullNearestGrowNeighbors(layout, padding, unit);
    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        const a = layout[i];
        const b = layout[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(0.001, Math.hypot(dx, dy));
        const minDistance = a.r + b.r + padding;
        if (dist >= minDistance) continue;
        const overlap = minDistance - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const aWeight = b.r / Math.max(0.001, a.r + b.r);
        const bWeight = a.r / Math.max(0.001, a.r + b.r);
        a.x -= nx * overlap * aWeight;
        a.y -= ny * overlap * aWeight;
        b.x += nx * overlap * bWeight;
        b.y += ny * overlap * bWeight;
      }
    }
  }
}
function pullNearestGrowNeighbors(layout, padding, unit) {
  const moves = layout.map(() => ({ x: 0, y: 0 }));
  layout.forEach((cell, index) => {
    let nearest = null;
    for (let otherIndex = 0; otherIndex < layout.length; otherIndex += 1) {
      if (otherIndex === index) continue;
      const other = layout[otherIndex];
      const dx = other.x - cell.x;
      const dy = other.y - cell.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      const surfaceGap = dist - cell.r - other.r - padding;
      const score = surfaceGap + Math.abs((cell.radial || 0) - (other.radial || 0)) * 0.018;
      if (!nearest || score < nearest.score) nearest = { otherIndex, dx, dy, dist, surfaceGap, score };
    }
    if (!nearest || nearest.surfaceGap <= padding * 0.8) return;
    const pull = Math.min(nearest.surfaceGap * 0.34, unit * 0.11);
    const nx = nearest.dx / nearest.dist;
    const ny = nearest.dy / nearest.dist;
    moves[index].x += nx * pull;
    moves[index].y += ny * pull;
    moves[nearest.otherIndex].x -= nx * pull * 0.45;
    moves[nearest.otherIndex].y -= ny * pull * 0.45;
  });
  layout.forEach((cell, index) => {
    cell.x += moves[index].x;
    cell.y += moves[index].y;
  });
}
function assignGrowGeometry(layout) {
  return layout.map((cell, index) => {
    const dx = cell.x - bounds.centerX;
    const dy = cell.y - bounds.centerY;
    return {
      ...cell,
      index,
      angle: Math.atan2(dy, dx),
      radial: Math.hypot(dx, dy),
      centerRatio: 1 - clamp(Math.hypot(dx, dy) / Math.max(1, Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.5), 0, 1),
    };
  });
}
function ringInfo(index) {
  for (const ring of rings) {
    const position = ring.findIndex((item) => item.index === index);
    if (position >= 0) return { ring, position };
  }
  return null;
}
function ringItem(ring, index) {
  if (!ring || !ring.length) return null;
  return ring[((Math.round(index) % ring.length) + ring.length) % ring.length] || null;
}
function curvedMove(from, to, index, progress, bendRatio) {
  const t = organicEase(progress);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const sign = seededRandom("cell-curve|" + config.seed + "|" + index)() > 0.5 ? 1 : -1;
  const bend = Math.min(len * bendRatio, averageRadius(cells) * 2.2) * sign;
  const wave = Math.sin(Math.PI * t);
  return { x: mixValue(from.x, to.x, t) + (-dy / len) * bend * wave, y: mixValue(from.y, to.y, t) + (dx / len) * bend * wave };
}
function pairedSwapMove(from, to, index, progress) {
  const t = organicEase(progress);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  if (len < 0.05) return { x: from.x, y: from.y };
  const direction = seededRandom("cell-swap-arc|" + config.seed + "|" + index)() > 0.5 ? 1 : -1;
  const arcHeight = Math.min(averageRadius(cells) * 1.85, len * 0.42) * direction;
  const wave = Math.sin(Math.PI * t);
  return { x: mixValue(from.x, to.x, t) + (-dy / len) * arcHeight * wave, y: mixValue(from.y, to.y, t) + (dx / len) * arcHeight * wave };
}
function arcMove(from, to, progress) {
  const t = organicEase(progress);
  const fromAngle = Math.atan2(from.y - bounds.centerY, from.x - bounds.centerX);
  const toAngle = Math.atan2(to.y - bounds.centerY, to.x - bounds.centerX);
  let delta = toAngle - fromAngle;
  if (delta <= 0) delta += Math.PI * 2;
  const angle = fromAngle + delta * t;
  const radial = mixValue(from.radial || Math.hypot(from.x - bounds.centerX, from.y - bounds.centerY), to.radial || Math.hypot(to.x - bounds.centerX, to.y - bounds.centerY), t);
  return { x: bounds.centerX + Math.cos(angle) * radial, y: bounds.centerY + Math.sin(angle) * radial };
}
function preventOverlaps(source, allowMove = true) {
  const resolved = source.map((cell) => ({ ...cell }));
  const padding = 0.08;
  for (let pass = 0; pass < 5; pass += 1) {
    for (let i = 0; i < resolved.length; i += 1) {
      for (let j = i + 1; j < resolved.length; j += 1) {
        const a = resolved[i], b = resolved[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(0.001, Math.hypot(dx, dy));
        const minD = a.r + b.r + padding;
        if (d >= minD) continue;
        if (!allowMove) continue;
        const overlap = minD - d;
        const nx = dx / d, ny = dy / d;
        const wa = a.r / Math.max(0.001, a.r + b.r);
        a.x -= nx * overlap * wa;
        a.y -= ny * overlap * wa;
        b.x += nx * overlap * (1 - wa);
        b.y += ny * overlap * (1 - wa);
        if (pass > 2) {
          const shrink = Math.max(0.88, d / minD);
          a.r *= shrink;
          b.r *= shrink;
        }
      }
    }
  }
  for (let i = 0; i < resolved.length; i += 1) {
    for (let j = i + 1; j < resolved.length; j += 1) {
      const a = resolved[i], b = resolved[j];
      const d = Math.max(0.001, distance(a, b));
      const maxRadiusSum = Math.max(0.001, d - padding);
      const radiusSum = a.r + b.r;
      if (radiusSum <= maxRadiusSum) continue;
      const shrink = Math.max(0.04, maxRadiusSum / radiusSum);
      a.r *= shrink;
      b.r *= shrink;
    }
  }
  return resolved;
}
function drawCell(cell) {
  const point = pointToCanvas(cell);
  const radius = Math.max(0.4, cell.r) * viewport.size / 100;
  ctx.globalAlpha = clamp(cell.opacity ?? config.cellOpacity, 0, 1);
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
function tick(now) {
  resize();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = config.cellColor;
  const elapsed = now - startedAt;
  const interval = Math.max(350, config.cellMotionIntervalMs);
  const duration = Math.min(Math.max(120, config.cellMotionDurationMs), interval);
  const cycle = Math.floor(elapsed / interval);
  const local = ((elapsed % interval) + interval) % interval;
  const raw = clamp(local / duration, 0, 1);
  const active = local <= duration;
  const progress = active ? (config.cellMotionType === "rotate" ? naturalBezierEase(raw) : organicEase(raw)) : 1;
  const pulse = active ? organicPulse(progress) : 0;
  preventOverlaps(cells.map((cell, index) => animatedState(cell, index, cycle, progress, pulse, local, duration, interval)), false).forEach(drawCell);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
  <\/script>
</body>
</html>`;
}

function generateCellLottie() {
  const layers = state.cellSystem.cells.map((cell, index) => makeLottieEllipseLayer(
    `Cell ${index + 1}`,
    cell,
    cell.r,
    {
      index: index + 1,
      fill: config.cellColor,
      opacity: config.cellOpacity,
    },
  ));
  return makeBasicLottieDocument("Cell", layers);
}
