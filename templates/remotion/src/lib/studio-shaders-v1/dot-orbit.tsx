import { dotOrbitFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-dot-orbit.json";
import { createPaperAdapter } from "./paper-adapter";
export const DotOrbitAdapter = createPaperAdapter(
  dotOrbitFragmentShader,
  descriptor.definition.fields,
  {
    colorBack: {
      uniform: "u_colorBack",
    },
    colors: {
      uniform: "u_colors",
    },
    size: {
      uniform: "u_size",
    },
    sizeRange: {
      uniform: "u_sizeRange",
    },
    spreading: {
      uniform: "u_spreading",
    },
    stepsPerColor: {
      uniform: "u_stepsPerColor",
    },
  },
  { image: false, isImage: false, noise: true }
);
