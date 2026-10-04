import { Data, Effect, Queue, Schema, Stream } from "effect";
import type {
  EntrySignal,
  MessageOf,
  PreviewMessage,
} from "@/preview/protocol";
import type { PreviewCommand } from "./preview";
import type { PreviewSurface, StampedMessage } from "./preview-channel";

export class NativePreviewError extends Data.TaggedError("NativePreviewError")<{
  readonly message: string;
}> {}

export type NativePreviewState =
  | { readonly phase: "loading" }
  | { readonly phase: "ready"; readonly stale: string | null }
  | { readonly phase: "failed"; readonly message: string };

const MANIFEST_PATH = "/__remocn/native";
const EVENTS_PATH = "/__remocn/hot";
const MESSAGE_SOURCE = "remocn-preview";
const BEHIND_MS = 8000;
const SOURCE_MAP = /(\/\/# sourceMappingURL=)(\S+)\s*$/;

const COMPILE_FAILED =
  "The canvas preview could not compile. Restart the preview and try again.";
const LOAD_FAILED =
  "The canvas preview could not load. Restart the preview host and retry.";
const PREPARE_SLOW =
  "Preparing the canvas took too long. Restart the preview host and retry.";
const INVALID_ADDRESS = "The preview returned an invalid resource address.";
const BUNDLE_FAILED = "The video bundle could not load. Retry the preview.";
const START_FAILED =
  "The video bundle could not start. Fix the project or restart the preview host.";
const RENDER_FAILED =
  "The video could not render. Fix the project, then retry the preview.";
const PAINT_SLOW = "The new version of the video took too long to draw.";
const STALE =
  "The latest change could not be shown. Showing the previous version.";

const Manifest = Schema.Struct({
  assets: Schema.String,
  events: Schema.String,
  generation: Schema.Int,
  preferred: Schema.NullOr(Schema.String),
  project: Schema.String,
  script: Schema.String,
  version: Schema.Literal(1),
});
type Manifest = typeof Manifest.Type;

interface RuntimePosition {
  frame: number;
  muted: boolean;
  playing: boolean;
  volume: number;
}

interface RuntimeSession {
  dispose: () => void;
  position: () => RuntimePosition | null;
  selection: () => string | null;
  start: (position: RuntimePosition | null, selection: string | null) => void;
}

interface NativeRuntime {
  mount: (
    element: HTMLElement,
    environment: {
      root: ShadowRoot;
      composition: string | null;
      preferred: string | null;
      viewport: HTMLElement;
      overlays: HTMLElement;
      assets: string;
      url: string;
      project: string;
      position: RuntimePosition | null;
      getStack: (element: Element) => Promise<
        | {
            fileName?: string;
            functionName?: string;
            lineNumber?: number;
            columnNumber?: number;
          }[]
        | null
      >;
      emit: (message: PreviewMessage | EntrySignal) => void;
      subscribe: (receive: (command: PreviewCommand) => void) => () => void;
    }
  ) => RuntimeSession;
}

export interface StagedDocument {
  readonly lastOperationId: string | null;
  readonly video: string;
}

export interface NativePreviewOptions {
  accepts: (document: StagedDocument | null) => boolean;
  attach: (surface: PreviewSurface) => () => void;
  onState: (state: NativePreviewState) => void;
  overlays: HTMLElement;
  stage: HTMLElement;
  url: string;
  viewport: HTMLElement;
}

interface Slot {
  readonly dispose: () => void;
  readonly document: () => StagedDocument | null;
  readonly generation: number;
  readonly painted: Effect.Effect<void, NativePreviewError>;
  readonly position: () => RuntimePosition | null;
  readonly reveal: (
    position: RuntimePosition | null,
    selection: string | null,
    rebuilt: boolean
  ) => void;
  readonly selection: () => string | null;
}

interface Session {
  current: Slot | null;
  readonly release: () => void;
  released: boolean;
  readonly slots: Set<Slot>;
  readonly swap: (slot: Slot) => void;
}

const REMOTION_GLOBALS = {
  remotion_audioEnabled: true,
  remotion_audioLatencyHint: "playback",
  remotion_envVariables: "{}",
  remotion_isStudio: false,
  remotion_logLevel: "info",
  remotion_numberOfAudioTags: 0,
  remotion_previewSampleRate: 48_000,
  remotion_sampleRate: 48_000,
  remotion_staticBase: "",
  remotion_videoEnabled: true,
};

const HOST_RESET =
  ":host{all:initial;display:block;color:#000;font:16px/normal sans-serif;text-align:start;color-scheme:normal}*,*::before,*::after{box-sizing:border-box}";

let owner: Session | null = null;

function ownedGlobal(key: string): boolean {
  return (
    key.startsWith("remotion_") ||
    key.startsWith("remocn_native_") ||
    key === "__remocnNativeBundle"
  );
}

const failure = (message: string) => new NativePreviewError({ message });

export function runNativePreview(options: NativePreviewOptions) {
  return Effect.gen(function* () {
    const base = new URL(options.url);
    const session = yield* Effect.acquireRelease(claim(), (held) =>
      Effect.sync(held.release)
    );

    const rebuilds = Stream.callback<void>(
      (queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            Queue.offerUnsafe(queue, undefined);
            const events = new EventSource(new URL(EVENTS_PATH, base));
            let opened = false;
            events.addEventListener("native-rebuilt", () =>
              Queue.offerUnsafe(queue, undefined)
            );
            events.addEventListener("open", () => {
              if (opened) {
                Queue.offerUnsafe(queue, undefined);
              }
              opened = true;
            });
            return events;
          }),
          (events) => Effect.sync(() => events.close())
        ),
      { bufferSize: 1, strategy: "sliding" }
    );

    yield* rebuilds.pipe(
      Stream.switchMap(() => Stream.fromEffect(stage(session, base, options))),
      Stream.runDrain
    );
  }).pipe(Effect.scoped);
}

