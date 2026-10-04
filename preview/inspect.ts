import { anchorOf, CANVAS_SELECTOR, resolveAnchor } from "./anchor";
import { assetBase, assetNames, forgetAssets, staticBase } from "./assets";
import { post } from "./bridge";
import { displayName, fiberOf, nearestInFibers } from "./fiber";
import { createGeometryEditor, SELECTION_BOUNDS } from "./geometry";
import { createInlineTextEditor } from "./inline-text";
import { managedIdentity, managedRoots } from "./managed-objects";
import { covers, nearText, OVERLAY_ATTR, pickAt } from "./picker";
import {
  formatFrame,
  projectFrames,
  type SourceSpot,
  truncateMarkup,
  withoutRuntimeMarks,
} from "./source";
import {
  contentRoot,
  currentSurface,
  elementsAt,
  eventElement,
  focusSurface,
  onViewChange,
  overlayRoot,
  styleRoot,
  surface,
  surfaceEvents,
  surfaceHref,
} from "./surface";
import { windowOf } from "./timing";
import {
  controlsAt,
  controlsChain,
  type InteractiveLink,
  nameIn,
  plainName,
  type TargetWhere,
  type TuningTarget,
} from "./tuning";
import { targetsOf } from "./tuning-runtime";

const CANVAS = CANVAS_SELECTOR;
const MARKUP_LIMIT = 4000;
const PARENTS = 3;
const SELECTION_ATTR = "data-remocn-selection";
const PULSE_CLASS = "remocn-selection-pulse";
const CURSOR = "--remocn-inspect-cursor";
const EDITING =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
// Hand-copied from --reference's dark value in app/globals.css — this file is
// compiled by the project's webpack and cannot import the app's theme.
export const ACCENT = "oklch(0.715 0.143 215.221)";
export const ACCENT_SOFT = "oklch(0.715 0.143 215.221 / 0.12)";
const LABEL_INK = "oklch(0.18 0.01 260)";
export const TOP = 2_147_483_000;

const WRAPPERS = new Set([
  "AbsoluteFill",
  "Composition",
  "Fill",
  "Folder",
  "Freeze",
  "Loop",
  "Sequence",
  "Series",
  "Still",
  "TransitionSeries",
]);

