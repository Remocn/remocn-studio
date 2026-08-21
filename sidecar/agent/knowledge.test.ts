// @vitest-environment node
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentEvent } from "@/shared/ipc";
import { PLUGIN_DIR_ENV } from "@/shared/ipc";
import {
  announce,
  BUNDLE_NAME,
  bundleVersion,
  CLAUDE_MANIFEST,
  CODEX_MARKETPLACE,
  collisionsIn,
  knowledgeNotice,
  LESSONS_SKILL,
  locateBundle,
  MOTION_SKILL,
  noBundle,
  SHIPPED,
  VENDORED,
} from "@/sidecar/agent/knowledge";

const PLUGIN = join(process.cwd(), "agent");
const NAME = /^name:\s*(\S+)/m;
const SEMVER = /^\d+\.\d+\.\d+/;

async function folder(...skills: string[]): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), "remocn-knowledge-"));

  await Promise.all(
    skills.map((skill) =>
      mkdir(join(target, ".claude", "skills", skill), { recursive: true })
    )
  );

  return target;
}

async function symlinks(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);

      if ((await lstat(path)).isSymbolicLink()) {
        return [path];
      }

      return entry.isDirectory() ? await symlinks(path) : [];
    })
  );

  return nested.flat();
}

async function manifest(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(PLUGIN, path), "utf8")) as Record<
    string,
    unknown
  >;
}

describe("the shipped bundle", () => {
  it("carries a skill folder for every name the sidecar expects", async () => {
    const entries = await readdir(join(PLUGIN, "skills"));

    expect(entries.sort()).toEqual([...SHIPPED].sort());
  });

  it("names each skill the way its folder is named", async () => {
    const names = await Promise.all(
      SHIPPED.map(async (skill) => {
        const source = await readFile(
          join(PLUGIN, "skills", skill, "SKILL.md"),
          "utf8"
        );

        return source.match(NAME)?.[1];
      })
    );

    expect(names).toEqual([...SHIPPED]);
  });

  it("keeps our own skills out of the vendored list, so a sync cannot delete them", () => {
    for (const skill of [LESSONS_SKILL, MOTION_SKILL]) {
      expect(VENDORED).not.toContain(skill);
      expect(SHIPPED).toContain(skill);
    }
  });

  it("holds real files, never symlinks into a store that is not shipped", async () => {
    expect(await symlinks(join(PLUGIN, "skills"))).toEqual([]);
  });
});

describe("the runtime manifests", () => {
  it("declares one plugin, under one name, for Claude, Copilot and Grok", async () => {
    const declared = await manifest(CLAUDE_MANIFEST);

    expect(declared.name).toBe(BUNDLE_NAME);
    expect(typeof declared.version).toBe("string");
  });

  it("declares the same plugin to Codex, from the same directory", async () => {
    const market = (await manifest(CODEX_MARKETPLACE)) as {
      name: string;
      plugins: { name: string; source: string }[];
    };

    expect(market.name).toBe(BUNDLE_NAME);
    expect(market.plugins).toEqual([{ name: BUNDLE_NAME, source: "./" }]);
  });

  it("keeps the Codex manifest out of the directory the other three read", () => {
    expect(CODEX_MARKETPLACE.startsWith(".claude-plugin")).toBe(false);
  });

  it("reads the version the plugin store keys its copy by", () => {
    expect(bundleVersion(PLUGIN)).toMatch(SEMVER);
  });

  it("falls back rather than throwing on a directory with no manifest", () => {
    expect(bundleVersion(join(PLUGIN, "skills"))).toBe("0.0.0");
  });
});

