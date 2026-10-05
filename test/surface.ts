import { configureBridge } from "@/preview/bridge";
import type {
  EntrySignal,
  PreviewCommand,
  PreviewMessage,
} from "@/preview/protocol";
import { configureSurface, type SurfaceEnvironment } from "@/preview/surface";

export interface TestSurface {
  dispose: () => void;
  flush: () => Promise<void>;
  host: HTMLElement;
  overlays: HTMLElement;
  pointAt: (elements: Element[]) => void;
  root: ShadowRoot;
  send: (command: PreviewCommand) => void;
  sent: (PreviewMessage | EntrySignal)[];
  viewport: HTMLElement;
}

const live = new Set<TestSurface>();

export function withSurface(
  overrides: Partial<SurfaceEnvironment> = {}
): TestSurface {
  const viewport = document.createElement("div");
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  const overlays = document.createElement("div");
  viewport.append(host, overlays);
  document.body.append(viewport);

  const sent: (PreviewMessage | EntrySignal)[] = [];
  const commands = new Set<(command: PreviewCommand) => void>();
  const stopSurface = configureSurface({
    assets: "http://127.0.0.1:4000/static",
    composition: "main",
    getStack: async () => null,
    overlays,
    preferred: null,
    project: "/project",
    root,
    url: "http://127.0.0.1:4000/",
    viewport,
    ...overrides,
  });
  const stopBridge = configureBridge({
    emit: (message) => {
      sent.push(message);
    },
    subscribe: (receive) => {
      commands.add(receive);
      return () => {
        commands.delete(receive);
      };
    },
  });

  const pointed = {
    document: Object.getOwnPropertyDescriptor(document, "elementFromPoint"),
    root: Object.getOwnPropertyDescriptor(root, "elementsFromPoint"),
  };
  const restore = () => {
    for (const [target, name, descriptor] of [
      [document, "elementFromPoint", pointed.document],
      [root, "elementsFromPoint", pointed.root],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(target, name, descriptor);
      } else {
        delete (target as unknown as Record<string, unknown>)[name];
      }
    }
  };

  const surface: TestSurface = {
    dispose: () => {
      if (!live.delete(surface)) {
        return;
      }
      stopSurface();
      stopBridge();
      commands.clear();
      restore();
      viewport.remove();
    },
    flush: () => new Promise((resolve) => queueMicrotask(resolve)),
    host,
    overlays,
    pointAt: (elements) => {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: () => host,
        writable: true,
      });
      Object.defineProperty(root, "elementsFromPoint", {
        configurable: true,
        value: () => elements,
        writable: true,
      });
    },
    root,
    send: (command) => {
      for (const receive of [...commands]) {
        receive(command);
      }
    },
    sent,
    viewport,
  };
  live.add(surface);
  return surface;
}

export function disposeSurfaces(): void {
  for (const surface of [...live]) {
    surface.dispose();
  }
}
