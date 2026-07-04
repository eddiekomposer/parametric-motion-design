// perspective effect module. Loaded before the main UI script.
var perspectiveDefaults = {
  perspectiveRotationDeg: 360,
  perspectiveDurationMs: 1200,
  perspectiveIntervalMs: 800,
  perspectiveHoverMode: false,
  perspectiveZOffset: 1,
  perspectiveUseCustomStyle: false,
  perspectiveFillColor: "#f6f7f1",
  perspectiveStrokeColor: "#5D5D5F",
  perspectiveOpacity: 0.92,
  perspectiveLineWidth: 1.35,
};

var perspectiveZScaleUnit = 0.2;

var perspectiveDefaultTopSvg = '<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">\n<rect x="35.2055" y="34.7739" width="16.2741" height="49.0174" rx="8.13705" stroke="#5D5D5F" stroke-width="0.54"/>\n<rect x="58.2153" y="33.7739" width="24.2387" height="23.3537" rx="11.6769" stroke="#5D5D5F" stroke-width="0.54"/>\n<path d="M70.1084 61.5293C70.8412 61.3786 71.5973 61.3786 72.3301 61.5293C73.2705 61.7228 74.1307 62.278 75.1641 63.2988C76.2003 64.3225 77.3828 65.7856 78.9785 67.7598C81.5046 70.885 83.3839 73.211 84.5713 75.084C85.7615 76.9614 86.2154 78.3233 85.9834 79.5342C85.8053 80.464 85.3905 81.3326 84.7793 82.0557C83.9833 82.9971 82.6388 83.5003 80.4307 83.7549C78.2276 84.0088 75.2372 84.0088 71.2188 84.0088C67.2006 84.0088 64.2108 84.0088 62.0078 83.7549C59.7993 83.5003 58.4541 82.9973 57.6582 82.0557C57.0471 81.3326 56.6332 80.464 56.4551 79.5342C56.2231 78.3233 56.677 76.9615 57.8672 75.084C59.0546 73.211 60.9339 70.885 63.46 67.7598C65.0556 65.7857 66.2382 64.3225 67.2744 63.2988C68.3078 62.278 69.1679 61.7228 70.1084 61.5293Z" stroke="#5D5D5F" stroke-width="0.54"/>\n<path d="M24.1317 42.6466C25.2504 33.8596 32.0903 27.202 40.8868 26.1598C46.2835 25.5204 52.8667 25 60 25C67.1333 25 73.7165 25.5204 79.1132 26.1598C87.9097 27.202 94.7496 33.8596 95.8683 42.6466C96.5004 47.6111 97 53.5692 97 60C97 66.4308 96.5004 72.3889 95.8683 77.3534C94.7496 86.1404 87.9097 92.798 79.1132 93.8402C73.7165 94.4796 67.1333 95 60 95C52.8667 95 46.2835 94.4796 40.8868 93.8402C32.0903 92.798 25.2504 86.1404 24.1317 77.3534C23.4996 72.3889 23 66.4308 23 60C23 53.5692 23.4996 47.6111 24.1317 42.6466Z" stroke="#5D5D5F" stroke-width="0.9" stroke-dasharray="2.78 2.78"/>\n</svg>';

var perspectiveControlDefs = [
  { key: "perspectiveHoverMode", type: "toggle", label: "响应hover", tip: "关闭时自动播放；开启时不循环，默认播放到 isometric，hover 时 2 倍速反向回 top，移开后正向播放。" },
  { key: "perspectiveDurationMs", label: "动效时长", min: 400, max: 5200, step: 50, tip: "控制 top 到 isometric 的单程过渡时长。" },
  { key: "perspectiveIntervalMs", label: "动效间隔", min: 0, max: 5000, step: 100, showWhen: () => !config.perspectiveHoverMode, tip: "关闭响应 hover 时，每次 top -> isometric 后停在 isometric 的等待时间。" },
  { key: "perspectiveRotationDeg", label: "旋转角度", min: -720, max: 720, step: 1, tip: "控制视角过渡时原图围绕 z 轴旋转的角度。" },
  { key: "perspectiveZOffset", label: "z轴偏移量", min: 0, max: 12, step: 0.01, tip: "控制不同元素在 z 轴上的高度差距。1 等于旧版 0.2；0 时所有元素高度一致。" },
  { key: "perspectiveUseCustomStyle", type: "toggle", label: "自定义样式", tip: "默认保留原图颜色、虚线和线宽；开启后对 SVG 源应用颜色和线宽覆盖，栅格图仍保留原像素。" },
  { key: "perspectiveFillColor", alphaKey: "perspectiveOpacity", type: "colorAlpha", label: "填充颜色", showWhen: () => config.perspectiveUseCustomStyle, tip: "自定义样式开启后，覆盖 SVG 源的填充颜色。" },
  { key: "perspectiveStrokeColor", type: "color", label: "线框颜色", showWhen: () => config.perspectiveUseCustomStyle, tip: "自定义样式开启后，覆盖 SVG 源的描边颜色，虚线节奏保持不变。" },
  { key: "perspectiveLineWidth", label: "线条粗细", min: 0.4, max: 5, step: 0.05, showWhen: () => config.perspectiveUseCustomStyle, tip: "自定义样式开启后，覆盖 SVG 源线条粗细；不会改变路径形状或虚线节奏。" },
];

