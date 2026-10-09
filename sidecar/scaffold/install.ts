import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { semver } from "bun";
import { Effect, Schema, Semaphore } from "effect";
import { PAPER_SHADER_VERSION } from "@/shared/shaders";
import {
  addCommand,
  binaryOf,
  DEFAULT_MANAGER,
  INSTALL_ARGS,
  installCommand,
  type PackageManager,
  type ProjectManager,
  pmOf,
} from "../package-manager";
import { remotionRootOf } from "../preview/project";
import { ScaffoldError } from "./template";

const KILL_GRACE_MS = 2000;
const TAIL_LINES = 12;

// bun's linker reports a failure it does not exit on: two installs in one
// folder ended with `error: Failed to link @babel/parser: EEXIST`, then
// `Saved lockfile` and the whole added-package list, and exit 0. A line
// shaped like that is a failed install whatever the exit code says.
const ERROR_LINE = /^\s*error:/i;

// One package-manager run at a time per project. `dispatch` forks every
// request, so Install pressed twice, Install beside the wizard's own scaffold
// install, or Upgrade Remotion during either genuinely ran two linkers in one
// node_modules — and the second one left a partially linked tree behind a
// green checklist row. The lane is keyed by the canonical root, so the same
// folder reached through a symlink still waits its turn.
const LANES = new Map<string, Semaphore.Semaphore>();

function laneOf(root: string): Semaphore.Semaphore {
  const key = canonical(root);
  const known = LANES.get(key);
  if (known !== undefined) {
    return known;
  }
  const lane = Semaphore.makeUnsafe(1);
  LANES.set(key, lane);
  return lane;
}

function canonical(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return resolve(root);
  }
}

export type Spawner = (
  binary: string,
  args: readonly string[],
  options: { cwd: string; stdio: ["ignore", "pipe", "pipe"] }
) => ChildProcess;

export interface Runner {
  readonly binary: (manager: PackageManager) => string | null;
  readonly spawn: Spawner;
}

export const NODE_RUNNER: Runner = { binary: binaryOf, spawn };

export function installDependencies(
  cwd: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner = NODE_RUNNER
): Effect.Effect<void, ScaffoldError> {
  const project = pmOf(remotionRootOf(cwd));

  return runManager(
    project,
    [...INSTALL_ARGS],
    installCommand(project.manager),
    log,
    runner
  );
}

export function installScaffold(
  cwd: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner = NODE_RUNNER
): Effect.Effect<void, ScaffoldError> {
  const root = remotionRootOf(cwd);

  return runManager(
    { lockfile: null, manager: DEFAULT_MANAGER, root },
    [...INSTALL_ARGS],
    installCommand(DEFAULT_MANAGER),
    log,
    runner
  );
}

export function upgradeArgs(
  manager: PackageManager,
  packages: readonly string[],
  version: string
): readonly string[] {
  const pinned = packages.map((name) => `${name}@${version}`);

  return manager === "npm" ? ["install", ...pinned] : ["add", ...pinned];
}

export function upgradeDependencies(
  cwd: string,
  packages: readonly string[],
  version: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner = NODE_RUNNER
): Effect.Effect<void, ScaffoldError> {
  const project = pmOf(remotionRootOf(cwd));

  if (packages.length === 0) {
    return Effect.fail(
      new ScaffoldError({
        message: "there is nothing to upgrade in this project",
      })
    );
  }

  return runManager(
    project,
    upgradeArgs(project.manager, packages, version),
    addCommand(project.manager),
    log,
    runner,
    remotionRootOf(cwd)
  );
}

const PaperManifest = Schema.Struct({
  dependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  devDependencies: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.String)
  ),
});
const PackageVersion = Schema.Struct({ version: Schema.NonEmptyString });
const decodePaperManifest = Schema.decodeUnknownEffect(PaperManifest);
const decodePackageVersion = Schema.decodeUnknownEffect(PackageVersion);
const PAPER_PACKAGES = ["@paper-design/shaders", "@paper-design/shaders-react"];

function installedPaperManifest(root: string, name: string): unknown {
  let cursor = root;
  for (;;) {
    const path = join(cursor, "node_modules", name, "package.json");
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8"));
    }
    const parent = dirname(cursor);
    if (parent === cursor) {
      return null;
    }
    cursor = parent;
  }
}

