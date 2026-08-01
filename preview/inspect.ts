import { post } from "./bridge";
import { OVERLAY_ATTR, pickAt } from "./picker";
import {
  absolutise,
  formatFrame,
  projectFrames,
  type SourceSpot,
  type StackFrame,
  truncateMarkup,
} from "./source";

const CANVAS = ".__remotion-player";
const MARKUP_LIMIT = 4000;
const PARENTS = 3;
const FIBER_KEY = "__reactFiber$";
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

interface GrabSource {
  columnNumber: number | null;
  componentName: string | null;
  filePath: string;
  lineNumber: number | null;
}

interface GrabApi {
  getDisplayName: (element: Element) => string | null;
  getSource: (element: Element) => Promise<GrabSource | null>;
  registerPlugin: (plugin: unknown) => void;
}

interface GrabModule {
  getStack: (element: Element) => Promise<StackFrame[] | null>;
  init: (options: Record<string, unknown>) => GrabApi;
}

interface Fiber {
  memoizedProps: Record<string, unknown> | null;
  return: Fiber | null;
  type: unknown;
}

export type InspectStatus = "armed" | "disarmed" | "no-canvas" | "no-grab";

export interface Scene {
  durationInFrames: number;
  frame: number;
  from: number;
  name: string;
}

export interface Stage {
  composition: () => string;
  fps: () => number;
  frame: () => number;
}

interface Session {
  readonly box: HTMLElement;
  readonly container: HTMLElement;
  readonly label: HTMLElement;
  readonly stop: () => void;
}

let api: GrabApi | null = null;
let session: Session | null = null;
let hovered: Element | null = null;
let frozen = false;
let exact = false;
let point: { x: number; y: number } | null = null;
let painting = 0;

export function canvas(): HTMLElement | null {
  return document.querySelector<HTMLElement>(CANVAS);
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

  close();
  session = start(container, stage);

  return grab() === null ? "no-grab" : "armed";
}

export function freezeInspect(next: boolean): void {
  frozen = next;

  if (frozen) {
    hovered = null;
    paint();
  }
}

function grab(): GrabApi | null {
  if (api !== null) {
    return api;
  }

  const module = grabModule();
  const container = canvas();

  if (module === null || container === null) {
    return null;
  }

  api = module.init({
    activationKey: () => false,
    activationMode: "toggle",
    container,
    enabled: true,
    maxContextLines: PARENTS,
    telemetry: false,
  });

  api.registerPlugin({
    name: "remocn-studio",
    theme: {
      dragBox: { enabled: false },
      elementLabel: { enabled: false },
      grabbedBoxes: { enabled: false },
      selectionBox: { enabled: false },
      toolbar: { enabled: false },
    },
  });

  return api;
}

