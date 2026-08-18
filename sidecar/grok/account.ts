import { tmpdir } from "node:os";
import { Effect } from "effect";
import type { EnvironmentCheck } from "@/shared/ipc";
import { AcpError, AUTH_REQUIRED, spawnAcp } from "../acp/connection";
import { findGrok } from "./cli";
import { NOT_AUTHENTICATED } from "./failure";

const PROBE_TIMEOUT_MS = 20_000;

// The same protocol probe Copilot gets: initialize plus session/new, no
// model asked, AUTH_REQUIRED meaning "sign in".
export function accountCheck(): Effect.Effect<EnvironmentCheck> {
  return Effect.promise(async () => {
    const executable = findGrok();
    if (executable === null) {
      return missingRow();
    }

    return await probe(executable);
  });
}

export function missingRow(): EnvironmentCheck {
  return {
    detail:
      "The grok command is not on this machine. Install Grok Build from grok.com/build, run `grok login`, then recheck.",
    fix: { command: "grok login", type: "command" },
    id: "grok",
    state: "failed",
    title: "Grok is not installed",
  };
}

export function signInRow(): EnvironmentCheck {
  return {
    detail: NOT_AUTHENTICATED,
    fix: { command: "grok login", type: "command" },
    id: "grok",
    state: "failed",
    title: "Grok is not logged in",
  };
}

export function okRow(version: string | null): EnvironmentCheck {
  return {
    detail: version === null ? null : `Grok Build ${version}`,
    fix: null,
    id: "grok",
    state: "ok",
    title: "Grok is logged in",
  };
}

export function unreachableRow(message: string): EnvironmentCheck {
  return {
    detail: `${message}\n\nRun grok in a terminal to see what it says.`,
    fix: { command: "grok", type: "command" },
    id: "grok",
    state: "failed",
    title: "Grok could not start",
  };
}

async function probe(executable: string): Promise<EnvironmentCheck> {
  const peer = spawnAcp({
    args: ["agent", "stdio"],
    command: executable,
    cwd: tmpdir(),
    log: () => undefined,
    onNotification: () => undefined,
    onRequest: () => Promise.resolve({}),
  });

  const timer = setTimeout(() => peer.kill(), PROBE_TIMEOUT_MS);

  try {
    const initialized = await peer.request<{
      _meta?: { agentVersion?: string };
      agentInfo?: { version?: string };
    }>("initialize", {
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
      protocolVersion: 1,
    });

    await peer.request("session/new", { cwd: tmpdir(), mcpServers: [] });

    return okRow(
      initialized.agentInfo?.version ?? initialized._meta?.agentVersion ?? null
    );
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