function preparePerspectiveEffect() {
  hideLineEditHandles();
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideParticleCanvas();
  perspectiveEnsureGroup();
  perspectiveEnsureHoverListeners();
  const signature = perspectiveSourceSignature();
  if (state.perspectiveSystem.lastSignature !== signature) {
    state.perspectiveSystem.lastSignature = signature;
    perspectiveRebuildNodes();
  }
  state.perspectiveSystem.progress = clamp(state.perspectiveSystem.progress || 0, 0, 1);
}

function perspectiveEnsureGroup() {
  if (state.perspectiveSystem.group) return state.perspectiveSystem.group;
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("id", "perspective-group");
  const shadows = document.createElementNS(SVG_NS, "g");
  const tops = document.createElementNS(SVG_NS, "g");
  shadows.setAttribute("data-perspective-layer", "shadow");
  tops.setAttribute("data-perspective-layer", "tops");
  group.appendChild(shadows);
  group.appendChild(tops);
  motionGroup.appendChild(group);
  state.perspectiveSystem.group = group;
  state.perspectiveSystem.shadowGroup = shadows;
  state.perspectiveSystem.depthGroup = null;
  state.perspectiveSystem.topGroup = tops;
  return group;
}

function hidePerspectiveGroup() {
  if (state.perspectiveSystem?.group) state.perspectiveSystem.group.style.display = "none";
}

function perspectiveSourceSignature() {
  return [
    state.fileName,
    state.sourceKind,
    state.referenceDataURL?.length || 0,
    state.referenceSvgText?.length || 0,
    config.perspectiveUseCustomStyle ? "custom" : "original",
    config.perspectiveFillColor,
    config.perspectiveStrokeColor,
    config.perspectiveOpacity,
    config.perspectiveLineWidth,
  ].join("|");
}

function perspectiveRebuildNodes() {
  perspectiveEnsureGroup();
  state.perspectiveSystem.shadowGroup.textContent = "";
  state.perspectiveSystem.topGroup.textContent = "";
  state.perspectiveSystem.nodes = perspectiveSourceLayers().map((layer, index) => {
    const shadow = perspectiveCreateLayerNode(state.perspectiveSystem.shadowGroup, layer, "perspective-shadow");
    const top = perspectiveCreateLayerNode(state.perspectiveSystem.topGroup, layer, "perspective-top");
    return { layer, shadow, top };
  });
}

function perspectiveCreateLayerNode(parent, layer, className) {
  const wrapper = document.createElementNS(SVG_NS, "g");
  wrapper.setAttribute("class", className);
  parent.appendChild(wrapper);
  const rect = perspectiveSourceRect();
  if (layer.kind === "svg") {
    const source = perspectiveSvgForLayer(layer);
    if (source) {
      source.setAttribute("x", rect.x.toFixed(3));
      source.setAttribute("y", rect.y.toFixed(3));
      source.setAttribute("width", rect.width.toFixed(3));
      source.setAttribute("height", rect.height.toFixed(3));
      source.setAttribute("preserveAspectRatio", "xMidYMid meet");
      if (config.perspectiveUseCustomStyle) perspectiveApplyCustomSvgStyle(source);
      wrapper.appendChild(source);
      return wrapper;
    }
  }
  const image = document.createElementNS(SVG_NS, "image");
  image.setAttribute("href", layer.href || perspectiveFallbackDataURL());
  image.setAttribute("x", rect.x.toFixed(3));
  image.setAttribute("y", rect.y.toFixed(3));
  image.setAttribute("width", rect.width.toFixed(3));
  image.setAttribute("height", rect.height.toFixed(3));
  image.setAttribute("preserveAspectRatio", "xMidYMid meet");
  wrapper.appendChild(image);
  return wrapper;
}

