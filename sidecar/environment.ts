import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Data, Effect, Ref } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { EnvironmentCheck } from "@/shared/ipc";
import { NOT_AUTHENTICATED } from "./claude/failure";
import { entryPointOf, remotionRootOf } from "./preview/project";

export class EnvironmentError extends Data.TaggedError("EnvironmentError")<{
  message: string;
}> {}

const ACCOUNT_TIMEOUT = "30 seconds";
const LOGGED_OUT = "none";
const FIRST_PARTY = "firstParty";
const NAMED_MISSING = 4;

export interface Account {
  apiProvider?: string;
  email?: string;
  organization?: string;
  subscriptionType?: string;
  tokenSource?: string;
}

export interface Manifest {
  dependencies: readonly string[];
  remotion: string | null;
}

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

export function accountRow(account: Account): EnvironmentCheck {
  const provider = account.apiProvider ?? FIRST_PARTY;

  if (provider !== FIRST_PARTY) {
    return {
      detail: `Authenticated through ${provider}.`,
      fix: null,
      id: "claude",
      state: "ok",
      title: "Claude Code is authenticated",
    };
  }

  if (account.tokenSource === LOGGED_OUT) {
    return {
      detail: NOT_AUTHENTICATED,
      fix: { command: "claude", type: "command" },
      id: "claude",
      state: "failed",
      title: "Claude Code is not logged in",
    };
  }

  return {
    detail: account.subscriptionType ?? account.email ?? null,
    fix: null,
    id: "claude",
    state: "ok",
    title: "Claude Code is logged in",
  };
}

export function unreachableRow(message: string): EnvironmentCheck {
  return {
    detail: `${message}\n\nRun claude in a terminal to see what it says.`,
    fix: { command: "claude", type: "command" },
    id: "claude",
    state: "failed",
    title: "Claude Code could not start",
  };
}

export function runtimeRow(version: string | undefined): EnvironmentCheck {
  if (version === undefined) {
    return {
      detail:
        "The sidecar is not running on bun, so bun:sqlite and the project's own installs may behave differently.",
      fix: null,
      id: "runtime",
      state: "warn",
      title: "The runtime is not bun",
    };
  }

  return {
    detail: `bun ${version}`,
    fix: null,
    id: "runtime",
    state: "ok",
    title: "bun is running the sidecar",
  };
}

export function remotionRow(
  root: string,
  manifest: Manifest | null
): EnvironmentCheck {
  if (manifest === null) {
    return {
      detail: `There is no package.json in ${root}, so this is not a Remotion project yet.`,
      fix: null,
      id: "remotion",
      state: "failed",
      title: "This folder is not a Remotion project",
    };
  }

  if (manifest.remotion === null) {
    return {
      detail: `${path.join(root, "package.json")} does not depend on remotion. Ask Claude to set the project up, or open a folder that already is one.`,
      fix: null,
      id: "remotion",
      state: "failed",
      title: "This folder is not a Remotion project",
    };
  }

  return {
    detail: `remotion ${manifest.remotion}`,
    fix: null,
    id: "remotion",
    state: "ok",
    title: "This folder is a Remotion project",
  };
}

export function dependencyRow(
  missing: readonly string[],
  total: number,
  drifted: string | null
): EnvironmentCheck {
  if (missing.length > 0) {
    const named = missing.slice(0, NAMED_MISSING).join(", ");
    const rest =
      missing.length > NAMED_MISSING
        ? ` and ${missing.length - NAMED_MISSING} more`
        : "";

    return {
      detail: `${missing.length} of ${total} declared packages are not in node_modules: ${named}${rest}.`,
      fix: { type: "install" },
      id: "dependencies",
      state: "failed",
      title: "Dependencies are not installed",
    };
  }

  if (drifted !== null) {
    return {
      detail: drifted,
      fix: { type: "install" },
      id: "dependencies",
      state: "warn",
      title: "package.json and the lockfile disagree",
    };
  }

  return {
    detail: `${total} declared packages resolve from node_modules.`,
    fix: null,
    id: "dependencies",
    state: "ok",
    title: "Dependencies are installed",
  };
}

export function entryRow(
  root: string,
  entry: string | null,
  reason: string
): EnvironmentCheck {
  if (entry === null) {
    return {
      detail: reason,
      fix: null,
      id: "entry",
      state: "failed",
      title: "No Remotion entry point",
    };
  }

  return {
    detail: path.relative(root, entry) || entry,
    fix: null,
    id: "entry",
    state: "ok",
    title: "A Remotion entry point is registered",
  };
}

export const PENDING_COMPOSITIONS: EnvironmentCheck = {
  detail: "Counted once the preview has compiled the project.",
  fix: null,
  id: "compositions",
  state: "pending",
  title: "Compositions",
};