function stage(session: Session, base: URL, options: NativePreviewOptions) {
  return Effect.gen(function* () {
    const manifest = yield* fetchManifest(base);
    if (
      session.current !== null &&
      session.current.generation === manifest.generation
    ) {
      return;
    }
    const source = yield* fetchScript(manifest.script);
    const slot = yield* Effect.acquireRelease(
      Effect.try({
        catch: () => failure(START_FAILED),
        try: () => mountSlot(session, manifest, source, base, options),
      }),
      (held) =>
        Effect.sync(() => {
          if (session.current !== held) {
            held.dispose();
          }
        })
    );
    yield* slot.painted.pipe(
      Effect.timeoutOrElse({
        duration: "30 seconds",
        orElse: () => Effect.fail(failure(PAINT_SLOW)),
      })
    );
    yield* settled(slot, options);
    yield* Effect.try({
      catch: () => failure(START_FAILED),
      try: () => session.swap(slot),
    });
    options.onState({ phase: "ready", stale: null });
  }).pipe(
    Effect.scoped,
    Effect.catch((error) =>
      Effect.sync(() => {
        if (session.released) {
          return;
        }
        options.onState(
          session.current === null
            ? { message: error.message, phase: "failed" }
            : { phase: "ready", stale: STALE }
        );
      })
    )
  );
}

function settled(slot: Slot, options: NativePreviewOptions) {
  return Effect.gen(function* () {
    const started = Date.now();
    const ready = () => {
      const editing = options.viewport.hasAttribute("data-preview-editing");
      const waited = Date.now() - started > BEHIND_MS;
      return !editing && (waited || options.accepts(slot.document()));
    };
    while (!ready()) {
      yield* Effect.sleep("100 millis");
    }
  });
}

function fetchManifest(base: URL) {
  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      catch: () => failure(LOAD_FAILED),
      try: (signal) =>
        fetch(new URL(MANIFEST_PATH, base), { cache: "no-store", signal }),
    });
    if (!response.ok) {
      return yield* Effect.fail(failure(COMPILE_FAILED));
    }
    const body = yield* Effect.tryPromise({
      catch: () => failure(LOAD_FAILED),
      try: () => response.json() as Promise<unknown>,
    });
    const manifest = yield* Schema.decodeUnknownEffect(Manifest)(body).pipe(
      Effect.mapError(() => failure(LOAD_FAILED))
    );
    for (const href of [manifest.script, manifest.assets, manifest.events]) {
      if (new URL(href).origin !== base.origin) {
        return yield* Effect.fail(failure(INVALID_ADDRESS));
      }
    }
    return manifest;
  }).pipe(
    Effect.timeoutOrElse({
      duration: "90 seconds",
      orElse: () => Effect.fail(failure(PREPARE_SLOW)),
    })
  );
}

