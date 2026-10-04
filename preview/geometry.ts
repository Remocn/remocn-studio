import {
  GEOMETRY_KEYS,
  type GeometryHandle,
  type GeometryKey,
  type GeometryValues,
  poseGeometry,
  type SnapBox,
  type SnapLine,
  type SnapLines,
  type Snapped,
  snapBox,
  snapLinesOf,
  snapSides,
  transformGeometry,
  unposeGeometry,
} from "../shared/studio-geometry";
import { post, route } from "./bridge";
import {
  type GeometryBetween,
  type GeometryConfig,
  type GeometryTarget,
  geometryTarget,
  renderedGeometry,
} from "./geometry-target";
import { managedIdentity, managedRoot } from "./managed-objects";
import { OVERLAY_ATTR } from "./picker";
import {
  eventElement,
  focusSurface,
  lockCamera,
  onViewChange,
  overlayRoot,
  styleRoot,
  surfaceEvents,
} from "./surface";

const MARKER = "data-remocn-transform";
const REVEAL = "data-remocn-reveal";
const INVISIBLE = 0.05;
export const SELECTION_BOUNDS = "data-remocn-selection-bounds";
const SNAP_DISTANCE = 6;
const NUDGE_SETTLE_MS = 400;
const GUIDE_INK = "#f43f5e";
const NO_GUIDES: Snapped["guides"] = { x: null, y: null };
const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
};
const TYPING =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
const POSE_NAMES: Record<
  GeometryBetween["kind"],
  Record<GeometryBetween["editing"], string>
> = {
  entry: { from: "Entry start", to: "Resting position" },
  exit: { from: "Resting position", to: "Exit end" },
};
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"] as const;
interface Gesture {
  accepted: boolean;
  angle: number;
  centerX: number;
  centerY: number;
  frame: number;
  guides: Snapped["guides"];
  handle: GeometryHandle;
  lines: SnapLines;
  nudge: { x: number; y: number };
  phase: "pending" | "dragging" | "committing";
  pointer: number;
  requestId: string;
  restore: () => void;
  rule: CSSStyleDeclaration;
  target: GeometryTarget;
  turn: number;
  values: GeometryValues;
  x: number;
  y: number;
}

