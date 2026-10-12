import { voronoiFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-voronoi.json";
import { createPaperAdapter } from "./paper-adapter";
export const VoronoiAdapter = createPaperAdapter(
  voronoiFragmentShader,
  descriptor.definition.fields,
  {
    colorGap: {
      uniform: "u_colorGap",
    },
    colorGlow: {
      uniform: "u_colorGlow",
    },
    colors: {
      uniform: "u_colors",
    },
    distortion: {
      uniform: "u_distortion",
    },
    gap: {
      uniform: "u_gap",
    },
    glow: {
      uniform: "u_glow",
    },
    stepsPerColor: {
      uniform: "u_stepsPerColor",
    },
  },
  { image: false, isImage: false, noise: true }
);
