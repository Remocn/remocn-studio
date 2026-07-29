import { post } from "./bridge";
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
const REFERENCE_HUE = 195;
const FIBER_KEY = "__reactFiber$";

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
  activate: () => void;
  deactivate: () => void;
  getPlugins: () => string[];
  getSource: (element: Element) => Promise<GrabSource | null>;
  isActive: () => boolean;
  registerPlugin: (plugin: unknown) => void;
}

export type InspectStatus =
  | "armed"
  | "disarmed"
  | "inert"
  | "no-canvas"
  | "no-grab";

interface GrabModule {
  getStack: (element: Element) => Promise<StackFrame[] | null>;
  init: (options: Record<string, unknown>) => GrabApi;
}

interface Fiber {
  memoizedProps: Record<string, unknown> | null;
  return: Fiber | null;
  type: unknown;
}

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

let api: GrabApi | null = null;

export function canvas(): HTMLElement | null {
  return document.querySelector<HTMLElement>(CANVAS);
}

export function armInspect(armed: boolean, stage: Stage): InspectStatus {
  if (!armed) {
    api?.deactivate();
    return "disarmed";
  }

  if (grabModule() === null) {
    return "no-grab";
  }

  if (canvas() === null) {
    return "no-canvas";
  }

  const grab = open(stage);

  if (grab === null) {
    return "no-grab";
  }

  grab.activate();

  return grab.isActive() ? "armed" : "inert";
}

export function freezeInspect(frozen: boolean): void {
  if (api === null) {
    return;
  }

  if (frozen) {
    api.deactivate();
    return;
  }

  api.activate();
}

function open(stage: Stage): GrabApi | null {
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
    theme: {
      dragBox: { enabled: false },
      elementLabel: { enabled: false },
      grabbedBoxes: { enabled: false },
      hue: REFERENCE_HUE,
      toolbar: { enabled: false },
    },
  });

  const grab = api;

  grab.registerPlugin({
    hooks: {
      onElementSelect: (element: Element) => {
        report(grab, module, element, stage).catch(nothing);
        return true;
      },
    },
    name: "remocn-studio",
  });

  module.getStack(container).catch(nothing);

  return grab;
}

async function report(
  grab: GrabApi,
  module: GrabModule,
  element: Element,
  stage: Stage
): Promise<void> {
  const root = rootPath();

  const [spot, frames] = await Promise.all([
    grab.getSource(element).catch(nothing),
    module.getStack(element).catch(nothing),
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
