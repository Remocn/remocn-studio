import { smokeRingFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-smoke-ring.json";
import { createPaperAdapter } from "./paper-adapter";
export const SmokeRingAdapter = createPaperAdapter(
  smokeRingFragmentShader,
  descriptor.definition.fields,
  {
    colorBack: {
      uniform: "u_colorBack",
    },
    colors: {
      uniform: "u_colors",
    },
    innerShape: {
      uniform: "u_innerShape",
    },
    noiseIterations: {
      uniform: "u_noiseIterations",
    },
    noiseScale: {
      uniform: "u_noiseScale",
    },
    radius: {
      uniform: "u_radius",
    },
    thickness: {
      uniform: "u_thickness",
    },
  },
  { image: false, isImage: false, noise: true }
);
