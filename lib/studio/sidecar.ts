import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Data, Effect, Exit, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import {
  codecsFor,
  type Decoded,
  decodeSidecarNotification,
  decodeSidecarStatus,
  QUIT_REQUESTED_EVENT,
  SIDECAR_NOTIFY_EVENT,
  SIDECAR_STATUS_EVENT,
  type SidecarMethod,
  type SidecarNotification,
  type SidecarParams,
  type SidecarResult,
  type SidecarStatus,
  type SidecarStream,
} from "@/shared/ipc";

export class SidecarError extends Data.TaggedError("SidecarError")<{
  message: string;
}> {}

export interface SidecarCall<M extends SidecarMethod> {
  id: string;
  method: M;
  onStream?: (data: SidecarStream<M>) => void;
  params: SidecarParams<M>;
}

const fail = (cause: unknown) =>
  new SidecarError({ message: errorMessage(cause) });

const command = <A>(
  name: string,
  args?: Record<string, unknown>
): Effect.Effect<A, SidecarError> =>
  Effect.tryPromise({
    catch: fail,
    try: () => invoke<A>(name, args),
  });

export const newRequestId = Effect.sync(() => crypto.randomUUID());

export function requestSidecar<M extends SidecarMethod>(
  call: SidecarCall<M>
): Effect.Effect<SidecarResult<M>, SidecarError> {
  const codecs = codecsFor(call.method);
  const onStream = new Channel<unknown>((data) => {
    const chunk = codecs.stream(data);
    if (call.onStream !== undefined && Exit.isSuccess(chunk)) {
      call.onStream(chunk.value);
    }
  });

  return command<unknown>("sidecar_request", {
    id: call.id,
    method: call.method,
    onStream,
    params: call.params,
  }).pipe(Effect.flatMap(codecs.result), Effect.mapError(fail));
}

export function cancelSidecarRequest(
  id: string
): Effect.Effect<void, SidecarError> {
  return command<void>("sidecar_cancel", { id });
}

export const fetchSidecarStatus: Effect.Effect<SidecarStatus, SidecarError> =
  command<unknown>("sidecar_status").pipe(
    Effect.flatMap(decodeSidecarStatus),
    Effect.mapError(fail)
  );

export const restartSidecar: Effect.Effect<void, SidecarError> =
  command<void>("sidecar_restart");

export const quitStudio: Effect.Effect<void, SidecarError> =
  command<void>("quit_studio");

const subscribe = <A>(
  event: string,
  decode: (input: unknown) => Decoded<A>,
  onValue: (value: A) => void
): Effect.Effect<UnlistenFn, SidecarError> =>
  Effect.tryPromise({
    catch: fail,
    try: () =>
      listen<unknown>(event, (received) => {
        const decoded = decode(received.payload);
        if (Exit.isSuccess(decoded)) {
          onValue(decoded.value);
        }
      }),
  });

const unsubscribe = (unlisten: UnlistenFn) =>
  Effect.ignore(
    Effect.tryPromise({
      catch: fail,
      try: () => Promise.resolve(unlisten()),
    })
  );

export function watchSidecarStatus(
  onStatus: (status: SidecarStatus) => void
): Effect.Effect<void, SidecarError, Scope.Scope> {
  return Effect.acquireRelease(
    subscribe(SIDECAR_STATUS_EVENT, decodeSidecarStatus, onStatus),
    unsubscribe
  ).pipe(Effect.asVoid);
}

export function watchQuitRequests(
  onQuit: () => void
): Effect.Effect<void, SidecarError, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.tryPromise({
      catch: fail,
      try: () => listen(QUIT_REQUESTED_EVENT, () => onQuit()),
    }),
    unsubscribe
  ).pipe(Effect.asVoid);
}

export function watchSidecarNotifications(
  onNotify: (notification: SidecarNotification) => void
): Effect.Effect<void, SidecarError, Scope.Scope> {
  return Effect.acquireRelease(
    subscribe(SIDECAR_NOTIFY_EVENT, decodeSidecarNotification, onNotify),
    unsubscribe
  ).pipe(Effect.asVoid);
}
