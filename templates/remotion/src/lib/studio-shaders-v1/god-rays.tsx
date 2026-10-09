import { godRaysFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-god-rays.json";
import { createPaperAdapter } from "./paper-adapter";
export const GodRaysAdapter = createPaperAdapter(
  godRaysFragmentShader,
  descriptor.definition.fields,
  {
    bloom: {
      uniform: "u_bloom",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colorBloom: {
      uniform: "u_colorBloom",
    },
    colors: {
      uniform: "u_colors",
    },
    density: {
      uniform: "u_density",
    },
    intensity: {
      uniform: "u_intensity",
    },
    midIntensity: {
      uniform: "u_midIntensity",
    },
    midSize: {
      uniform: "u_midSize",
    },
    spotty: {
      uniform: "u_spotty",
    },
  },
  { image: false, isImage: false, noise: true }
);
