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

// The macOS wording until mounted, which is also what the prerendered page
// carries: a Mac never sees a word change, and Linux swaps before paint.
export function useIsMac(): boolean {
  const platform = usePlatform();

  return platform === null || platform === "mac";
}
