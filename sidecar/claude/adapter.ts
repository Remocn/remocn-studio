import { Effect, Ref, Stream } from "effect";
import type {
  AgentFailure,
  ContextUsage,
  PromptParams,
  PromptResult,
} from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import type { AgentAdapter, TurnServices } from "../agent/adapter";
import { announce, locateBundle } from "../agent/knowledge";
import { accountCheck } from "./account";
import { eventsOf } from "./events";
import { failureFromText, failureOf } from "./failure";
import { permissionGuard } from "./guard";
import { messages } from "./session";

export const claudeAdapter: AgentAdapter = {
  account: accountCheck,

  info: PROVIDER_INFO.claude,

  turn: (params: PromptParams, services: TurnServices) =>
    Effect.gen(function* () {
      const sessionId = yield* Ref.make(params.sessionId);
      const failure = yield* Ref.make<AgentFailure | null>(null);
      const context = yield* Ref.make<ContextUsage | null>(null);
      const knowledge = locateBundle(services.cwd);

      yield* announce(knowledge, services);

      yield* Stream.runForEach(
        messages(params, {
          assets: services.briefs.assets,
          brief: services.briefs.pipeline,
          canUseTool: permissionGuard({
            cwd: services.cwd,
            emit: services.emit,
            gate: services.gate,
            onApprove: services.onApprove,
            turnId: services.turnId,
          }),
          cwd: services.cwd,
          knowledge,
          log: (line) => Effect.runSync(services.log(line)),
          media: services.briefs.media,
          onContext: (usage) => Effect.runSync(Ref.set(context, usage)),
          onMode: (apply) => Effect.runSync(services.onMode(apply)),
          onStop: () => Effect.runSync(services.gate.abandon(services.turnId)),
          tools: services.tools,
        }),
        (message) =>
          Effect.gen(function* () {
            if (message.type === "system" && message.subtype === "init") {
              yield* Ref.set(sessionId, message.session_id);
            }

            const found = failureOf(message);
            if (found !== null) {
              yield* Ref.set(failure, found);
            }

            yield* Effect.forEach(
              eventsOf(message, params.mode),
              (event) =>
                Effect.andThen(services.emit(event), services.record(event)),
              { discard: true }
            );
          })
      ).pipe(
        Effect.catch((error) =>
          Ref.update(
            failure,
            (current) => current ?? failureFromText(error.message)
          )
        ),
        Effect.onExit(() => services.gate.abandon(services.turnId))
      );

      return {
        context: yield* Ref.get(context),
        failure: yield* Ref.get(failure),
        sessionId: yield* Ref.get(sessionId),
      } satisfies PromptResult;
    }),
};
