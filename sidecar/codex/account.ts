import { Effect } from "effect";
import type { EnvironmentCheck } from "@/shared/ipc";
import { findCodex, runCodex } from "./cli";

export const NOT_AUTHENTICATED =
  "Codex is not signed in. Run `codex login` in a terminal, sign in with your ChatGPT account, then try again.";

const STATUS_TIMEOUT_MS = 30_000;

const LOGGED_OUT = /not logged in/i;

// `codex login status` answers on stdout and in the exit code: 0 with
// "Logged in using ChatGPT" (or the API-key variant), 1 with "Not logged in".
// Measured against codex-cli 0.147.0.
export function accountRow(
  code: number | null,
  output: string
): EnvironmentCheck {
  const said = output.trim();

  if (code === 0) {
    return {
      detail: said.length > 0 ? said : null,
      fix: null,
      id: "codex",
      state: "ok",
      title: "Codex is logged in",
    };
  }

  if (LOGGED_OUT.test(said)) {
    return {
      detail: NOT_AUTHENTICATED,
      fix: { command: "codex login", type: "command" },
      id: "codex",
      state: "failed",
      title: "Codex is not logged in",
    };
  }

  return {
    detail: `${said.length > 0 ? said : "Codex answered nothing."}\n\nRun codex login status in a terminal to see what it says.`,
    fix: { command: "codex login", type: "command" },
    id: "codex",
    state: "failed",
    title: "Codex could not answer",
  };
}

export function missingRow(): EnvironmentCheck {
  return {
    detail:
      "The codex command is not on this machine. Install it with `npm install -g @openai/codex` (or `brew install codex`), run `codex login`, then recheck.",
    fix: { command: "npm install -g @openai/codex", type: "command" },
    id: "codex",
    state: "failed",
    title: "Codex is not installed",
  };
}

export function accountCheck(): Effect.Effect<EnvironmentCheck> {
  return Effect.promise(async () => {
    const executable = findCodex();
    if (executable === null) {
      return missingRow();
    }

    const run = await runCodex(
      executable,
      ["login", "status"],
      STATUS_TIMEOUT_MS
    );
    return accountRow(run.code, run.output);
  });
}
