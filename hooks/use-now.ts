"use client";

import { type Duration, Effect, Fiber, Schedule } from "effect";
import { useEffect, useState } from "react";

const TICK = "1 minute";

export function useNow(every: Duration.Input | null = TICK): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (every === null) {
      return;
    }

    const fiber = Effect.runFork(
      Effect.repeat(
        Effect.sync(() => setNow(Date.now())),
        Schedule.spaced(every)
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [every]);

  return now;
}
