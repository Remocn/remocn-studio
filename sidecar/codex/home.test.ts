// @vitest-environment node
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DATA_DIR_ENV } from "@/shared/ipc";
import {
  BUNDLE_NAME,
  type KnowledgeBundle,
  noBundle,
} from "@/sidecar/agent/knowledge";
import { codexHome } from "@/sidecar/codex/home";

const PLUGIN = join(process.cwd(), "agent");

const attached: KnowledgeBundle = {
  collisions: [],
  loaded: true,
  path: PLUGIN,
  reason: null,
  source: "plugin-dir",
};

let real = "";
let data = "";

async function userHome(config: string | null): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "remocn-codex-home-"));

  await writeFile(join(home, "auth.json"), '{"tokens":{}}');
  await mkdir(join(home, "sessions"), { recursive: true });
  await mkdir(join(home, "plugins", "cache", "openai-curated"), {
    recursive: true,
  });
  if (config !== null) {
    await writeFile(join(home, "config.toml"), config);
  }

  return home;
}

beforeEach(async () => {
  real = await userHome('model = "gpt-5.6"\n');
  data = await mkdtemp(join(tmpdir(), "remocn-codex-data-"));
  process.env.CODEX_HOME = real;
  process.env[DATA_DIR_ENV] = data;
});

afterEach(() => {
  Reflect.deleteProperty(process.env, "CODEX_HOME");
  Reflect.deleteProperty(process.env, DATA_DIR_ENV);
});

describe("codexHome", () => {
  it("leaves the home alone when there is no bundle to deliver", () => {
    expect(codexHome(noBundle("nothing shipped"))).toEqual({
      home: null,
      knowledge: noBundle("nothing shipped"),
    });
  });

  it("hands back a home of the studio's own, under its data directory", () => {
    const prepared = codexHome(attached);

    expect(prepared.home).toBe(join(data, "codex-home"));
    expect(prepared.knowledge.loaded).toBe(true);
    expect(prepared.knowledge.source).toBe("codex-home");
  });

  it("shares the login rather than copying it", () => {
    const home = codexHome(attached).home as string;

    expect(lstatSync(join(home, "auth.json")).isSymbolicLink()).toBe(true);
    expect(existsSync(join(home, "sessions"))).toBe(true);
    expect(lstatSync(join(home, "sessions")).isSymbolicLink()).toBe(true);
  });

  it("never writes to the user's own config", () => {
    codexHome(attached);

    expect(readFileSync(join(real, "config.toml"), "utf8")).toBe(
      'model = "gpt-5.6"\n'
    );
  });

  it("registers the bundle in a config of its own, keeping what the user set", () => {
    const home = codexHome(attached).home as string;
    const config = readFileSync(join(home, "config.toml"), "utf8");

    expect(lstatSync(join(home, "config.toml")).isSymbolicLink()).toBe(false);
    expect(config).toContain('model = "gpt-5.6"');
    expect(config).toContain(`[marketplaces.${BUNDLE_NAME}]`);
    expect(config).toContain(`source = "${PLUGIN}"`);
    expect(config).toContain(`[plugins."${BUNDLE_NAME}@${BUNDLE_NAME}"]`);
  });

  it("materialises the bundle where the plugin store looks for it", () => {
    const home = codexHome(attached).home as string;
    const version = JSON.parse(
      readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")
    ).version as string;
    const root = join(
      home,
      "plugins",
      "cache",
      BUNDLE_NAME,
      BUNDLE_NAME,
      version
    );

    expect(existsSync(join(root, "skills", "motion-design", "SKILL.md"))).toBe(
      true
    );
    expect(lstatSync(root).isSymbolicLink()).toBe(false);
  });

  it("keeps the plugins the user installed themselves", () => {
    const home = codexHome(attached).home as string;

    expect(existsSync(join(home, "plugins", "cache", "openai-curated"))).toBe(
      true
    );
  });

  it("does not touch a home whose config already registers the bundle", async () => {
    const own = `[marketplaces.${BUNDLE_NAME}]\nsource_type = "local"\nsource = "/elsewhere"\n`;
    real = await userHome(own);
    process.env.CODEX_HOME = real;

    const home = codexHome(attached).home as string;

    expect(readFileSync(join(home, "config.toml"), "utf8")).toBe(own);
  });

  it("degrades to a reason, not a failure, when the login cannot be shared", async () => {
    real = await mkdtemp(join(tmpdir(), "remocn-codex-noauth-"));
    process.env.CODEX_HOME = real;

    const prepared = codexHome(attached);

    expect(prepared.home).toBeNull();
    expect(prepared.knowledge.loaded).toBe(false);
    expect(prepared.knowledge.reason).toContain("login");
  });
});
