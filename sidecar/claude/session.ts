import {
  type Options,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { Data, Effect, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { PromptParams } from "@/shared/ipc";

export class ClaudeError extends Data.TaggedError("ClaudeError")<{
  message: string;
}> {}

interface Turn {
  readonly close: () => void;
  readonly session: Query;
}

export function messages(
  params: PromptParams,
  log: (line: string) => void
): Stream.Stream<SDKMessage, ClaudeError> {
  return Stream.suspend(() => {
    const turn = open(params, log);
    let finished = false;

    return Stream.fromAsyncIterable(
      stoppable(turn, () => finished),
      (cause) => new ClaudeError({ message: errorMessage(cause) })
    ).pipe(
      Stream.tap((message) =>
        Effect.sync(() => {
          if (message.type === "result") {
            finished = true;
            turn.close();
          }
        })
      )
    );
  });
}

function open(params: PromptParams, log: (line: string) => void): Turn {
  const input = Promise.withResolvers<void>();

  const prompt = (async function* () {
    yield {
      message: { content: params.prompt, role: "user" as const },
      parent_tool_use_id: null,
      session_id: "",
      type: "user" as const,
    } satisfies SDKUserMessage;

    await input.promise;
  })();

  return {
    close: () => input.resolve(),
    session: query({ options: optionsOf(params, log), prompt }),
  };
}

function optionsOf(params: PromptParams, log: (line: string) => void): Options {
  return {
    cwd: params.cwd,
    includePartialMessages: true,
    permissionMode: "acceptEdits",
    settingSources: ["project"],
    stderr: (data) => log(`claude: ${data.trimEnd()}`),
    ...(params.model === null ? {} : { model: params.model }),
    ...(params.sessionId === null ? {} : { resume: params.sessionId }),
  };
}

function stoppable(
  turn: Turn,
  finished: () => boolean
): AsyncIterable<SDKMessage> {
  const iterator = turn.session[Symbol.asyncIterator]();

  return {
    [Symbol.asyncIterator]: () => ({
      next: () => iterator.next(),
      return: async () => {
        if (!finished()) {
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
