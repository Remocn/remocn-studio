import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";
import { act, render } from "@testing-library/react";
import { Exit } from "effect";
import { createContext, useContext, useEffect } from "react";
import { decodePreviewMessage } from "@/lib/studio/preview";
import { MESH_GRADIENT, shaderCreation } from "@/shared/shaders";
import {
  applyStudioOperation,
  inverseStudioOperation,
  type StudioDocument,
} from "@/shared/studio-document";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import { documentFixture } from "@/test/fixtures/studio-document";
import type {
  ShaderAdapterProps,
  ShaderRegistry,
} from "../templates/remotion/src/lib/studio-objects-v7/shaders";

const Frame = createContext(0);
mock.module("remotion", () => ({
  useCurrentFrame: () => useContext(Frame),
  useVideoConfig: () => ({ fps: 30, height: 1080, width: 1920 }),
}));
let runtime: typeof import("../templates/remotion/src/lib/studio-objects-v7");
let slot: typeof import("../templates/remotion/src/lib/studio-objects-v7/shaders");
beforeAll(async () => {
  runtime = await import("../templates/remotion/src/lib/studio-objects-v7");
  slot = await import(
    "../templates/remotion/src/lib/studio-objects-v7/shaders"
  );
});

const release = mock();
const parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");
afterEach(() => {
  if (parentDescriptor) {
    Object.defineProperty(window, "parent", parentDescriptor);
  }
  release.mockClear();
});

function Adapter({ frame, fps, values, onReady }: ShaderAdapterProps) {
  useEffect(() => {
    onReady();
    return release;
  }, [onReady]);
  return (
    <canvas
      data-colors={JSON.stringify(values.colors)}
      data-time={(frame / fps) * Number(values.speed) * 1000}
    />
  );
}
const registry: ShaderRegistry = {
  [MESH_GRADIENT.slug]: {
    component: Adapter,
    revision: MESH_GRADIENT.revision,
  },
};
const creation = shaderCreation(
  MESH_GRADIENT,
  shaderTargetFixture,
  "insert-1",
  "shader-1",
  0
);
const document = applyStudioOperation(
  documentFixture,
  creation,
  shaderTargetFixture
);

function Video({
  data = document,
  frame = 0,
  duration = 150,
  localFrame = frame,
  duplicate = false,
}: {
  data?: StudioDocument;
  frame?: number;
  duration?: number;
  localFrame?: number;
  duplicate?: boolean;
}) {
  return (
    <Frame.Provider value={frame}>
      <runtime.StudioObjects document={data}>
        <Frame.Provider value={localFrame}>
          <div data-background style={{ background: "black" }} />
          <slot.StudioShaderSlot
            durationInFrames={duration}
            id="root-shaders"
            label="Intro"
            registry={registry}
            sourceRevision="source-1"
          />
          {duplicate === true && (
            <slot.StudioShaderSlot
              durationInFrames={duration}
              id="root-shaders"
              label="Intro copy"
              registry={registry}
              sourceRevision="source-1"
            />
          )}
          <h1>Foreground</h1>
        </Frame.Provider>
      </runtime.StudioObjects>
    </Frame.Provider>
  );
}

describe("scene shader slot", () => {
  it("renders between the opaque background and foreground using scene-local time on a direct seek", () => {
    const view = render(<Video frame={90} localFrame={60} />);
    const host = view.container.querySelector("[data-studio-shader-slot]");
    expect(host?.previousElementSibling?.hasAttribute("data-background")).toBe(
      true
    );
    expect(host?.nextElementSibling?.tagName).toBe("H1");
    expect(host?.querySelector("canvas")?.getAttribute("data-time")).toBe(
      "2000"
    );
    view.rerender(<Video frame={45} localFrame={15} />);
    expect(host?.querySelector("canvas")?.getAttribute("data-time")).toBe(
      "500"
    );
  });
  it("publishes decoded target ranges, duplicate occurrences and insertion acknowledgements", async () => {
    const postMessage = mock();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });
    const view = render(<Video frame={90} localFrame={60} />);
    await act(() => Promise.resolve());
    const messages = postMessage.mock.calls.map((call) => call[0]);
    for (const message of messages) {
      expect(Exit.isSuccess(decodePreviewMessage(message))).toBe(true);
    }
    expect(
      messages.find((message) => message.type === "shader.ready")
    ).toMatchObject({
      objectId: "shader-1",
      operationId: "insert-1",
      slotId: "root-shaders",
      video: "intro",
    });
    expect(
      messages.filter((message) => message.type === "shader.targets").at(-1)
        ?.targets
    ).toEqual([
      {
        contract: 1,
        durationInFrames: 150,
        fps: 30,
        from: 30,
        label: "Intro",
        occurrences: 1,
        sceneId: null,
        slotId: "root-shaders",
        sourceRevision: "source-1",
      },
    ]);
    view.rerender(<Video duplicate frame={90} localFrame={60} />);
    expect(
      postMessage.mock.calls
        .map((call) => call[0])
        .filter((message) => message.type === "shader.targets")
        .at(-1)?.targets[0].occurrences
    ).toBe(2);
  });
  it("keeps the scene clock after trimming, follows scene duration, and releases removed or inactive layers", () => {
    const trimmed = {
      ...document,
      objects: document.objects.map((object) =>
        object.shader
          ? { ...object, values: { ...object.values, startFrame: 30 } }
          : object
      ),
    };
    const view = render(<Video data={trimmed} duration={240} frame={30} />);
    expect(
      view.container.querySelector("canvas")?.getAttribute("data-time")
    ).toBe("1000");
    view.rerender(<Video data={trimmed} duration={240} frame={239} />);
    expect(view.container.querySelector("canvas")).not.toBeNull();
    view.rerender(<Video data={trimmed} duration={240} frame={240} />);
    expect(view.container.querySelector("canvas")).toBeNull();
    expect(release).toHaveBeenCalled();
    view.rerender(<Video />);
    view.rerender(
      <Video
        data={applyStudioOperation(
          document,
          inverseStudioOperation(creation, "undo")
        )}
      />
    );
    expect(view.container.querySelector("canvas")).toBeNull();
  });
  it("orders independent shader layers without moving the foreground and applies opacity to one instance", () => {
    const second = shaderCreation(
      MESH_GRADIENT,
      shaderTargetFixture,
      "insert-2",
      "shader-2",
      1
    );
    const both = applyStudioOperation(
      document,
      {
        ...second,
        object: {
          ...second.object,
          values: { ...second.object.values, opacity: 0.4 },
        },
      },
      shaderTargetFixture
    );
    const view = render(<Video data={both} />);
    const layers = [...view.container.querySelectorAll("[data-studio-object]")];
    expect(
      layers.map((layer) => layer.getAttribute("data-studio-object"))
    ).toEqual(["shader-1", "shader-2"]);
    expect((layers[1] as HTMLElement).style.opacity).toBe("0.4");
    expect(
      view.container.querySelector("[data-studio-shader-slot]")
        ?.nextElementSibling?.textContent
    ).toBe("Foreground");
  });
  it("refuses an explicit trim that no longer fits a shortened scene", () => {
    expect(() =>
      slot.shaderInterval(
        { endFrame: 150, followSceneEnd: false, startFrame: 0 },
        120
      )
    ).toThrow("trim no longer fits");
    expect(
      slot.shaderInterval(
        { endFrame: 150, followSceneEnd: true, startFrame: 0 },
        120
      )
    ).toEqual({ end: 120, start: 0 });
  });
});
