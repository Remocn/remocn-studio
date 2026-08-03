"use client";

import { NeuroNoise } from "@paper-design/shaders-react";
import { useShaderBackdrop } from "@/hooks/use-shader-backdrop";

const SPEED = 0.3;
const SCALE = 1.6;

// The shader takes hex/rgb/hsl and the theme is authored in oklch, so these
// cannot read the tokens. They are the primary violet and its light end,
// carried over as rgba with the alpha doing the muting: a transparent back
// leaves the pane's own background showing through in either theme.
const BACK = "rgba(0, 0, 0, 0)";
const MID = "rgba(124, 58, 237, 0.55)";
const FRONT = "rgba(196, 181, 253, 0.45)";

// A background is soft by nature, so it is rendered at one device pixel per
// CSS pixel and capped well under the library's 8.3M default. Nothing about
// the pattern survives the extra samples; the GPU time does.
const MAX_PIXELS = 1920 * 1080;

export function StartupBackdrop() {
  const { isReady, speed } = useShaderBackdrop(SPEED);

  if (!isReady) {
    return null;
  }

  return (
    // Masked rather than faded with an overlay: the mask composites against
    // whatever the pane's background happens to be, and it keeps the pattern
    // away from the composer, where it would sit under text being typed.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(115%_75%_at_50%_0%,#000_0%,#000c_35%,#0006_60%,transparent_85%)]"
    >
      <NeuroNoise
        brightness={0.11}
        className="size-full"
        colorBack={BACK}
        colorFront={FRONT}
        colorMid={MID}
        contrast={0.32}
        height="100%"
        maxPixelCount={MAX_PIXELS}
        minPixelRatio={1}
        scale={SCALE}
        speed={speed}
        width="100%"
      />
    </div>
  );
}
