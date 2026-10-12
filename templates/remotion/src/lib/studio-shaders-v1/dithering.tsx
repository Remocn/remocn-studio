import { ditheringFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-dithering.json";
import { createPaperAdapter } from "./paper-adapter";
export const DitheringAdapter = createPaperAdapter(
  ditheringFragmentShader,
  descriptor.definition.fields,
  {
    colorBack: {
      uniform: "u_colorBack",
    },
    colorFront: {
      uniform: "u_colorFront",
    },
    shape: {
      options: {
        dots: 3,
        ripple: 5,
        simplex: 1,
        sphere: 7,
        swirl: 6,
        warp: 2,
        wave: 4,
      },
      uniform: "u_shape",
    },
    size: {
      uniform: "u_pxSize",
    },
    type: {
      options: {
        "2x2": 2,
        "4x4": 3,
        "8x8": 4,
        random: 1,
      },
      uniform: "u_type",
    },
  },
  { image: false, isImage: false, noise: false }
);
