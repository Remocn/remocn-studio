import { Effect } from "effect";
import { HOST_PID_ENV } from "@/shared/ipc";

const POLL_MS = 2000;
const SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"] as const;

export const untilOrphaned: Effect.Effect<string> = Effect.suspend(() => {
  const host = Number.parseInt(process.env[HOST_PID_ENV] ?? "", 10);

  if (!(Number.isInteger(host) && host > 0)) {
    return Effect.never;
  }

  return poll(host).pipe(Effect.as(`host ${host} is gone`));
});

export const untilSignalled: Effect.Effect<string> = Effect.callback<string>(
  (resume) => {
    const listeners = SIGNALS.map((signal) => {
      const onSignal = () => resume(Effect.succeed(`received ${signal}`));
      process.once(signal, onSignal);
      return { onSignal, signal };
    });

    return Effect.sync(() => {
      for (const { onSignal, signal } of listeners) {
        process.off(signal, onSignal);
      }
    });
  }
);

function poll(host: number): Effect.Effect<void> {
  return Effect.sleep(POLL_MS).pipe(
    Effect.andThen(
      Effect.suspend(() => (isAlive(host) ? poll(host) : Effect.void))
    )
  );
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