function start(container: HTMLElement, stage: Stage): Session {
  const { box, label } = overlay();

  const onMove = (event: PointerEvent) => {
    point = { x: event.clientX, y: event.clientY };
    exact = event.altKey;
    schedule(container);
  };

  const onLeave = () => {
    point = null;
    hovered = null;
    paint();
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      exact = event.type === "keydown";
      schedule(container);
    }
  };

  const onDown = (event: PointerEvent) => {
    if (frozen || !container.contains(event.target as Node)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const picked =
      pickAt(event.clientX, event.clientY, container, event.altKey) ?? hovered;

    if (picked !== null) {
      report(picked, stage).catch(nothing);
    }
  };

  const swallow = (event: Event) => {
    if (!frozen && container.contains(event.target as Node)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointerup", swallow, true);
  window.addEventListener("click", swallow, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);
  container.addEventListener("pointerleave", onLeave);

  return {
    box,
    container,
    label,
    stop: () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", swallow, true);
      window.removeEventListener("click", swallow, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      container.removeEventListener("pointerleave", onLeave);
      box.remove();
      label.remove();
    },
  };
}

function close(): void {
  session?.stop();
  session = null;
  hovered = null;
  point = null;
  exact = false;
  frozen = false;
}

function schedule(container: HTMLElement): void {
  if (painting !== 0) {
    return;
  }

  painting = requestAnimationFrame(() => {
    painting = 0;

    if (session === null || frozen || point === null) {
      return;
    }

    hovered = pickAt(point.x, point.y, container, exact);
    paint();
  });
}

function overlay(): { box: HTMLElement; label: HTMLElement } {
  const box = document.createElement("div");
  const label = document.createElement("div");

  for (const node of [box, label]) {
    node.setAttribute(OVERLAY_ATTR, "");
    node.style.position = "fixed";
    node.style.pointerEvents = "none";
    node.style.display = "none";
    node.style.left = "0";
    node.style.top = "0";
  }

  box.style.zIndex = String(TOP);
  box.style.boxSizing = "border-box";
  box.style.border = `1px solid ${ACCENT}`;
  box.style.background = ACCENT_SOFT;
  box.style.borderRadius = "2px";

  label.style.zIndex = String(TOP + 1);
  label.style.background = ACCENT;
  label.style.color = LABEL_INK;
  label.style.borderRadius = "4px";
  label.style.padding = "2px 6px";
  label.style.font =
    "500 11px ui-sans-serif, system-ui, -apple-system, sans-serif";
  label.style.whiteSpace = "nowrap";

  document.body.append(box, label);

  return { box, label };
}

function paint(): void {
  if (session === null) {
    return;
  }

  const { box, label } = session;

  if (hovered === null) {
    box.style.display = "none";
    label.style.display = "none";
    return;
  }

  const rect = hovered.getBoundingClientRect();

  box.style.display = "block";
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;

  label.textContent = nameOf(hovered);
  label.style.display = "block";
  label.style.left = `${Math.max(0, rect.left)}px`;
  label.style.top =
    rect.top > 20 ? `${rect.top - 19}px` : `${rect.bottom + 4}px`;
}

function nameOf(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const component = api?.getDisplayName(element) ?? null;

  return component === null ? tag : `${component}.${tag}`;
}

async function report(element: Element, stage: Stage): Promise<void> {
  const module = grabModule();
  const found = grab();
  const root = rootPath();

  const [spot, frames] = await Promise.all([
    found === null ? null : found.getSource(element).catch(nothing),
    module === null ? null : module.getStack(element).catch(nothing),
  ]);

  const stack = projectFrames(root, frames);
  const target = resolved(root, spot) ?? stack.at(0) ?? null;
  const frame = stage.frame();

  post({
    element: {
      column: target?.column ?? null,
      component: spot?.componentName ?? target?.name ?? null,
      composition: stage.composition(),
      file: target?.file ?? null,
      fps: stage.fps(),
      frame,
      html: truncateMarkup(element.outerHTML, MARKUP_LIMIT),
      line: target?.line ?? null,
      scene: sceneOf(element, frame),
      stack: parentsOf(stack, target).map(formatFrame),
    },
    rect: normalise(element.getBoundingClientRect()),
    type: "selection",
  });
}

function resolved(root: string, spot: GrabSource | null): SourceSpot | null {
  const file = absolutise(root, spot?.filePath);

  return file === null || spot === null
    ? null
    : {
        column: spot.columnNumber,
        file,
        line: spot.lineNumber,
        name: spot.componentName,
      };
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
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;

  return {
    height: rect.height / height,
    width: rect.width / width,
    x: rect.left / width,
    y: rect.top / height,
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

function displayName(fiber: Fiber): string | null {
  const type = fiber.type as
    | { displayName?: string; name?: string }
    | string
    | null;

  if (type === null || typeof type === "string") {
    return null;
  }

  const name = type.displayName ?? type.name;

  return typeof name === "string" && name.length > 0 ? name : null;
}

function fiberOf(node: Element): Fiber | null {
  const key = Object.keys(node).find((own) => own.startsWith(FIBER_KEY));

  return key === undefined
    ? null
    : ((node as unknown as Record<string, Fiber>)[key] ?? null);
}

function grabModule(): GrabModule | null {
  return (
    (globalThis as unknown as { __REACT_GRAB_MODULE__?: GrabModule })
      .__REACT_GRAB_MODULE__ ?? null
  );
}

function rootPath(): string {
  return (window as unknown as { remocn_root?: string }).remocn_root ?? "/";
}

const nothing = () => null;
