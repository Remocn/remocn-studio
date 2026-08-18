import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { errorMessage } from "@/lib/error-message";

// A minimal JSON-RPC 2.0 peer over a child's stdio, newline-delimited — the
// framing the Agent Client Protocol actually uses on the wire, measured
// against Copilot CLI 1.0.80. Both directions carry requests: ours to the
// agent (initialize, session/*), and the agent's to us (permission asks, fs
// delegation), which is why the peer takes an onRequest handler instead of
// only reading answers.
export interface AcpPeer {
  readonly exited: Promise<void>;
  readonly kill: () => void;
  readonly notify: (method: string, params: unknown) => void;
  readonly request: <T>(method: string, params: unknown) => Promise<T>;
}

export interface AcpSpawn {
  readonly args: readonly string[];
  readonly command: string;
  readonly cwd: string;
  readonly log: (line: string) => void;
  readonly onNotification: (method: string, params: unknown) => void;
  readonly onRequest: (method: string, params: unknown) => Promise<unknown>;
}

interface Frame {
  error?: { code?: number; message?: string };
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
}

export class AcpError extends Error {
  readonly code: number | null;

  constructor(message: string, code: number | null = null) {
    super(message);
    this.code = code;
  }
}

// The Agent Client Protocol's error for a session that needs a login first.
export const AUTH_REQUIRED = -32_000;

export function spawnAcp(options: AcpSpawn): AcpPeer {
  const child: ChildProcess = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const pending = new Map<
    number,
    { fail: (cause: AcpError) => void; succeed: (value: unknown) => void }
  >();
  let nextId = 1;

  const exited = new Promise<void>((done) => {
    child.once("exit", () => {
      for (const waiter of pending.values()) {
        waiter.fail(new AcpError("the agent exited before it answered"));
      }
      pending.clear();
      done();
    });
    child.once("error", (cause) => {
      options.log(`acp: ${errorMessage(cause)}`);
      for (const waiter of pending.values()) {
        waiter.fail(new AcpError(errorMessage(cause)));
      }
      pending.clear();
      done();
    });
  });

  const write = (frame: object) => {
    child.stdin?.write(`${JSON.stringify(frame)}\n`);
  };

  const serve = (frame: Frame) => {
    const { id, method } = frame;
    if (method === undefined || id === undefined) {
      return;
    }

    options
      .onRequest(method, frame.params)
      .then((result) => write({ id, jsonrpc: "2.0", result }))
      .catch((cause) =>
        write({
          error: { code: -32_603, message: errorMessage(cause) },
          id,
          jsonrpc: "2.0",
        })
      );
  };

  if (child.stderr) {
    createInterface({ input: child.stderr }).on("line", (line) => {
      if (line.trim().length > 0) {
        options.log(`acp: ${line}`);
      }
    });
  }

  if (child.stdout) {
    createInterface({ input: child.stdout }).on("line", (line) => {
      if (line.trim().length === 0) {
        return;
      }

      let frame: Frame;
      try {
        frame = JSON.parse(line) as Frame;
      } catch {
        options.log(`acp: dropped a frame it could not parse: ${line}`);
        return;
      }

      if (frame.method === undefined) {
        settle(frame);
        return;
      }

      if (frame.id === undefined) {
        options.onNotification(frame.method, frame.params);
      } else {
        serve(frame);
      }
    });
  }

  function settle(frame: Frame): void {
    const waiter = typeof frame.id === "number" && pending.get(frame.id);
    if (!waiter) {
      return;
    }
    pending.delete(frame.id as number);

    if (frame.error === undefined) {
      waiter.succeed(frame.result);
    } else {
      waiter.fail(
        new AcpError(
          frame.error.message ?? "the agent answered with an error",
          frame.error.code ?? null
        )
      );
    }
  }

  return {
    exited,

    kill: () => {
      child.kill("SIGTERM");
    },

    notify: (method, params) => {
      write({ jsonrpc: "2.0", method, params });
    },

    request: <T>(method: string, params: unknown) =>
      new Promise<T>((succeed, fail) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, {
          fail,
          succeed: (value) => succeed(value as T),
        });
        write({ id, jsonrpc: "2.0", method, params });
      }),
  };
}
