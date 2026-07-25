import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Data, Effect } from "effect";
import { errorMessage } from "@/lib/error-message";

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

export function revealInFinder(path: string): Effect.Effect<void, ShellError> {
  return Effect.tryPromise({
    catch: fail,
    try: () => revealItemInDir(path),
  });
}
