import { warpFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-warp.json";
import { createPaperAdapter } from "./paper-adapter";
export const WarpAdapter = createPaperAdapter(
  warpFragmentShader,
  descriptor.definition.fields,
  {
    colors: {
      uniform: "u_colors",
    },
    distortion: {
      uniform: "u_distortion",
    },
    proportion: {
      uniform: "u_proportion",
    },
    shape: {
      options: {
        checks: 0,
        edge: 2,
        stripes: 1,
      },
      uniform: "u_shape",
    },
    shapeScale: {
      uniform: "u_shapeScale",
    },
    softness: {
      uniform: "u_softness",
    },
    swirl: {
      uniform: "u_swirl",
    },
    swirlIterations: {
      uniform: "u_swirlIterations",
    },
  },
  { image: false, isImage: false, noise: true }
);
