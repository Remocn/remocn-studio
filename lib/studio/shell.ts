import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Data, Effect, type Scope } from "effect";
import { errorMessage } from "@/lib/error-message";
import { IMAGE_EXTENSIONS, PLAYABLE_EXTENSIONS } from "./attachments";

export class ShellError extends Data.TaggedError("ShellError")<{
  message: string;
}> {}

const fail = (cause: unknown) =>
  new ShellError({ message: errorMessage(cause) });

export function pickFolder(
  title: string
): Effect.Effect<string | null, ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => open({ directory: true, multiple: false, title }),
  });
}

export function pickImages(): Effect.Effect<string[], ShellError> {
  return picked("Attach images", "Images", IMAGE_EXTENSIONS);
}

export function pickPlayable(): Effect.Effect<string[], ShellError> {
  return picked("Attach video or audio", "Video and audio", [
    ...PLAYABLE_EXTENSIONS,
  ]);
}

function picked(
  title: string,
  name: string,
  extensions: readonly string[]
): Effect.Effect<string[], ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () =>
      open({
        filters: [{ extensions: [...extensions], name }],
        multiple: true,
        title,
      }),
  }).pipe(Effect.map((found) => found ?? []));
}

export interface DroppedFiles {
  readonly paths: readonly string[];
  readonly position: { readonly x: number; readonly y: number };
}

export interface DragWatcher {
  readonly onDrop: (dropped: DroppedFiles) => void;
  readonly onOver: (position: { x: number; y: number } | null) => void;
}

export function watchFileDrops(
  watcher: DragWatcher
): Effect.Effect<void, ShellError, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.tryPromise({
      catch: fail,
      try: () =>
        getCurrentWebview().onDragDropEvent(({ payload }) => {
          if (payload.type === "leave") {
            watcher.onOver(null);
            return;
          }

          if (payload.type === "drop") {
            watcher.onOver(null);
            watcher.onDrop({
              paths: payload.paths,
              position: payload.position,
            });
            return;
          }

          watcher.onOver(payload.position);
        }),
    }),
    (unlisten) => Effect.ignore(Effect.sync(unlisten))
  ).pipe(Effect.asVoid);
}

export function revealInFinder(path: string): Effect.Effect<void, ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => revealItemInDir(path),
  });
}
