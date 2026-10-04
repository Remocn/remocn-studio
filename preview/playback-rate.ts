import { useEffect, useState } from "react";
import { route } from "./bridge";

export const PLAYBACK_RATES = [0.25, 0.5, 1, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export function usePlaybackRate(): number {
  const [rate, setRate] = useState(1);
  useEffect(
    () =>
      route("rate", {
        "transport.rate": (command) => {
          if ((PLAYBACK_RATES as readonly number[]).includes(command.rate)) {
            setRate(command.rate);
          }
        },
      }),
    []
  );
  return rate;
}