// Remotion's own plumbing, by the shape of its names: the three
// `*SequenceRefForwardingFunction`s every `<Sequence>` renders through, and
// the higher-order component `Interactive.withSchema` wraps a component in.
const INTERNAL = /RefForwardingFunction$|^withInteractivitySchema\(/;

export type InspectStatus = "armed" | "disarmed" | "no-canvas";

export interface Scene {
  durationInFrames: number;
  frame: number;
  from: number;
  name: string;
}

export interface VideoConfig {
  durationInFrames: number;
  fps: number;
  height: number;
  width: number;
}

export interface Stage {
  composition: () => string;
  fps: () => number;
  frame: () => number;
  pause?: () => void;
  seek?: (frame: number) => void;
  // What the codemod resolves `fps`, `width`, `height` and `durationInFrames`
  // to when a prop is written as an expression over them. Only the page knows
  // it, so it rides with the selection rather than being asked for later.
  video: () => VideoConfig;
}

interface Session {
  readonly box: HTMLElement;
  readonly container: HTMLElement;
  readonly geometry: ReturnType<typeof createGeometryEditor>;
  readonly inline: ReturnType<typeof createInlineTextEditor>;
  readonly label: HTMLElement;
  readonly stage: Stage;
  readonly stop: () => void;
}

let session: Session | null = null;
let hovered: Element | null = null;
let listHovered: string | null = null;
let exact = false;
let point: { x: number; y: number } | null = null;
let painting = 0;
let pickVersion = 0;
// Where each `Interactive` of the last selection sits, so switching in the
// pane can point back at it. Captured at pick time, which is the only moment
// the whole chain is known.
let chain = new Map<string, Element>();
let picked: Element | null = null;
let selected: Element | null = null;
let managedSelected: { id: string; video: string; generation: string } | null =
  null;
let selection: { box: HTMLElement; tag: HTMLElement } | null = null;
let restoring: string | null = null;

export function canvas(): HTMLElement | null {
  return contentRoot().querySelector<HTMLElement>(CANVAS);
}

export function armInspect(armed: boolean, stage: Stage): InspectStatus {
  if (!armed) {
    close();
    return "disarmed";
  }

  const container = canvas();

  if (container === null) {
    return "no-canvas";
  }

  if (session?.container !== container) {
    close();
    session = start(container, stage);
  }
  restore();

  return "armed";
}

/**
 * Draw the box on one `Interactive` of the current selection, or clear it.
 *
 * The pane shows one link of the chain at a time, and nothing on screen said
 * which — `<Series>` and `CameraRig` are names, not places. This paints inside
 * the preview document, next to the hover box and for the same reason: it
 * shares a document with the pixels, so it cannot drift from them.
 */
// The box belongs to the *card*, not to the mode. Turning Inspect off while the
// pane is up still means "stop picking, not forget what I picked" — but once
// Cancel has closed the pane there is nothing on screen the box refers to, and
// leaving it there burns a rectangle and a component name into a frame the
// person is judging by eye, with no mode on and nothing to click to remove it.
export function highlightTarget(targetId: string | null, open: boolean): void {
  if (managedSelected !== null) {
    return;
  }
  if (!open) {
    selected = null;
    paint();
    return;
  }

  selected = targetId === null ? picked : (chain.get(targetId) ?? picked);
  paint();
}

export function hoverManaged(objectId: string | null): void {
  listHovered = objectId;
  paint();
}

export function highlightManaged(
  objectId: string | null,
  video: string,
  generation: string
): void {
  managedSelected =
    objectId === null ? null : { generation, id: objectId, video };
  selected = null;
  paint();
}

export function selectedAnchor(): string | null {
  const container = canvas();
  if (
    picked === null ||
    container === null ||
    !picked.isConnected ||
    managedIdentity(picked) !== null
  ) {
    return null;
  }
  return anchorOf(picked, container);
}

export function restoreSelection(anchor: string | null): void {
  restoring = anchor;
  restore();
}

function restore(): void {
  const current = session;
  if (restoring === null || current === null) {
    return;
  }
  const found = resolveAnchor(restoring, current.container);
  restoring = null;
  if (
    found === null ||
    found === current.container ||
    managedIdentity(found) !== null
  ) {
    return;
  }
  picked = found;
  selected = found;
  managedSelected = null;
  pickVersion += 1;
  paint();
  report(found, current.stage, false, pickVersion).catch(nothing);
}

export function clearSelection(): void {
  session?.inline.cancel();
  session?.geometry.cancel();
  pickVersion += 1;
  chain = new Map();
  picked = null;
  selected = null;
  managedSelected = null;
  // The rebuild that clears a selection is a turn having written to the
  // project, which is the one thing that changes what is in `public/`.
  forgetAssets();
  paint();
}

export function repaint(): void {
  if (session !== null && session.container !== canvas()) {
    armInspect(true, session.stage);
  }
  paint();
}

export function dismissSelection(notify = true): void {
  session?.inline.cancel();
  session?.geometry.cancel();
  pickVersion += 1;
  chain = new Map();
  picked = null;
  selected = null;
  managedSelected = null;
  hovered = null;
  paint();
  if (notify) {
    post({ type: "inspect.clear" });
  }
}

function forceHitTesting(): HTMLStyleElement {
  const style = document.createElement("style");
  style.setAttribute(OVERLAY_ATTR, "");
  style.textContent = `${CANVAS}, ${CANVAS} * {
    pointer-events: auto !important;
    cursor: var(--remocn-canvas-cursor, var(${CURSOR}, default)) !important;
  }`;
  styleRoot().append(style);
  return style;
}

function overCanvas(container: HTMLElement, x: number, y: number): boolean {
  const [top] = elementsAt(x, y);

  if (top !== undefined) {
    return container.contains(top);
  }

  return covers(container, x, y);
}

function start(container: HTMLElement, stage: Stage): Session {
  const { box, label } = overlay();
  const hitTesting = forceHitTesting();
  const stopView = onViewChange(paint);
  const cursor = container.style.getPropertyValue(CURSOR);
  const inline = createInlineTextEditor(container, ACCENT, TOP + 3, paint);
  const geometry = createGeometryEditor(
    container,
    ACCENT,
    TOP + 2,
    () => stage.pause?.(),
    () => stage.frame(),
    paint,
    (frame) => stage.seek?.(frame)
  );

  container.style.setProperty(CURSOR, "default");

  const onMove = (event: PointerEvent) => {
    if (geometry.active()) {
      return;
    }
    if (currentSurface()?.viewport.hasAttribute("data-preview-navigation")) {
      onLeave();
      return;
    }
    point = { x: event.clientX, y: event.clientY };
    exact = event.altKey;
    schedule(container);
  };

  const onLeave = () => {
    point = null;
    hovered = null;
    container.style.setProperty(CURSOR, "default");
    paint();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      exact = event.type === "keydown";
      schedule(container);
    }
    if (
      event.type === "keydown" &&
      event.key === "Escape" &&
      !event.defaultPrevented &&
      !eventElement(event)?.closest(EDITING)
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (geometry.escape()) {
        return;
      }
      dismissSelection();
    }
  };

  const onDown = (event: PointerEvent) => {
    if (inline.contains(eventElement(event))) {
      return;
    }
    if (inline.beforePick()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (geometry.pointerDown(event)) {
      return;
    }
    const menu = event.button === 2;
    if (
      (event.button !== 0 && !menu) ||
      !overCanvas(container, event.clientX, event.clientY)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    choose(
      pickAt(event.clientX, event.clientY, container, event.altKey) ?? hovered,
      menu
    );
  };

  const choose = (found: Element | null, menu: boolean) => {
    if (found === null || found === container) {
      if (!menu) {
        dismissSelection();
      }
      return;
    }

    stage.pause?.();
    focusSurface();

    const repeat =
      picked !== null &&
      anchorOf(picked, container) === anchorOf(found, container);

    if (menu && repeat) {
      post({ type: "canvas.menu" });
      return;
    }

    picked = found;
    selected = found;
    managedSelected = null;
    pickVersion += 1;
    paint();

    if (repeat) {
      pulse();
    }

    const version = pickVersion;
    report(found, stage, repeat, version)
      .then(() => {
        if (menu && version === pickVersion) {
          post({ type: "canvas.menu" });
        }
      })
      .catch(nothing);
  };

  // A click that picks must never also reach Remotion's `clickToPlay`
  // underneath it.
  const swallow = (event: MouseEvent) => {
    if (
      inline.contains(eventElement(event)) ||
      geometry.contains(eventElement(event))
    ) {
      return;
    }
    if (overCanvas(container, event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  surfaceEvents.addEventListener("pointermove", onMove, true);
  surfaceEvents.addEventListener("pointerdown", onDown, true);
  surfaceEvents.addEventListener("pointerup", swallow, true);
  surfaceEvents.addEventListener("click", swallow, true);
  surfaceEvents.addEventListener("dblclick", inline.doubleClick, true);
  surfaceEvents.addEventListener("keydown", onKey, true);
  surfaceEvents.addEventListener("keyup", onKey, true);
  container.addEventListener("pointerleave", onLeave);

  return {
    box,
    container,
    geometry,
    inline,
    label,
    stage,
    stop: () => {
      surfaceEvents.removeEventListener("pointermove", onMove, true);
      surfaceEvents.removeEventListener("pointerdown", onDown, true);
      surfaceEvents.removeEventListener("pointerup", swallow, true);
      surfaceEvents.removeEventListener("click", swallow, true);
      surfaceEvents.removeEventListener("dblclick", inline.doubleClick, true);
      surfaceEvents.removeEventListener("keydown", onKey, true);
      surfaceEvents.removeEventListener("keyup", onKey, true);
      container.removeEventListener("pointerleave", onLeave);
      if (cursor) {
        container.style.setProperty(CURSOR, cursor);
      } else {
        container.style.removeProperty(CURSOR);
      }
      box.remove();
      label.remove();
      stopView();
      hitTesting.remove();
      inline.stop();
      geometry.stop();
    },
  };
}

function close(): void {
  cancelAnimationFrame(painting);
  painting = 0;
  pickVersion += 1;
  session?.stop();
  session = null;
  hovered = null;
  listHovered = null;
  point = null;
  exact = false;
  paint();
}

function schedule(container: HTMLElement): void {
  if (painting !== 0) {
    return;
  }

  painting = requestAnimationFrame(() => {
    painting = 0;

    if (session === null || point === null) {
      return;
    }

    hovered = pickAt(point.x, point.y, container, exact);
    if (hovered === container) {
      hovered = null;
    }
    container.style.setProperty(CURSOR, cursorFor(hovered, point, session));
    paint();
  });
}

function cursorFor(
  target: Element | null,
  at: { x: number; y: number },
  active: Session
): string {
  if (target !== null && nearText(target, at.x, at.y)) {
    return "text";
  }
  return active.geometry.movable(target) ? "move" : "default";
}

function overlay(): { box: HTMLElement; label: HTMLElement } {
  const box = drawn(TOP);
  const label = tagged(TOP + 1);

  box.style.border = `1px solid ${ACCENT}`;
  box.style.opacity = "0.55";

  overlayRoot().append(box, label);

  return { box, label };
}

function selectionPair(): { box: HTMLElement; tag: HTMLElement } {
  if (selection?.box.isConnected === true) {
    return selection;
  }

  const box = drawn(TOP - 2);
  const tag = tagged(TOP - 1);

  box.setAttribute(SELECTION_ATTR, "");
  box.setAttribute(SELECTION_BOUNDS, "");
  box.style.border = `2px solid ${ACCENT}`;

  overlayRoot().append(pulseStyle());
  overlayRoot().append(box, tag);
  selection = { box, tag };

  return selection;
}

function pulseStyle(): HTMLStyleElement {
  const style = document.createElement("style");
  style.setAttribute(SELECTION_ATTR, "");
  style.textContent = `@keyframes ${PULSE_CLASS} {
  0% { outline: 0 solid ${ACCENT_SOFT}; }
  40% { outline: 2px solid ${ACCENT_SOFT}; }
  100% { outline: 0 solid ${ACCENT_SOFT}; }
}
[${SELECTION_ATTR}].${PULSE_CLASS} { animation: ${PULSE_CLASS} 250ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  [${SELECTION_ATTR}].${PULSE_CLASS} { animation: none; }
}`;

  return style;
}

function pulse(): void {
  const { box } = selectionPair();

  box.classList.remove(PULSE_CLASS);
  requestAnimationFrame(() => box.classList.add(PULSE_CLASS));
}

function drawn(depth: number): HTMLElement {
  const node = positioned(depth);

  node.style.boxSizing = "border-box";
  node.style.borderRadius = "2px";

  return node;
}

function tagged(depth: number): HTMLElement {
  const node = positioned(depth);

  node.style.background = ACCENT;
  node.style.color = LABEL_INK;
  node.style.borderRadius = "4px";
  node.style.padding = "2px 6px";
  node.style.font =
    "500 11px ui-sans-serif, system-ui, -apple-system, sans-serif";
  node.style.whiteSpace = "nowrap";

  return node;
}

function positioned(depth: number): HTMLElement {
  const node = document.createElement("div");

  node.setAttribute(OVERLAY_ATTR, "");
  node.style.position = "fixed";
  node.style.pointerEvents = "none";
  node.style.display = "none";
  node.style.left = "0";
  node.style.top = "0";
  node.style.zIndex = String(depth);

  return node;
}

function paint(): void {
  paintSelection();
  paintHover();
}

function paintSelection(): void {
  const { box, tag } = selectionPair();
  if (session?.inline.active()) {
    session.geometry.paint(null);
    place(box, tag, null);
    return;
  }
  const roots =
    managedSelected === null
      ? []
      : managedRoots(managedSelected.id).filter(
          (node) =>
            node.getAttribute("data-studio-video") === managedSelected?.video &&
            node.getAttribute("data-studio-generation") ===
              managedSelected?.generation
        );
  const root =
    (picked !== null && roots.includes(picked) ? picked : null) ??
    roots.find((node) => node.getBoundingClientRect().width > 0) ??
    null;
  const showing = managedSelected === null ? selected : root;
  place(box, tag, session?.geometry.paint(showing) ? null : showing);
}

function paintHover(): void {
  if (session === null) {
    return;
  }

  const showing =
    listHovered === null
      ? hovered
      : (managedRoots(listHovered).find(
          (node) => node.getBoundingClientRect().width > 0
        ) ?? null);
  const isSelected =
    showing !== null &&
    (showing === selected ||
      (managedSelected !== null &&
        managedIdentity(showing)?.objectId === managedSelected.id));
  place(
    session.box,
    session.label,
    isSelected || session.inline.active() || session.geometry.active()
      ? null
      : showing
  );
  session.label.style.display = "none";
}

function place(
  box: HTMLElement,
  label: HTMLElement,
  showing: Element | null
): void {
  if (showing === null || !showing.isConnected) {
    box.style.display = "none";
    label.style.display = "none";
    return;
  }

  const rect = showing.getBoundingClientRect();

  box.style.display = "block";
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;

  label.textContent = nameOf(showing);
  label.style.display = "block";
  label.style.left = `${Math.max(0, rect.left)}px`;
  label.style.top =
    rect.top > 20 ? `${rect.top - 19}px` : `${rect.bottom + 4}px`;
}

export function nameOf(element: Element): string {
  const managedLabel = element.getAttribute("data-studio-label");
  if (managedLabel !== null) {
    return managedLabel;
  }
  const tag = element.tagName.toLowerCase();
  const controls = controlsAt(element);
  const label =
    (controls === null
      ? null
      : nameIn(controls.currentRuntimeValueDotNotation)) ??
    componentAt(element);

  return label === null ? tag : `${plainName(label)} · ${tag}`;
}

/**
 * The name of the thing you are pointing at, which is the component you could
 * tune — not the machinery around it. The nearest fiber's display name is
 * whatever happens to be closest, and inside a Remotion tree that is routinely
 * `RegularSequenceRefForwardingFunction`: true, and useless to read.
 */
export function componentAt(element: Element): string | null {
  const controls = controlsAt(element);

  if (controls !== null) {
    return controls.componentName;
  }

  return nearestInFibers(element, (fiber) => {
    const name = displayName(fiber);

    return name !== null && !WRAPPERS.has(name) && !INTERNAL.test(name)
      ? name
      : null;
  });
}

async function report(
  element: Element,
  stage: Stage,
  repeat: boolean,
  version: number
): Promise<void> {
  const frame = stage.frame();
  const composition = stage.composition();
  const fps = stage.fps();
  const video = stage.video();
  const rect = normalise(element.getBoundingClientRect());
  const managed = managedIdentity(element);
  if (managed !== null) {
    post({ type: "studio.select", ...managed });
    return;
  }
  const { getStack, project: root } = surface();
  const stackOf = async (node: Element) =>
    projectFrames(root, await getStack(node).catch(nothing));
  const container = canvas();
  const links = controlsChain(element);

  const [stack, sources] = await Promise.all([
    stackOf(element),
    Promise.all(
      links.map(async (link) =>
        link.node === null ? null : ((await stackOf(link.node)).at(0) ?? null)
      )
    ),
  ]);

  if (version !== pickVersion || !element.isConnected) {
    return;
  }

  chain = chainOf(links, container);
  const wheres = wheresOf(links, sources, container);

  const target = stack.at(0) ?? null;
  const assets = await assetNames();

  if (version !== pickVersion || !element.isConnected) {
    return;
  }

  post({
    assetBase: assetBase(staticBase(), surfaceHref()),
    assets,
    element: {
      column: target?.column ?? null,
      component: target?.name ?? null,
      composition,
      file: target?.file ?? null,
      fps,
      frame,
      html: truncateMarkup(
        withoutRuntimeMarks(element.outerHTML),
        MARKUP_LIMIT
      ),
      line: target?.line ?? null,
      scene: sceneOf(element, frame),
      stack: parentsOf(stack, target).map(formatFrame),
    },
    fonts: loadedFonts(),
    rect,
    repeat,
    text: directText(links.at(0)?.node ?? element),
    tuning: located(targetsOf(element), wheres),
    type: "selection",
    video,
    window: windowOf(element),
  });
}

function chainOf(
  links: readonly InteractiveLink[],
  container: HTMLElement | null
): Map<string, Element> {
  const next = new Map<string, Element>();

  for (const { controls, node } of links) {
    if (node === null) {
      continue;
    }

    if (container !== null) {
      next.set(anchorOf(node, container), node);
    }

    next.set(controls.overrideId, node);
  }

  return next;
}

function wheresOf(
  links: readonly InteractiveLink[],
  sources: readonly (SourceSpot | null)[],
  container: HTMLElement | null
): Map<string, TargetWhere | null> {
  const wheres = new Map<string, TargetWhere | null>();

  for (const [at, link] of links.entries()) {
    const where = whereOf(sources[at] ?? null);

    if (container !== null && link.node !== null) {
      wheres.set(anchorOf(link.node, container), where);
    }

    wheres.set(link.controls.overrideId, where);
  }

  return wheres;
}

function loadedFonts(): string[] {
  const faces = (document as { fonts?: Iterable<{ family?: unknown }> }).fonts;

  if (faces === undefined) {
    return [];
  }

  const families = new Set<string>();

  for (const face of faces) {
    if (typeof face.family === "string" && face.family.length > 0) {
      families.add(face.family);
    }
  }

  return [...families];
}

function directText(node: Element | null): string | null {
  if (node === null || node.childNodes.length !== 1) {
    return null;
  }

  const child = node.firstChild;
  const text =
    child?.nodeType === Node.TEXT_NODE ? (child.nodeValue ?? "") : "";

  return text.trim().length === 0 ? null : text;
}

function located(
  targets: readonly TuningTarget[],
  wheres: ReadonlyMap<string, TargetWhere | null>
): TuningTarget[] {
  return targets.map((target) => ({
    ...target,
    where: wheres.get(target.instanceId) ?? wheres.get(target.targetId) ?? null,
  }));
}

function whereOf(spot: SourceSpot | null): TargetWhere | null {
  return spot === null
    ? null
    : { column: spot.column, file: spot.file, line: spot.line };
}

function parentsOf(
  stack: readonly SourceSpot[],
  target: SourceSpot | null
): SourceSpot[] {
  const first = stack.at(0);
  const rest =
    target !== null && first?.file === target.file && first.line === target.line
      ? stack.slice(1)
      : stack;

  return rest.slice(0, PARENTS);
}

function normalise(rect: DOMRect) {
  const bounds = canvas()?.getBoundingClientRect();
  const width = bounds?.width || 1;
  const height = bounds?.height || 1;

  return {
    height: rect.height / height,
    width: rect.width / width,
    x: (rect.left - (bounds?.left ?? 0)) / width,
    y: (rect.top - (bounds?.top ?? 0)) / height,
  };
}

export function sceneOf(node: Element, frame: number): Scene | null {
  let fiber = fiberOf(node);
  let inner: string | null = null;

  while (fiber !== null) {
    const timing = sequenceTiming(fiber.memoizedProps);

    if (timing !== null) {
      return {
        ...timing,
        frame: frame - timing.from,
        name: labelOf(fiber.memoizedProps) ?? inner ?? "",
      };
    }

    const name = displayName(fiber);
    if (name !== null && !WRAPPERS.has(name)) {
      inner = name;
    }

    fiber = fiber.return;
  }

  return null;
}

function sequenceTiming(
  props: Record<string, unknown> | null
): { durationInFrames: number; from: number } | null {
  const from = props?.from;
  const durationInFrames = props?.durationInFrames;

  return typeof from === "number" &&
    Number.isFinite(from) &&
    typeof durationInFrames === "number" &&
    Number.isFinite(durationInFrames)
    ? {
        durationInFrames: Math.trunc(durationInFrames),
        from: Math.trunc(from),
      }
    : null;
}

function labelOf(props: Record<string, unknown> | null): string | null {
  const name = props?.name;
  return typeof name === "string" && name.length > 0 ? name : null;
}

const nothing = () => null;
