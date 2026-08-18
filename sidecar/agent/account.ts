import { Effect, Ref } from "effect";
import type { EnvironmentCheck } from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";
import { adapterFor } from "./registry";

export interface AccountCache {
  readonly clear: Effect.Effect<void>;
  readonly row: (
    provider: AgentProvider,
    cwd: string
  ) => Effect.Effect<EnvironmentCheck>;
}

type Probe = (
  provider: AgentProvider,
  cwd: string
) => Effect.Effect<EnvironmentCheck>;

const probeAdapter: Probe = (provider, cwd) =>
  adapterFor(provider).account(cwd);

export function makeAccountCache(
  probe: Probe = probeAdapter
): Effect.Effect<AccountCache> {
  return Effect.map(
    Ref.make<ReadonlyMap<AgentProvider, EnvironmentCheck>>(new Map()),
    (cached): AccountCache => ({
      clear: Ref.set(cached, new Map()),
      row: (provider, cwd) =>
        Effect.flatMap(Ref.get(cached), (seen) => {
          const known = seen.get(provider);
          if (known !== undefined) {
            return Effect.succeed(known);
          }

          return probe(provider, cwd).pipe(
            Effect.tap((row) =>
              Ref.update(cached, (current) =>
                new Map(current).set(provider, row)
              )
            )
          );
        }),
    })
  );
}
