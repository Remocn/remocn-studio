import {
  type CanUseTool,
  type McpServerConfig,
  type Options,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { Data, type Duration, Effect, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { ContextUsage, PromptParams } from "@/shared/ipc";
import type { KnowledgeBundle } from "../agent/knowledge";
import type { ApplyMode } from "../agent/mode";
import type { Ask } from "../tools/execute";
import type { StdioTransport } from "../tools/gateway";
import { toolServer } from "../tools/host";
import { isToolServer, type ToolServer } from "../tools/specs";
import { contentOf } from "./content";
import { gateHooks } from "./guard";
import { pluginsFor } from "./knowledge";

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
  readonly executable: string;
  readonly inProcess: Readonly<Partial<Record<ToolServer, Ask>>>;
  readonly knowledge: KnowledgeBundle;
  readonly log: (line: string) => void;
  readonly media: string | null;
  readonly onContext: (usage: ContextUsage) => void;
  readonly onMode: (apply: ApplyMode) => void;
  readonly onStop: () => void;
  readonly system: string;
  readonly tools: Readonly<Partial<Record<ToolServer, StdioTransport>>>;
  readonly trailer: string | null;
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
          return contextReading(turn.session, callbacks.onContext).pipe(
            Effect.andThen(Effect.sync(() => turn.close()))
          );
        })
      )
    );
  });
}

// The meter needs a total and a ceiling. `summary` answers both from the last
// response's usage; the default, `full`, counts every category through the
// token-count API while the turn's result waits behind it.
export function contextReading(
  session: Pick<Query, "getContextUsage">,
  onContext: (usage: ContextUsage) => void,
  window: Duration.Input = "2 seconds"
): Effect.Effect<void> {
  return Effect.tryPromise(() =>
    session.getContextUsage({ detail: "summary" })
  ).pipe(
    Effect.timeout(window),
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
      message: {
        content: await contentOf(params, callbacks.trailer, callbacks.media),
        role: "user" as const,
      },
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

export function optionsOf(
  params: PromptParams,
  callbacks: TurnCallbacks
): Options {
  const plugins = pluginsFor(callbacks.knowledge);

  const hooks = gateHooks(params.mode, callbacks.cwd);

  return {
    canUseTool: callbacks.canUseTool,
    cwd: callbacks.cwd,
    ...(hooks === undefined ? {} : { hooks }),
    includePartialMessages: true,
    mcpServers: serversOf(callbacks),
    pathToClaudeCodeExecutable: callbacks.executable,
    permissionMode: params.mode,
    plugins,
    settingSources: ["project"],
    stderr: (data) => callbacks.log(`claude: ${data.trimEnd()}`),
    // Recorded on the chat's first turn and sent as recorded after that, so
    // the prefix the provider caches survives every later turn. Nothing that
    // changes between turns may ride here: the stage brief is in the message.
    systemPrompt: {
      append: callbacks.system,
      preset: "claude_code",
      snapshot: true,
      type: "preset",
    },
    ...(params.effort === null ? {} : { effort: params.effort }),
    ...(params.model === null ? {} : { model: params.model }),
    ...(params.sessionId === null ? {} : { resume: params.sessionId }),
  };
}

export function serversOf(
  callbacks: Pick<TurnCallbacks, "inProcess" | "tools">
): Record<string, McpServerConfig> {
  return Object.fromEntries(
    Object.entries(callbacks.tools).map(([name, transport]) => {
      const ask = isToolServer(name) ? callbacks.inProcess[name] : undefined;
      if (ask !== undefined && isToolServer(name)) {
        return [
          name,
          { instance: toolServer(name, ask), name, type: "sdk" as const },
        ];
      }
      return [
        name,
        {
          args: [...transport.args],
          command: transport.command,
          env: { ...transport.env },
          type: "stdio" as const,
        },
      ];
    })
  );
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
