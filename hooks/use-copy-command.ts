"use client";

import { Effect, Fiber } from "effect";
import type { MouseEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

export interface CopyCommand {
  copied: string | null;
  onCopy: (event: MouseEvent<HTMLButtonElement>) => void;
}

const CLEAR_AFTER = "2 seconds";

export function useCopyCommand(): CopyCommand {
  const [copied, setCopied] = useState<string | null>(null);
  const running = useRef<Fiber.Fiber<unknown, unknown> | null>(null);

  const onCopy = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const command = event.currentTarget.value;

    if (running.current !== null) {
      Effect.runFork(Fiber.interrupt(running.current));
    }

    running.current = Effect.runFork(
      Effect.tryPromise(() => navigator.clipboard.writeText(command)).pipe(
        Effect.andThen(
          Effect.sync(() => {
            setCopied(command);
          })
        ),
        Effect.andThen(Effect.sleep(CLEAR_AFTER)),
        Effect.andThen(
          Effect.sync(() => {
            setCopied(null);
          })
        ),
        Effect.ignore
      )
    );
  }, []);

  return useMemo(() => ({ copied, onCopy }), [copied, onCopy]);
}
