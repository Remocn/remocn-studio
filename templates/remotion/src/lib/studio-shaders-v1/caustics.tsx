import { fragment } from "./caustics-fragment";
import { createCustomAdapter } from "./custom-adapter";
import descriptor from "./descriptors/shader-caustics.json";
export const CausticsAdapter = createCustomAdapter(
  fragment,
  descriptor.definition.fields,
  {
    accent: "u_accent",
    accentAmount: "u_accentAmt",
    intensity: "u_intensity",
    scale: "u_scale",
  },
  ["u_floor", "u_light"]
);