function perspectiveSourceLayers() {
  const svgText = perspectiveSourceSvgText();
  if (svgText) {
    const parsed = perspectiveParseSvg(svgText);
    if (parsed) {
      const elements = perspectiveGraphicChildren(parsed.svg);
      if (elements.length) {
        const total = elements.length;
        return elements.map((element, index) => {
          const dashed = perspectiveElementHasDash(element);
          return {
            kind: "svg",
            source: parsed.svg,
            element,
            z: dashed ? 2.5 : 14 + index * 4,
            order: dashed ? -1 : index,
          };
        });
      }
      return [{ kind: "svg", source: parsed.svg, element: null, z: 16, order: 0 }];
    }
  }
  return [{ kind: "image", href: perspectiveSourceDataURL(), z: 16, order: 0 }];
}

function perspectiveSourceSvgText() {
  if (state.usingSampleReference && !state.referenceSvgText) return perspectiveDefaultTopSvg;
  if (state.sourceKind === "svg" && state.referenceSvgText) return state.referenceSvgText;
  return "";
}

function perspectiveSourceDataURL() {
  const svgText = perspectiveSourceSvgText();
  if (svgText) return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
  return state.referenceDataURL || perspectiveFallbackDataURL();
}

function perspectiveSourceKind() {
  return perspectiveSourceSvgText() ? "svg" : "image";
}

function perspectiveSourceName() {
  return state.usingSampleReference && perspectiveSourceSvgText() === perspectiveDefaultTopSvg ? "top.svg" : state.fileName;
}

function perspectiveParseSvg(svgText) {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return null;
    svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
    return { svg };
  } catch (error) {
    console.warn("Unable to parse original SVG for perspective effect.", error);
    return null;
  }
}

function perspectiveGraphicChildren(svg) {
  const tags = new Set(["path", "polygon", "polyline", "line", "rect", "circle", "ellipse", "g"]);
  return Array.from(svg.children).filter((node) => tags.has(node.tagName.toLowerCase()));
}

function perspectiveElementHasDash(element) {
  if (!element) return false;
  const value = [
    element.getAttribute("stroke-dasharray"),
    element.getAttribute("style"),
    ...Array.from(element.querySelectorAll?.("[stroke-dasharray]") || []).map((node) => node.getAttribute("stroke-dasharray")),
  ].filter(Boolean).join(" ");
  return /dash/i.test(value) || /\d+\s+[\d.]+/.test(value);
}

function perspectiveSvgForLayer(layer) {
  const source = document.importNode(layer.source, true);
  source.removeAttribute("id");
  source.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
  if (layer.element) {
    const tagName = layer.element.tagName.toLowerCase();
    const marker = layer.element.getAttribute("data-perspective-layer-id");
    Array.from(source.children).forEach((child, index) => {
      if (child.tagName.toLowerCase() === "defs") return;
      const sourceChild = perspectiveGraphicChildren(layer.source)[index];
      const same = sourceChild === layer.element || (marker && sourceChild?.getAttribute("data-perspective-layer-id") === marker);
      if (!same && child.tagName.toLowerCase() !== "defs") child.remove();
    });
  }
  if (config.perspectiveUseCustomStyle) perspectiveApplyCustomSvgStyle(source);
  return source;
}

function perspectiveSourceRect() {
  const svgText = perspectiveSourceSvgText();
  const svgSize = svgText ? perspectiveSvgSize(svgText) : null;
  const width = svgSize?.width || state.imageData?.width || 1;
  const height = svgSize?.height || state.imageData?.height || 1;
  const aspect = clamp(width / Math.max(1, height), 0.18, 5.4);
  const maxW = 68;
  const maxH = 68;
  const fittedW = aspect >= 1 ? maxW : maxH * aspect;
  const fittedH = aspect >= 1 ? maxW / aspect : maxH;
  return {
    x: 50 - fittedW / 2,
    y: 50 - fittedH / 2,
    width: fittedW,
    height: fittedH,
  };
}

