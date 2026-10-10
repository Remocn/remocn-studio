import { liquidMetalFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-liquid-metal.json";
import { createPaperAdapter } from "./paper-adapter";
export const LiquidMetalAdapter = createPaperAdapter(
  liquidMetalFragmentShader,
  descriptor.definition.fields,
  {
    angle: {
      uniform: "u_angle",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colorTint: {
      uniform: "u_colorTint",
    },
    contour: {
      uniform: "u_contour",
    },
    distortion: {
      uniform: "u_distortion",
    },
    repetition: {
      uniform: "u_repetition",
    },
    shape: {
      options: {
        circle: 1,
        daisy: 2,
        diamond: 3,
        metaballs: 4,
        none: 0,
      },
      uniform: "u_shape",
    },
    shiftBlue: {
      uniform: "u_shiftBlue",
    },
    shiftRed: {
      uniform: "u_shiftRed",
    },
    softness: {
      uniform: "u_softness",
    },
  },
  { image: true, isImage: true, noise: false }
);
