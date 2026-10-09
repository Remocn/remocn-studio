import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { readFile } from "node:fs/promises";
import { act, cleanup, render } from "@testing-library/react";
import { SHADER_DESCRIPTORS, shaderCreation } from "@/shared/shaders";
import { fieldUnavailableReason } from "@/shared/studio-document";
import { shaderTargetFixture } from "@/test/fixtures/shaders";
import type { PaperCanvasProps } from "../templates/remotion/src/lib/studio-shaders-v1/paper";

let current: PaperCanvasProps | null = null;
const pending = new Set<number>();
const cancel = mock();
let nextHandle = 0;
mock.module("../templates/remotion/src/lib/studio-shaders-v1/paper", () => ({
  PaperCanvas: (props: PaperCanvasProps) => {
    current = props;
    return <div />;
  },
}));
mock.module("remotion", () => ({
  cancelRender: cancel,
  continueRender: (handle: number) => pending.delete(handle),
  delayRender: () => {
    nextHandle += 1;
    pending.add(nextHandle);
    return nextHandle;
  },
}));

import { CausticsAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/caustics";
import { ColorPanelsAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/color-panels";
import { DitheringAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/dithering";
import { DotOrbitAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/dot-orbit";
import { GemSmokeAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/gem-smoke";
import { GodRaysAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/god-rays";
import { GrainGradientAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/grain-gradient";
import { LiquidMetalAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/liquid-metal";
import { MetaballsAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/metaballs";
import { NeuroNoiseAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/neuro-noise";
import { PerlinNoiseAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/perlin-noise";
import { PulsingBorderAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/pulsing-border";
import { SimplexNoiseAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/simplex-noise";
import { SmokeRingAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/smoke-ring";
import { SpiralAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/spiral";
import { StrataAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/strata";
import { SwirlAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/swirl";
import { VoronoiAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/voronoi";
import { WarpAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/warp";
import { WaterAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/water";
import { WeaveAdapter } from "../templates/remotion/src/lib/studio-shaders-v1/weave";

const adapters = {
  "shader-caustics": CausticsAdapter,
  "shader-color-panels": ColorPanelsAdapter,
  "shader-dithering": DitheringAdapter,
  "shader-dot-orbit": DotOrbitAdapter,
  "shader-gem-smoke": GemSmokeAdapter,
  "shader-god-rays": GodRaysAdapter,
  "shader-grain-gradient": GrainGradientAdapter,
  "shader-liquid-metal": LiquidMetalAdapter,
  "shader-metaballs": MetaballsAdapter,
  "shader-neuro-noise": NeuroNoiseAdapter,
  "shader-perlin-noise": PerlinNoiseAdapter,
  "shader-pulsing-border": PulsingBorderAdapter,
  "shader-simplex-noise": SimplexNoiseAdapter,
  "shader-smoke-ring": SmokeRingAdapter,
  "shader-spiral": SpiralAdapter,
  "shader-strata": StrataAdapter,
  "shader-swirl": SwirlAdapter,
  "shader-voronoi": VoronoiAdapter,
  "shader-warp": WarpAdapter,
  "shader-water": WaterAdapter,
  "shader-weave": WeaveAdapter,
};

const decode = spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue();
afterEach(() => {
  cleanup();
  current = null;
  decode.mockClear();
  cancel.mockClear();
  pending.clear();
});
const instance = new Set([
  "opacity",
  "order",
  "startFrame",
  "endFrame",
  "followSceneEnd",
]);
it.each(Object.entries(adapters))(
  "%s binds every exposed shader parameter and uses scene time",
  async (slug, Adapter) => {
    const descriptor = SHADER_DESCRIPTORS.find((d) => d.slug === slug);
    if (!descriptor) {
      throw new Error(`Missing descriptor: ${slug}`);
    }
    const { values } = shaderCreation(
      descriptor,
      shaderTargetFixture,
      "create",
      "shader",
      0
    ).object;
    const props = {
      fps: 24,
      frame: 72,
      onError: mock(),
      onReady: mock(),
      values,
    };
    const { rerender } = render(<Adapter {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    if (!current) {
      throw new Error("No draw");
    }
    const original = JSON.stringify(current.uniforms);
    expect(current.time).toBe(3000);
    for (const field of descriptor.definition.fields) {
      if (instance.has(field.id)) {
        continue;
      }
      let changed: unknown;
      if (field.type === "number") {
        changed = field.default === field.min ? field.max : field.min;
      } else if (field.type === "palette") {
        changed = (field.default as readonly string[]).map(() => "#ff0000");
      } else if (field.type === "color") {
        changed = "#ff0000";
      } else if (field.type === "enum") {
        changed = field.options?.find((v) => v !== field.default);
      } else if (field.type === "boolean") {
        changed = !field.default;
      }
      if (changed === undefined) {
        throw new Error(`No sample for ${field.id}`);
      }
      rerender(
        <Adapter
          {...props}
          values={{ ...values, [field.id]: changed as never }}
        />
      );
      if (field.id === "speed") {
        expect(current.time).not.toBe(3000);
      } else {
        expect(JSON.stringify(current.uniforms)).not.toBe(original);
      }
    }
    if (current.uniforms.u_noiseTexture || current.uniforms.u_image) {
      expect(decode).toHaveBeenCalled();
    }
  }
);
it("gates texture decoding, cleans up abandoned loads and reports decode failures", async () => {
  const descriptor = SHADER_DESCRIPTORS.find(
    (d) => d.slug === "shader-dot-orbit"
  );
  if (!descriptor) {
    throw new Error("Missing Dot Orbit descriptor");
  }
  const { values } = shaderCreation(
    descriptor,
    shaderTargetFixture,
    "create",
    "shader",
    0
  ).object;
  const props = { fps: 24, frame: 0, onError: mock(), onReady: mock(), values };
  let resolveImage: () => void = () => undefined;
  decode.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveImage = () => resolve();
      })
  );
  const first = render(<DotOrbitAdapter {...props} />);
  expect(current).toBeNull();
  expect(pending.size).toBe(1);
  await act(async () => {
    resolveImage();
    await Promise.resolve();
  });
  expect(current).not.toBeNull();
  expect(pending.size).toBe(0);
  first.unmount();
  current = null;
  decode.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveImage = () => resolve();
      })
  );
  const second = render(<DotOrbitAdapter {...props} />);
  second.unmount();
  expect(pending.size).toBe(0);
  await act(async () => {
    resolveImage();
    await Promise.resolve();
  });
  expect(current).toBeNull();
  decode.mockRejectedValueOnce(new Error("Noise decode failed"));
  render(<DotOrbitAdapter {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(props.onError).toHaveBeenCalledWith("Noise decode failed");
  expect(cancel).toHaveBeenCalled();
  expect(pending.size).toBe(0);
});
it("retains parameter values while explaining dependent controls", () => {
  const descriptor = SHADER_DESCRIPTORS.find(
    (d) => d.slug === "shader-perlin-noise"
  );
  if (!descriptor) {
    throw new Error("Missing Perlin descriptor");
  }
  for (const id of ["lacunarity", "persistence"]) {
    const field = descriptor.definition.fields.find((f) => f.id === id);
    if (!field) {
      throw new Error(`Missing field: ${id}`);
    }
    expect(fieldUnavailableReason(field, { octaveCount: 1 })).toContain(
      "octave"
    );
    expect(fieldUnavailableReason(field, { octaveCount: 2 })).toBeNull();
  }
});
it.each(
  SHADER_DESCRIPTORS.filter(
    (d) => d.adapter === "paper" && d.slug !== "shader-mesh-gradient"
  )
)("copies the complete pinned uniform API for $slug", async (descriptor) => {
  const name = descriptor.slug.slice(7);
  const source = await readFile(
    `node_modules/@paper-design/shaders-react/dist/shaders/${name}.js`,
    "utf8"
  );
  const [uniformBlock] = source
    .slice(source.indexOf("  const uniforms = {"))
    .split("// Sizing uniforms");
  const adapter = await readFile(
    `templates/remotion/src/lib/studio-shaders-v1/${name}.tsx`,
    "utf8"
  );
  for (const match of uniformBlock.matchAll(/(u_\w+):/g)) {
    if (
      ["u_colorsCount", "u_noiseTexture", "u_isImage", "u_image"].includes(
        match[1]
      )
    ) {
      continue;
    }
    expect(adapter).toContain(match[1]);
  }
});
