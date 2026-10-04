import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Effect, Fiber } from "effect";
import { type NativePreviewState, runNativePreview } from "./native-preview";
import { pauseCommand } from "./preview";
import { createPreviewSurfaceChannel } from "./preview-surface";

const BASE = "http://127.0.0.1:51749/";
const HOOKS_KEY = "__nativePreviewTestHooks";

interface Hooks {
  commands: Record<string, unknown[]>;
  disposed: string[];
  sourceMap?: string;
}

function hooks(): Hooks {
  return (window as unknown as Record<string, Hooks>)[HOOKS_KEY];
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  private readonly listeners = new Map<string, Set<() => void>>();
  readonly url: string;

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    const set = this.listeners.get(type) ?? new Set<() => void>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    // The real EventSource stops delivering; nothing to release here.
  }

  fire(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener();
    }
  }
}

function fakeResponse(body: unknown, ok = true) {
  return {
    json: () => Promise.resolve(body),
    ok,
    statusText: ok ? "OK" : "error",
    text: () => Promise.resolve(String(body)),
  } as Response;
}

function manifestOf(generation: number, script: string) {
  return {
    assets: `${BASE}assets/`,
    events: `${BASE}__remocn/hot`,
    generation,
    preferred: null,
    project: "demo",
    script: `${BASE}${script}`,
    version: 1 as const,
  };
}

function workingBundle(id: string) {
  return `window.__remocnNativeBundle = { mount: (element, env) => {
    window.${HOOKS_KEY}.commands["${id}"] = [];
    env.subscribe((command) => { window.${HOOKS_KEY}.commands["${id}"].push(command); });
    env.emit({ type: "native.painted" });
    return {
      dispose: () => { window.${HOOKS_KEY}.disposed.push("${id}"); },
      position: () => ({ frame: 0, muted: false, playing: false, volume: 1 }),
      selection: () => null,
      start: () => undefined,
    };
  } };`;
}

function brokenBundle() {
  return "window.__remocnNativeBundle = { notMount: true };";
}

interface Network {
  manifest: ReturnType<typeof manifestOf>;
  scripts: Map<string, string>;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return (input as Request).url;
}

function setupNetwork(): Network {
  const network: Network = {
    manifest: manifestOf(1, "v1.js"),
    scripts: new Map([["v1.js", workingBundle("slot1")]]),
  };
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.startsWith(`${BASE}__remocn/native`)) {
      return Promise.resolve(fakeResponse(network.manifest));
    }
    const name = url.slice(BASE.length);
    const script = network.scripts.get(name);
    if (script !== undefined) {
      return Promise.resolve(fakeResponse(script));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch;
  return network;
}

const fibers: Fiber.Fiber<unknown, unknown>[] = [];

function interruptAll(held: Fiber.Fiber<unknown, unknown>[]) {
  return Promise.all(
    held.map((fiber) => Effect.runPromise(Fiber.interrupt(fiber)))
  );
}

function harness(
  options: Partial<{
    accepts: () => boolean;
    viewport: HTMLElement;
  }> = {}
) {
  (window as unknown as Record<string, Hooks>)[HOOKS_KEY] = {
    commands: {},
    disposed: [],
  };
  const stage = document.createElement("div");
  const overlays = document.createElement("div");
  const viewport = options.viewport ?? document.createElement("div");
  const channel = createPreviewSurfaceChannel();
  const states: NativePreviewState[] = [];
  const waiters: {
    predicate: (states: readonly NativePreviewState[]) => boolean;
    resolve: () => void;
  }[] = [];

  const onState = (state: NativePreviewState) => {
    states.push(state);
    for (const waiter of [...waiters]) {
      if (waiter.predicate(states)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve();
      }
    }
  };

  const waitForState = (
    predicate: (states: readonly NativePreviewState[]) => boolean
  ): Promise<void> => {
    if (predicate(states)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("timed out waiting for a native preview state"));
      }, 4000);
      waiters.push({
        predicate,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
      });
    });
  };

  const readyCount = (all: readonly NativePreviewState[]) =>
    all.filter((state) => state.phase === "ready" && state.stale === null)
      .length;

  const fiber = Effect.runFork(
    runNativePreview({
      accepts: options.accepts ?? (() => true),
      attach: channel.attach,
      onState,
      overlays,
      stage,
      url: BASE,
      viewport,
    })
  );
  fibers.push(fiber);

  return {
    channel,
    overlays,
    readyCount,
    stage,
    states,
    viewport,
    waitForState,
  };
}

let originalEventSource: unknown;
let originalFetch: typeof fetch;

beforeEach(() => {
  const { happyDOM } = window as unknown as {
    happyDOM?: { settings?: { enableJavaScriptEvaluation?: boolean } };
  };
  if (happyDOM?.settings) {
    happyDOM.settings.enableJavaScriptEvaluation = true;
  }
  originalEventSource = (globalThis as Record<string, unknown>).EventSource;
  (globalThis as Record<string, unknown>).EventSource = FakeEventSource;
  FakeEventSource.instances = [];
  originalFetch = globalThis.fetch;
});

