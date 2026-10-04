import type { PreviewCommand, TargetStatuses, TuningValue } from "./protocol";
import type { TuningTarget } from "./tuning";

export interface TuningReply {
  readonly error: string | null;
  readonly ok: boolean;
}

export interface TuningRuntime {
  readonly clear: () => void;
  readonly reset: (targetId: string, paths: readonly string[]) => TuningReply;
  readonly set: (
    targetId: string,
    path: string,
    value: TuningValue
  ) => TuningReply;
  readonly statuses: (targets: readonly TargetStatuses[]) => void;
  readonly targetsOf: (element: Element) => readonly TuningTarget[];
}

let active: TuningRuntime | null = null;

export function activate(runtime: TuningRuntime): () => void {
  active = runtime;
  return () => {
    if (active === runtime) {
      active = null;
    }
  };
}

/** The `Interactive`s around an element, innermost first. */
export function targetsOf(element: Element): readonly TuningTarget[] {
  return active?.targetsOf(element) ?? [];
}

export function clearTuning(): void {
  active?.clear();
}

/**
 * What the codemod read out of the file, for the targets the pane has open.
 *
 * This is the whole of the studio's knowledge about the code: without it a
 * value can still be dragged — the runtime is handed a synthetic static status
 * — but nothing is known about where it came from, so nothing can be written
 * back.
 */
export function applyStatuses(targets: readonly TargetStatuses[]): void {
  active?.statuses(targets);
}

export function tune(
  command: Extract<PreviewCommand, { type: "tune.set" | "tune.reset" }>
): TuningReply {
  if (active === null) {
    return {
      error: "Interactive controls are unavailable in this preview.",
      ok: false,
    };
  }

  return command.type === "tune.set"
    ? active.set(command.targetId, command.path, command.value)
    : active.reset(command.targetId, command.paths);
}
