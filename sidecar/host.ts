import { Cause, Data, Effect, Exit, FiberMap, Stream } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  CANCELLED,
  codecsFor,
  decodeHostFrame,
  decodeMethod,
  SIDECAR_PROTOCOL,
  type SidecarMethod,
  type SidecarParams,
  type SidecarRequestFrame,
  type SidecarResult,
  type SidecarStream,
} from "@/shared/ipc";
import { type SidecarChannel as Channel, SidecarChannel } from "./channel";

export class HandlerError extends Data.TaggedError("HandlerError")<{
  message: string;
}> {}

export interface HandlerInput<M extends SidecarMethod> {
  emit: (chunk: SidecarStream<M>) => Effect.Effect<void>;
  log: (message: string) => Effect.Effect<void>;
  params: SidecarParams<M>;
}

export type Handler<M extends SidecarMethod, R = never> = (
  input: HandlerInput<M>
) => Effect.Effect<SidecarResult<M>, HandlerError, R>;

export type Handlers<R = never> = { [M in SidecarMethod]: Handler<M, R> };

type ErasedHandler<R> = (input: {
  emit: (chunk: never) => Effect.Effect<void>;
  log: (message: string) => Effect.Effect<void>;
  params: never;
}) => Effect.Effect<unknown, HandlerError, R>;

type Inflight = FiberMap.FiberMap<string>;

export function runHost<R>(handlers: Handlers<R>) {
  return Effect.gen(function* () {
    const channel = yield* SidecarChannel;
    const inflight: Inflight = yield* FiberMap.make<string>();

    yield* channel.send({
      pid: process.pid,
      protocol: SIDECAR_PROTOCOL,
      type: "ready",
    });

    yield* Stream.runForEach(channel.lines, (line) =>
      handleLine(handlers, channel, inflight, line)
    );
  });
}

function handleLine<R>(
  handlers: Handlers<R>,
  channel: Channel,
  inflight: Inflight,
  line: string
) {
  return Effect.suspend(() => {
    if (line.trim().length === 0) {
      return Effect.void;
    }

    const frame = decodeHostFrame(line);
    if (Exit.isFailure(frame)) {
      return channel.log(`dropped a frame it could not parse: ${line}`);
    }

    if (frame.value.type === "cancel") {
      return FiberMap.remove(inflight, frame.value.id);
    }

    return dispatch(handlers, channel, inflight, frame.value);
  });
}

function dispatch<R>(
  handlers: Handlers<R>,
  channel: Channel,
  inflight: Inflight,
  frame: SidecarRequestFrame
) {
  return Effect.gen(function* () {
    if (yield* FiberMap.has(inflight, frame.id)) {
      yield* channel.send({
        id: frame.id,
        message: `request ${frame.id} is already in flight`,
        type: "error",
      });
      return;
    }

    const method = decodeMethod(frame.method);
    if (Exit.isFailure(method)) {
      yield* channel.send({
        id: frame.id,
        message: `there is no method called ${frame.method}`,
        type: "error",
      });
      return;
    }

    yield* FiberMap.run(
      inflight,
      frame.id,
      serve(handlers, channel, frame.id, method.value, frame.params)
    );
  });
}

function serve<R>(
  handlers: Handlers<R>,
  channel: Channel,
  id: string,
  method: SidecarMethod,
  params: unknown
) {
  const erased = handlers as unknown as Record<string, ErasedHandler<R>>;

  return Effect.gen(function* () {
    const decoded = yield* codecsFor(method).params(params);

    return yield* erased[method]({
      emit: (chunk) => channel.send({ data: chunk, id, type: "stream" }),
      log: channel.log,
      params: decoded as never,
    });
  }).pipe(
    Effect.onExit((exit) =>
      channel.send(
        Exit.isSuccess(exit)
          ? { data: exit.value, id, type: "result" }
          : { id, message: replyMessage(exit.cause), type: "error" }
      )
    ),
    Effect.ignore
  );
}

function replyMessage(cause: Cause.Cause<unknown>): string {
  if (Cause.hasInterruptsOnly(cause)) {
    return CANCELLED;
  }
  return errorMessage(Cause.squash(cause));
}
