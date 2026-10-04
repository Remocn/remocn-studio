import { type Duration, Effect } from "effect";
import type { SessionMode } from "@/shared/ipc";
import type { AcpPeer } from "./connection";
import type { SessionModes } from "./pool";

// ACP mode ids are URIs; the match is on the name after the last `#` (or the
// last path segment), compared whole, so a version bump that moves the prefix
// cannot silently strand every session in the default mode — and a prefix
// that happens to contain "agent" cannot pass for agent mode. acceptEdits maps
// to plain agent mode — an agent's allow-all mode (autopilot and its cousins)
// has no story here.
const MODE_NAMES: Record<SessionMode, string> = {
  acceptEdits: "agent",
  auto: "agent",
  plan: "plan",
};

const SWITCH_DEADLINE = "5 seconds";

const TRAILING_SLASHES = /\/+$/;

export interface ModeRecord {
  modes: SessionModes | undefined;
}

export function modeIdFor(
  mode: SessionMode,
  modes: SessionModes | undefined
): string | null {
  const wanted = MODE_NAMES[mode];
  const found = (modes?.availableModes ?? []).find(
    (candidate) => nameOf(candidate.id ?? "") === wanted
  );
  return found?.id ?? null;
}

function nameOf(id: string): string {
  const fragment = id.lastIndexOf("#");
  const name =
    fragment === -1
      ? (id.replace(TRAILING_SLASHES, "").split("/").at(-1) ?? "")
      : id.slice(fragment + 1);
  return name.toLowerCase();
}

export function switchMode(
  peer: AcpPeer,
  sessionId: string,
  mode: SessionMode,
  record: ModeRecord,
  log: (line: string) => void,
  deadline: Duration.Input = SWITCH_DEADLINE
): Promise<boolean> {
  const modeId = modeIdFor(mode, record.modes);
  if (modeId === null) {
    return Promise.resolve(false);
  }
  if (modeId === record.modes?.currentModeId) {
    return Promise.resolve(true);
  }

  return Effect.runPromise(
    Effect.tryPromise({
      catch: String,
      try: () => peer.request("session/set_mode", { modeId, sessionId }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: deadline,
        orElse: () => Effect.fail("the agent did not answer in time"),
      }),
      Effect.flatMap(() =>
        Effect.sync(() => {
          record.modes = { ...record.modes, currentModeId: modeId };
          return true;
        })
      ),
      Effect.catch((reason) =>
        Effect.sync(() => {
          log(`acp: could not enter ${mode}: ${reason}`);
          return false;
        })
      )
    )
  );
}

export function takeModeUpdate(
  record: ModeRecord,
  update: Record<string, unknown>
): void {
  if (
    update.sessionUpdate === "current_mode_update" &&
    typeof update.currentModeId === "string"
  ) {
    record.modes = { ...record.modes, currentModeId: update.currentModeId };
  }
}
