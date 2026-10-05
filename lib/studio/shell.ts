import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
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

export function pickSourceAsset(): Effect.Effect<string | null, ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () =>
      open({
        filters: [
          {
            extensions: ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"],
            name: "Brand images",
          },
        ],
        multiple: false,
        title: "Choose the original brand asset",
      }),
  });
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
  readonly onEnter?: (entered: DroppedFiles) => void;
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

          if (payload.type === "enter") {
            watcher.onEnter?.({
              paths: payload.paths,
              position: payload.position,
            });
          }

          watcher.onOver(payload.position);
        }),
    }),
    (unlisten) => Effect.ignore(Effect.sync(unlisten))
  ).pipe(Effect.asVoid);
}

export function fileExists(path: string): Effect.Effect<boolean, ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => invoke<boolean>("path_exists", { path }),
  });
}

export function revealInFinder(path: string): Effect.Effect<void, ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => revealItemInDir(path),
  });
}

const WINDOW_BACKGROUNDS = { dark: "#0a0a0a", light: "#f5f5f5" } as const;

export type WindowTheme = keyof typeof WINDOW_BACKGROUNDS;

export function setWindowBackground(
  theme: WindowTheme
): Effect.Effect<void, ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => getCurrentWindow().setBackgroundColor(WINDOW_BACKGROUNDS[theme]),
  });
}

export function holdWindowFullScreen(
  onLeave: () => void
): Effect.Effect<void, ShellError, Scope.Scope> {
  return Effect.gen(function* () {
    const current = yield* Effect.try({ catch: fail, try: getCurrentWindow });
    const already = yield* Effect.tryPromise({
      catch: fail,
      try: () => current.isFullscreen(),
    });
    if (already) {
      return;
    }
    yield* Effect.acquireRelease(
      Effect.tryPromise({
        catch: fail,
        try: () => current.setFullscreen(true),
      }),
      () => Effect.ignore(Effect.tryPromise(() => current.setFullscreen(false)))
    );
    let entered = false;
    const check = Effect.tryPromise(() => current.isFullscreen()).pipe(
      Effect.tap((now) =>
        Effect.sync(() => {
          if (now) {
            entered = true;
          } else if (entered) {
            onLeave();
          }
        })
      ),
      Effect.ignore
    );
    yield* Effect.acquireRelease(
      Effect.tryPromise({
        catch: fail,
        try: () =>
          current.onResized(() => {
            Effect.runFork(check);
          }),
      }),
      (unlisten) => Effect.ignore(Effect.sync(unlisten))
    );
  });
}

export function watchWindowFocus(
  onFocus: () => void,
  onBlur: () => void = () => undefined
): Effect.Effect<void, ShellError, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.tryPromise({
      catch: fail,
      try: async () =>
        getCurrentWindow().onFocusChanged(({ payload }) => {
          if (payload) {
            onFocus();
          } else {
            onBlur();
          }
        }),
    }),
    (unlisten) => Effect.ignore(Effect.sync(unlisten))
  ).pipe(Effect.asVoid);
}
