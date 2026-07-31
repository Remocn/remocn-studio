import { Effect } from "effect";
import {
  cancelSidecarRequest,
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type {
  EnvironmentCheck,
  EnvironmentReport,
  InstallEvent,
  Installed,
} from "@/shared/ipc";
import type { PreviewComposition } from "./preview";

export function checkEnvironment(
  projectId: string,
  force: boolean
): Effect.Effect<EnvironmentReport, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.check",
      params: { force, projectId },
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function installProject(
  projectId: string,
  onEvent: (event: InstallEvent) => void
): Effect.Effect<Installed, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.install",
      onStream: onEvent,
      params: { projectId },
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function compositionRow(
  pick: PreviewComposition | null
): EnvironmentCheck {
  if (pick === null) {
    return {
      detail: "Counted once the preview has compiled the project.",
      fix: null,
      id: "compositions",
      state: "pending",
      title: "Compositions",
    };
  }

  if (pick.total === 0 || pick.compositionId === null) {
    return {
      detail:
        "The Root compiled, but it registers no <Composition>. Ask Claude to add one called Main.",
      fix: null,
      id: "compositions",
      state: "failed",
      title: "No compositions are registered",
    };
  }

  if (pick.reason !== "main") {
    return {
      detail: `${pick.total} registered, but none of them is called Main, so ${pick.compositionId} is playing.`,
      fix: null,
      id: "compositions",
      state: "warn",
      title: "There is no composition called Main",
    };
  }

  return {
    detail: `${pick.total} registered, and Main is one of them.`,
    fix: null,
    id: "compositions",
    state: "ok",
    title: "Compositions are registered",
  };
}

export function merged(
  checks: readonly EnvironmentCheck[],
  pick: PreviewComposition | null
): readonly EnvironmentCheck[] {
  const composition = compositionRow(pick);

  return checks.map((check) =>
    check.id === "compositions" ? composition : check
  );
}

export function unresolved(
  checks: readonly EnvironmentCheck[]
): readonly EnvironmentCheck[] {
  return checks.filter(
    (check) => check.state === "failed" || check.state === "warn"
  );
}

export function isBlocked(checks: readonly EnvironmentCheck[]): boolean {
  return checks.some(
    (check) => check.id === "claude" && check.state === "failed"
  );
}
