import { neuroNoiseFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-neuro-noise.json";
import { createPaperAdapter } from "./paper-adapter";
export const NeuroNoiseAdapter = createPaperAdapter(
  neuroNoiseFragmentShader,
  descriptor.definition.fields,
  {
    brightness: {
      uniform: "u_brightness",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colorFront: {
      uniform: "u_colorFront",
    },
    colorMid: {
      uniform: "u_colorMid",
    },
    contrast: {
      uniform: "u_contrast",
    },
  },
  { image: false, isImage: false, noise: false }
);
