import { metaballsFragmentShader } from "@paper-design/shaders";
import descriptor from "./descriptors/shader-metaballs.json";
import { createPaperAdapter } from "./paper-adapter";
export const MetaballsAdapter = createPaperAdapter(
  metaballsFragmentShader,
  descriptor.definition.fields,
  {
    colorBack: {
      uniform: "u_colorBack",
    },
    colors: {
      uniform: "u_colors",
    },
    count: {
      uniform: "u_count",
    },
    size: {
      uniform: "u_size",
    },
  },
  { image: false, isImage: false, noise: true }
);
