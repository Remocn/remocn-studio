import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { Effect, Exit, Fiber } from "effect";
import { causeMessage } from "@/lib/error-message";
import type { PackageManager } from "@/sidecar/package-manager";
import {
  checkPaperDependencies,
  installDependencies,
  preparePaperDependencies,
  type Runner,
  type Spawner,
  upgradeArgs,
  upgradeDependencies,
} from "@/sidecar/scaffold/install";

interface Call {
  args: readonly string[];
  binary: string;
  cwd: string;
}

const LOCKFILES: Record<PackageManager, string> = {
  bun: "bun.lock",
  npm: "package-lock.json",
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
};

const REMOTION = ["@remotion/cli", "remotion"];

let folder = "";

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "remocn-install-"));
});

afterEach(async () => {
  await rm(folder, { force: true, recursive: true });
});

function spawner(calls: Call[], code: number): Spawner {
  const fake: Spawner = (binary, args, options) => {
    calls.push({ args: [...args], binary, cwd: options.cwd });

    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      kill: () => true,
      signalCode: null,
      stderr: null,
      stdout: null,
    });

    queueMicrotask(() => child.emit("exit", code, null));

    return child as unknown as ReturnType<Spawner>;
  };

  return fake;
}

function runner(
  calls: Call[],
  code = 0,
  binary: string | null = "/bin/manager"
): Runner {
  return { binary: () => binary, spawn: spawner(calls, code) };
}

async function project(manager: PackageManager) {
  await writeFile(
    path.join(folder, "package.json"),
    JSON.stringify({ name: "video" })
  );
  await writeFile(path.join(folder, LOCKFILES[manager]), "");
}

const lines = () => Effect.void;

async function installedPaper(version = "0.0.78") {
  const packages = ["@paper-design/shaders", "@paper-design/shaders-react"];
  await writeFile(
    path.join(folder, "package.json"),
    JSON.stringify({
      dependencies: Object.fromEntries(packages.map((name) => [name, version])),
    })
  );
  await Promise.all(
    packages.map(async (name) => {
      const directory = path.join(folder, "node_modules", name);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "package.json"),
        JSON.stringify({ name, version })
      );
    })
  );
}

describe("Paper shader dependency preparation", () => {
  it("reuses the tested version without running a package manager", async () => {
    await installedPaper();
    const calls: Call[] = [];
    await Effect.runPromise(
      preparePaperDependencies(folder, lines, runner(calls))
    );
    expect(calls).toHaveLength(0);
  });
  it("refuses incompatible installed and declared versions before making changes", async () => {
    const calls: Call[] = [];
    await installedPaper("0.0.77");
    await expect(
      Effect.runPromise(checkPaperDependencies(folder))
    ).rejects.toThrow("requires 0.0.78");
    await writeFile(
      path.join(folder, "package.json"),
      JSON.stringify({ dependencies: { "@paper-design/shaders": "*" } })
    );
    await expect(
      Effect.runPromise(preparePaperDependencies(folder, lines, runner(calls)))
    ).rejects.toThrow("will not replace");
    expect(calls).toHaveLength(0);
  });
  it("reports an offline install failure and verifies a successful exit actually installed packages", async () => {
    await project("npm");
    const calls: Call[] = [];
    await expect(
      Effect.runPromise(
        preparePaperDependencies(folder, lines, runner(calls, 1))
      )
    ).rejects.toThrow();
    expect(calls[0].args).toEqual([
      "install",
      "@paper-design/shaders@0.0.78",
      "@paper-design/shaders-react@0.0.78",
    ]);
    await expect(
      Effect.runPromise(preparePaperDependencies(folder, lines, runner(calls)))
    ).rejects.toThrow("without preparing");
  });
  it("shares the install lane and rechecks dependencies after waiting, so concurrent insertions install once", async () => {
    await project("bun");
    const calls: Call[] = [];
    const lane = held(calls);
    const install = Effect.runFork(
      installDependencies(folder, lines, lane.runner)
    );
    const first = Effect.runFork(
      preparePaperDependencies(folder, lines, lane.runner)
    );
    const second = Effect.runFork(
      preparePaperDependencies(folder, lines, lane.runner)
    );
    await settle();
    expect(calls).toHaveLength(1);
    lane.children[0]?.emit("exit", 0, null);
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1].args).toEqual([
      "add",
      "@paper-design/shaders@0.0.78",
      "@paper-design/shaders-react@0.0.78",
    ]);
    await installedPaper();
    lane.children[1]?.emit("exit", 0, null);
    await Effect.runPromise(Fiber.join(install));
    await Effect.runPromise(Fiber.join(first));
    await Effect.runPromise(Fiber.join(second));
    expect(calls).toHaveLength(2);
  });
});

