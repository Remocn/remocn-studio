import { tmpdir } from "node:os";
import { Effect } from "effect";
import type { EnvironmentCheck } from "@/shared/ipc";
import { AcpError, AUTH_REQUIRED, spawnAcp } from "../acp/connection";
import { findCopilot } from "./cli";
import { NOT_AUTHENTICATED } from "./failure";

const PROBE_TIMEOUT_MS = 20_000;

// The probe speaks the protocol instead of scraping output: `copilot` has no
// `login status` subcommand, but an unauthenticated agent answers
// `session/new` with ACP's AUTH_REQUIRED error, and a logged-in one opens a
// session — no model is asked, so the probe costs nothing. What this cannot
// see is an org policy that blocks the CLI: that state only speaks inside a
// turn, and the failure classifier catches it there.
export function accountCheck(): Effect.Effect<EnvironmentCheck> {
  return Effect.promise(async () => {
    const executable = findCopilot();
    if (executable === null) {
      return missingRow();
    }

    return await probe(executable);
  });
}

export function missingRow(): EnvironmentCheck {
  return {
    detail:
      "The copilot command is not on this machine. Install it with `npm install -g @github/copilot`, run `copilot login`, then recheck.",
    fix: { command: "npm install -g @github/copilot", type: "command" },
    id: "copilot",
    state: "failed",
    title: "Copilot is not installed",
  };
}

export function signInRow(): EnvironmentCheck {
  return {
    detail: NOT_AUTHENTICATED,
    fix: { command: "copilot login", type: "command" },
    id: "copilot",
    state: "failed",
    title: "Copilot is not logged in",
  };
}

export function okRow(version: string | null): EnvironmentCheck {
  return {
    detail: version === null ? null : `Copilot CLI ${version}`,
    fix: null,
    id: "copilot",
    state: "ok",
    title: "Copilot is logged in",
  };
}

export function unreachableRow(message: string): EnvironmentCheck {
  return {
    detail: `${message}\n\nRun copilot in a terminal to see what it says.`,
    fix: { command: "copilot", type: "command" },
    id: "copilot",
    state: "failed",
    title: "Copilot could not start",
  };
}

async function probe(executable: string): Promise<EnvironmentCheck> {
  const peer = spawnAcp({
    args: ["--acp", "--log-level", "none"],
    command: executable,
    cwd: tmpdir(),
    log: () => undefined,
    onNotification: () => undefined,
    onRequest: () => Promise.resolve({}),
  });

  const timer = setTimeout(() => peer.kill(), PROBE_TIMEOUT_MS);

  try {
    const initialized = await peer.request<{
      agentInfo?: { version?: string };
    }>("initialize", {
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      protocolVersion: 1,
    });

    await peer.request("session/new", { cwd: tmpdir(), mcpServers: [] });

    return okRow(initialized.agentInfo?.version ?? null);
  } catch (cause) {
    if (cause instanceof AcpError && cause.code === AUTH_REQUIRED) {
      return signInRow();
    }
    return unreachableRow(
      cause instanceof Error ? cause.message : String(cause)
    );
  } finally {
    clearTimeout(timer);
    peer.kill();
  }
}
