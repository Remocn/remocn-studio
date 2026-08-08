"use client";

import { ShaderField } from "./shader-field";

const SPEED = 0.26;
const SCALE = 2.4;
const BRIGHTNESS = 0.16;
const CONTRAST = 0.26;

export function StartupBackdrop() {
  return (
    // Masked rather than faded with an overlay: the mask composites against
    // whatever the pane's background happens to be, and it keeps the pattern
    // away from the composer, where it would sit under text being typed.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-75 [mask-image:radial-gradient(130%_100%_at_50%_-15%,#000_0%,#000e_40%,#0009_62%,transparent_92%)]"
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
