"use client";

import type { CanvasRulersState } from "@/hooks/use-canvas-rulers";

const RULER_INK =
  "block size-full text-muted-foreground [--ruler-edge:var(--pane-border)] [--ruler-mark:var(--reference)]";

export function CanvasRulers({ rulers }: { rulers: CanvasRulersState }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 z-[15] size-5 bg-muted"
        data-canvas-chrome
      />
      <div
        aria-hidden="true"
        className="absolute top-0 right-(--canvas-inspector-width) left-5 z-[15] h-5 bg-muted"
        data-canvas-chrome
        data-canvas-occludes="top"
      >
        <canvas className={RULER_INK} ref={rulers.top} />
      </div>
      <div
        aria-hidden="true"
        className="absolute top-5 bottom-0 left-0 z-[15] w-5 bg-muted"
        data-canvas-chrome
        data-canvas-occludes="left"
      >
        <canvas className={RULER_INK} ref={rulers.left} />
      </div>
    </>
  );
}
