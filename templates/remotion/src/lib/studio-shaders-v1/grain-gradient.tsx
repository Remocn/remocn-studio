import { grainGradientFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-grain-gradient.json";
import { createPaperAdapter } from "./paper-adapter";
export const GrainGradientAdapter = createPaperAdapter(
  grainGradientFragmentShader,
  descriptor.definition.fields,
  {
    colorBack: {
      uniform: "u_colorBack",
    },
    colors: {
      uniform: "u_colors",
    },
    intensity: {
      uniform: "u_intensity",
    },
    noise: {
      uniform: "u_noise",
    },
    shape: {
      options: {
        blob: 6,
        corners: 4,
        dots: 2,
        ripple: 5,
        sphere: 7,
        truchet: 3,
        wave: 1,
      },
      uniform: "u_shape",
    },
    softness: {
      uniform: "u_softness",
    },
  },
  { image: false, isImage: false, noise: true }
);
