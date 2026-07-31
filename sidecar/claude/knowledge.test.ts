// @vitest-environment node
import { lstat, mkdir, mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PLUGIN_DIR_ENV } from "@/shared/ipc";
import {
  installedIn,
  LESSONS_SKILL,
  pluginsFor,
  SHIPPED,
  VENDORED,
} from "@/sidecar/claude/knowledge";

const PLUGIN = join(process.cwd(), "agent");
const NAME = /^name:\s*(\S+)/m;

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

describe("the vendored plugin", () => {
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

  it("keeps our own skill out of the vendored list, so a sync cannot delete it", () => {
    expect(VENDORED).not.toContain(LESSONS_SKILL);
    expect(SHIPPED).toContain(LESSONS_SKILL);
  });

  it("holds real files, never symlinks into a store that is not shipped", async () => {
    expect(await symlinks(join(PLUGIN, "skills"))).toEqual([]);
  });

  it("declares itself a plugin so the SDK loads its skills", async () => {
    const manifest = JSON.parse(
      await readFile(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")
    ) as { name: string };

    expect(manifest.name).toBe("remocn-studio");
  });
});

describe("pluginsFor", () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, PLUGIN_DIR_ENV);
  });

  it("hands the SDK the bundled plugin", async () => {
    process.env[PLUGIN_DIR_ENV] = PLUGIN;

    expect(pluginsFor(await folder())).toEqual([
      { path: PLUGIN, type: "local" },
    ]);
  });

  it("hands over nothing when the app did not ship one", async () => {
    Reflect.deleteProperty(process.env, PLUGIN_DIR_ENV);

    expect(pluginsFor(await folder())).toEqual([]);
  });

  it("hands over nothing when the bundled path is not there", async () => {
    process.env[PLUGIN_DIR_ENV] = join(PLUGIN, "does-not-exist");

    expect(pluginsFor(await folder())).toEqual([]);
  });

  it("steps aside for a project that installed the skill itself", async () => {
    process.env[PLUGIN_DIR_ENV] = PLUGIN;

    expect(pluginsFor(await folder("remocn"))).toEqual([]);
  });

  it("stays out of the way of skills it does not vendor", async () => {
    process.env[PLUGIN_DIR_ENV] = PLUGIN;

    expect(pluginsFor(await folder("pdf", "docx"))).toEqual([
      { path: PLUGIN, type: "local" },
    ]);
  });
});

describe("installedIn", () => {
  it("sees a project's own copy of any vendored skill", async () => {
    expect(installedIn(await folder("remotion-interactivity"))).toBe(true);
  });

  it("does not mistake an unrelated skill for one of ours", async () => {
    expect(installedIn(await folder("remotion-render"))).toBe(false);
  });
});
