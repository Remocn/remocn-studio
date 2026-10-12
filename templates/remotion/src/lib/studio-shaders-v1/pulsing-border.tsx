import { pulsingBorderFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-pulsing-border.json";
import { createPaperAdapter } from "./paper-adapter";
export const PulsingBorderAdapter = createPaperAdapter(
  pulsingBorderFragmentShader,
  descriptor.definition.fields,
  {
    aspectRatio: {
      options: {
        auto: 0,
        square: 1,
      },
      uniform: "u_aspectRatio",
    },
    bloom: {
      uniform: "u_bloom",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colors: {
      uniform: "u_colors",
    },
    intensity: {
      uniform: "u_intensity",
    },
    marginBottom: {
      uniform: "u_marginBottom",
    },
    marginLeft: {
      uniform: "u_marginLeft",
    },
    marginRight: {
      uniform: "u_marginRight",
    },
    marginTop: {
      uniform: "u_marginTop",
    },
    pulse: {
      uniform: "u_pulse",
    },
    roundness: {
      uniform: "u_roundness",
    },
    smoke: {
      uniform: "u_smoke",
    },
    smokeSize: {
      uniform: "u_smokeSize",
    },
    softness: {
      uniform: "u_softness",
    },
    spotSize: {
      uniform: "u_spotSize",
    },
    spots: {
      uniform: "u_spots",
    },
    thickness: {
      uniform: "u_thickness",
    },
  },
  { image: false, isImage: false, noise: true }
);
