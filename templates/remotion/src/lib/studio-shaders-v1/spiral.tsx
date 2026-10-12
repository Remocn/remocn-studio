import { spiralFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-spiral.json";
import { createPaperAdapter } from "./paper-adapter";
export const SpiralAdapter = createPaperAdapter(
  spiralFragmentShader,
  descriptor.definition.fields,
  {
    colorBack: {
      uniform: "u_colorBack",
    },
    colorFront: {
      uniform: "u_colorFront",
    },
    density: {
      uniform: "u_density",
    },
    distortion: {
      uniform: "u_distortion",
    },
    noise: {
      uniform: "u_noise",
    },
    noiseFrequency: {
      uniform: "u_noiseFrequency",
    },
    softness: {
      uniform: "u_softness",
    },
    strokeCap: {
      uniform: "u_strokeCap",
    },
    strokeTaper: {
      uniform: "u_strokeTaper",
    },
    strokeWidth: {
      uniform: "u_strokeWidth",
    },
  },
  { image: false, isImage: false, noise: false }
);
