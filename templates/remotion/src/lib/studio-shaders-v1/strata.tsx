import { createCustomAdapter } from "./custom-adapter";
import descriptor from "./descriptors/shader-strata.json";
import { fragment } from "./strata-fragment";
export const StrataAdapter = createCustomAdapter(
  fragment,
  descriptor.definition.fields,
  {
    accent: "u_accent",
    accentAmount: "u_accentAmt",
    amplitude: "u_amp",
    layers: "u_layers",
  },
  ["u_c0", "u_c1", "u_c2", "u_c3"]
);
