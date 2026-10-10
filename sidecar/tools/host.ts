import { connect } from "node:net";
import { createInterface } from "node:readline";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Effect, Exit } from "effect";
import { TOOLS_HOST_FLAG } from "../flags";
import { untilBroken } from "../pipes";
import type { Ask, ToolAnswer, ToolExecution } from "./execute";
import {
  decodeToolReply,
  TOOLS_SOCKET_ENV,
  TOOLS_TURN_ENV,
  type ToolCall,
} from "./protocol";
import { isToolServer, TOOL_SPECS, type ToolServer } from "./specs";

export type { Ask } from "./execute";

export interface GatewayLink {
  readonly ask: Ask;
  readonly closed: Promise<void>;
  readonly end: () => void;
}

// The child owns nothing: it speaks MCP on its stdio for whichever CLI
// spawned it and forwards every call over the unix socket to the sidecar,
// where the stores and the turn's stream live. The socket closing means the
// sidecar is gone, and a tool host with no sidecar has nothing left to say.
export const runToolsHost: Effect.Effect<void> = Effect.promise(() =>
  main().catch((cause) => {
    process.stderr.write(`tools host: ${String(cause)}\n`);
    process.exitCode = 1;
  })
);

export function connectGateway(
  socketPath: string,
  turn: string,
  server: string
): Promise<GatewayLink> {
  const closed = Promise.withResolvers<void>();
  const pending = new Map<
    string,
    {
      answer: (reply: ToolAnswer) => void;
      progress?: ToolExecution["progress"];
      cleanup: () => void;
    }
  >();

  const socket = connect(socketPath);

  const link: GatewayLink = {
    ask: (tool, params, execution) =>
      new Promise<ToolAnswer>((answer) => {
        const call: ToolCall = {
          id: crypto.randomUUID(),
          params,
          server,
          tool,
          turn,
          type: "call",
        };
        const cancel = () =>
          socket.write(`${JSON.stringify({ ...call, cancel: true })}\n`);
        pending.set(call.id, {
          answer,
          cleanup: () =>
            execution?.signal?.removeEventListener("abort", cancel),
          progress: execution?.progress,
        });
        socket.write(`${JSON.stringify(call)}\n`);
        execution?.signal?.addEventListener("abort", cancel, { once: true });
        if (execution?.signal?.aborted) {
          cancel();
        }
      }),
    closed: closed.promise,
    end: () => socket.end(),
  };

  const lines = createInterface({ input: socket });
  lines.on("line", (line) => {
    const reply = decodeToolReply(line);
    if (Exit.isFailure(reply)) {
      return;
    }
    const waiting = pending.get(reply.value.id);
    if (reply.value.type === "progress") {
      if (reply.value.progress) {
        waiting?.progress?.(
          reply.value.text,
          reply.value.progress.completed,
          reply.value.progress.total
        );
      }
      return;
    }
    waiting?.cleanup();
    waiting?.answer({
      isError: reply.value.isError,
      text: reply.value.text,
    });
    pending.delete(reply.value.id);
  });

  socket.on("close", () => {
    for (const waiting of pending.values()) {
      waiting.cleanup();
      waiting.answer({
        isError: true,
        text: "The studio went away before this call was answered.",
      });
    }
    pending.clear();
    closed.resolve();
  });
  socket.on("error", () => undefined);

  return new Promise((ready, failed) => {
    socket.once("connect", () => {
      socket.removeListener("error", failed);
      ready(link);
    });
    socket.once("error", failed);
  });
}

export function toolServer(server: ToolServer, ask: Ask): McpServer {
  const built = new McpServer({ name: server, version: "1.0.0" });

  for (const spec of TOOL_SPECS[server]) {
    built.tool(spec.name, spec.description, spec.shape, async (args, extra) => {
      const token = extra._meta?.progressToken;
      let lastProgress = 0;
      const answer = await ask(spec.name, args, {
        progress: (stage, completed, total) => {
          const fraction = total > 0 ? Math.min(1, completed / total) : 0;
          const progress = readinessProgress(stage, fraction);
          lastProgress = Math.max(lastProgress, progress);
          if (token !== undefined) {
            extra
              .sendNotification({
                method: "notifications/progress",
                params: {
                  message: stage,
                  progress: lastProgress,
                  progressToken: token,
                  total: 100,
                },
              })
              .catch(() => undefined);
          }
        },
        signal: extra.signal,
      });
      return {
        content: [{ text: answer.text, type: "text" as const }],
        ...(answer.isError ? { isError: true } : {}),
      };
    });
  }

  return built;
}

async function main(): Promise<void> {
  const flag = process.argv.indexOf(TOOLS_HOST_FLAG);
  const name = process.argv[flag + 1] ?? "";
  const socketPath = process.env[TOOLS_SOCKET_ENV] ?? "";
  const turn = process.env[TOOLS_TURN_ENV] ?? "";

  if (!isToolServer(name)) {
    throw new Error(`there is no tool server called ${name}`);
  }
  if (socketPath.length === 0 || turn.length === 0) {
    throw new Error(
      `${TOOLS_SOCKET_ENV} and ${TOOLS_TURN_ENV} must name the sidecar's socket and the turn`
    );
  }

  const link = await connectGateway(socketPath, turn, name);
  const server = toolServer(name, link.ask);

  const stopped = Promise.withResolvers<void>();
  const transport = new StdioServerTransport();
  transport.onclose = () => stopped.resolve();
  await server.connect(transport);

  await Promise.race([
    link.closed,
    stopped.promise,
    Effect.runPromise(untilBroken(process.stdout, "the agent closed stdout")),
  ]);
  link.end();
}

function readinessProgress(stage: string, fraction: number): number {
  if (stage === "done") {
    return 100;
  }
  if (stage === "audio") {
    return 60 + 35 * fraction;
  }
  if (stage === "frames") {
    return 5 + 50 * fraction;
  }
  return 1;
}