function perspectiveSvgSize(svgText) {
  const parsed = perspectiveParseSvg(svgText);
  if (!parsed) return null;
  const viewBox = String(parsed.svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }
  const width = parseFloat(parsed.svg.getAttribute("width") || "0");
  const height = parseFloat(parsed.svg.getAttribute("height") || "0");
  return width > 0 && height > 0 ? { width, height } : null;
}

function perspectiveSanitizedSvgNode(svgText) {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return null;
    svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
    const imported = document.importNode(svg, true);
    imported.removeAttribute("id");
    return imported;
  } catch (error) {
    console.warn("Unable to embed original SVG for perspective effect.", error);
    return null;
  }
}

function perspectiveApplyCustomSvgStyle(svg) {
  const fillColor = perspectiveRgba(config.perspectiveFillColor, clamp(Number(config.perspectiveOpacity) || 0, 0, 1));
  const strokeColor = config.perspectiveStrokeColor;
  const lineWidth = clamp(Number(config.perspectiveLineWidth) || 1.35, 0.4, 5);
  svg.querySelectorAll("path, polygon, polyline, line, rect, circle, ellipse").forEach((node) => {
    const style = node.getAttribute("style") || "";
    const stroke = node.getAttribute("stroke");
    const fill = node.getAttribute("fill");
    const hasStroke = stroke !== "none" && !/stroke\s*:\s*none/i.test(style);
    const hasFill = fill !== "none" && !/fill\s*:\s*none/i.test(style);
    if (hasStroke) {
      node.style.setProperty("stroke", strokeColor, "important");
      node.style.setProperty("stroke-width", String(lineWidth), "important");
      node.style.setProperty("vector-effect", "non-scaling-stroke", "important");
    }
    if (hasFill) {
      node.style.setProperty("fill", fillColor, "important");
    }
  });
}

function perspectiveEnsureHoverListeners() {
  if (state.perspectiveSystem.hoverListenersAttached) return;
  const update = (event) => {
    state.perspectiveSystem.pointer = { x: event.clientX, y: event.clientY, active: true };
    if (config.effectType === "perspective" && config.perspectiveHoverMode) {
      perspectiveSetHoverActive(perspectivePointerHitsObject(event.clientX, event.clientY));
    }
  };
  const leave = () => {
    state.perspectiveSystem.pointer.active = false;
    if (config.effectType === "perspective" && config.perspectiveHoverMode) {
      perspectiveSetHoverActive(false);
    }
  };
  [motionSvg].filter(Boolean).forEach((target) => {
    target.addEventListener("pointermove", update);
    target.addEventListener("pointerleave", leave);
    target.addEventListener("mousemove", update);
    target.addEventListener("mouseleave", leave);
  });
  state.perspectiveSystem.hoverListenersAttached = true;
}

function renderPerspectiveEffect(now) {
  hideLineGroup();
  hideSineGroup();
  hideOscilloscopeGroup();
  hideParticleCanvas();
  if (state.particles) state.particles.forEach((particle) => { particle.style.display = "none"; });
  perspectiveEnsureGroup().style.display = "";
  motionPath.setAttribute("opacity", "0");
  motionGroup.removeAttribute("transform");

  if (state.perspectiveSystem.lastSignature !== perspectiveSourceSignature()) {
    preparePerspectiveEffect();
  }
  perspectiveSyncHoverState();
  const progress = config.perspectiveHoverMode ? perspectiveHoverProgress(now) : perspectiveLoopProgress(now);
  const view = config.perspectiveHoverMode ? progress : perspectiveEaseInOut(progress);
  const angle = (Number(config.perspectiveRotationDeg) || 0) * (Math.PI / 180) * view;
  perspectiveRenderNodes(view, angle, view);
}

function perspectiveSyncHoverState() {
  if (!config.perspectiveHoverMode) return;
  const pointer = state.perspectiveSystem.pointer;
  if (!pointer?.active) return;
  perspectiveSetHoverActive(perspectivePointerHitsObject(pointer.x, pointer.y));
}

function perspectiveSetHoverActive(active) {
  const next = Boolean(active);
  if (next === state.perspectiveSystem.hoverActive) return;
  state.perspectiveSystem.hoverActive = next;
  perspectiveStartAnimation(next ? 0 : 1, next);
}

