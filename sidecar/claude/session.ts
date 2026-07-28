import {
  type CanUseTool,
  type Options,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { Data, Effect, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { ContextUsage, PromptParams } from "@/shared/ipc";
import { contentOf } from "./content";
import { STUDIO_CONVENTIONS } from "./conventions";
import { pluginsFor } from "./knowledge";
import type { ApplyMode } from "./mode";

export class ClaudeError extends Data.TaggedError("ClaudeError")<{
  message: string;
}> {}

interface Turn {
  readonly close: () => void;
  readonly session: Query;
}

export interface TurnCallbacks {
  readonly canUseTool: CanUseTool;
  readonly cwd: string;
  readonly log: (line: string) => void;
  readonly onContext: (usage: ContextUsage) => void;
  readonly onMode: (apply: ApplyMode) => void;
  readonly onStop: () => void;
}

export function messages(
  params: PromptParams,
  callbacks: TurnCallbacks
): Stream.Stream<SDKMessage, ClaudeError> {
  return Stream.suspend(() => {
    const turn = open(params, callbacks);
    let finished = false;

    return Stream.fromAsyncIterable(
      stoppable(turn, callbacks, () => finished),
      (cause) => new ClaudeError({ message: errorMessage(cause) })
    ).pipe(
      Stream.tap((message) =>
        Effect.suspend(() => {
          if (message.type !== "result") {
            return Effect.void;
          }
          finished = true;
          return context(turn, callbacks.onContext).pipe(
            Effect.andThen(Effect.sync(() => turn.close()))
          );
        })
      )
    );
  });
}

function context(
  turn: Turn,
  onContext: (usage: ContextUsage) => void
): Effect.Effect<void> {
  return Effect.tryPromise(() => turn.session.getContextUsage()).pipe(
    Effect.timeout("2 seconds"),
    Effect.tap((usage) =>
      Effect.sync(() =>
        onContext({
          maxTokens: usage.maxTokens,
          totalTokens: usage.totalTokens,
        })
      )
    ),
    Effect.ignore
  );
}

function open(params: PromptParams, callbacks: TurnCallbacks): Turn {
  const input = Promise.withResolvers<void>();

  const prompt = (async function* () {
    yield {
      message: { content: await contentOf(params), role: "user" as const },
      parent_tool_use_id: null,
      session_id: "",
      type: "user" as const,
    } satisfies SDKUserMessage;

    await input.promise;
  })();

  const session = query({ options: optionsOf(params, callbacks), prompt });
  callbacks.onMode((mode) => session.setPermissionMode(mode));

  return { close: () => input.resolve(), session };
}

function optionsOf(params: PromptParams, callbacks: TurnCallbacks): Options {
  return {
    canUseTool: callbacks.canUseTool,
    cwd: callbacks.cwd,
    includePartialMessages: true,
    permissionMode: params.mode,
    plugins: pluginsFor(callbacks.cwd),
    settingSources: ["project"],
    stderr: (data) => callbacks.log(`claude: ${data.trimEnd()}`),
    systemPrompt: {
      append: STUDIO_CONVENTIONS,
      preset: "claude_code",
      type: "preset",
    },
    ...(params.effort === null ? {} : { effort: params.effort }),
    ...(params.model === null ? {} : { model: params.model }),
    ...(params.sessionId === null ? {} : { resume: params.sessionId }),
  };
}

function stoppable(
  turn: Turn,
  callbacks: TurnCallbacks,
  finished: () => boolean
): AsyncIterable<SDKMessage> {
  const iterator = turn.session[Symbol.asyncIterator]();

  return {
    [Symbol.asyncIterator]: () => ({
      next: () => iterator.next(),
      return: async () => {
        if (!finished()) {
          callbacks.onStop();
          await turn.session.interrupt().catch(ignore);
        }
        turn.close();
        await iterator.return?.().catch(ignore);
        return { done: true, value: undefined };
      },
    }),
  };
}

const ignore = (): undefined => undefined;
