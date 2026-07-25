"use client";

import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";
import { fetchSidecarStatus, watchSidecarStatus } from "@/lib/studio/sidecar";
import type { SidecarStatus } from "@/shared/ipc";

const RETRY_MS = 700;

const readStatus = fetchSidecarStatus.pipe(
  Effect.catch(() => Effect.succeed(null))
);

function settle(
  onStatus: (status: SidecarStatus) => void
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const status = yield* readStatus;

    if (status !== null) {
      onStatus(status);
      if (status.phase === "ready" || status.phase === "down") {
        return;
      }
    }

    yield* Effect.sleep(RETRY_MS);
    yield* settle(onStatus);
  });
}

function same(left: SidecarStatus | null, right: SidecarStatus): boolean {
  return (
    left !== null &&
    left.attempt === right.attempt &&
    left.detail === right.detail &&
    left.logPath === right.logPath &&
    left.phase === right.phase &&
    left.pid === right.pid
  );
}

export function useSidecarStatus(): SidecarStatus | null {
  const [status, setStatus] = useState<SidecarStatus | null>(null);

  useEffect(() => {
    const keep = (next: SidecarStatus) => {
      setStatus((seen) => (same(seen, next) ? seen : next));
    };

    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          yield* watchSidecarStatus(keep);
          yield* settle(keep);
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
