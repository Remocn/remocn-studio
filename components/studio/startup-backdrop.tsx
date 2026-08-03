"use client";

import { ShaderField } from "./shader-field";

const SPEED = 0.3;
const SCALE = 1.6;
const BRIGHTNESS = 0.11;
const CONTRAST = 0.32;

export function StartupBackdrop() {
  return (
    // Masked rather than faded with an overlay: the mask composites against
    // whatever the pane's background happens to be, and it keeps the pattern
    // away from the composer, where it would sit under text being typed.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(115%_75%_at_50%_0%,#000_0%,#000c_35%,#0006_60%,transparent_85%)]"
    >
      <ShaderField
        brightness={BRIGHTNESS}
        contrast={CONTRAST}
        scale={SCALE}
        speed={SPEED}
      />
    </div>
  );
}
