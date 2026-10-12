import { gemSmokeFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-gem-smoke.json";
import { createPaperAdapter } from "./paper-adapter";
export const GemSmokeAdapter = createPaperAdapter(
  gemSmokeFragmentShader,
  descriptor.definition.fields,
  {
    angle: {
      uniform: "u_angle",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colorInner: {
      uniform: "u_colorInner",
    },
    colors: {
      uniform: "u_colors",
    },
    innerDistortion: {
      uniform: "u_innerDistortion",
    },
    innerGlow: {
      uniform: "u_innerGlow",
    },
    offset: {
      uniform: "u_offset",
    },
    outerDistortion: {
      uniform: "u_outerDistortion",
    },
    outerGlow: {
      uniform: "u_outerGlow",
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
    size: {
      uniform: "u_size",
    },
  },
  { image: true, isImage: true, noise: false }
);
