import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { MESH_GRADIENT, shaderCreation } from "@/shared/shaders";
import { shaderTargetFixture } from "@/test/fixtures/shaders";

const pending = new Set<number>();
const cancelled = mock();
let handle = 0;
let contextFails = false;
let mountFails = false;
const mounts: FakeMount[] = [];
class FakeMount {
  canvasElement = document.createElement("canvas");
  dispose = mock(() => this.canvasElement.remove());
  setUniforms = mock();
  setFrame = mock();
  lose = mock();
  readonly speed: number;
  readonly time: number;
  constructor(
    element: HTMLDivElement,
    _fragment: string,
    _uniforms: unknown,
    _options: unknown,
    speed: number,
    time: number
  ) {
    this.speed = speed;
    this.time = time;
    element.append(this.canvasElement);
    Object.defineProperty(this.canvasElement, "getContext", {
      value: () => ({
        CURRENT_PROGRAM: 1,
        finish: mock(),
        getError: () => 0,
        getExtension: () => ({ loseContext: this.lose }),
        getParameter: () => ({}),
        getProgramParameter: () => true,
        isContextLost: () => contextFails,
        LINK_STATUS: 2,
        NO_ERROR: 0,
      }),
    });
    mounts.push(this);
    if (mountFails) {
      throw new Error("Shader compilation failed");
    }
  }
}
mock.module("@paper-design/shaders", () => ({
  getShaderColorFromString: () => [0, 0, 0, 1],
  meshGradientFragmentShader: "mesh-fragment",
  ShaderFitOptions: { contain: 1, cover: 2, none: 0 },
  ShaderMount: FakeMount,
}));
mock.module("remotion", () => ({
  cancelRender: cancelled,
  continueRender: (id: number) => pending.delete(id),
  delayRender: () => {
    handle += 1;
    pending.add(handle);
    return handle;
  },
}));
let Mesh: typeof import("../templates/remotion/src/lib/studio-shaders-v1/mesh-gradient").MeshGradientAdapter;
beforeAll(async () => {
  Mesh = (
    await import(
      "../templates/remotion/src/lib/studio-shaders-v1/mesh-gradient"
    )
  ).MeshGradientAdapter;
});
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let undoRaf: () => void = () => undefined;
beforeEach(() => {
  const request = spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (callback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    }
  );
  const cancel = spyOn(globalThis, "cancelAnimationFrame").mockImplementation(
    (id) => {
      frames.delete(id);
    }
  );
  undoRaf = () => {
    request.mockRestore();
    cancel.mockRestore();
  };
});
afterEach(() => {
  cleanup();
  undoRaf();
  pending.clear();
  frames.clear();
  mounts.length = 0;
  cancelled.mockClear();
  contextFails = false;
  mountFails = false;
});
function tick() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) {
      callback(0);
    }
  });
}
const { values } = shaderCreation(
  MESH_GRADIENT,
  shaderTargetFixture,
  "insert",
  "shader",
  0
).object;

describe("Paper adapter capture lifecycle", () => {
  it("draws the requested time after direct seeks and releases capture only after the frame is ready", () => {
    const ready = mock();
    const error = mock();
    const view = render(
      <Mesh
        fps={30}
        frame={60}
        onError={error}
        onReady={ready}
        values={values}
      />
    );
    expect(pending.size).toBe(1);
    expect(ready).not.toHaveBeenCalled();
    expect(mounts[0].speed).toBe(0);
    expect(mounts[0].time).toBe(2000);
    tick();
    tick();
    expect(mounts[0].setFrame).toHaveBeenLastCalledWith(2000);
    expect(pending.size).toBe(0);
    expect(ready).toHaveBeenCalledTimes(1);
    view.rerender(
      <Mesh
        fps={30}
        frame={15}
        onError={error}
        onReady={ready}
        values={{ ...values, distortion: 0.2, speed: 2 }}
      />
    );
    expect(pending.size).toBe(1);
    tick();
    tick();
    expect(mounts).toHaveLength(1);
    expect(mounts[0].setFrame).toHaveBeenLastCalledWith(1000);
    expect(mounts[0].setUniforms).toHaveBeenLastCalledWith(
      expect.objectContaining({ u_colorsCount: 4, u_distortion: 0.2 })
    );
    expect(error).not.toHaveBeenCalled();
    view.unmount();
    expect(mounts[0].dispose).toHaveBeenCalledTimes(1);
    expect(mounts[0].lose).toHaveBeenCalledTimes(1);
  });
  it("cancels pending callbacks and capture handles when removed during initialization", () => {
    const ready = mock();
    const view = render(
      <Mesh
        fps={30}
        frame={0}
        onError={mock()}
        onReady={ready}
        values={values}
      />
    );
    view.unmount();
    expect(pending.size).toBe(0);
    expect(frames.size).toBe(0);
    expect(ready).not.toHaveBeenCalled();
    expect(mounts[0].lose).toHaveBeenCalledTimes(1);
  });
  it("fails capture and reports graphics failures instead of acknowledging an absent shader", () => {
    contextFails = true;
    const ready = mock();
    const error = mock();
    render(
      <Mesh
        fps={30}
        frame={0}
        onError={error}
        onReady={ready}
        values={values}
      />
    );
    tick();
    tick();
    expect(ready).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "The shader graphics context is unavailable."
    );
    expect(cancelled).toHaveBeenCalled();
    expect(pending.size).toBe(0);
  });
  it("cleans up partial initialization when compilation throws", () => {
    mountFails = true;
    const error = mock();
    const view = render(
      <Mesh
        fps={30}
        frame={0}
        onError={error}
        onReady={mock()}
        values={values}
      />
    );
    expect(view.container.querySelector("canvas")).toBeNull();
    expect(error).toHaveBeenCalledWith("Shader compilation failed");
    expect(cancelled).toHaveBeenCalled();
    expect(mounts[0].lose).toHaveBeenCalledTimes(1);
  });
});

it("draws and acknowledges while playback supplies a new frame on every animation tick", () => {
  const ready = mock();
  const error = mock();
  const view = render(
    <Mesh fps={60} frame={0} onError={error} onReady={ready} values={values} />
  );
  for (let frame = 1; frame <= 10; frame += 1) {
    tick();
    view.rerender(
      <Mesh
        fps={60}
        frame={frame}
        onError={error}
        onReady={ready}
        values={values}
      />
    );
  }
  expect(ready).toHaveBeenCalled();
  expect(mounts[0].setFrame).toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
