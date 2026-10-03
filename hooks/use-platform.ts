"use client";

import { useLayoutEffect, useState } from "react";
import { currentPlatform, type Platform } from "@/lib/studio/platform";

export function usePlatformAttribute(): void {
  useLayoutEffect(() => {
    document.documentElement.dataset.platform = currentPlatform();
  }, []);
}

// `null` until mounted: the static export is prerendered without a navigator,
// so reading the platform during render would disagree with the hydrated page.
export function usePlatform(): Platform | null {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useLayoutEffect(() => {
    setPlatform(currentPlatform());
  }, []);

  return platform;
}