afterEach(async () => {
  await interruptAll(fibers.splice(0));
  globalThis.fetch = originalFetch;
  (globalThis as Record<string, unknown>).EventSource = originalEventSource;
  for (const script of document.head.querySelectorAll("script")) {
    script.remove();
  }
});

describe("runNativePreview", () => {
  it("attaches the mounted runtime as the one active surface", async () => {
    setupNetwork();
    const { channel, states, waitForState } = harness();

    await waitForState((all) => all.length > 0);

    expect(states.at(-1)).toEqual({ phase: "ready", stale: null });

    channel.send(pauseCommand());
    expect(hooks().commands.slot1).toEqual([pauseCommand()]);
  });

  it("swaps to a rebuilt runtime and stops delivering to the disposed one", async () => {
    const network = setupNetwork();
    const { channel, readyCount, waitForState } = harness();
    await waitForState((all) => readyCount(all) >= 1);

    network.manifest = manifestOf(2, "v2.js");
    network.scripts.set("v2.js", workingBundle("slot2"));
    FakeEventSource.instances[0]?.fire("native-rebuilt");

    await waitForState((all) => readyCount(all) >= 2);

    channel.send(pauseCommand());

    expect(hooks().commands.slot1).toEqual([]);
    expect(hooks().commands.slot2).toEqual([pauseCommand()]);
    expect(hooks().disposed).toEqual(["slot1"]);
  });

  it("resolves only the bundle's own source map line, not the same words inside its code", async () => {
    const network = setupNetwork();
    network.scripts.set(
      "v1.js",
      `${workingBundle("slot1")}
window.${HOOKS_KEY}.sourceMap = "//# sourceMappingURL=" + "x.map";
//# sourceMappingURL=bundle.js.map`
    );
    const { states, waitForState } = harness();

    await waitForState((all) => all.length > 0);

    expect(states.at(-1)).toEqual({ phase: "ready", stale: null });
    expect(hooks().sourceMap).toBe("//# sourceMappingURL=x.map");
    expect(document.head.querySelector("script")?.textContent).toContain(
      `//# sourceMappingURL=${BASE}bundle.js.map\n`
    );
  });

  it("re-checking the same generation on an EventSource reconnect does not restage", async () => {
    setupNetwork();
    const { readyCount, waitForState } = harness();
    await waitForState((all) => readyCount(all) >= 1);

    FakeEventSource.instances[0]?.fire("native-rebuilt");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(hooks().disposed).toEqual([]);
  });

  it("keeps the previous version with a stale notice when a rebuild cannot mount", async () => {
    const network = setupNetwork();
    const { channel, waitForState } = harness();
    await waitForState((all) => all.some((state) => state.phase === "ready"));

    network.manifest = manifestOf(2, "broken.js");
    network.scripts.set("broken.js", brokenBundle());
    FakeEventSource.instances[0]?.fire("native-rebuilt");

    await waitForState((all) =>
      all.some((state) => state.phase === "ready" && state.stale !== null)
    );

    channel.send(pauseCommand());
    expect(hooks().commands.slot1).toEqual([pauseCommand()]);
    expect(hooks().disposed).toEqual([]);
  });

  it("holds a painted rebuild back while an edit is in progress on the viewport", async () => {
    const network = setupNetwork();
    const viewport = document.createElement("div");
    const { channel, readyCount, waitForState } = harness({ viewport });
    await waitForState((all) => readyCount(all) >= 1);

    viewport.setAttribute("data-preview-editing", "");
    network.manifest = manifestOf(2, "v2.js");
    network.scripts.set("v2.js", workingBundle("slot2"));
    FakeEventSource.instances[0]?.fire("native-rebuilt");

    await new Promise((resolve) => setTimeout(resolve, 250));
    channel.send(pauseCommand());
    expect(hooks().commands.slot1).toEqual([pauseCommand()]);
    // slot2 has mounted (its bundle ran and registered a subscriber) but is
    // not yet revealed, so a command sent while the shown surface is still
    // slot1's never reaches it.
    expect(hooks().commands.slot2).toEqual([]);

    viewport.removeAttribute("data-preview-editing");
    await waitForState((all) => readyCount(all) >= 2);

    channel.send(pauseCommand());
    expect(hooks().commands.slot2).toEqual([pauseCommand()]);
  });

  it("tearing the preview down disposes the current runtime and clears its DOM", async () => {
    setupNetwork();
    const { stage, overlays, waitForState } = harness();
    await waitForState((all) => all.length > 0);

    expect(stage.childElementCount).toBe(1);
    expect(overlays.childElementCount).toBe(1);

    await interruptAll(fibers.splice(0));

    expect(hooks().disposed).toEqual(["slot1"]);
    expect(stage.childElementCount).toBe(0);
    expect(overlays.childElementCount).toBe(0);
  });
});