function fetchScript(url: string) {
  return Effect.tryPromise({
    catch: () => failure(BUNDLE_FAILED),
    try: async (signal) => {
      const response = await fetch(url, { cache: "no-store", signal });
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      return response.text();
    },
  }).pipe(
    Effect.timeoutOrElse({
      duration: "30 seconds",
      orElse: () => Effect.fail(failure(BUNDLE_FAILED)),
    })
  );
}

function claim() {
  return Effect.sync(() => {
    owner?.release();
    const globals = window as unknown as Record<string, unknown>;
    const before = new Map(
      Object.entries(Object.getOwnPropertyDescriptors(window)).filter(([key]) =>
        ownedGlobal(key)
      )
    );
    Object.assign(globals, REMOTION_GLOBALS);
    const session: Session = {
      current: null,
      release: () => {
        if (session.released) {
          return;
        }
        session.released = true;
        session.current = null;
        try {
          for (const slot of [...session.slots]) {
            slot.dispose();
          }
        } finally {
          restoreGlobals(globals, before);
          if (owner === session) {
            owner = null;
          }
        }
      },
      released: false,
      slots: new Set(),
      swap: (slot) => {
        const previous = session.current;
        const position = previous?.position() ?? null;
        const selection = previous?.selection() ?? null;
        session.current = slot;
        previous?.dispose();
        slot.reveal(position, selection, previous !== null);
      },
    };
    owner = session;
    return session;
  });
}

function restoreGlobals(
  globals: Record<string, unknown>,
  before: Map<string, PropertyDescriptor>
) {
  for (const key of Object.keys(window)) {
    if (ownedGlobal(key) && !before.has(key)) {
      delete globals[key];
    }
  }
  for (const [key, descriptor] of before) {
    Object.defineProperty(window, key, descriptor);
  }
}

function evaluate(
  source: string,
  url: string,
  script: HTMLScriptElement
): NativeRuntime {
  const globals = window as unknown as Record<string, unknown>;
  for (const key of Object.keys(window)) {
    if (key.startsWith("remocn_native_")) {
      delete globals[key];
    }
  }
  Reflect.deleteProperty(window, "__remocnNativeBundle");
  let failed = false;
  const onError = (event: ErrorEvent) => {
    failed = true;
    event.preventDefault();
  };
  window.addEventListener("error", onError);
  try {
    const mapped = source.replace(
      SOURCE_MAP,
      (_match, directive: string, value: string) =>
        `${directive}${new URL(value, url).href}`
    );
    script.textContent = `${mapped}\n//# sourceURL=${url}\n`;
    document.head.appendChild(script);
  } finally {
    window.removeEventListener("error", onError);
  }
  const runtime = Reflect.get(window, "__remocnNativeBundle") as
    | NativeRuntime
    | undefined;
  Reflect.deleteProperty(window, "__remocnNativeBundle");
  if (failed || typeof runtime?.mount !== "function") {
    throw new Error("The video bundle did not provide a canvas preview.");
  }
  return runtime;
}

