"use client";

import { useCallback, useMemo, useState } from "react";

export interface ClipFallback {
  isBroken: boolean;
  onError: () => void;
  ref: (node: HTMLVideoElement | null) => void;
}

// A clip that fails to play is remembered for the card's lifetime, so the
// popover settles on the poster instead of retrying the decode on every
// hover.
//
// The ref exists because the `autoPlay` attribute alone does not start the
// clip: React never writes `muted` into the DOM (a long-standing quirk), so
// the autoplay policy sees an unmuted video and blocks it. Muting the element
// by hand and calling play() is the reliable path; a rejected play falls
// through to onError's poster.
export function useClipFallback(): ClipFallback {
  const [isBroken, setBroken] = useState(false);

  const onError = useCallback(() => setBroken(true), []);

  // The rejection is swallowed on purpose: closing the popover mid-start
  // rejects play() with an AbortError, and treating that as a broken clip
  // permanently demoted every briefly-hovered card to its poster. A clip
  // that genuinely cannot decode reports through onError instead.
  const ref = useCallback((node: HTMLVideoElement | null) => {
    if (node === null) {
      return;
    }
    node.muted = true;
    node.play().catch(() => undefined);
  }, []);

  return useMemo(() => ({ isBroken, onError, ref }), [isBroken, onError, ref]);
}
