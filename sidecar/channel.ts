import { createInterface } from "node:readline";
import { Context, Data, Effect, Layer, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { SidecarFrame } from "@/shared/ipc";

export class ChannelError extends Data.TaggedError("ChannelError")<{
  message: string;
}> {}

export interface SidecarChannel {
  readonly lines: Stream.Stream<string, ChannelError>;
  readonly log: (message: string) => Effect.Effect<void>;
  readonly send: (frame: SidecarFrame) => Effect.Effect<void>;
}

export const SidecarChannel = Context.Service<SidecarChannel>(
  "sidecar/SidecarChannel"
);

export function make(options: {
  input: AsyncIterable<string>;
  stderr: (line: string) => void;
  stdout: (line: string) => void;
}): SidecarChannel {
  return {
    lines: Stream.fromAsyncIterable(
      options.input,
      (cause) => new ChannelError({ message: errorMessage(cause) })
    ),
    log: (message) => Effect.sync(() => options.stderr(message)),
    send: (frame) => Effect.sync(() => options.stdout(JSON.stringify(frame))),
  };
}

export const layerProcess = Layer.sync(SidecarChannel, () =>
  make({
    input: createInterface({
      crlfDelay: Number.POSITIVE_INFINITY,
      input: process.stdin,
    }),
    stderr: (line) => process.stderr.write(`${line}\n`),
    stdout: (line) => process.stdout.write(`${line}\n`),
  })
);
