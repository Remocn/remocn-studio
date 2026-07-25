"use client";

import type { CSSProperties } from "react";
import type {
  DotAnimationResolver,
  DotMatrixCommonProps,
} from "@/lib/dotmatrix-core";
import { DotMatrixBase, trBlPathNormFromIndex } from "@/lib/dotmatrix-core";
import {
  useDotMatrixPhases,
  usePrefersReducedMotion,
} from "@/lib/dotmatrix-hooks";

export type DotmSquare1Props = DotMatrixCommonProps;

const animationResolver: DotAnimationResolver = ({
  isActive,
  index,
  row,
  col,
  reducedMotion,
  phase,
}) => {
  if (!isActive) {
    return { className: "dmx-inactive" };
  }

  const path = trBlPathNormFromIndex(index);
  const slice = row + (4 - col);
  const parity = slice % 2;
  const style = {
    "--dmx-diagonal-parity": parity,
    "--dmx-path": path,
  } as CSSProperties;

  if (reducedMotion || phase === "idle") {
    return {
      style: {
        ...style,
        opacity: parity === 0 ? 0.88 : 0.14,
      },
    };
  }

  return { className: "dmx-diagonal-alt-sweep", style };
};

export function DotmSquare1({
  speed = 1.1,
  pattern = "full",
  animated = true,
  hoverAnimated = false,
  ...rest
}: DotmSquare1Props) {
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