describe("locateBundle", () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, PLUGIN_DIR_ENV);
  });

  it("resolves the shipped bundle, and every skill in it", async () => {
    process.env[PLUGIN_DIR_ENV] = PLUGIN;

    const found = locateBundle(await folder());

    expect(found).toEqual({
      collisions: [],
      loaded: true,
      path: PLUGIN,
      reason: null,
      source: "plugin-dir",
    });
  });

  it("says why when the app shipped none", async () => {
    Reflect.deleteProperty(process.env, PLUGIN_DIR_ENV);

    const found = locateBundle(await folder());

    expect(found.loaded).toBe(false);
    expect(found.source).toBe("none");
    expect(found.reason).toContain("no skills bundle");
  });

  it("says why when the shipped path is not there", async () => {
    process.env[PLUGIN_DIR_ENV] = join(PLUGIN, "does-not-exist");

    expect(locateBundle(await folder()).loaded).toBe(false);
  });

  it("refuses a directory that carries no plugin manifest", async () => {
    const empty = await folder();
    process.env[PLUGIN_DIR_ENV] = empty;

    const found = locateBundle(empty);

    expect(found.loaded).toBe(false);
    expect(found.reason).toContain(CLAUDE_MANIFEST);
  });

  it("refuses a bundle that lost one of the skills it promises, and names it", async () => {
    const broken = await mkdtemp(join(tmpdir(), "remocn-broken-"));
    await mkdir(join(broken, ".claude-plugin"), { recursive: true });
    await writeFile(
      join(broken, CLAUDE_MANIFEST),
      JSON.stringify({ name: BUNDLE_NAME, version: "0.1.0" })
    );
    await Promise.all(
      SHIPPED.map(async (skill) => {
        await mkdir(join(broken, "skills", skill), { recursive: true });
        await writeFile(
          join(broken, "skills", skill, "SKILL.md"),
          "---\n---\n"
        );
      })
    );
    await rm(join(broken, "skills", MOTION_SKILL, "SKILL.md"));
    process.env[PLUGIN_DIR_ENV] = broken;

    const found = locateBundle(broken);

    expect(found.loaded).toBe(false);
    expect(found.reason).toContain(MOTION_SKILL);
  });

  it("still loads the bundle when the project ships one of the same skills", async () => {
    process.env[PLUGIN_DIR_ENV] = PLUGIN;

    const found = locateBundle(await folder("remocn"));

    expect(found.loaded).toBe(true);
    expect(found.collisions).toEqual(["remocn"]);
  });

  it("does not mistake an unrelated project skill for one of ours", async () => {
    process.env[PLUGIN_DIR_ENV] = PLUGIN;

    expect(locateBundle(await folder("pdf", "docx")).collisions).toEqual([]);
  });
});

describe("collisionsIn", () => {
  it("sees a project's own copy of any vendored skill", async () => {
    expect(collisionsIn(await folder("remotion-interactivity"))).toEqual([
      "remotion-interactivity",
    ]);
  });

  it("does not mistake an unrelated skill for one of ours", async () => {
    expect(collisionsIn(await folder("remotion-render"))).toEqual([]);
  });
});

describe("announce", () => {
  const spoken = () => {
    const events: AgentEvent[] = [];
    const lines: string[] = [];

    return {
      emit: (event: AgentEvent) =>
        Effect.sync(() => {
          events.push(event);
        }),
      events,
      lines,
      log: (line: string) =>
        Effect.sync(() => {
          lines.push(line);
        }),
    };
  };

  it("logs the attach and says nothing to the person when it worked", async () => {
    const heard = spoken();

    await Effect.runPromise(
      announce(
        {
          collisions: [],
          loaded: true,
          path: PLUGIN,
          reason: null,
          source: "plugin-dir",
        },
        heard
      )
    );

    expect(heard.events).toEqual([]);
    expect(heard.lines.join("\n")).toContain("plugin-dir");
  });

  it("turns a failed attach into one notice, and never into a failure", async () => {
    const heard = spoken();

    await Effect.runPromise(announce(noBundle("the disk is a lie"), heard));

    expect(heard.events).toEqual([
      {
        message: expect.stringContaining("the disk is a lie"),
        type: "notice",
      },
    ]);
  });

  it("logs a collision without taking the rest of the bundle down", async () => {
    const heard = spoken();

    await Effect.runPromise(
      announce(
        {
          collisions: ["remocn"],
          loaded: true,
          path: PLUGIN,
          reason: null,
          source: "plugin-dir",
        },
        heard
      )
    );

    expect(heard.events).toEqual([]);
    expect(heard.lines.join("\n")).toContain("remocn");
  });
});

describe("knowledgeNotice", () => {
  it("keeps quiet about a bundle that loaded", () => {
    expect(
      knowledgeNotice({
        collisions: [],
        loaded: true,
        path: PLUGIN,
        reason: null,
        source: "codex-home",
      })
    ).toBeNull();
  });

  it("says the turn carries on", () => {
    const notice = knowledgeNotice(noBundle("no bundle here"));

    expect(notice?.type).toBe("notice");
    expect(notice?.type === "notice" && notice.message).toContain(
      "studio conventions alone"
    );
  });
});