export function manifestOf(
  root: string
): Effect.Effect<Manifest | null, never> {
  return Effect.tryPromise({
    catch: () => new EnvironmentError({ message: "no package.json" }),
    try: async () => {
      const source = await readFile(path.join(root, "package.json"), "utf8");
      const parsed = JSON.parse(source) as Record<
        string,
        Record<string, string> | undefined
      >;

      const names = new Set<string>();
      let remotion: string | null = null;

      for (const field of DEPENDENCY_FIELDS) {
        for (const [name, range] of Object.entries(parsed[field] ?? {})) {
          names.add(name);
          if (name === "remotion") {
            remotion = range;
          }
        }
      }

      return { dependencies: [...names], remotion } satisfies Manifest;
    },
  }).pipe(Effect.orElseSucceed(() => null));
}

export function isInstalled(root: string, name: string): boolean {
  let dir = root;

  for (;;) {
    if (existsSync(path.join(dir, "node_modules", name, "package.json"))) {
      return true;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return false;
    }

    dir = parent;
  }
}

export function missingFrom(
  root: string,
  dependencies: readonly string[]
): readonly string[] {
  return dependencies.filter((name) => !isInstalled(root, name));
}

export function lockfileDrift(root: string): Effect.Effect<string | null> {
  return Effect.callback<string | null>((resume) => {
    const child = spawn(
      process.execPath,
      ["install", "--dry-run", "--frozen-lockfile"],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
    );

    let said = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      said += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      said += chunk.toString();
    });

    child.once("error", () => resume(Effect.succeed(null)));

    child.once("exit", (code) => {
      resume(Effect.succeed(driftFrom(code, said)));
    });

    return Effect.sync(() => {
      child.kill("SIGKILL");
    });
  });
}

export function driftFrom(code: number | null, said: string): string | null {
  if (code === 0) {
    return null;
  }

  const line = said
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row.startsWith("error:") && row.includes("lockfile"));

  if (line === undefined) {
    return null;
  }

  return `${line.slice("error:".length).trim()} Installing brings node_modules and the lockfile back in step with package.json.`;
}

function silent(closed: Promise<void>): AsyncIterable<SDKUserMessage> {
  return {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        await closed;
        return { done: true, value: undefined };
      },
    }),
  };
}

export function askAccount(
  cwd: string
): Effect.Effect<Account, EnvironmentError> {
  return Effect.tryPromise({
    catch: (cause) => new EnvironmentError({ message: errorMessage(cause) }),
    try: async () => {
      const input = Promise.withResolvers<void>();
      const session = query({
        options: { cwd },
        prompt: silent(input.promise),
      });

      try {
        return (await session.accountInfo()) as Account;
      } finally {
        input.resolve();
      }
    },
  }).pipe(
    Effect.timeout(ACCOUNT_TIMEOUT),
    Effect.catch((cause) =>
      Effect.fail(
        cause instanceof EnvironmentError
          ? cause
          : new EnvironmentError({
              message: `Claude Code did not answer within ${ACCOUNT_TIMEOUT}.`,
            })
      )
    )
  );
}

export interface AccountCache {
  readonly clear: Effect.Effect<void>;
  readonly row: (cwd: string) => Effect.Effect<EnvironmentCheck>;
}

export function makeAccountCache(): Effect.Effect<AccountCache> {
  return Effect.map(
    Ref.make<EnvironmentCheck | null>(null),
    (cached): AccountCache => ({
      clear: Ref.set(cached, null),
      row: (cwd) =>
        Effect.flatMap(Ref.get(cached), (seen) =>
          seen === null
            ? askAccount(cwd).pipe(
                Effect.map(accountRow),
                Effect.catch((error) =>
                  Effect.succeed(unreachableRow(error.message))
                ),
                Effect.tap((row) => Ref.set(cached, row))
              )
            : Effect.succeed(seen)
        ),
    })
  );
}

export function checksFor(
  folder: string,
  account: EnvironmentCheck
): Effect.Effect<readonly EnvironmentCheck[]> {
  return Effect.gen(function* () {
    const root = remotionRootOf(folder);
    const manifest = yield* manifestOf(root);

    const runtime = runtimeRow(
      (process.versions as Record<string, string | undefined>).bun ?? undefined
    );

    const head = [account, runtime, remotionRow(root, manifest)];

    if (manifest === null) {
      return [...head, PENDING_COMPOSITIONS];
    }

    const dependencies = yield* dependenciesRow(root, manifest);

    if (manifest.remotion === null) {
      return [...head, dependencies, PENDING_COMPOSITIONS];
    }

    const entry = yield* entryPointOf(root).pipe(
      Effect.map((file) => entryRow(root, file, "")),
      Effect.catch((error) =>
        Effect.succeed(entryRow(root, null, error.message))
      )
    );

    return [...head, dependencies, entry, PENDING_COMPOSITIONS];
  });
}

function dependenciesRow(
  root: string,
  manifest: Manifest
): Effect.Effect<EnvironmentCheck> {
  return Effect.gen(function* () {
    const missing = missingFrom(root, manifest.dependencies);

    if (missing.length > 0) {
      return dependencyRow(missing, manifest.dependencies.length, null);
    }

    const drifted = yield* lockfileDrift(root);

    return dependencyRow([], manifest.dependencies.length, drifted);
  });
}
