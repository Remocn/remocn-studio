import { simplexNoiseFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-simplex-noise.json";
import { createPaperAdapter } from "./paper-adapter";
export const SimplexNoiseAdapter = createPaperAdapter(
  simplexNoiseFragmentShader,
  descriptor.definition.fields,
  {
    colors: {
      uniform: "u_colors",
    },
    softness: {
      uniform: "u_softness",
    },
    stepsPerColor: {
      uniform: "u_stepsPerColor",
    },
  },
  { image: false, isImage: false, noise: false }
);
