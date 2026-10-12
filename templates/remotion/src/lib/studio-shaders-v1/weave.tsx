import { createCustomAdapter } from "./custom-adapter";
import descriptor from "./descriptors/shader-weave.json";
import { fragment } from "./weave-fragment";
export const WeaveAdapter = createCustomAdapter(
  fragment,
  descriptor.definition.fields,
  {
    accent: "u_accent",
    accentAmount: "u_accentAmt",
    scale: "u_scale",
    warp: "u_warp",
  },
  ["u_c0", "u_c1", "u_c2", "u_c3"]
);
