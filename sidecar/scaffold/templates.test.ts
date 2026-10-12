import { beforeAll, describe, expect, it } from "bun:test";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Effect, Exit } from "effect";
import { causeMessage } from "@/lib/error-message";
import { version } from "@/package.json";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { PROJECT_TEMPLATES } from "@/shared/templates";
import { ensureRegistry } from "@/sidecar/scaffold/registry";
import { expandTemplate } from "@/sidecar/scaffold/template";
import {
  expandTemplateVideo,
  mintFolder,
  stamped,
  TEMPLATE_SPECS,
  VIDEO_TEMPLATES,
  withDependencies,
} from "@/sidecar/scaffold/templates";

const TEMPLATE = join(process.cwd(), "templates", "remotion");
const PROPS = {
  joinedAt: "2026-07-08T00:00:00.000Z",
  launchedAt: "2026-09-06T00:00:00.000Z",
  memberNumber: 128,
  name: "Zoë Álvarez",
  period: "year" as const,
  purchasedAt: "2026-09-06T00:00:00.000Z",
};

const byName = (a: string, b: string) => a.localeCompare(b);

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

async function scratch() {
  return await mkdtemp(join(tmpdir(), "remocn-welcome-"));
}

async function scaffolded(target: string) {
  await run(expandTemplate(target));
  await run(ensureRegistry(target));
}

describe("the welcome template", () => {
  beforeAll(() => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
  });

  it("ships a folder for every template the link can name", async () => {
    const folders = await readdir(join(TEMPLATE, VIDEO_TEMPLATES));

    expect(folders.toSorted(byName)).toEqual(
      PROJECT_TEMPLATES.map(
        (template) => TEMPLATE_SPECS[template].folder
      ).toSorted(byName)
    );
  });

  it("carries the composition, its schema and the remocn components it uses, as files", async () => {
    const folder = join(TEMPLATE, VIDEO_TEMPLATES, "welcome-early-member");
    const remocn = await readdir(join(folder, "components", "remocn"));

    expect(await readdir(folder)).toEqual(
      expect.arrayContaining([
        "index.tsx",
        "logo.ts",
        "schema.ts",
        "welcome-early-member.tsx",
      ])
    );
    expect(remocn.toSorted(byName)).toEqual([
      "backdrop.tsx",
      "kinetic-center-build.tsx",
      "number-wheel.tsx",
      "per-character-rise.tsx",
      "staggered-fade-up.tsx",
    ]);
  });

  it("names where the original lives, since the two are synced by hand", async () => {
    const copy = await readFile(
      join(
        TEMPLATE,
        VIDEO_TEMPLATES,
        "welcome-early-member",
        "welcome-early-member.tsx"
      ),
      "utf8"
    );

    expect(copy).toContain(
      "remocn-studio-landing/remotion/welcome-early-member"
    );
    expect(copy).not.toContain('from "@/');
  });

  it("is stamped with the props as the composition's defaultProps", async () => {
    const target = join(await scratch(), "Welcome — Zoë");
    await scaffolded(target);

    const slug = await run(
      expandTemplateVideo(target, "welcome-early-member", PROPS)
    );
    const originPath = join(
      target,
      "src",
      "videos",
      slug,
      "studio-origin.json"
    );
    expect(
      JSON.parse(await readFile(originPath, "utf8")).createdWithStudioVersion
    ).toBe(process.env.REMOCN_STUDIO_VERSION ?? version);
    const original = JSON.stringify({
      createdWithStudioVersion: "0.8.0",
      version: 1,
    });
    await writeFile(originPath, original);
    await run(expandTemplateVideo(target, "welcome-early-member", PROPS));
    expect(await readFile(originPath, "utf8")).toBe(original);
    await rm(originPath);
    await run(expandTemplateVideo(target, "welcome-early-member", PROPS));
    await expect(readFile(originPath)).rejects.toThrow();
    const module = await readFile(
      join(target, "src", "videos", slug, "index.tsx"),
      "utf8"
    );

    expect(slug).toBe("welcome-early-member");
    expect(module).toContain('"name": "Zoë Álvarez"');
    expect(module).toContain('"memberNumber": 128');
    expect(module).toContain("export const defaultProps");
    expect(module).toContain("export const schema");
    expect(module).not.toContain("__TEMPLATE_PROPS__");
  });

  it("adds the pins the composition needs, at the template's own Remotion version", async () => {
    const target = join(await scratch(), "Welcome — Zoë");
    await scaffolded(target);
    await run(expandTemplateVideo(target, "welcome-early-member", PROPS));

    const manifest = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };

    expect(manifest.dependencies["@remotion/google-fonts"]).toBe(
      manifest.dependencies.remotion
    );
    expect(
      manifest.dependencies["@paper-design/shaders-react"]
    ).toBeUndefined();
    expect(manifest.dependencies.zod).toBeDefined();
  });

  it("is registered by the scan, which forwards its props and schema", async () => {
    const target = join(await scratch(), "Welcome — Zoë");
    await scaffolded(target);

    const registry = await readFile(
      join(target, "src", "videos", "registry.tsx"),
      "utf8"
    );

    expect(registry).toContain("defaultProps={video.defaultProps}");
    expect(registry).toContain("schema={video.schema}");
  });

  it("refuses to stamp a module that lost its slot", () => {
    expect(() =>
      stamped("export default 1;", PROPS, "welcome-early-member")
    ).toThrow("__TEMPLATE_PROPS__");
  });

  it("fails with a sentence when no template dir is set", async () => {
    const saved = process.env[TEMPLATE_DIR_ENV];
    delete process.env[TEMPLATE_DIR_ENV];

    const exit = await Effect.runPromiseExit(
      expandTemplateVideo(await scratch(), "welcome-early-member", PROPS)
    );

    process.env[TEMPLATE_DIR_ENV] = saved;
    expect(
      Exit.isFailure(exit) ? causeMessage(exit.cause) : "a success"
    ).toContain(TEMPLATE_DIR_ENV);
  });
});

describe("withDependencies", () => {
  it("adds what is missing and never moves a pin the project already has", () => {
    const merged = JSON.parse(
      withDependencies(
        JSON.stringify({
          dependencies: { remotion: "4.0.520", zod: "4.3.6" },
          name: "x",
        }),
        { "@remotion/google-fonts": "4.0.520", zod: "9.9.9" }
      )
    ) as { dependencies: Record<string, string>; name: string };

    expect(merged.name).toBe("x");
    expect(merged.dependencies).toEqual({
      "@remotion/google-fonts": "4.0.520",
      remotion: "4.0.520",
      zod: "4.3.6",
    });
  });
});

describe("mintFolder", () => {
  it("takes the name when it is free, and counts past it when it is not", async () => {
    const parent = join(await scratch(), "projects");

    const first = await mintFolder(parent, "Welcome — Alex");
    const second = await mintFolder(parent, "Welcome — Alex");
    const third = await mintFolder(parent, "Welcome — Alex");

    expect(basename(first)).toBe("Welcome — Alex");
    expect(basename(second)).toBe("Welcome — Alex 2");
    expect(basename(third)).toBe("Welcome — Alex 3");
    expect((await stat(third)).isDirectory()).toBe(true);
  });
});
