import type { AnimationEventHandler } from "react";
import { useSplash } from "@/hooks/use-splash";
import type { SplashPhase } from "@/lib/studio/splash";
import { GLYPH } from "./logo-mark";

export function Splash({
  isSettled,
  onGone,
}: {
  isSettled: boolean;
  onGone?: () => void;
}) {
  const splash = useSplash(isSettled, onGone);

  return <SplashScreen {...splash} />;
}

export function SplashScreen({
  isReduced,
  onAnimationEnd,
  phase,
}: {
  isReduced: boolean;
  onAnimationEnd: AnimationEventHandler<HTMLDivElement>;
  phase: SplashPhase | "gone";
}) {
  if (phase === "gone") {
    return null;
  }

  return (
    <div
      aria-label="Loading Remocn Studio"
      className="splash-surface fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background text-foreground"
      data-reduced-motion={isReduced}
      data-splash={phase}
      data-tauri-drag-region
      onAnimationEnd={onAnimationEnd}
      role="status"
    >
      <div
        aria-hidden="true"
        className="splash-lockup relative flex items-baseline font-semibold text-[14px] leading-5 tracking-[-0.4px]"
        data-splash-lockup
      >
        <svg
          className="h-4 w-auto overflow-visible"
          fill="none"
          viewBox="0 0 124.06 134.26"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>remocn</title>
          <path
            className="splash-glyph-stroke"
            d={GLYPH}
            pathLength="1"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path className="splash-glyph-fill" d={GLYPH} fill="currentColor" />
        </svg>
        <span className="splash-wordmark ml-[0.04em]">emocn Studio</span>
      </div>
    </div>
  );
}
