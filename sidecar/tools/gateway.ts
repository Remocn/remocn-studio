import { randomBytes } from "node:crypto";
import { unlinkSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Effect, Exit, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import { executeTool, type TurnTools } from "./execute";
import {
  decodeToolCall,
  TOOLS_HOST_FLAG,
  TOOLS_SOCKET_ENV,
  TOOLS_TURN_ENV,
  type ToolReply,
} from "./protocol";
import { isToolServer, type ToolServer } from "./specs";

export interface StdioTransport {
  readonly args: readonly string[];
  readonly command: string;
  readonly env: Readonly<Record<string, string>>;
}

export interface ToolGateway {
  readonly serving: (
    turnId: string,
    tools: TurnTools
  ) => Effect.Effect<void, never, Scope.Scope>;
  readonly transport: (server: ToolServer, turnId: string) => StdioTransport;
}

export function makeGateway(
  log: (line: string) => void = () => undefined,
  socketPath: string = join(
    tmpdir(),
    `remocn-tools-${process.pid}-${randomBytes(4).toString("hex")}.sock`
  )
): ToolGateway {
  const turns = new Map<string, TurnTools>();

  let listening: Promise<Server> | null = null;

  const listen = (): Promise<Server> => {
    listening ??= new Promise((ready, failed) => {
      const server = createServer((socket) => serve(socket));
      server.once("error", failed);
      server.listen(socketPath, () => {
        server.removeListener("error", failed);
        process.once("exit", () => removeSocket(socketPath));
        ready(server);
      });
    });
    return listening;
  };

  const serve = (socket: Socket) => {
    const lines = createInterface({ input: socket });

    const reply = (frame: ToolReply) => {
      socket.write(`${JSON.stringify(frame)}\n`);
    };

    lines.on("line", (line) => {
      if (line.trim().length === 0) {
        return;
      }

      const call = decodeToolCall(line);
      if (Exit.isFailure(call)) {
        log(`tools: dropped a frame it could not parse: ${line}`);
        return;
      }

      const { id, params, server, tool, turn } = call.value;
      const refused = (text: string) =>
        reply({ id, isError: true, text, type: "reply" });

      const tools = turns.get(turn);
      if (tools === undefined) {
        refused(
          "This turn is no longer running, so the studio cannot answer its tools."
        );
        return;
      }
      if (!isToolServer(server)) {
        refused(`There is no tool server called ${server}.`);
        return;
      }

      executeTool(server, tool, params, tools)
        .then((answer) => {
          log(`tools: ${server}.${tool} ${answer.isError ? "failed" : "ok"}`);
          reply({
            id,
            isError: answer.isError,
            text: answer.text,
            type: "reply",
          });
        })
        .catch((cause) => refused(errorMessage(cause)));
    });

    socket.on("error", () => undefined);
  };

  return {
    // A gateway that cannot listen is logged, not fatal: the children then
    // fail to connect and the CLI reports the servers down, while the turn —
    // whose words matter more than its tools — still runs.
    serving: (turnId, tools) =>
      Effect.acquireRelease(
        Effect.promise(async () => {
          try {
            await listen();
          } catch (cause) {
            log(`tools: the gateway could not listen: ${errorMessage(cause)}`);
          }
          turns.set(turnId, tools);
        }),
        () => Effect.sync(() => turns.delete(turnId))
      ).pipe(Effect.asVoid),

    transport: (server, turnId) => ({
      args: [process.argv[1] ?? "", TOOLS_HOST_FLAG, server],
      command: process.execPath,
      env: {
        [TOOLS_SOCKET_ENV]: socketPath,
        [TOOLS_TURN_ENV]: turnId,
      },
    }),
  };
}

function removeSocket(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // a socket that was never created leaves nothing to remove
  }
}
