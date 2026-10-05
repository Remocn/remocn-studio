import { Effect, Ref, Stream } from "effect";
import type {
  AgentFailure,
  ContextUsage,
  PromptParams,
  PromptResult,
} from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import type { AgentAdapter, TurnServices } from "../agent/adapter";
import { missingCli } from "../agent/cli";
import { announce, locateBundle } from "../agent/knowledge";
import { accountCheck, missingRow } from "./account";
import { findClaude } from "./cli";
import { eventsOf } from "./events";
import { failureFromText, failureOf } from "./failure";
import { permissionGuard } from "./guard";
import { messages } from "./session";

export const claudeAdapter: AgentAdapter = {
  account: accountCheck,

  forget: () => Effect.void,

  info: PROVIDER_INFO.claude,

  toolKey: ({ turn }) => turn,

  turn: (params: PromptParams, services: TurnServices) =>
    Effect.gen(function* () {
      const executable = findClaude();
      if (executable === null) {
        return missingCli(missingRow(), params);
      }

      const sessionId = yield* Ref.make(params.sessionId);
      const failure = yield* Ref.make<AgentFailure | null>(null);
      const context = yield* Ref.make<ContextUsage | null>(null);
      const knowledge = locateBundle(services.cwd);

      yield* announce(knowledge, services);
      const { media, system, trailer } = services.instructions(
        knowledge.loaded
      );

      yield* Stream.runForEach(
        messages(params, {
          canUseTool: permissionGuard({
            cwd: services.cwd,
            permissions: services.permissions,
          }),
          cwd: services.cwd,
          executable,
          inProcess: services.inProcess ?? {},
          knowledge,
          log: (line) => Effect.runSync(services.log(line)),
          media,
          onContext: (usage) => Effect.runSync(Ref.set(context, usage)),
          onMode: (apply) => Effect.runSync(services.onMode(apply)),
          onStop: () => Effect.runSync(services.permissions.abandon),
          system,
          tools: services.tools,
          trailer,
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
        Effect.onExit(() => services.permissions.abandon)
      );

      return {
        context: yield* Ref.get(context),
        failure: yield* Ref.get(failure),
        sessionId: yield* Ref.get(sessionId),
      } satisfies PromptResult;
    }),
};
