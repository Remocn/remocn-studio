import { openUrl } from "@tauri-apps/plugin-opener";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { ShellError } from "@/lib/studio/shell";
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
  NodeDownload,
  NodeInstaller,
  Upgraded,
} from "@/shared/ipc";
import type { AgentProvider } from "@/shared/providers";
import type { PreviewComposition } from "./preview";

export function checkEnvironment(
  projectId: string,
  force: boolean,
  provider: AgentProvider
): Effect.Effect<EnvironmentReport, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.check",
      params: { force, projectId, provider },
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

export function upgradeProject(
  projectId: string,
  packages: readonly string[],
  version: string,
  onEvent: (event: InstallEvent) => void
): Effect.Effect<Upgraded, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "project.upgrade",
      onStream: onEvent,
      params: { packages, projectId, version },
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function installNode(
  onEvent: (event: NodeDownload) => void
): Effect.Effect<NodeInstaller, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "node.install",
      onStream: onEvent,
      params: null,
    }).pipe(Effect.onInterrupt(() => Effect.ignore(cancelSidecarRequest(id))));
  });
}

export function downloadPercent(event: NodeDownload | null): number | null {
  if (event === null || event.total === null || event.total <= 0) {
    return null;
  }

  return Math.min(100, Math.round((event.received / event.total) * 100));
}

export const NODE_DOWNLOAD_URL = "https://nodejs.org/en/download";

// Off macOS there is no system installer to hand a package to, and the studio
// does not install Node into anyone's home folder: the official page, or the
// distribution's own package, is where it comes from.
export const openNodeDownload: Effect.Effect<void, ShellError> =
  Effect.tryPromise({
    catch: (cause) =>
      new ShellError({
        message: `The Node.js download page did not open (${errorMessage(cause)}). Its address is ${NODE_DOWNLOAD_URL}`,
      }),
    try: () => openUrl(NODE_DOWNLOAD_URL),
  });

export function compositionRow(
  pick: PreviewComposition | null,
  agent = "the agent"
): EnvironmentCheck {
  if (pick === null) {
    return {
      detail: "Counted once the preview has compiled the project.",
      fix: null,
      id: "compositions",
      state: "pending",
      title: "Videos",
    };
  }

  if (pick.total === 0 || pick.compositionId === null) {
    return {
      detail: `The project compiled, but it registers no videos yet. Ask ${agent} to add one.`,
      fix: null,
      id: "compositions",
      state: "failed",
      title: "No videos are registered",
    };
  }

  // The one case worth failing on now that a project holds many videos: the
  // pane asked for one by name and the compiled project does not render it.
  // "No composition called Main" is the normal case here, not a warning.
  if (pick.reason === "missing") {
    return {
      detail: `Nothing in this project renders ${pick.compositionId}. Its Root.tsx has to register it — ask ${agent} to, or open a video the project does render.`,
      fix: null,
      id: "compositions",
      state: "failed",
      title: `${pick.compositionId} is not in the code`,
    };
  }

  return {
    detail: `${pick.total} registered, and ${pick.compositionId} is playing.`,
    fix: null,
    id: "compositions",
    state: "ok",
    title: "Videos are registered",
  };
}

export function merged(
  checks: readonly EnvironmentCheck[],
  pick: PreviewComposition | null,
  agent?: string
): readonly EnvironmentCheck[] {
  const composition = compositionRow(pick, agent);

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

export function troubleHeading(troubles: readonly EnvironmentCheck[]): string {
  return troubles.every((check) => check.state === "warn")
    ? "This project has one thing worth fixing"
    : "This project is not ready to run";
}

// Only the session's own provider being logged out locks the composer: the
// account row's id is the provider id, so the check is one comparison.
export function isBlocked(
  checks: readonly EnvironmentCheck[],
  provider: AgentProvider
): boolean {
  return checks.some(
    (check) => check.id === provider && check.state === "failed"
  );
}