function perspectivePointerHitsObject(clientX, clientY) {
  const target = state.perspectiveSystem.topGroup || state.perspectiveSystem.group;
  if (!target || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const padding = 8;
  return (
    clientX >= rect.left - padding &&
    clientX <= rect.right + padding &&
    clientY >= rect.top - padding &&
    clientY <= rect.bottom + padding
  );
}

function perspectiveLoopProgress(now) {
  const duration = Math.max(1, Number(config.perspectiveDurationMs) || 1200);
  const interval = Math.max(0, Number(config.perspectiveIntervalMs) || 0);
  const leg = duration + interval;
  const total = leg * 2;
  const elapsed = Math.max(0, now - state.startedAt);
  const local = total <= 0 ? 0 : elapsed % total;
  if (local < duration) return local / duration;
  if (local < leg) return 1;
  if (local < leg + duration) return 1 - ((local - leg) / duration);
  return 0;
}

function perspectiveHoverProgress(now) {
  const system = state.perspectiveSystem;
  if (!system.animation) {
    if (!Number.isFinite(system.progress)) system.progress = 0;
    if (system.progress < 0.999 && !system.hoverActive) perspectiveStartAnimation(1, false, now);
  }
  const animation = system.animation;
  if (!animation) return clamp(system.progress || 0, 0, 1);
  const raw = clamp((now - animation.start) / Math.max(1, animation.duration), 0, 1);
  const eased = animation.reverse ? perspectiveEaseOut(raw) : perspectiveEaseInOut(raw);
  system.progress = animation.from + (animation.to - animation.from) * eased;
  if (raw >= 1) {
    system.progress = animation.to;
    system.animation = null;
  }
  return clamp(system.progress, 0, 1);
}

function perspectiveStartAnimation(target, reverse, now = performance.now()) {
  const system = state.perspectiveSystem;
  const from = clamp(Number(system.progress) || 0, 0, 1);
  const to = clamp(target, 0, 1);
  const distance = Math.abs(to - from);
  if (distance < 0.001) {
    system.progress = to;
    system.animation = null;
    return;
  }
  const baseDuration = Math.max(1, Number(config.perspectiveDurationMs) || 1200);
  system.animation = {
    from,
    to,
    reverse: Boolean(reverse),
    start: now,
    duration: baseDuration * distance * (reverse ? 0.5 : 1),
  };
}

function perspectiveRenderNodes(view, angle, phase) {
  const nodes = state.perspectiveSystem.nodes;
  if (!Array.isArray(nodes) || !nodes.length) return;
  const shadowOpacity = document.body.dataset.theme === "light" ? 0.13 : 0.28;
  nodes
    .slice()
    .sort((a, b) => a.layer.z - b.layer.z)
    .forEach(({ layer, shadow, top }) => {
      const zScale = clamp(Number(config.perspectiveZOffset) || 0, 0, 12) * perspectiveZScaleUnit;
      const z = layer.z * zScale * view;
      shadow.setAttribute("transform", perspectiveMatrix(angle, 0, view * 0.18, view * 4.8, phase));
      shadow.setAttribute("opacity", (shadowOpacity * view * (layer.z > 4 ? 0.7 : 1)).toFixed(3));
      shadow.style.filter = view > 0.01 ? "blur(1.6px)" : "none";
      top.setAttribute("transform", perspectiveMatrix(angle, z, view, 0, phase));
      top.setAttribute("opacity", "1");
    });
}

function perspectiveMatrix(angle, z, view, extraY, phase = view) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const topA = cos;
  const topB = sin;
  const topC = -sin;
  const topD = cos;
  const isoBase = { a: 0.965926, b: -0.258819, c: 0.5, d: 0.866025 };
  const isoA = isoBase.a * cos + isoBase.c * sin;
  const isoB = isoBase.b * cos + isoBase.d * sin;
  const isoC = -isoBase.a * sin + isoBase.c * cos;
  const isoD = -isoBase.b * sin + isoBase.d * cos;
  const cameraFlip = 1 - 2 * Math.sin(clamp(phase, 0, 1) * Math.PI) ** 2;
  const a = topA * (1 - view) + isoA * view;
  const b = (topB * (1 - view) + isoB * view) * cameraFlip;
  const c = topC * (1 - view) + isoC * view;
  const d = (topD * (1 - view) + isoD * view) * cameraFlip;
  const e = 50 - a * 50 - c * 50;
  const f = 50 - b * 50 - d * 50 - z * 0.74 + view * 4 + extraY;
  return `matrix(${a.toFixed(6)} ${b.toFixed(6)} ${c.toFixed(6)} ${d.toFixed(6)} ${e.toFixed(6)} ${f.toFixed(6)})`;
}

