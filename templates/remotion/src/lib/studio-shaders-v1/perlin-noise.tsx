import { perlinNoiseFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-perlin-noise.json";
import { createPaperAdapter } from "./paper-adapter";
export const PerlinNoiseAdapter = createPaperAdapter(
  perlinNoiseFragmentShader,
  descriptor.definition.fields,
  {
    colorBack: {
      uniform: "u_colorBack",
    },
    colorFront: {
      uniform: "u_colorFront",
    },
    lacunarity: {
      uniform: "u_lacunarity",
    },
    octaveCount: {
      uniform: "u_octaveCount",
    },
    persistence: {
      uniform: "u_persistence",
    },
    proportion: {
      uniform: "u_proportion",
    },
    softness: {
      uniform: "u_softness",
    },
  },
  { image: false, isImage: false, noise: false }
);
