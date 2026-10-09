import { waterFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-water.json";
import { createPaperAdapter } from "./paper-adapter";
export const WaterAdapter = createPaperAdapter(
  waterFragmentShader,
  descriptor.definition.fields,
  {
    caustic: {
      uniform: "u_caustic",
    },
    colorBack: {
      uniform: "u_colorBack",
    },
    colorHighlight: {
      uniform: "u_colorHighlight",
    },
    edges: {
      uniform: "u_edges",
    },
    highlights: {
      uniform: "u_highlights",
    },
    layering: {
      uniform: "u_layering",
    },
    size: {
      uniform: "u_size",
    },
    waves: {
      uniform: "u_waves",
    },
  },
  { image: true, isImage: false, noise: false }
);