export function createGeometryEditor(
  container: HTMLElement,
  accent: string,
  depth: number,
  pause: () => void,
  currentFrame: () => number,
  onChange: () => void,
  seek: (frame: number) => void
) {
  let config: GeometryConfig | null = null;
  let target: GeometryTarget | null = null;
  let gesture: Gesture | null = null;
  let painting = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let nudging: ReturnType<typeof setTimeout> | undefined;
  const frame = overlay("div", depth);
  frame.setAttribute(SELECTION_BOUNDS, "");
  let frameRotation = 0;
  let revealed: HTMLElement | null = null;
  const revealing = document.createElement("style");
  revealing.setAttribute(OVERLAY_ATTR, "");
  revealing.textContent = `[${REVEAL}] { opacity: 0.45 !important; }`;
  styleRoot().append(revealing);
  const reveal = (node: HTMLElement | null) => {
    if (revealed !== null && revealed !== node) {
      revealed.removeAttribute(REVEAL);
    }
    revealed = null;
    if (node === null) {
      return;
    }
    node.removeAttribute(REVEAL);
    if (Number(getComputedStyle(node).opacity) < INVISIBLE) {
      node.setAttribute(REVEAL, "");
      revealed = node;
    }
  };
  const insideFrame = (x: number, y: number) => {
    if (frame.style.display === "none") {
      return false;
    }
    const rect = frame.getBoundingClientRect();
    const angle = (-frameRotation * Math.PI) / 180;
    const dx = x - (rect.left + rect.width / 2);
    const dy = y - (rect.top + rect.height / 2);
    const localX = Math.cos(angle) * dx - Math.sin(angle) * dy;
    const localY = Math.sin(angle) * dx + Math.cos(angle) * dy;
    return (
      Math.abs(localX) <= frame.offsetWidth / 2 &&
      Math.abs(localY) <= frame.offsetHeight / 2
    );
  };
  const guides = {
    x: overlay("div", depth - 1),
    y: overlay("div", depth - 1),
  };
  guides.x.style.background = GUIDE_INK;
  guides.y.style.background = GUIDE_INK;
  const ghost = document.createElement("button");
  ghost.type = "button";
  ghost.setAttribute(OVERLAY_ATTR, "");
  let ghostFrame: number | null = null;
  Object.assign(ghost.style, {
    appearance: "none",
    background: "rgba(255, 255, 255, 0.06)",
    border: `1px dashed ${accent}`,
    boxSizing: "border-box",
    display: "none",
    margin: "0",
    opacity: "0.7",
    padding: "0",
    position: "fixed",
    transformOrigin: "center",
    zIndex: String(depth - 1),
  });
  const path = overlay("div", depth - 1);
  Object.assign(path.style, {
    borderTop: `1px dashed ${accent}`,
    height: "0",
    opacity: "0.8",
    transformOrigin: "0 0",
  });
  Object.assign(frame.style, {
    border: `1px solid ${accent}`,
    boxSizing: "border-box",
    transformOrigin: "center",
  });
  const label = overlay("div", depth + 1);
  Object.assign(label.style, {
    background: accent,
    borderRadius: "3px",
    color: "#101820",
    font: "500 11px/1.4 system-ui, sans-serif",
    padding: "2px 6px",
    whiteSpace: "nowrap",
  });
  const notice = overlay("div", depth + 3);
  notice.setAttribute("role", "status");
  Object.assign(notice.style, {
    background: "#222",
    borderRadius: "4px",
    bottom: "8px",
    color: "#f3f3f3",
    font: "12px/1.4 system-ui, sans-serif",
    left: "8px",
    maxWidth: "calc(100vw - 16px)",
    padding: "6px 8px",
  });
  const handles = HANDLES.map((handle) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute(OVERLAY_ATTR, "");
    button.dataset.geometryHandle = handle;
    button.setAttribute(
      "aria-label",
      handle === "rotate" ? "Rotate object" : `Resize ${handle}`
    );
    button.title =
      handle === "rotate"
        ? "Rotate · Shift snaps to 15°"
        : "Resize · Shift keeps proportions at corners";
    const size = matchMedia("(pointer: coarse)").matches ? 44 : 24;
    Object.assign(button.style, {
      background: "transparent",
      border: "0",
      display: "grid",
      height: `${size}px`,
      margin: "0",
      padding: "0",
      placeItems: "center",
      pointerEvents: "auto",
      position: "absolute",
      touchAction: "none",
      transform: "translate(-50%, -50%)",
      width: `${size}px`,
    });
    button.style.left = handleLeft(handle);
    button.style.top = handleTop(handle);
    const dot = document.createElement("span");
    Object.assign(dot.style, {
      background: "#fff",
      border: `1px solid ${accent}`,
      borderRadius: handle === "rotate" ? "50%" : "0",
      height: "8px",
      pointerEvents: "none",
      width: "8px",
    });
    button.append(dot);
    frame.append(button);
    return { button, handle };
  });
  overlayRoot().append(ghost, path, guides.x, guides.y, frame, label, notice);

  const explain = (error: string) => {
    notice.textContent = error;
    notice.style.display = "block";
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.style.display = "none";
    }, 5000);
  };
  const drawGuides = (lines: Snapped["guides"]) => {
    const place = (
      node: HTMLElement,
      line: SnapLine | null,
      vertical: boolean
    ) => {
      if (line === null) {
        node.style.display = "none";
        return;
      }
      Object.assign(
        node.style,
        vertical
          ? {
              display: "block",
              height: `${line.to - line.from}px`,
              left: `${line.at - 0.5}px`,
              top: `${line.from}px`,
              width: "1px",
            }
          : {
              display: "block",
              height: "1px",
              left: `${line.from}px`,
              top: `${line.at - 0.5}px`,
              width: `${line.to - line.from}px`,
            }
      );
    };
    place(guides.x, lines.x, true);
    place(guides.y, lines.y, false);
  };
  const reset = () => {
    const previous = gesture;
    gesture = null;
    lockCamera(frame, false);
    clearTimeout(timer);
    clearTimeout(nudging);
    drawGuides(NO_GUIDES);
    if (previous) {
      previous.restore();
      if (
        previous.pointer >= 0 &&
        container.hasPointerCapture(previous.pointer)
      ) {
        container.releasePointerCapture(previous.pointer);
      }
    }
    onChange();
  };
  const cancel = () => {
    if (gesture && gesture.phase !== "pending") {
      post({ requestId: gesture.requestId, type: "studio.geometry.cancel" });
    }
    reset();
  };
  const settle = () => {
    if (
      gesture?.phase === "committing" &&
      gesture.accepted &&
      (!gesture.target.node.isConnected ||
        renderedGeometry(gesture.target.node, gesture.values))
    ) {
      reset();
    }
  };
  const drawBetween = (
    current: GeometryTarget,
    values: GeometryValues,
    rect: DOMRect
  ) => {
    const { between } = current;
    if (between === null) {
      ghostFrame = null;
      ghost.style.display = "none";
      path.style.display = "none";
      return;
    }
    const rendered = poseGeometry(values, current.pose);
    const angle = (current.parentRotation * Math.PI) / 180;
    const scale = current.parentScale;
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const centerOf = (pose: GeometryValues) => {
      const dx =
        (pose.x + pose.width / 2 - rendered.x - rendered.width / 2) * scale;
      const dy =
        (pose.y + pose.height / 2 - rendered.y - rendered.height / 2) * scale;
      return {
        x: originX + Math.cos(angle) * dx - Math.sin(angle) * dy,
        y: originY + Math.sin(angle) * dx + Math.cos(angle) * dy,
      };
    };
    const { other } = between;
    const there = centerOf(other);
    const local = Number(current.frameAttribute);
    const otherSide = between.editing === "from" ? "to" : "from";
    ghostFrame =
      between.frames !== null && Number.isFinite(local)
        ? currentFrame() - local + between.frames[otherSide]
        : null;
    const name = POSE_NAMES[between.kind][otherSide];
    ghost.style.pointerEvents =
      ghostFrame === null || gesture !== null ? "none" : "auto";
    ghost.style.cursor = ghostFrame === null ? "default" : "pointer";
    ghost.setAttribute(
      "aria-label",
      ghostFrame === null ? name : `Go to ${name.toLowerCase()}`
    );
    ghost.title =
      ghostFrame === null
        ? name
        : `${name} · click to go to frame ${Math.round(ghostFrame)}`;
    const here = centerOf(values);
    const width = other.width * scale;
    const height = other.height * scale;
    Object.assign(ghost.style, {
      display: "block",
      height: `${height}px`,
      left: `${there.x - width / 2}px`,
      top: `${there.y - height / 2}px`,
      transform: `rotate(${other.rotation + current.parentRotation}deg)`,
      width: `${width}px`,
    });
    const [start, end] =
      between.editing === "from" ? [here, there] : [there, here];
    Object.assign(path.style, {
      display: "block",
      left: `${start.x}px`,
      top: `${start.y}px`,
      transform: `rotate(${Math.atan2(end.y - start.y, end.x - start.x)}rad)`,
      width: `${Math.hypot(end.x - start.x, end.y - start.y)}px`,
    });
  };
  const draw = (current: GeometryTarget, values: GeometryValues) => {
    const rendered = poseGeometry(values, current.pose);
    const rect = current.node.getBoundingClientRect();
    drawBetween(current, values, rect);
    const width = rendered.width * current.scale;
    const height = rendered.height * current.scale;
    const rotation = rendered.rotation + current.parentRotation;
    frameRotation = rotation;
    Object.assign(frame.style, {
      display: "block",
      height: `${height}px`,
      left: `${rect.left + rect.width / 2 - width / 2}px`,
      top: `${rect.top + rect.height / 2 - height / 2}px`,
      transform: `rotate(${rotation}deg)`,
      width: `${width}px`,
    });
    const pose =
      current.between === null
        ? ""
        : `${POSE_NAMES[current.between.kind][current.between.editing]} · `;
    const hidden = revealed === current.node ? " · transparent here" : "";
    label.textContent = `${pose}${format(rendered.width)} × ${format(rendered.height)}${gesture?.handle === "rotate" ? ` · ${format(rendered.rotation)}°` : ""}${hidden}`;
    Object.assign(label.style, {
      display: "block",
      left: `${Math.max(4, Math.min(rect.left + rect.width / 2 - label.offsetWidth / 2, innerWidth - label.offsetWidth - 4))}px`,
      top: `${Math.max(4, Math.min(rect.bottom + 8, innerHeight - 24))}px`,
    });
    for (const { button, handle } of handles) {
      const disabled = handle === "rotate" && current.binding.rotation === null;
      button.style.display = disabled ? "none" : "grid";
      button.setAttribute(
        "aria-disabled",
        String(gesture?.phase === "committing" || !config?.enabled)
      );
      button.style.cursor = cursor(handle, rotation);
    }
  };
  const paint = (node: Element | null): boolean => {
    if (gesture && currentFrame() !== gesture.frame) {
      cancel();
    }
    if (gesture) {
      draw(gesture.target, gesture.values);
      return true;
    }
    target = geometryTarget(node, config);
    reveal(target?.node ?? null);
    if (!target) {
      frame.style.display = "none";
      label.style.display = "none";
      ghost.style.display = "none";
      path.style.display = "none";
      return false;
    }
    draw(target, target.values);
    return true;
  };
  const apply = () => {
    const current = gesture;
    if (!current) {
      return;
    }
    if (currentFrame() !== current.frame) {
      cancel();
      return;
    }
    const { rule } = current;
    const rendered = poseGeometry(current.values, current.target.pose);
    rule.setProperty("left", `${rendered.x}px`, "important");
    rule.setProperty("top", `${rendered.y}px`, "important");
    rule.setProperty("width", `${rendered.width}px`, "important");
    rule.setProperty("height", `${rendered.height}px`, "important");
    rule.setProperty("rotate", `${rendered.rotation}deg`, "important");
    draw(current.target, current.values);
    drawGuides(current.guides);
  };
  const screenBox = (
    current: Gesture,
    values: GeometryValues
  ): SnapBox | null => {
    const { target: moving } = current;
    const next = poseGeometry(values, moving.pose);
    const upright = (degrees: number) => {
      const turn = ((degrees % 360) + 360) % 360;
      return Math.min(turn, 360 - turn) <= 0.01;
    };
    if (!(upright(next.rotation) && upright(moving.parentRotation))) {
      return null;
    }
    const first = poseGeometry(moving.values, moving.pose);
    const centerX =
      current.centerX +
      (next.x + next.width / 2 - first.x - first.width / 2) *
        moving.parentScale;
    const centerY =
      current.centerY +
      (next.y + next.height / 2 - first.y - first.height / 2) *
        moving.parentScale;
    const width = next.width * moving.scale;
    const height = next.height * moving.scale;
    return {
      bottom: centerY + height / 2,
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: centerY - height / 2,
    };
  };
  const snapTargets = (node: HTMLElement): SnapLines => {
    const rects: SnapBox[] = [container.getBoundingClientRect()];
    for (const other of container.querySelectorAll<HTMLElement>(
      "[data-studio-object]"
    )) {
      if (other === node || other.contains(node) || node.contains(other)) {
        continue;
      }
      const rect = other.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        rects.push(rect);
      }
    }
    return snapLinesOf(rects);
  };
  const begin = (current: Gesture) => {
    if (current.phase !== "pending") {
      return;
    }
    current.phase = "dragging";
    pause();
    post({
      binding: current.target.binding,
      generation: current.target.generation,
      objectId: current.target.objectId,
      requestId: current.requestId,
      type: "studio.geometry.begin",
      values: current.target.values,
      video: current.target.video,
    });
  };
  const start = (
    current: GeometryTarget,
    handle: GeometryHandle,
    pointer: number,
    x: number,
    y: number
  ) => {
    const { node } = current;
    const rect = node.getBoundingClientRect();
    const token = crypto.randomUUID();
    const oldMarker = node.getAttribute(MARKER);
    const sheet = document.createElement("style");
    sheet.setAttribute(OVERLAY_ATTR, "");
    sheet.textContent = `[${MARKER}="${token}"] { transition: none !important; }
      .__remotion-player, .__remotion-player * { cursor: ${cursor(handle, poseGeometry(current.values, current.pose).rotation + current.parentRotation)} !important; user-select: none !important; }`;
    node.setAttribute(MARKER, token);
    styleRoot().append(sheet);
    const rule = ((sheet.sheet as CSSStyleSheet).cssRules[0] as CSSStyleRule)
      .style;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const next: Gesture = {
      accepted: false,
      angle: Math.atan2(y - centerY, x - centerX),
      centerX,
      centerY,
      frame: currentFrame(),
      guides: NO_GUIDES,
      handle,
      lines: snapTargets(node),
      nudge: { x: 0, y: 0 },
      phase: "pending",
      pointer,
      requestId: crypto.randomUUID(),
      restore: () => {
        sheet.remove();
        if (oldMarker === null) {
          node.removeAttribute(MARKER);
        } else {
          node.setAttribute(MARKER, oldMarker);
        }
      },
      rule,
      target: current,
      turn: 0,
      values: current.values,
      x,
      y,
    };
    gesture = next;
    lockCamera(frame, true);
    return next;
  };
  const transform = (
    current: Gesture,
    dx: number,
    dy: number,
    shift: boolean,
    angle: number
  ) => {
    const { target: moving } = current;
    const { pose } = moving;
    const posed = (value: number | null | undefined, field: GeometryKey) =>
      value === null || value === undefined
        ? null
        : value * pose.multiplier[field] + pose.offset[field];
    const bounds = Object.fromEntries(
      GEOMETRY_KEYS.map((field) => {
        const bound = moving.bounds[field];
        return [
          field,
          {
            max: posed(bound?.max, field),
            min: posed(bound?.min, field),
          },
        ];
      })
    );
    for (const key of ["width", "height"] as const) {
      bounds[key].min = Math.max(
        1,
        Math.max(1, moving.bounds[key]?.min ?? 1) * pose.multiplier[key] +
          pose.offset[key]
      );
    }
    const next = unposeGeometry(
      transformGeometry(
        poseGeometry(moving.values, pose),
        current.handle,
        dx,
        dy,
        shift,
        bounds,
        angle,
        pose.scale
      ),
      pose
    );
    for (const key of GEOMETRY_KEYS) {
      // Inverting a motion mapping must not turn unchanged fields into tiny edits.
      if (Math.abs(next[key] - moving.values[key]) < 1e-9) {
        next[key] = moving.values[key];
      }
      const bound = moving.bounds[key];
      if (
        !Number.isFinite(next[key]) ||
        next[key] < (bound?.min ?? Number.NEGATIVE_INFINITY) - 1e-9 ||
        next[key] > (bound?.max ?? Number.POSITIVE_INFINITY) + 1e-9
      ) {
        return moving.values;
      }
      next[key] = Math.min(
        bound?.max ?? Number.POSITIVE_INFINITY,
        Math.max(bound?.min ?? Number.NEGATIVE_INFINITY, next[key])
      );
    }
    return next;
  };
  const turnTo = (current: Gesture, event: PointerEvent) => {
    const next = Math.atan2(
      event.clientY - current.centerY,
      event.clientX - current.centerX
    );
    const delta = next - current.angle;
    current.turn +=
      (Math.atan2(Math.sin(delta), Math.cos(delta)) * 180) / Math.PI;
    current.angle = next;
  };
  const snapOf = (current: Gesture, event: PointerEvent): Snapped | null => {
    if (event.metaKey || event.ctrlKey) {
      return null;
    }
    const box = screenBox(current, current.values);
    if (box === null) {
      return null;
    }
    return snapBox(
      box,
      current.lines,
      snapSides(current.handle, event.shiftKey),
      SNAP_DISTANCE
    );
  };
  const move = (event: PointerEvent) => {
    const current = gesture;
    if (
      !current ||
      current.pointer !== event.pointerId ||
      current.phase === "committing"
    ) {
      return;
    }
    if (currentFrame() !== current.frame) {
      cancel();
      return;
    }
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (current.phase === "pending" && Math.hypot(dx, dy) < 3) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    begin(current);
    if (current.handle === "rotate") {
      turnTo(current, event);
    }
    const angle = (current.target.parentRotation * Math.PI) / 180;
    const scale = current.target.parentScale;
    const px = (Math.cos(angle) * dx + Math.sin(angle) * dy) / scale;
    const py = (-Math.sin(angle) * dx + Math.cos(angle) * dy) / scale;
    current.values = transform(current, px, py, event.shiftKey, current.turn);
    const snapped = snapOf(current, event);
    if (snapped !== null && (snapped.dx !== 0 || snapped.dy !== 0)) {
      current.values = transform(
        current,
        px + snapped.dx / scale,
        py + snapped.dy / scale,
        event.shiftKey,
        current.turn
      );
    }
    current.guides = snapped === null ? NO_GUIDES : snapped.guides;
    if (painting === 0) {
      painting = requestAnimationFrame(() => {
        painting = 0;
        apply();
      });
    }
  };
  const commit = () => {
    const current = gesture;
    if (!current || current.phase === "committing") {
      return;
    }
    if (
      current.phase === "pending" ||
      GEOMETRY_KEYS.every(
        (field) => current.values[field] === current.target.values[field]
      )
    ) {
      cancel();
      return;
    }
    current.guides = NO_GUIDES;
    apply();
    if (gesture !== current) {
      return;
    }
    current.phase = "committing";
    suppressClick = current.pointer >= 0;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      suppressClick = false;
    }, 0);
    post({
      requestId: current.requestId,
      type: "studio.geometry.commit",
      values: current.values,
    });
    timer = setTimeout(() => {
      cancel();
      explain(
        "The transform did not finish updating. Check its properties before trying again."
      );
    }, 6000);
  };
  const up = (event: PointerEvent) => {
    if (!gesture || gesture.pointer !== event.pointerId) {
      return;
    }
    if (gesture.phase !== "pending") {
      move(event);
      event.preventDefault();
      event.stopPropagation();
    }
    commit();
  };
  const lost = (event: PointerEvent) => {
    if (
      gesture?.pointer === event.pointerId &&
      gesture.phase !== "committing"
    ) {
      cancel();
    }
  };
  const blur = () => {
    if (gesture?.pointer === -1 && gesture.phase === "dragging") {
      commit();
    } else if (gesture?.phase !== "committing") {
      cancel();
    }
  };
  const resize = () => {
    if (gesture && gesture.phase !== "committing") {
      cancel();
    } else {
      onChange();
    }
  };
  const click = (event: MouseEvent) => {
    if (!suppressClick) {
      return;
    }
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const startNudge = (
    event: KeyboardEvent,
    handle: GeometryHandle
  ): Gesture | null => {
    if (!target) {
      return null;
    }
    if (!config?.enabled) {
      event.preventDefault();
      event.stopPropagation();
      return null;
    }
    if (handle === "rotate" && target.binding.rotation === null) {
      return null;
    }
    const fresh = geometryTarget(target.node, config);
    if (!fresh) {
      return null;
    }
    pause();
    const next = start(fresh, handle, -1, 0, 0);
    begin(next);
    return next;
  };
  const keydown = (event: KeyboardEvent) => {
    const arrow = ARROWS[event.key];
    const hit = eventElement(event);
    if (
      !arrow ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.isComposing ||
      hit?.closest(TYPING)
    ) {
      return;
    }
    if (gesture?.phase === "committing" && gesture.pointer === -1) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (gesture && gesture.pointer !== -1) {
      return;
    }
    const focused = hit?.closest<HTMLElement>("[data-geometry-handle]");
    const handle =
      focused && frame.contains(focused)
        ? (focused.dataset.geometryHandle as GeometryHandle)
        : "move";
    const current = gesture ?? startNudge(event, handle);
    if (current === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    current.nudge.x += arrow.x * step;
    current.nudge.y += arrow.y * step;
    current.turn += (arrow.x || arrow.y) * step;
    current.values = transform(
      current,
      current.nudge.x,
      current.nudge.y,
      false,
      current.turn
    );
    apply();
    clearTimeout(nudging);
    nudging = setTimeout(commit, NUDGE_SETTLE_MS);
  };

  const goToGhost = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if (ghostFrame === null || gesture !== null) {
      return;
    }
    seek(ghostFrame);
    focusSurface();
  };
  ghost.addEventListener("click", goToGhost);

  const stopCommands = route("geometry", {
    replay: cancel,
    seek: cancel,
    "studio.geometry.config": (command) => {
      config = command;
      if (
        gesture &&
        gesture.phase !== "committing" &&
        (!command.enabled ||
          command.objectId !== gesture.target.objectId ||
          command.generation !== gesture.target.generation)
      ) {
        cancel();
      }
      onChange();
    },
    "studio.geometry.result": (command) => {
      if (gesture === null || command.requestId !== gesture.requestId) {
        return;
      }
      if (command.error) {
        reset();
        explain(command.error);
      } else {
        gesture.accepted = true;
        settle();
      }
    },
    "transport.step": cancel,
    "transport.toggle": cancel,
  });
  post({ type: "studio.geometry.request" });
  const observer = new MutationObserver(() => {
    if (gesture) {
      const identity = managedIdentity(gesture.target.node);
      if (
        !gesture.target.node.isConnected ||
        identity?.generation !== gesture.target.generation ||
        currentFrame() !== gesture.frame ||
        (gesture.phase !== "committing" &&
          (gesture.target.node.getAttribute("data-studio-geometry") !==
            gesture.target.bindingAttribute ||
            gesture.target.node.getAttribute("data-studio-geometry-pose") !==
              gesture.target.poseAttribute ||
            gesture.target.node.getAttribute("data-studio-geometry-frame") !==
              gesture.target.frameAttribute))
      ) {
        cancel();
      } else {
        settle();
      }
    }
    onChange();
  });
  observer.observe(container, {
    attributeFilter: [
      "data-studio-generation",
      "data-studio-geometry",
      "data-studio-geometry-values",
      "data-studio-geometry-pose",
      "data-studio-geometry-frame",
      "data-studio-geometry-between",
    ],
    attributes: true,
    childList: true,
    subtree: true,
  });
  surfaceEvents.addEventListener("pointermove", move, true);
  surfaceEvents.addEventListener("pointerup", up, true);
  surfaceEvents.addEventListener("pointercancel", lost, true);
  surfaceEvents.addEventListener("lostpointercapture", lost, true);
  window.addEventListener("blur", blur);
  window.addEventListener("resize", resize);
  const stopView = onViewChange(resize);
  surfaceEvents.addEventListener("click", click, true);
  surfaceEvents.addEventListener("keydown", keydown, true);

  return {
    active: () => gesture !== null,
    cancel,
    contains: (eventTarget: EventTarget | null) =>
      eventTarget instanceof Node &&
      (frame.contains(eventTarget) || ghost.contains(eventTarget)),
    escape: () => {
      if (!gesture) {
        return false;
      }
      if (gesture.phase !== "committing") {
        cancel();
      }
      return true;
    },
    movable: (node: Element | null) => target !== null && target.node === node,
    paint,
    pointerDown: (event: PointerEvent) => {
      const onGhost = eventElement(event);
      if (onGhost !== null && ghost.contains(onGhost)) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      if (
        gesture ||
        !target ||
        !config?.enabled ||
        event.button !== 0 ||
        event.altKey
      ) {
        return false;
      }
      const hit = eventElement(event);
      const handle = hit?.closest<HTMLElement>("[data-geometry-handle]");
      const mode =
        handle && frame.contains(handle)
          ? (handle.dataset.geometryHandle as GeometryHandle)
          : "move";
      const own = hit !== null && managedRoot(hit, container) === target.node;
      const unreachable =
        (hit === null || !container.contains(hit)) &&
        insideFrame(event.clientX, event.clientY);
      if (mode === "move" && !own && !unreachable) {
        return false;
      }
      if (mode === "rotate" && target.binding.rotation === null) {
        return false;
      }
      const fresh = geometryTarget(target.node, config);
      if (!fresh) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      pause();
      focusSurface();
      handle?.focus({ preventScroll: true });
      start(fresh, mode, event.pointerId, event.clientX, event.clientY);
      container.setPointerCapture(event.pointerId);
      return true;
    },
    stop: () => {
      cancel();
      stopCommands();
      observer.disconnect();
      cancelAnimationFrame(painting);
      clearTimeout(noticeTimer);
      clearTimeout(clickTimer);
      surfaceEvents.removeEventListener("pointermove", move, true);
      surfaceEvents.removeEventListener("pointerup", up, true);
      surfaceEvents.removeEventListener("pointercancel", lost, true);
      surfaceEvents.removeEventListener("lostpointercapture", lost, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", resize);
      stopView();
      reveal(null);
      revealing.remove();
      surfaceEvents.removeEventListener("click", click, true);
      surfaceEvents.removeEventListener("keydown", keydown, true);
      clearTimeout(nudging);
      frame.remove();
      guides.x.remove();
      guides.y.remove();
      ghost.remove();
      path.remove();
      label.remove();
      notice.remove();
    },
  };
}

function overlay(tag: "div", depth: number) {
  const node = document.createElement(tag);
  node.setAttribute(OVERLAY_ATTR, "");
  Object.assign(node.style, {
    display: "none",
    pointerEvents: "none",
    position: "fixed",
    zIndex: String(depth),
  });
  return node;
}
function format(value: number) {
  return String(Math.round(value * 10) / 10);
}
function cursor(handle: GeometryHandle, rotation: number): string {
  if (handle === "move") {
    return "move";
  }
  if (handle === "rotate") {
    return "crosshair";
  }
  const x = handleSign(handle, "e", "w");
  const y = handleSign(handle, "s", "n");
  const angle = (Math.atan2(y, x) * 180) / Math.PI + rotation;
  const index = ((Math.round(angle / 45) % 4) + 4) % 4;
  return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][index];
}
function handleSign(
  handle: GeometryHandle,
  positive: string,
  negative: string
): number {
  if (handle.includes(positive)) {
    return 1;
  }
  if (handle.includes(negative)) {
    return -1;
  }
  return 0;
}
function handleLeft(handle: (typeof HANDLES)[number]): string {
  if (handle.includes("w")) {
    return "0";
  }
  if (handle.includes("e") && handle !== "rotate") {
    return "100%";
  }
  return "50%";
}
function handleTop(handle: (typeof HANDLES)[number]): string {
  if (handle === "rotate") {
    return "-26px";
  }
  if (handle.includes("n")) {
    return "0";
  }
  if (handle.includes("s")) {
    return "100%";
  }
  return "50%";
}
