"use client";

import { useRef } from "react";
import type { MoodTone, ShellMood } from "@/lib/studio/mood";
import { cn } from "@/lib/utils";
import { ShaderField } from "./shader-field";

const CALM = 0.24;
const BUSY = 0.85;

// `fit: "none"` means the pattern lives in pixel space, so this scale reads the
// same whatever the pane is resized to — a narrower band is a narrower window
// onto the same texture, not a squeezed one.
const SCALE = 0.55;

const BRIGHTNESS = 0.26;
const CONTRAST = 0.2;

// Filtering preserves transparent pixels and lets mood changes transition.
const TONES = {
  failed: "hue-rotate-100",
  idle: "grayscale",
  waiting: "-hue-rotate-45",
} satisfies Record<MoodTone, string>;

export function Titlebar({
  className,
  isBooting = false,
  isStill = false,
  mood,
}: {
  className?: string;
  isBooting?: boolean;
  isStill?: boolean;
  mood: ShellMood | null;
}) {
  return (
    // Window controls and activity share stationary chrome above the content.
    <div
      className={cn(
        "relative h-[46px] shrink-0 overflow-hidden bg-sidebar",
        className
      )}
      data-slot="titlebar"
      data-tauri-drag-region
    >
      {mood === null ? null : (
        <MoodField isBooting={isBooting} isStill={isStill} mood={mood} />
      )}
    </div>
  );
}

// `isStill` freezes the drift without losing the field: a speed of zero is
// what the reduced-motion probe already hands the shader, so a person's
// choice and the OS's take the same path.
export function MoodField({
  isBooting,
  isStill = false,
  mood,
}: {
  isBooting: boolean;
  isStill?: boolean;
  mood: ShellMood;
}) {
  // A mood first mounted beneath the splash is already part of the assembled
  // shell. Capture that decision so removing the boot flag cannot replay its
  // entrance after the splash has gone.
  const shouldAnimateEntrance = useRef(!isBooting).current;

  return (
    <div
      aria-hidden="true"
      className={cn(
        // Fade into the sidebar without drawing a seam at the band's edge.
        "pointer-events-none absolute inset-0 transition-[filter] duration-slow ease-out [mask-image:linear-gradient(to_bottom,#000_0%,#000d_35%,#0009_60%,#0004_80%,#0001_92%,transparent_100%)]",
        shouldAnimateEntrance && "animate-titlebar",
        TONES[mood.tone]
      )}
      data-slot="titlebar-mood"
    >
      <ShaderField
        brightness={BRIGHTNESS}
        className={cn(
          "transition-opacity duration-slow ease-out",
          mood.tone === "idle" && !mood.isBusy ? "opacity-0" : "opacity-35"
        )}
        contrast={CONTRAST}
        scale={SCALE}
        speed={speedOf(mood, isStill)}
      />
    </div>
  );
}

function speedOf(mood: ShellMood, isStill: boolean): number {
  if (isStill || (mood.tone === "idle" && !mood.isBusy)) {
    return 0;
  }
  return mood.isBusy ? BUSY : CALM;
}
