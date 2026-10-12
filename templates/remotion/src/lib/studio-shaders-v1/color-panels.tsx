import { colorPanelsFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-color-panels.json";
import { createPaperAdapter } from "./paper-adapter";
export const ColorPanelsAdapter = createPaperAdapter(
  colorPanelsFragmentShader,
  descriptor.definition.fields,
  {
    angle1: {
      uniform: "u_angle1",
    },
    angle2: {
      uniform: "u_angle2",
    },
    blur: {
      uniform: "u_blur",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colors: {
      uniform: "u_colors",
    },
    density: {
      uniform: "u_density",
    },
    edges: {
      uniform: "u_edges",
    },
    fadeIn: {
      uniform: "u_fadeIn",
    },
    fadeOut: {
      uniform: "u_fadeOut",
    },
    gradient: {
      uniform: "u_gradient",
    },
    length: {
      uniform: "u_length",
    },
  },
  { image: false, isImage: false, noise: false }
);
