// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  accountRow,
  checksFor,
  dependencyRow,
  driftFrom,
  entryRow,
  manifestOf,
  missingFrom,
  remotionRow,
  runtimeRow,
  unreachableRow,
} from "./environment";

let folder = "";

beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "remocn-env-"));
});

afterEach(async () => {
  await rm(folder, { force: true, recursive: true });
});

const write = (file: string, body: unknown) =>
  writeFile(path.join(folder, file), JSON.stringify(body));

describe("accountRow", () => {
  it("reads a logged-out CLI off tokenSource, which is the only signal it sends", () => {
    const check = accountRow({
      apiProvider: "firstParty",
      tokenSource: "none",
    });

    expect(check.state).toBe("failed");
    expect(check.fix).toEqual({ command: "claude", type: "command" });
  });

  it("passes a logged-in account and shows the subscription", () => {
    const check = accountRow({
      apiProvider: "firstParty",
      email: "someone@example.com",
      subscriptionType: "Claude Max",
    });

    expect(check.state).toBe("ok");
    expect(check.detail).toBe("Claude Max");
  });

  it("treats a third-party provider as authenticated elsewhere", () => {
    const check = accountRow({ apiProvider: "bedrock" });

    expect(check.state).toBe("ok");
    expect(check.detail).toContain("bedrock");
  });

  it("keeps a CLI that would not start distinct from one that is logged out", () => {
    const check = unreachableRow("spawn failed");

    expect(check.state).toBe("failed");
    expect(check.title).not.toBe(accountRow({ tokenSource: "none" }).title);
  });
});

describe("runtimeRow", () => {
  it("reports the bun the sidecar is running on", () => {
    expect(runtimeRow("1.3.2")).toMatchObject({
      detail: "bun 1.3.2",
      state: "ok",
    });
  });

  it("warns when the sidecar is not on bun at all", () => {
    expect(runtimeRow(undefined).state).toBe("warn");
  });
});

describe("manifestOf", () => {
  it("is null when there is no package.json", async () => {
    expect(await Effect.runPromise(manifestOf(folder))).toBeNull();
  });

  it("is null when package.json does not parse", async () => {
    await writeFile(path.join(folder, "package.json"), "{ not json");

    expect(await Effect.runPromise(manifestOf(folder))).toBeNull();
  });

  it("collects every dependency field and picks out remotion", async () => {
    await write("package.json", {
      dependencies: { react: "19.2.8", remotion: "4.0.360" },
      devDependencies: { typescript: "5" },
    });

    const manifest = await Effect.runPromise(manifestOf(folder));

    expect(manifest?.remotion).toBe("4.0.360");
    expect([...(manifest?.dependencies ?? [])].sort()).toEqual([
      "react",
      "remotion",
      "typescript",
    ]);
  });
});

describe("remotionRow", () => {
  it("explains a folder with no package.json", () => {
    const check = remotionRow(folder, null);

    expect(check.state).toBe("failed");
    expect(check.title).toBe("This folder is not a Remotion project");
  });

  it("explains a package.json that does not depend on remotion", () => {
    const check = remotionRow(folder, {
      dependencies: ["react"],
      remotion: null,
    });

    expect(check.state).toBe("failed");
    expect(check.detail).toContain("package.json");
  });

  it("passes a real Remotion project", () => {
    const check = remotionRow(folder, {
      dependencies: ["remotion"],
      remotion: "4.0.360",
    });

    expect(check.state).toBe("ok");
  });
});

