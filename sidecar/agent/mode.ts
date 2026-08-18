import { Effect, Ref } from "effect";
import type { SessionMode } from "@/shared/ipc";

export type ApplyMode = (mode: SessionMode) => Promise<void>;

export interface ModeSwitch {
  readonly bind: (apply: ApplyMode) => Effect.Effect<void>;
  readonly set: (mode: SessionMode) => Effect.Effect<boolean>;
}

export function makeModeSwitch(): Effect.Effect<ModeSwitch> {
  return Effect.map(Ref.make<ApplyMode | null>(null), (applier) => ({
    bind: (apply) => Ref.set(applier, apply),

    set: (mode) =>
      Ref.get(applier).pipe(
        Effect.flatMap((apply) =>
          apply === null
            ? Effect.succeed(false)
            : Effect.tryPromise(() => apply(mode)).pipe(
                Effect.as(true),
                Effect.orElseSucceed(() => false)
              )
        )
      ),
  }));
}
