import { describe, expect, it } from "bun:test";
import { post, route } from "@/preview/bridge";
import type { Routes } from "@/preview/protocol";
import { contentRoot, currentSurface, elementsAt } from "@/preview/surface";
import { withSurface } from "./surface";

describe("withSurface", () => {
  it("configures the surface and the bridge the way a mount does", () => {
    const surface = withSurface();

    expect(currentSurface()?.root).toBe(surface.root);
    expect(contentRoot()).toBe(surface.root);
    expect(surface.host.shadowRoot).toBe(surface.root);
    expect(surface.viewport.contains(surface.host)).toBe(true);
    expect(surface.viewport.contains(surface.overlays)).toBe(true);
    expect(document.body.contains(surface.viewport)).toBe(true);
  });

  it("captures what the runtime posts once the microtask runs", async () => {
    const surface = withSurface();

    post({ paused: false, status: "armed", type: "inspect" });
    expect(surface.sent).toEqual([]);
    await surface.flush();

    expect(surface.sent).toEqual([
      { paused: false, status: "armed", type: "inspect" },
    ]);
  });

  it("delivers a command to every consumer routed for it", () => {
    const surface = withSurface();
    const player: unknown[] = [];
    const text: unknown[] = [];
    const stopPlayer = route("player", playerRoutes(player));
    const stopText = route("inline-text", {
      replay: () => undefined,
      seek: (command) => text.push(command),
      "studio.text.close": () => undefined,
      "studio.text.open": () => undefined,
      "transport.step": () => undefined,
      "transport.toggle": () => undefined,
    });

    surface.send({ frame: 3, type: "seek" });
    surface.send({ type: "pause" });
    stopPlayer();
    stopText();
    surface.send({ frame: 4, type: "seek" });

    expect(player).toEqual([{ frame: 3, type: "seek" }, { type: "pause" }]);
    expect(text).toEqual([{ frame: 3, type: "seek" }]);
  });

  it("answers elementsAt from the shadow root once the host is hit", () => {
    const surface = withSurface();
    const node = document.createElement("div");
    surface.root.append(node);

    surface.pointAt([node]);

    expect(elementsAt(1, 1)).toEqual([node]);
  });

  it("leaves no surface, bridge or viewport after dispose", async () => {
    const surface = withSurface();
    surface.dispose();

    expect(currentSurface()).toBeNull();
    expect(document.body.contains(surface.viewport)).toBe(false);
    expect(() =>
      route("rate", { "transport.rate": () => undefined })
    ).toThrow();
    post({ type: "rebuilt" });
    await surface.flush();
    expect(surface.sent).toEqual([]);
  });
});

function playerRoutes(received: unknown[]): Routes<"player"> {
  const record = (command: unknown) => {
    received.push(command);
  };
  return {
    highlight: record,
    inspect: record,
    "inspect.clear": record,
    pause: record,
    replay: record,
    seek: record,
    snapshot: record,
    "studio.hide": record,
    "studio.highlight": record,
    "studio.hover": record,
    "studio.unhide": record,
    "tune.reset": record,
    "tune.set": record,
    "tuning.statuses": record,
  };
}
