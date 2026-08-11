"use client";

import type { MoodTone, ShellMood } from "@/lib/studio/mood";
import { cn } from "@/lib/utils";
import { ShaderField } from "./shader-field";

const CALM = 0.24;
const BUSY = 0.85;

// `fit: "none"` means the pattern lives in pixel space, so this scale reads the
// same whatever the pane is resized to — a narrower band is a narrower window
// onto the same texture, not a squeezed one.
const SCALE = 0.55;

// Brighter and flatter than the startup screen's. There the shader is a wash
// behind prose and has a whole pane to be visible in; here it is the signal
// itself in a band a few pixels tall, and the drift kept carrying the lit part
// out of frame. Brightness lifts the crossing points, and lower contrast keeps
// the space between them from going to black.
const BRIGHTNESS = 0.26;
const CONTRAST = 0.2;

// A filter, not a blend layer. `mix-blend-mode` composites against the backdrop
// of the nearest isolated group, and the fade-in below animates opacity, which
// makes this element its own group — so over the canvas's transparent parts the
// tint simply painted itself and the band came out a flat slab of colour.
// `hue-rotate` transforms the pixels that exist and leaves the rest alone, and
// unlike a WebGL uniform it transitions.
//
// Measured against the shader's violet (#7c3aed) through the filter spec's
// matrix: -45deg lands on rgb(5, 95, 220), 100deg on rgb(228, 49, 20).
const TONES = {
  failed: "hue-rotate-100",
  idle: "hue-rotate-0",
  waiting: "-hue-rotate-45",
} satisfies Record<MoodTone, string>;

export function Titlebar({
  className,
  mood,
}: {
  className?: string;
  mood: ShellMood | null;
}) {
  return (
    // The window has no title bar of its own, so this band is where macOS
    // draws its buttons. It is the same height whether or not it carries the
    // shader, which is what lets an empty app grow into a busy one without
    // anything below it moving. The inset shell overrides the height: there
    // the band is a backdrop the content card rides over, not a strip.
    <div
      className={cn(
        "relative h-(--titlebar-block-inset) shrink-0 overflow-hidden bg-sidebar",
        className
      )}
      data-slot="titlebar"
      data-tauri-drag-region
    >
      {mood === null ? null : (
        <div
          aria-hidden="true"
          className={cn(
            // The band's own bottom edge is the sidebar, not a boundary worth
            // drawing, so the pattern is masked out before it gets there —
            // a long staged ramp, because a short one reads as a hard seam.
            "pointer-events-none absolute inset-0 animate-titlebar transition-[filter] duration-700 ease-out [mask-image:linear-gradient(to_bottom,#000_0%,#000d_35%,#0009_60%,#0004_80%,#0001_92%,transparent_100%)]",
            TONES[mood.tone]
          )}
          data-slot="titlebar-mood"
        >
          <ShaderField
            brightness={BRIGHTNESS}
            contrast={CONTRAST}
            scale={SCALE}
            speed={mood.isBusy ? BUSY : CALM}
          />
        </div>
      )}
    </div>
  );
}
