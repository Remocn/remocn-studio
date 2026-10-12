import { afterEach, beforeEach, expect, it, mock, spyOn } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { SHADER_DESCRIPTORS, shaderCreation } from "@/shared/shaders";
import { shaderTargetFixture } from "@/test/fixtures/shaders";

const draw = mock();
const dispose = mock();
const loseContext = mock();
const cancel = mock();
const finish = mock();
const pending = new Set<number>();
let nextHandle = 0;
let broken = false;
mock.module(
  "../templates/remotion/src/lib/studio-shaders-v1/tunnel-renderer",
  () => ({
    createTunnelRenderer: () => {
      if (broken) {
        throw new Error("Unsupported WebGL2");
      }
      return { dispose, draw };
    },
  })
);
mock.module("remotion", () => ({
  cancelRender: cancel,
  continueRender: (handle: number) => pending.delete(handle),
  delayRender: () => {
    nextHandle += 1;
    const handle = nextHandle;
    pending.add(handle);
    return handle;
  },
  useVideoConfig: () => ({ height: 1080, width: 1920 }),
}));

import { LightTunnelAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/light-tunnel";

let restore: () => void = () => undefined;
beforeEach(() => {
  const context = spyOn(
    HTMLCanvasElement.prototype,
    "getContext"
  ).mockImplementation(
    () =>
      ({
        finish,
        getError: () => 0,
        getExtension: () => ({ loseContext }),
        isContextLost: () => false,
        NO_ERROR: 0,
      }) as never
  );
  restore = () => context.mockRestore();
});
afterEach(() => {
  cleanup();
  restore();
  for (const fn of [draw, dispose, loseContext, cancel, finish]) {
    fn.mockClear();
  }
  pending.clear();
  broken = false;
});
const descriptor = SHADER_DESCRIPTORS.find(
  (d) => d.slug === "shader-light-tunnel"
);
if (!descriptor) {
  throw new Error("Missing tunnel descriptor");
}
const { values } = shaderCreation(
  descriptor,
  shaderTargetFixture,
  "create",
  "shader",
  0
).object;
const props = () => ({
  fps: 24,
  frame: 72,
  onError: mock(),
  onReady: mock(),
  values,
});

it("draws the local frame with every tunnel control and disposes both passes", () => {
  const p = props();
  const { rerender, unmount } = render(<LightTunnelAdapter {...p} />);
  expect(draw).toHaveBeenLastCalledWith(
    Number(values.timeOffset) + 3,
    values.twist,
    values.glow,
    values.depth,
    values.spirals,
    values.patternScale,
    values.rotation,
    values.offsetX,
    values.offsetY
  );
  expect(p.onReady).toHaveBeenCalledTimes(1);
  expect(finish).toHaveBeenCalledTimes(1);
  expect(pending.size).toBe(0);
  const changed = {
    ...values,
    depth: 1.2,
    glow: 1.8,
    offsetX: 0.4,
    offsetY: -0.1,
    patternScale: 2,
    rotation: 90,
    speed: 0,
    spirals: 4,
    timeOffset: 12,
    twist: 1.1,
  };
  rerender(<LightTunnelAdapter {...p} frame={149} values={changed} />);
  expect(draw).toHaveBeenLastCalledWith(12, 1.1, 1.8, 1.2, 4, 2, 90, 0.4, -0.1);
  unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(loseContext).toHaveBeenCalledTimes(1);
});
it("fails capture on initialization failure or a lost context", () => {
  broken = true;
  const failed = props();
  const first = render(<LightTunnelAdapter {...failed} />);
  expect(failed.onError).toHaveBeenCalledWith("Unsupported WebGL2");
  expect(failed.onReady).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalled();
  expect(pending.size).toBe(0);
  first.unmount();
  broken = false;
  const lost = props();
  const second = render(<LightTunnelAdapter {...lost} />);
  const canvas = second.container.querySelector("canvas");
  if (!canvas) {
    throw new Error("Missing tunnel canvas");
  }
  act(() => canvas.dispatchEvent(new Event("webglcontextlost")));
  expect(lost.onError).toHaveBeenCalledWith(
    expect.stringContaining("context was lost")
  );
});
