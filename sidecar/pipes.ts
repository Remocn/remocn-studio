import { Effect } from "effect";

// A write into a pipe whose reader is gone does not throw in bun: `write`
// returns false and the stream emits `error` with EPIPE, and an `error` with
// no listener surfaces as an unhandled rejection — which is what crash
// reporting filed from 1.0.0 as REM-651, from inside whichever `Effect.sync`
// happened to log next. Measured on bun 1.4.2: after that one event the
// stream is errored, every later write is dropped without another, and
// nothing is buffered, so one listener per stream is the whole guard.
export interface Outlet {
  readonly errored: unknown;
  readonly off: (event: "error", listener: (error: Error) => void) => unknown;
  readonly on: (event: "error", listener: (error: Error) => void) => unknown;
  readonly once: (event: "error", listener: (error: Error) => void) => unknown;
}

const ignore = () => undefined;

export function guard(outlets: readonly Outlet[]): Effect.Effect<void> {
  return Effect.sync(() => {
    for (const outlet of outlets) {
      outlet.on("error", ignore);
    }
  });
}

export const guardPipes: Effect.Effect<void> = guard([
  process.stdout,
  process.stderr,
]);

export function untilBroken(
  outlet: Outlet,
  reason: string
): Effect.Effect<string> {
  return Effect.callback<string>((resume) => {
    if (outlet.errored) {
      resume(Effect.succeed(reason));
      return;
    }

    const onError = () => resume(Effect.succeed(reason));
    outlet.once("error", onError);

    return Effect.sync(() => {
      outlet.off("error", onError);
    });
  });
}
