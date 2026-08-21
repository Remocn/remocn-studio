import { Schema } from "effect";

export const MOTION_ROLES = [
  "entry",
  "emphasis",
  "exit",
  "scene",
  "transition",
] as const;

export const MotionRole = Schema.Literals(MOTION_ROLES);

export type MotionRole = (typeof MotionRole)["Type"];

export const ELEMENT_ROLES = ["entry", "emphasis", "exit"] as const;

export type ElementRole = (typeof ELEMENT_ROLES)[number];

export const ROLE_LABELS: Record<MotionRole, string> = {
  emphasis: "Emphasis",
  entry: "Entry",
  exit: "Exit",
  scene: "Scene",
  transition: "Transition",
};

export const ROLE_HINTS: Record<MotionRole, string> = {
  emphasis: "how it draws the eye while it is on screen",
  entry: "how it arrives",
  exit: "how it leaves",
  scene: "what holds the frame for a whole scene",
  transition: "how one scene becomes the next",
};

export const ROLE_PARAMETERS: Record<MotionRole, readonly string[]> = {
  emphasis: ["intensity", "repeat", "delay"],
  entry: ["direction", "durationInFrames", "delay", "stagger", "easing"],
  exit: ["direction", "durationInFrames", "delay", "stagger", "easing"],
  scene: ["speed", "intensity"],
  transition: ["direction", "durationInFrames", "easing"],
};

export const MOTION_DICTIONARY: Record<ElementRole, readonly string[]> = {
  emphasis: ["highlight", "mark", "shimmer", "glitch", "swap", "burst"],
  entry: [
    "fade-in",
    "rise-in",
    "slide-in",
    "blur-in",
    "scale-in",
    "mask-reveal",
    "type-on",
    "draw-on",
    "count-in",
    "decode-in",
  ],
  exit: ["fade-out", "blur-out", "slide-out", "scale-out"],
};

export function isElementRole(role: MotionRole): role is ElementRole {
  return (ELEMENT_ROLES as readonly MotionRole[]).includes(role);
}

export function isMotionRole(value: unknown): value is MotionRole {
  return (
    typeof value === "string" &&
    (MOTION_ROLES as readonly string[]).includes(value)
  );
}