function paperState(root: string) {
  const failed = (cause: unknown) =>
    new ScaffoldError({
      message:
        cause instanceof Error
          ? cause.message
          : "Could not check the project's Paper shader dependencies.",
    });
  return Effect.gen(function* () {
    const raw = yield* Effect.try({
      catch: failed,
      try: () =>
        JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as unknown,
    });
    const manifest = yield* decodePaperManifest(raw).pipe(
      Effect.mapError(failed)
    );
    return yield* Effect.forEach(PAPER_PACKAGES, (name) =>
      Effect.gen(function* () {
        const declared =
          manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
        if (
          declared !== undefined &&
          !semver.satisfies(PAPER_SHADER_VERSION, declared)
        ) {
          return yield* Effect.fail(
            new ScaffoldError({
              message: `${name} declares ${declared}. Shader insertion requires ${PAPER_SHADER_VERSION}; resolve this dependency before adding a shader.`,
            })
          );
        }
        const installed = yield* Effect.try({
          catch: failed,
          try: () => installedPaperManifest(root, name),
        });
        if (installed === null) {
          return { declared, installed: false, name };
        }
        const pkg = yield* decodePackageVersion(installed).pipe(
          Effect.mapError(failed)
        );
        if (pkg.version !== PAPER_SHADER_VERSION) {
          return yield* Effect.fail(
            new ScaffoldError({
              message: `${name} ${pkg.version} is installed. Shader insertion requires ${PAPER_SHADER_VERSION}; Studio will not replace it automatically.`,
            })
          );
        }
        return { declared, installed: true, name };
      })
    );
  });
}

export function checkPaperDependencies(cwd: string) {
  return paperState(remotionRootOf(cwd)).pipe(Effect.asVoid);
}

export function preparePaperDependencies(
  cwd: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner = NODE_RUNNER
) {
  const root = remotionRootOf(cwd);
  const project = pmOf(root);
  return laneOf(project.root).withPermits(1)(
    Effect.gen(function* () {
      const state = yield* paperState(root);
      const missing = state
        .filter((item) => !item.installed || item.declared === undefined)
        .map((item) => item.name);
      if (missing.length === 0) {
        return;
      }
      const binary = runner.binary(project.manager);
      if (binary === null) {
        return yield* Effect.fail(
          new ScaffoldError({ message: notInstalled(project.manager) })
        );
      }
      yield* run(
        binary,
        upgradeArgs(project.manager, missing, PAPER_SHADER_VERSION),
        addCommand(project.manager),
        log,
        runner,
        root
      );
      const verified = yield* paperState(root);
      if (
        verified.some((item) => !item.installed || item.declared === undefined)
      ) {
        return yield* Effect.fail(
          new ScaffoldError({
            message:
              "The package manager finished without preparing both Paper shader packages. Retry after checking the project installation.",
          })
        );
      }
    })
  );
}

function runManager(
  project: ProjectManager,
  args: readonly string[],
  command: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner,
  within: string = project.root
): Effect.Effect<void, ScaffoldError> {
  const { manager } = project;
  const binary = runner.binary(manager);

  if (binary === null) {
    return Effect.fail(new ScaffoldError({ message: notInstalled(manager) }));
  }

  return laneOf(project.root).withPermits(1)(
    run(binary, args, command, log, runner, within)
  );
}

function run(
  binary: string,
  args: readonly string[],
  command: string,
  log: (line: string) => Effect.Effect<void>,
  runner: Runner,
  within: string
): Effect.Effect<void, ScaffoldError> {
  return Effect.callback<void, ScaffoldError>((resume) => {
    const child = runner.spawn(binary, args, {
      cwd: within,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const tail: string[] = [];
    const errors: string[] = [];

    const watch = (stream: NodeJS.ReadableStream | null) => {
      if (stream === null) {
        return;
      }
      const lines = createInterface({
        crlfDelay: Number.POSITIVE_INFINITY,
        input: stream,
      });
      lines.on("line", (line) => {
        tail.push(line);
        if (tail.length > TAIL_LINES) {
          tail.shift();
        }
        if (ERROR_LINE.test(line)) {
          errors.push(line);
        }
        Effect.runSync(log(line));
      });
    };

    watch(child.stdout);
    watch(child.stderr);

    child.once("error", (cause) => {
      resume(Effect.fail(new ScaffoldError({ message: String(cause) })));
    });

    child.once("exit", (code, signal) => {
      if (code === 0 && errors.length === 0) {
        resume(Effect.void);
        return;
      }
      if (code === 0) {
        resume(
          Effect.fail(
            new ScaffoldError({
              message: `${command} reported an error and still exited 0:\n${errors.join("\n")}`,
            })
          )
        );
        return;
      }
      resume(
        Effect.fail(
          new ScaffoldError({
            message: reason(command, code, signal, tail),
          })
        )
      );
    });

    return Effect.sync(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref();
      }
    });
  });
}

export function notInstalled(manager: PackageManager): string {
  return `this project's lockfile is ${manager}'s, and ${manager} is not installed on this machine — the studio will not install its dependencies with anything else`;
}

function reason(
  command: string,
  code: number | null,
  signal: NodeJS.Signals | null,
  tail: readonly string[]
): string {
  const how =
    signal === null ? `exited with code ${code}` : `was killed by ${signal}`;
  const said = tail.join("\n").trim();

  return said.length === 0
    ? `${command} ${how}`
    : `${command} ${how}:\n${said}`;
}