describe("upgradeArgs", () => {
  it("pins every package with the version the fix names", () => {
    expect(upgradeArgs("bun", REMOTION, "4.0.520")).toEqual([
      "add",
      "@remotion/cli@4.0.520",
      "remotion@4.0.520",
    ]);
  });

  it("speaks each manager's own word for adding a package", () => {
    expect(upgradeArgs("npm", ["remotion"], "4.0.520")[0]).toBe("install");
    expect(upgradeArgs("pnpm", ["remotion"], "4.0.520")[0]).toBe("add");
    expect(upgradeArgs("yarn", ["remotion"], "4.0.520")[0]).toBe("add");
  });
});

describe("upgradeDependencies", () => {
  it("runs the manager the project's lockfile names, in its directory", async () => {
    await project("pnpm");
    const calls: Call[] = [];

    await Effect.runPromise(
      upgradeDependencies(folder, REMOTION, "4.0.520", lines, runner(calls))
    );

    expect(calls).toEqual([
      {
        args: ["add", "@remotion/cli@4.0.520", "remotion@4.0.520"],
        binary: "/bin/manager",
        cwd: folder,
      },
    ]);
  });

  it("adds in the manifest the checklist reads, not at the workspace root", async () => {
    await writeFile(
      path.join(folder, "package.json"),
      JSON.stringify({ name: "workspace", workspaces: ["videos/*"] })
    );
    await writeFile(path.join(folder, LOCKFILES.pnpm), "");

    const member = path.join(folder, "videos", "intro");
    await mkdir(member, { recursive: true });
    await writeFile(
      path.join(member, "package.json"),
      JSON.stringify({ dependencies: { remotion: "4.0.481" }, name: "intro" })
    );

    const calls: Call[] = [];

    await Effect.runPromise(
      upgradeDependencies(member, REMOTION, "4.0.520", lines, runner(calls))
    );

    expect(calls[0]?.cwd).toBe(member);
  });

  it("uses npm's install for a project whose lockfile is npm's", async () => {
    await project("npm");
    const calls: Call[] = [];

    await Effect.runPromise(
      upgradeDependencies(folder, ["remotion"], "4.0.520", lines, runner(calls))
    );

    expect(calls[0]?.args).toEqual(["install", "remotion@4.0.520"]);
  });

  it("says the manager is missing rather than substituting another", async () => {
    await project("yarn");

    const exit = await Effect.runPromiseExit(
      upgradeDependencies(
        folder,
        ["remotion"],
        "4.0.520",
        lines,
        runner([], 0, null)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("yarn");
    }
  });

  it("names the command that failed, not the one it did not run", async () => {
    await project("bun");
    const calls: Call[] = [];

    const exit = await Effect.runPromiseExit(
      upgradeDependencies(
        folder,
        ["remotion"],
        "4.0.520",
        lines,
        runner(calls, 1)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("bun add");
    }
  });

  it("refuses an empty list rather than running a bare add", async () => {
    await project("bun");
    const calls: Call[] = [];

    const exit = await Effect.runPromiseExit(
      upgradeDependencies(folder, [], "4.0.520", lines, runner(calls))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe("installDependencies", () => {
  it("still runs a plain install, in the lockfile's own directory", async () => {
    await project("npm");
    const calls: Call[] = [];

    await Effect.runPromise(installDependencies(folder, lines, runner(calls)));

    expect(calls).toEqual([
      { args: ["install"], binary: "/bin/manager", cwd: folder },
    ]);
  });
});

interface Held {
  readonly children: EventEmitter[];
  readonly runner: Runner;
  readonly stdout: PassThrough[];
}

// A child that does not exit until the test says so, with a real stdout.
function held(calls: Call[]): Held {
  const children: EventEmitter[] = [];
  const stdout: PassThrough[] = [];

  const fake: Spawner = (binary, args, options) => {
    calls.push({ args: [...args], binary, cwd: options.cwd });
    const out = new PassThrough();
    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      kill: () => true,
      signalCode: null,
      stderr: null,
      stdout: out,
    });
    children.push(child);
    stdout.push(out);
    return child as unknown as ReturnType<Spawner>;
  };

  return {
    children,
    runner: { binary: () => "/bin/manager", spawn: fake },
    stdout,
  };
}

function settle() {
  return new Promise<void>((resolve) => setTimeout(resolve, 20));
}

// Three methods shell out to the project's package manager and `dispatch`
// forks every request, so two of them genuinely ran at once in one folder —
// and bun's linker is not safe against itself there.
describe("one package-manager run at a time per project", () => {
  it("queues a second install until the first has exited", async () => {
    await project("bun");
    const calls: Call[] = [];
    const lane = held(calls);

    const first = Effect.runFork(
      installDependencies(folder, lines, lane.runner)
    );
    const second = Effect.runFork(
      installDependencies(folder, lines, lane.runner)
    );
    await settle();

    expect(calls).toHaveLength(1);

    lane.children[0]?.emit("exit", 0, null);
    await settle();

    expect(calls).toHaveLength(2);

    lane.children[1]?.emit("exit", 0, null);
    await Effect.runPromise(Fiber.join(first));
    await Effect.runPromise(Fiber.join(second));
  });

  it("queues an upgrade behind an install in the same project", async () => {
    await project("bun");
    const calls: Call[] = [];
    const lane = held(calls);

    const install = Effect.runFork(
      installDependencies(folder, lines, lane.runner)
    );
    const upgrade = Effect.runFork(
      upgradeDependencies(folder, REMOTION, "4.0.520", lines, lane.runner)
    );
    await settle();

    expect(calls.map((call) => call.args[0])).toEqual(["install"]);

    lane.children[0]?.emit("exit", 0, null);
    await settle();

    expect(calls.map((call) => call.args[0])).toEqual(["install", "add"]);

    lane.children[1]?.emit("exit", 0, null);
    await Effect.runPromise(Fiber.join(install));
    await Effect.runPromise(Fiber.join(upgrade));
  });

  // bun printed the failure, then "Saved lockfile" and the whole package list,
  // and exited 0 — an install that looked fine to everyone watching it.
  it("fails an install whose output reports an error despite exit 0", async () => {
    await project("bun");
    const calls: Call[] = [];
    const lane = held(calls);

    const fiber = Effect.runFork(
      installDependencies(folder, lines, lane.runner)
    );
    await settle();

    lane.stdout[0]?.write("Resolved, downloaded and extracted [0]\n");
    lane.stdout[0]?.write("error: Failed to link @babel/parser: EEXIST\n");
    lane.stdout[0]?.write("Saved lockfile\n");
    await settle();
    lane.children[0]?.emit("exit", 0, null);

    const exit = await Effect.runPromiseExit(Fiber.join(fiber));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain(
        "Failed to link @babel/parser"
      );
      expect(causeMessage(exit.cause)).toContain("exited 0");
    }
  });
});
