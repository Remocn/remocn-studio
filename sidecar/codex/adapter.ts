import {
  Codex,
  type CodexOptions,
  type ModelReasoningEffort,
  type ThreadOptions,
} from "@openai/codex-sdk";
import { Data, Effect, Exit, Ref, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import type {
  AgentFailure,
  EffortLevel,
  PromptParams,
  PromptResult,
  SessionMode,
} from "@/shared/ipc";
import { PROVIDER_INFO } from "@/shared/providers";
import type { AgentAdapter, TurnServices } from "../agent/adapter";
import { conventionsFor } from "../claude/conventions";
import { accountCheck, missingRow } from "./account";
import { findCodex } from "./cli";
import { inputOf } from "./content";
import { makeTranslator } from "./events";
import { failureFromText } from "./failure";

class CodexError extends Data.TaggedError("CodexError")<{
  message: string;
}> {}

// How the three studio modes reach Codex, and what each costs. Headless Codex
// has nobody to answer an approval prompt, so approvalPolicy is always
// "never" and the OS sandbox is what enforces the boundary instead of a card:
// auto and acceptEdits become workspace-write — a write outside the folder is
// *blocked* rather than asked about, which is the #223 invariant enforced
// harder than Claude's auto manages — and plan becomes read-only, where the
// agent can look but not touch. The Allow/Deny card never appears for a Codex
// turn; that is the trade this mapping is, not an oversight.
export const SANDBOXES: Record<SessionMode, ThreadOptions["sandboxMode"]> = {
  acceptEdits: "workspace-write",
  auto: "workspace-write",
  plan: "read-only",
};

export const EFFORTS: Record<EffortLevel, ModelReasoningEffort> = {
  high: "high",
  low: "low",
  max: "xhigh",
  medium: "medium",
  xhigh: "xhigh",
};

export const codexAdapter: AgentAdapter = {
  account: () => accountCheck(),

  info: PROVIDER_INFO.codex,

  turn: (params: PromptParams, services: TurnServices) =>
    Effect.gen(function* () {
      const executable = findCodex();
      if (executable === null) {
        return {
          context: null,
          failure: {
            kind: "unknown",
            message: missingRow().detail ?? "Codex is not installed.",
          },
          sessionId: params.sessionId,
        } satisfies PromptResult;
      }

      const sessionId = yield* Ref.make(params.sessionId);
      const failure = yield* Ref.make<AgentFailure | null>(null);
      const translator = makeTranslator(params.mode);
      const controller = new AbortController();

      const codex = new Codex({
        codexPathOverride: executable,
        config: configOf(services),
      });

      const options: ThreadOptions = {
        approvalPolicy: "never",
        sandboxMode: SANDBOXES[params.mode],
        skipGitRepoCheck: true,
        workingDirectory: services.cwd,
        ...(params.effort === null
          ? {}
          : { modelReasoningEffort: EFFORTS[params.effort] }),
      };

      const thread =
        params.sessionId === null
          ? codex.startThread(options)
          : codex.resumeThread(params.sessionId, options);

      const input = inputOf(
        params,
        services.briefs.assets,
        services.briefs.media
      );

      yield* Effect.tryPromise({
        catch: (cause) => new CodexError({ message: errorMessage(cause) }),
        try: () => thread.runStreamed(input, { signal: controller.signal }),
      }).pipe(
        Effect.flatMap((streamed) =>
          Stream.runForEach(
            Stream.fromAsyncIterable(
              streamed.events,
              (cause) => new CodexError({ message: errorMessage(cause) })
            ),
            (event) =>
              Effect.gen(function* () {
                if (event.type === "thread.started") {
                  yield* Ref.set(sessionId, event.thread_id);
                }
                if (event.type === "turn.failed") {
                  yield* Ref.set(failure, failureFromText(event.error.message));
                }
                if (event.type === "error") {
                  yield* Ref.set(failure, failureFromText(event.message));
                }

                yield* Effect.forEach(
                  translator.take(event),
                  (translated) =>
                    Effect.andThen(
                      services.emit(translated),
                      services.record(translated)
                    ),
                  { discard: true }
                );
              })
          )
        ),
        Effect.onExit((exit) =>
          Effect.sync(() => {
            if (!Exit.isSuccess(exit)) {
              controller.abort();
            }
          })
        ),
        Effect.catch((error) =>
          Ref.update(
            failure,
            (current) => current ?? failureFromText(error.message)
          )
        )
      );

      return {
        context: null,
        failure: yield* Ref.get(failure),
        sessionId: yield* Ref.get(sessionId),
      } satisfies PromptResult;
    }),
};

// The conventions ride developer_instructions — the config-level equivalent
// of Claude's systemPrompt append — so nothing is written into the user's
// project. The remocn skills are not delivered here yet (plugins are Claude
// Code's mechanism), which is exactly what the Experimental badge says.
function configOf(services: TurnServices): NonNullable<CodexOptions["config"]> {
  const conventions = conventionsFor(false);

  return {
    developer_instructions:
      services.briefs.pipeline === null
        ? conventions
        : `${conventions}\n\n${services.briefs.pipeline}`,
    // The studio's own servers are pre-approved ("approve"), the same
    // decision the Claude gate makes for them. Not "auto": that mode reads
    // the tool annotations and treats an unannotated tool as destructive, so
    // headless Codex — with nobody to answer the prompt — kills the call as
    // "user cancelled MCP tool call". Measured, not guessed.
    mcp_servers: Object.fromEntries(
      Object.entries(services.tools).map(([name, transport]) => [
        name,
        {
          args: [...transport.args],
          command: transport.command,
          default_tools_approval_mode: "approve",
          env: { ...transport.env },
        },
      ])
    ),
  };
}
