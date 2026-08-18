import { connect } from "node:net";
import { createInterface } from "node:readline";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Effect, Exit } from "effect";
import type { ToolAnswer } from "./execute";
import {
  decodeToolReply,
  TOOLS_HOST_FLAG,
  TOOLS_SOCKET_ENV,
  TOOLS_TURN_ENV,
  type ToolCall,
} from "./protocol";
import { isToolServer, TOOL_SPECS, type ToolServer } from "./specs";

export type Ask = (tool: string, params: unknown) => Promise<ToolAnswer>;

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
  const pending = new Map<string, (reply: ToolAnswer) => void>();

  const socket = connect(socketPath);

  const link: GatewayLink = {
    ask: (tool, params) =>
      new Promise<ToolAnswer>((answer) => {
        const call: ToolCall = {
          id: crypto.randomUUID(),
          params,
          server,
          tool,
          turn,
          type: "call",
        };
        pending.set(call.id, answer);
        socket.write(`${JSON.stringify(call)}\n`);
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
    pending.get(reply.value.id)?.({
      isError: reply.value.isError,
      text: reply.value.text,
    });
    pending.delete(reply.value.id);
  });

  socket.on("close", () => {
    for (const answer of pending.values()) {
      answer({
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
    built.tool(spec.name, spec.description, spec.shape, async (args) => {
      const answer = await ask(spec.name, args);
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

  await Promise.race([link.closed, stopped.promise]);
  link.end();
}
