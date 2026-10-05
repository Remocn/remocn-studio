import { describe, expect, it } from "bun:test";
import { withSurface } from "@/test/surface";
import {
  configureSurface,
  contentRoot,
  currentSurface,
  elementsAt,
  focusSurface,
  lockCamera,
  overlayRoot,
  styleRoot,
  surfaceEvents,
  surfaceHref,
} from "./surface";

function environment() {
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  const viewport = document.createElement("div");
  const overlays = document.createElement("div");
  overlays.append(document.createElement("span"));
  return {
    assets: "http://127.0.0.1/assets/",
    composition: "intro",
    getStack: async () => null,
    overlays,
    preferred: null,
    project: "demo",
    root,
    url: "http://127.0.0.1/video",
    viewport,
  };
}

describe("configureSurface", () => {
  it("throws before a surface configures", () => {
    expect(currentSurface()).toBeNull();
    expect(() => contentRoot()).toThrow(
      "The preview surface is not configured."
    );
    expect(() => overlayRoot()).toThrow();
    expect(() => styleRoot()).toThrow();
    expect(() => surfaceHref()).toThrow();
    expect(() => focusSurface()).toThrow();
    expect(() => elementsAt(0, 0)).toThrow();
    expect(() =>
      surfaceEvents.addEventListener("pointerdown", () => undefined)
    ).toThrow();
  });

  it("installs the environment so accessors read the native surface", () => {
    const value = environment();
    const dispose = configureSurface(value);

    expect(currentSurface()).toBe(value);
    expect(contentRoot()).toBe(value.root);
    expect(overlayRoot()).toBe(value.overlays);
    expect(styleRoot()).toBe(value.root);
    expect(surfaceHref()).toBe(value.url);

    dispose();
  });

  it("focuses the surface viewport while configured, and throws once torn down", () => {
    const value = environment();
    const dispose = configureSurface(value);
    let viewportFocused = false;
    value.viewport.focus = () => {
      viewportFocused = true;
    };

    focusSurface();
    expect(viewportFocused).toBe(true);

    dispose();
    expect(() => focusSurface()).toThrow();
  });

  it("marks the viewport as editing while any lock is held, and clears it once all release", () => {
    const value = environment();
    const dispose = configureSurface(value);
    const first = {};
    const second = {};

    lockCamera(first, true);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(true);

    lockCamera(second, true);
    lockCamera(first, false);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(true);

    lockCamera(second, false);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(false);

    dispose();
  });

  it("cancels an unfinished edit lock when the runtime is torn down", () => {
    const value = environment();
    const dispose = configureSurface(value);
    lockCamera({}, true);
    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(true);

    dispose();

    expect(value.viewport.hasAttribute("data-preview-editing")).toBe(false);
    expect(() => lockCamera({}, false)).not.toThrow();
    // A lock held by the torn-down surface must not resurrect on the next one.
    const next = environment();
    const disposeNext = configureSurface(next);
    lockCamera({}, false);
    expect(next.viewport.hasAttribute("data-preview-editing")).toBe(false);
    disposeNext();
  });

  it("clears the overlay layer's children when the runtime is torn down", () => {
    const value = environment();
    const dispose = configureSurface(value);
    expect(value.overlays.childElementCount).toBe(1);

    dispose();

    expect(value.overlays.childElementCount).toBe(0);
  });

  it("throws from the accessors again once the surface disconnects", () => {
    const value = environment();
    const dispose = configureSurface(value);

    dispose();

    expect(currentSurface()).toBeNull();
    expect(() => contentRoot()).toThrow();
    expect(() => overlayRoot()).toThrow();
    expect(() => surfaceHref()).toThrow();
  });
});

describe("elementsAt", () => {
  it("answers nothing when the hit is outside the stage host", () => {
    const surface = withSurface();
    const node = document.createElement("div");
    surface.root.append(node);
    surface.pointAt([node]);
    document.elementFromPoint = () => surface.overlays;

    expect(elementsAt(1, 1)).toEqual([]);
  });

  it("keeps only the nodes that live in the shadow root", () => {
    const surface = withSurface();
    const inside = document.createElement("div");
    surface.root.append(inside);
    surface.pointAt([inside, surface.host, document.body]);

    expect(elementsAt(1, 1)).toEqual([inside]);
  });
});

describe("surfaceEvents", () => {
  it("removes a listener from the viewport it was added to after the surface stops", () => {
    const surface = withSurface();
    const seen: Event[] = [];
    const listener = (event: Event) => seen.push(event);
    surfaceEvents.addEventListener("pointerdown", listener);
    const { viewport } = surface;
    surface.dispose();

    surfaceEvents.removeEventListener("pointerdown", listener);
    viewport.dispatchEvent(new Event("pointerdown"));

    expect(seen).toEqual([]);
  });

  it("removes nothing harmlessly when the listener was never added", () => {
    expect(() =>
      surfaceEvents.removeEventListener("pointerdown", () => undefined)
    ).not.toThrow();
  });
});