function perspectiveEaseInOut(value) {
  return perspectiveCubicBezier(value, 0.58, 0.02, 0.22, 1);
}

function perspectiveEaseOut(value) {
  return perspectiveCubicBezier(value, 0.22, 0.82, 0.24, 1);
}

function perspectiveCubicBezier(value, x1, y1, x2, y2) {
  const target = clamp(value, 0, 1);
  let low = 0;
  let high = 1;
  let t = target;
  for (let index = 0; index < 16; index += 1) {
    t = (low + high) / 2;
    const x = perspectiveBezierAxis(t, x1, x2);
    if (x < target) low = t;
    else high = t;
  }
  return perspectiveBezierAxis(t, y1, y2);
}

function perspectiveBezierAxis(t, p1, p2) {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}

function perspectiveRgba(color, alpha) {
  const parsed = parseColorValue(color) || { r: 246, g: 247, b: 241 };
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function perspectiveFallbackDataURL() {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(perspectiveDefaultTopSvg);
}

function generatePerspectiveStandaloneHTML() {
  const rect = perspectiveSourceRect();
  const sourceSvgText = perspectiveSourceSvgText();
  const sourceDataURL = perspectiveSourceDataURL();
  const layers = perspectiveSourceLayers().map((layer) => ({
    kind: layer.kind,
    z: layer.z,
    index: layer.kind === "svg" && layer.element ? perspectiveGraphicChildren(layer.source).indexOf(layer.element) : -1,
  }));
  const standaloneConfig = {
    perspectiveRotationDeg: Number(config.perspectiveRotationDeg) || 0,
    perspectiveZOffset: clamp(Number(config.perspectiveZOffset) || 0, 0, 12),
    perspectiveZScaleUnit,
    perspectiveDurationMs: Math.max(1, Number(config.perspectiveDurationMs) || 1200),
    perspectiveIntervalMs: Math.max(0, Number(config.perspectiveIntervalMs) || 0),
    perspectiveHoverMode: Boolean(config.perspectiveHoverMode),
    perspectiveUseCustomStyle: Boolean(config.perspectiveUseCustomStyle),
    perspectiveFillColor: config.perspectiveFillColor,
    perspectiveStrokeColor: config.perspectiveStrokeColor,
    perspectiveOpacity: clamp(Number(config.perspectiveOpacity) || 0, 0, 1),
    perspectiveLineWidth: clamp(Number(config.perspectiveLineWidth) || 1.35, 0.4, 5),
    fileName: perspectiveSourceName().replace(/[<>&"]/g, ""),
    rect,
    sourceSvgText,
    sourceDataURL,
    layers,
  };
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${standaloneConfig.fileName} Perspective Motion</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050507; overflow: hidden; }
    svg { width: min(82vmin, 680px); height: min(82vmin, 680px); overflow: visible; touch-action: none; }
    image { image-rendering: auto; }
  </style>
</head>
<body>
  <svg id="stage" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <g id="shadow"></g>
    <g id="top"></g>
  </svg>
  <script>
const SVG_NS = "http://www.w3.org/2000/svg";
const config = ${JSON.stringify(standaloneConfig)};
const stage = document.querySelector("#stage");
const groups = { shadow: document.querySelector("#shadow"), top: document.querySelector("#top") };
const system = { progress: 0, hoverActive: false, pointer: { x: 0, y: 0, active: false }, animation: null };
function graphicChildren(svg) {
  const tags = new Set(["path", "polygon", "polyline", "line", "rect", "circle", "ellipse", "g"]);
  return Array.from(svg.children).filter((node) => tags.has(node.tagName.toLowerCase()));
}
function makeSvgForLayer(layer) {
  if (!config.sourceSvgText) return null;
  const doc = new DOMParser().parseFromString(config.sourceSvgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const svg = doc.documentElement;
  svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
  const children = graphicChildren(svg);
  if (layer.index >= 0) {
    Array.from(svg.children).forEach((child, index) => {
      if (child.tagName.toLowerCase() === "defs") return;
      const sourceChild = children[index];
      if (sourceChild !== children[layer.index] && child.tagName.toLowerCase() !== "defs") child.remove();
    });
  }
  svg.removeAttribute("id");
  svg.setAttribute("x", config.rect.x.toFixed(3));
  svg.setAttribute("y", config.rect.y.toFixed(3));
  svg.setAttribute("width", config.rect.width.toFixed(3));
  svg.setAttribute("height", config.rect.height.toFixed(3));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  if (config.perspectiveUseCustomStyle) applyCustomSvgStyle(svg);
  return svg;
}
function rgba(color, alpha) {
  const hex = String(color || "").trim().replace("#", "");
  const valid = /^[0-9a-f]{6}$/i.test(hex) ? hex : "f6f7f1";
  const r = parseInt(valid.slice(0, 2), 16);
  const g = parseInt(valid.slice(2, 4), 16);
  const b = parseInt(valid.slice(4, 6), 16);
  return "rgba(" + r + ", " + g + ", " + b + ", " + clamp(alpha, 0, 1).toFixed(3) + ")";
}
function applyCustomSvgStyle(svg) {
  const fillColor = rgba(config.perspectiveFillColor, config.perspectiveOpacity);
  svg.querySelectorAll("path, polygon, polyline, line, rect, circle, ellipse").forEach((node) => {
    const style = node.getAttribute("style") || "";
    const stroke = node.getAttribute("stroke");
    const fill = node.getAttribute("fill");
    const hasStroke = stroke !== "none" && !/stroke\\s*:\\s*none/i.test(style);
    const hasFill = fill !== "none" && !/fill\\s*:\\s*none/i.test(style);
    if (hasStroke) {
      node.style.setProperty("stroke", config.perspectiveStrokeColor, "important");
      node.style.setProperty("stroke-width", String(config.perspectiveLineWidth), "important");
      node.style.setProperty("vector-effect", "non-scaling-stroke", "important");
    }
    if (hasFill) node.style.setProperty("fill", fillColor, "important");
  });
}
function makeLayer(parent, layer) {
  const group = document.createElementNS(SVG_NS, "g");
  const svg = makeSvgForLayer(layer);
  if (svg) {
    group.appendChild(svg);
  } else {
    const image = document.createElementNS(SVG_NS, "image");
    image.setAttribute("href", config.sourceDataURL);
    image.setAttribute("x", config.rect.x.toFixed(3));
    image.setAttribute("y", config.rect.y.toFixed(3));
    image.setAttribute("width", config.rect.width.toFixed(3));
    image.setAttribute("height", config.rect.height.toFixed(3));
    image.setAttribute("preserveAspectRatio", "xMidYMid meet");
    group.appendChild(image);
  }
  parent.appendChild(group);
  return group;
}
const nodes = config.layers.map((layer) => ({
  layer,
  shadow: makeLayer(groups.shadow, layer),
  top: makeLayer(groups.top, layer),
}));
stage.addEventListener("pointermove", (event) => {
  system.pointer = { x: event.clientX, y: event.clientY, active: true };
  if (config.perspectiveHoverMode) setHoverActive(pointerHitsObject(event.clientX, event.clientY));
});
stage.addEventListener("mousemove", (event) => {
  system.pointer = { x: event.clientX, y: event.clientY, active: true };
  if (config.perspectiveHoverMode) setHoverActive(pointerHitsObject(event.clientX, event.clientY));
});
stage.addEventListener("pointerleave", () => {
  system.pointer.active = false;
  if (config.perspectiveHoverMode) setHoverActive(false);
});
stage.addEventListener("mouseleave", () => {
  system.pointer.active = false;
  if (config.perspectiveHoverMode) setHoverActive(false);
});
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function easeInOut(value) {
  return cubicBezier(value, 0.58, 0.02, 0.22, 1);
}
function easeOut(value) {
  return cubicBezier(value, 0.22, 0.82, 0.24, 1);
}
function cubicBezier(value, x1, y1, x2, y2) {
  const target = clamp(value, 0, 1);
  let low = 0;
  let high = 1;
  let t = target;
  for (let index = 0; index < 16; index += 1) {
    t = (low + high) / 2;
    const x = bezierAxis(t, x1, x2);
    if (x < target) low = t;
    else high = t;
  }
  return bezierAxis(t, y1, y2);
}
function bezierAxis(t, p1, p2) {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}
function loopProgress(now) {
  const duration = Math.max(1, config.perspectiveDurationMs);
  const leg = duration + Math.max(0, config.perspectiveIntervalMs);
  const total = leg * 2;
  const local = total <= 0 ? 0 : now % total;
  if (local < duration) return local / duration;
  if (local < leg) return 1;
  if (local < leg + duration) return 1 - ((local - leg) / duration);
  return 0;
}
function hoverProgress(now) {
  if (!system.animation && system.progress < 0.999 && !system.hoverActive) startAnimation(1, false, now);
  if (!system.animation) return clamp(system.progress || 0, 0, 1);
  const raw = clamp((now - system.animation.start) / Math.max(1, system.animation.duration), 0, 1);
  const eased = system.animation.reverse ? easeOut(raw) : easeInOut(raw);
  system.progress = system.animation.from + (system.animation.to - system.animation.from) * eased;
  if (raw >= 1) {
    system.progress = system.animation.to;
    system.animation = null;
  }
  return clamp(system.progress, 0, 1);
}
function setHoverActive(active) {
  const next = Boolean(active);
  if (next === system.hoverActive) return;
  system.hoverActive = next;
  startAnimation(next ? 0 : 1, next);
}
function pointerHitsObject(clientX, clientY) {
  const rect = groups.top.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const padding = 8;
  return clientX >= rect.left - padding && clientX <= rect.right + padding && clientY >= rect.top - padding && clientY <= rect.bottom + padding;
}
function startAnimation(target, reverse, now = performance.now()) {
  const from = clamp(Number(system.progress) || 0, 0, 1);
  const to = clamp(target, 0, 1);
  const distance = Math.abs(to - from);
  if (distance < 0.001) {
    system.progress = to;
    system.animation = null;
    return;
  }
  system.animation = { from, to, reverse: Boolean(reverse), start: now, duration: config.perspectiveDurationMs * distance * (reverse ? 0.5 : 1) };
}
function matrix(angle, z, view, extraY) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const topA = cos, topB = sin, topC = -sin, topD = cos;
  const isoBase = { a: 0.965926, b: -0.258819, c: 0.5, d: 0.866025 };
  const isoA = isoBase.a * cos + isoBase.c * sin;
  const isoB = isoBase.b * cos + isoBase.d * sin;
  const isoC = -isoBase.a * sin + isoBase.c * cos;
  const isoD = -isoBase.b * sin + isoBase.d * cos;
  const cameraFlip = 1 - 2 * Math.sin(clamp(view, 0, 1) * Math.PI) ** 2;
  const a = topA * (1 - view) + isoA * view;
  const b = (topB * (1 - view) + isoB * view) * cameraFlip;
  const c = topC * (1 - view) + isoC * view;
  const d = (topD * (1 - view) + isoD * view) * cameraFlip;
  const e = 50 - a * 50 - c * 50;
  const f = 50 - b * 50 - d * 50 - z * 0.74 + view * 4 + extraY;
  return "matrix(" + a.toFixed(6) + " " + b.toFixed(6) + " " + c.toFixed(6) + " " + d.toFixed(6) + " " + e.toFixed(6) + " " + f.toFixed(6) + ")";
}
function draw(now) {
  const progress = config.perspectiveHoverMode ? hoverProgress(now) : loopProgress(now);
  const view = config.perspectiveHoverMode ? progress : easeInOut(progress);
  const angle = (config.perspectiveRotationDeg * Math.PI / 180) * view;
  nodes.slice().sort((a, b) => a.layer.z - b.layer.z).forEach(({ layer, shadow, top }) => {
    const z = layer.z * config.perspectiveZOffset * config.perspectiveZScaleUnit * view;
    shadow.setAttribute("transform", matrix(angle, 0, view * 0.18, view * 4.8));
    shadow.setAttribute("opacity", (0.28 * view).toFixed(3));
    shadow.style.filter = view > 0.01 ? "blur(1.6px)" : "none";
    top.setAttribute("transform", matrix(angle, z, view, 0));
  });
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
  <\/script>
</body>
</html>`;
}