describe("missingFrom", () => {
  const install = async (where: string, name: string) => {
    await mkdir(path.join(where, "node_modules", name), { recursive: true });
    await writeFile(
      path.join(where, "node_modules", name, "package.json"),
      JSON.stringify({ name, version: "1.0.0" })
    );
  };

  it("names what is not in node_modules", () => {
    expect([...missingFrom(folder, ["remotion", "react"])].sort()).toEqual([
      "react",
      "remotion",
    ]);
  });

  it("counts a package that is actually there", async () => {
    await install(folder, "remotion");

    expect(missingFrom(folder, ["remotion"])).toEqual([]);
  });

  it("handles a scoped name", async () => {
    await install(folder, "@remotion/bundler");

    expect(missingFrom(folder, ["@remotion/bundler"])).toEqual([]);
  });

  it("accepts a copy hoisted to a workspace root above the project", async () => {
    const workspace = path.join(folder, "packages/video");
    await mkdir(workspace, { recursive: true });
    await install(folder, "remotion");

    expect(missingFrom(workspace, ["remotion"])).toEqual([]);
  });

  it("does not count a package only a sibling cache can resolve, the way bun's global cache does", async () => {
    await install(path.join(folder, "cache"), "typescript");

    expect(missingFrom(folder, ["typescript"])).toEqual(["typescript"]);
  });

  it("does not count a folder with no package.json in it", async () => {
    await mkdir(path.join(folder, "node_modules/hollow"), { recursive: true });

    expect(missingFrom(folder, ["hollow"])).toEqual(["hollow"]);
  });
});

describe("dependencyRow", () => {
  it("offers the install button and counts what is missing", () => {
    const check = dependencyRow(["a", "b"], 10, null);

    expect(check.state).toBe("failed");
    expect(check.fix).toEqual({ type: "install" });
    expect(check.detail).toContain("2 of 10");
  });

  it("names at most four and says how many more", () => {
    const check = dependencyRow(["a", "b", "c", "d", "e", "f"], 6, null);

    expect(check.detail).toContain("and 2 more");
  });

  it("warns rather than fails when only the lockfile drifted", () => {
    const check = dependencyRow([], 10, "lockfile had changes");

    expect(check.state).toBe("warn");
    expect(check.fix).toEqual({ type: "install" });
  });

  it("passes when everything resolves and nothing drifted", () => {
    expect(dependencyRow([], 10, null).state).toBe("ok");
  });
});

describe("driftFrom", () => {
  it("is silent when bun is happy", () => {
    expect(driftFrom(0, "bun install v1.3.2")).toBeNull();
  });

  it("reports a frozen lockfile that had changes", () => {
    const drift = driftFrom(
      1,
      "bun install v1.3.2\nerror: lockfile had changes, but lockfile is frozen\n"
    );

    expect(drift).toContain("lockfile had changes");
  });

  it("does not accuse the lockfile when bun failed for another reason", () => {
    expect(
      driftFrom(1, "error: failed to resolve nanoid@5.0.9 (network error)")
    ).toBeNull();
  });

  it("does not accuse the lockfile when bun said nothing at all", () => {
    expect(driftFrom(1, "")).toBeNull();
  });
});

describe("checksFor", () => {
  const account = accountRow({ subscriptionType: "Claude Max" });

  const idsOf = async () => {
    const checks = await Effect.runPromise(checksFor(folder, account));
    return checks.map((check) => check.id);
  };

  it("says a folder is not a Remotion project once, not three times", async () => {
    expect(await idsOf()).toEqual([
      "claude",
      "runtime",
      "remotion",
      "compositions",
    ]);
  });

  it("still checks dependencies of a JS project that is not Remotion", async () => {
    await write("package.json", { dependencies: { react: "19.2.8" } });

    expect(await idsOf()).toEqual([
      "claude",
      "runtime",
      "remotion",
      "dependencies",
      "compositions",
    ]);
  });

  it("asks for an entry point only once remotion is declared", async () => {
    await write("package.json", { dependencies: { remotion: "4.0.360" } });

    expect(await idsOf()).toContain("entry");
  });

  it("passes the account row through untouched", async () => {
    const checks = await Effect.runPromise(checksFor(folder, account));

    expect(checks[0]).toBe(account);
  });
});

describe("entryRow", () => {
  it("shows the entry relative to the Remotion root", () => {
    const check = entryRow(folder, path.join(folder, "src/index.ts"), "");

    expect(check).toMatchObject({ detail: "src/index.ts", state: "ok" });
  });

  it("carries the reason there is none", () => {
    const check = entryRow(folder, null, "no Remotion entry point");

    expect(check.state).toBe("failed");
    expect(check.detail).toBe("no Remotion entry point");
  });
});
