"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import { fetchSidecarStatus, watchSidecarStatus } from "@/lib/studio/sidecar";
import type { SidecarStatus } from "@/shared/ipc";

export function useSidecarStatus(): SidecarStatus | null {
  const [status, setStatus] = useState<SidecarStatus | null>(null);

  useEffect(() => {
    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchSidecarStatus(setStatus);

          yield* Effect.ignore(
            Effect.tap(fetchSidecarStatus, (current) =>
              Effect.sync(() => setStatus((seen) => seen ?? current))
            )
          );

          yield* Effect.never;
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  return status;
}
