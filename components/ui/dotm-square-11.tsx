"use client";

import type { CSSProperties } from "react";
import type {
  DotAnimationResolver,
  DotMatrixCommonProps,
} from "@/lib/dotmatrix-core";
import { DotMatrixBase } from "@/lib/dotmatrix-core";
import {
  useDotMatrixPhases,
  usePrefersReducedMotion,
} from "@/lib/dotmatrix-hooks";

export type DotmSquare11Props = DotMatrixCommonProps;

const animationResolver: DotAnimationResolver = ({
  isActive,
  manhattanDistance,
  reducedMotion,
  phase,
}) => {
  if (!isActive) {
    return { className: "dmx-inactive" };
  }

  const ring = Math.max(0, Math.min(4, manhattanDistance));
  const style = {
    "--dmx-ripple-parity": ring % 2,
    "--dmx-ripple-ring": ring,
  } as CSSProperties;

  if (reducedMotion || phase === "idle") {
    return {
      style: {
        ...style,
        opacity: 0.2 + (1 - ring / 4) * 0.72,
      },
    };
  }

  return { className: "dmx-ripple-echo", style };
};

export function DotmSquare11({
  speed = 1.25,
  pattern = "full",
  animated = true,
  hoverAnimated = false,
  ...rest
}: DotmSquare11Props) {
  const reducedMotion = usePrefersReducedMotion();
  const {
    phase: matrixPhase,
    onMouseEnter,
    onMouseLeave,
  } = useDotMatrixPhases({
    animated: Boolean(animated && !reducedMotion),
    hoverAnimated: Boolean(hoverAnimated && !reducedMotion),
    speed,
  });

  return (
    <DotMatrixBase
      {...rest}
      animated={animated}
      animationResolver={animationResolver}
      dotSize={rest.dotSize ?? 5}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      pattern={pattern}
      phase={matrixPhase}
      reducedMotion={reducedMotion}
      size={rest.size ?? 36}
      speed={speed}
    />
  );
}
