"use client";

import { useEffect, useState } from "react";

export interface ShaderBackdrop {
  isReady: boolean;
  speed: number;
}

interface Support {
  hasWebgl: boolean;
  isStill: boolean;
}

export function useShaderBackdrop(speed: number): ShaderBackdrop {
  const [support, setSupport] = useState<Support | null>(null);

  useEffect(() => {
    setSupport(probe());
  }, []);

  return {
    isReady: support?.hasWebgl ?? false,
    speed: support?.isStill === true ? 0 : speed,
  };
}

// Paper Shaders throws "WebGL is not supported in this browser" when the
// context comes back null, so this has to be answered before the shader is
// rendered rather than caught around it. The probe's own context is handed
// straight back — a background is not worth holding one of the handful a
// webview will give out.
function probe(): Support {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  gl?.getExtension("WEBGL_lose_context")?.loseContext();

  return {
    hasWebgl: gl !== null,
    isStill: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
