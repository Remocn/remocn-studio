import { swirlFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-swirl.json";
import { createPaperAdapter } from "./paper-adapter";
export const SwirlAdapter = createPaperAdapter(
  swirlFragmentShader,
  descriptor.definition.fields,
  {
    bandCount: {
      uniform: "u_bandCount",
    },
    center: {
      uniform: "u_center",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colors: {
      uniform: "u_colors",
    },
    noise: {
      uniform: "u_noise",
    },
    noiseFrequency: {
      uniform: "u_noiseFrequency",
    },
    proportion: {
      uniform: "u_proportion",
    },
    softness: {
      uniform: "u_softness",
    },
    twist: {
      uniform: "u_twist",
    },
  },
  { image: false, isImage: false, noise: false }
);