function mountSlot(
  session: Session,
  manifest: Manifest,
  source: string,
  base: URL,
  options: NativePreviewOptions
): Slot {
  if (session.released) {
    throw new Error("The canvas preview was closed.");
  }

  const host = document.createElement("div");
  host.style.cssText =
    "position:absolute;inset:0;visibility:hidden;pointer-events:none";
  host.inert = true;
  const root = host.attachShadow({ mode: "open" });
  const element = document.createElement("div");
  element.style.cssText =
    "width:100%;height:100%;position:relative;isolation:isolate";
  const reset = document.createElement("style");
  reset.textContent = HOST_RESET;
  root.replaceChildren(reset, element);
  const overlays = document.createElement("div");
  overlays.style.cssText = "position:absolute;inset:0";
  const script = document.createElement("script");

  const messages = new Set<(message: StampedMessage) => void>();
  const commands = new Set<(command: PreviewCommand) => void>();
  const buffered: StampedMessage[] = [];
  const waiting = new Set<
    (outcome: Effect.Effect<void, NativePreviewError>) => void
  >();
  let outcome: Effect.Effect<void, NativePreviewError> | null = null;
  let runtime: RuntimeSession | null = null;
  let disconnect: (() => void) | null = null;
  let revealed = false;
  let live = true;

  const settle = (next: Effect.Effect<void, NativePreviewError>) => {
    if (outcome !== null) {
      return;
    }
    outcome = next;
    for (const resume of waiting) {
      resume(next);
    }
    waiting.clear();
  };
  const deliver = (message: StampedMessage) => {
    for (const receive of [...messages]) {
      receive(message);
    }
  };
  const emit = (message: PreviewMessage | EntrySignal) => {
    if (!live) {
      return;
    }
    if (message.type === "native.painted") {
      settle(Effect.void);
      return;
    }
    if (message.type === "native.error") {
      settle(Effect.fail(failure(RENDER_FAILED)));
      if (session.current === slot) {
        options.onState({ message: RENDER_FAILED, phase: "failed" });
      }
      return;
    }
    const tagged: StampedMessage = { ...message, source: MESSAGE_SOURCE };
    if (revealed) {
      deliver(tagged);
    } else {
      buffered.push(tagged);
    }
  };
  const surface: PreviewSurface = {
    dispose: () => {
      live = false;
      messages.clear();
      commands.clear();
    },
    focus: () => options.viewport.focus({ preventScroll: true }),
    send: (command) => {
      if (live) {
        for (const receive of [...commands]) {
          receive(command);
        }
      }
    },
    subscribe: (receive) => {
      messages.add(receive);
      return () => {
        messages.delete(receive);
      };
    },
  };

  const slot: Slot = {
    dispose: () => {
      if (!session.slots.delete(slot)) {
        return;
      }
      live = false;
      waiting.clear();
      try {
        disconnect?.();
      } finally {
        try {
          runtime?.dispose();
        } finally {
          script.remove();
          script.textContent = "";
          host.remove();
          overlays.remove();
        }
      }
    },
    document: () => {
      const ready = buffered.findLast(
        (message): message is MessageOf<"studio.ready"> & StampedMessage =>
          message.type === "studio.ready"
      );
      return typeof ready?.video === "string"
        ? {
            lastOperationId:
              typeof ready.lastOperationId === "string"
                ? ready.lastOperationId
                : null,
            video: ready.video,
          }
        : null;
    },
    generation: manifest.generation,
    painted: Effect.callback<void, NativePreviewError>((resume) => {
      if (outcome === null) {
        waiting.add(resume);
      } else {
        resume(outcome);
      }
      return Effect.sync(() => {
        waiting.delete(resume);
      });
    }),
    position: () => runtime?.position() ?? null,
    reveal: (position, selection, rebuilt) => {
      host.style.cssText = "position:absolute;inset:0";
      host.inert = false;
      revealed = true;
      disconnect = options.attach(surface);
      if (rebuilt) {
        deliver({ source: MESSAGE_SOURCE, type: "rebuilt" });
      }
      for (const message of buffered.splice(0)) {
        deliver(message);
      }
      runtime?.start(position, selection);
    },
    selection: () => runtime?.selection() ?? null,
  };

  session.slots.add(slot);
  options.stage.append(host);
  options.overlays.append(overlays);
  try {
    const bundle = evaluate(source, manifest.script, script);
    runtime = bundle.mount(element, {
      assets: manifest.assets,
      composition: base.searchParams.get("composition"),
      emit,
      getStack: async (target) => {
        const { getStack } = await import("grab/core");
        return getStack(target);
      },
      overlays,
      position: session.current?.position() ?? null,
      preferred: manifest.preferred,
      project: manifest.project,
      root,
      subscribe: (receive) => {
        commands.add(receive);
        return () => {
          commands.delete(receive);
        };
      },
      url: options.url,
      viewport: options.viewport,
    });
  } catch (error) {
    slot.dispose();
    throw error;
  }
  return slot;
}
