"use client";

import { useCallback, useEffect, useRef } from "react";

export function useNavigationMotion() {
  const pointer = useRef(false);
  useEffect(() => {
    const onPointer = () => {
      pointer.current = true;
    };
    const onKey = () => {
      pointer.current = false;
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);
  return useCallback(
    () =>
      pointer.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
}
