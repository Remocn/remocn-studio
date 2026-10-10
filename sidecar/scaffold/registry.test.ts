import { beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { causeMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import {
  ensureRegistry,
  importOf,
  REGISTRY_FILE,
  wrapped,
} from "@/sidecar/scaffold/registry";

const TEMPLATE = join(process.cwd(), "templates", "remotion");
const SPECIFIER = "./videos/registry";

const CANONICAL = `import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
`;

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

async function project(entry = CANONICAL) {
  const root = await mkdtemp(join(tmpdir(), "remocn-registry-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "package.json"), "{}\n", "utf8");
  await writeFile(join(root, "src", "index.ts"), entry, "utf8");
  await writeFile(
    join(root, "src", "Root.tsx"),
    "export function Root() {\n  return null;\n}\n",
    "utf8"
  );
  return root;
}

describe("wrapped", () => {
  it("splices the scan into a canonical entry point", () => {
    const after = wrapped(CANONICAL, SPECIFIER);

    expect(after).toContain(`import { withVideos } from "${SPECIFIER}";`);
    expect(after).toContain("registerRoot(withVideos(Root));");
    expect(after).toContain('import { Root } from "./Root";');
  });

  it("answers null when the entry already registers the scan", () => {
    const once = wrapped(CANONICAL, SPECIFIER) ?? "";

    expect(wrapped(once, SPECIFIER)).toBeNull();
  });

  it("keeps whatever else the entry does", () => {
    const after = wrapped(
      `import "./styles.css";\n${CANONICAL}enableSomething();\n`,
      SPECIFIER
    );

    expect(after).toContain('import "./styles.css";');
    expect(after).toContain("enableSomething();");
  });

  // The entry point is the person's file: a half-understood edit to it would
  // break every composition in the project, not only the studio's videos.
  it("refuses a shape it cannot read rather than guessing", () => {
    expect(() =>
      wrapped(
        'import { registerRoot } from "remotion";\nregisterRoot(() => <Thing />);\n',
        SPECIFIER
      )
    ).toThrow("registerRoot(Root)");
  });

  it("refuses an entry with no imports to anchor to", () => {
    expect(() => wrapped("registerRoot(Root);\n", SPECIFIER)).toThrow(
      "entry point"
    );
  });
});

describe("importOf", () => {
  it("writes a relative specifier without the extension", () => {
    expect(importOf("/p/src/index.ts", `/p/src/videos/${REGISTRY_FILE}`)).toBe(
      "./videos/registry"
    );
  });

  it("climbs out when the entry is not under src", () => {
    expect(
      importOf("/p/remotion/index.ts", `/p/src/videos/${REGISTRY_FILE}`)
    ).toBe("../src/videos/registry");
  });
});

describe("ensureRegistry", () => {
  beforeAll(() => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
  });

  it("places the scan and splices it into a project it never scaffolded", async () => {
    const root = await project();

    const answer = await run(ensureRegistry(root));

    expect(answer.wrapped).toBe(true);
    expect(answer.entry).toBe(join(root, "src", "index.ts"));

    const registry = await readFile(
      join(root, "src", "videos", REGISTRY_FILE),
      "utf8"
    );
    expect(registry).toContain("require.context");

    const entry = await readFile(answer.entry, "utf8");
    expect(entry).toContain('from "./videos/registry"');
    expect(entry).toContain("registerRoot(withVideos(Root));");
  });

  it("never touches the project's own Root", async () => {
    const root = await project();
    const before = await readFile(join(root, "src", "Root.tsx"), "utf8");

    await run(ensureRegistry(root));

    expect(await readFile(join(root, "src", "Root.tsx"), "utf8")).toBe(before);
  });

  it("installs motion foundations in an existing project and preserves authored copies", async () => {
    const root = await project();
    const objects = join(root, "src/lib/studio-objects-v1/index.tsx");
    const curves = join(root, "src/lib/studio-objects-v2/index.tsx");
    const timing = join(root, "src/lib/studio-motion-v1/timing.ts");
    await run(ensureRegistry(root));
    expect(await readFile(objects, "utf8")).toContain("useStudioObject");
    expect(await readFile(curves, "utf8")).toContain("easing:");
    await writeFile(objects, "// authored objects v1");
    await run(ensureRegistry(root));
    expect(await readFile(objects, "utf8")).toBe("// authored objects v1");
    expect(await readFile(timing, "utf8")).toBe(
      await readFile(
        join(TEMPLATE, "src/lib/studio-motion-v1/timing.ts"),
        "utf8"
      )
    );
    await writeFile(timing, "// authored motion\n");
    await run(ensureRegistry(root));
    expect(await readFile(timing, "utf8")).toBe("// authored motion\n");
  });

  it("installs v6 beside authored v1 to v5 without overwriting them", async () => {
    const root = await project();
    const v5 = join(root, "src/lib/studio-objects-v5/index.tsx");
    await mkdir(join(root, "src/lib/studio-objects-v5"), { recursive: true });
    await writeFile(v5, "// authored v5\n");
    await run(ensureRegistry(root));
    expect(await readFile(v5, "utf8")).toBe("// authored v5\n");
    expect(
      await readFile(join(root, "src/lib/studio-objects-v6/index.tsx"), "utf8")
    ).toBe(
      await readFile(
        join(TEMPLATE, "src/lib/studio-objects-v6/index.tsx"),
        "utf8"
      )
    );
    expect(
      await readFile(join(root, "src/lib/studio-objects-v6/between.ts"), "utf8")
    ).toContain("studio-objects-v5/between");
  });

  it("is safe to run twice", async () => {
    const root = await project();

    await run(ensureRegistry(root));
    const once = await readFile(join(root, "src", "index.ts"), "utf8");
    const again = await run(ensureRegistry(root));

    expect(again.wrapped).toBe(false);
    expect(await readFile(join(root, "src", "index.ts"), "utf8")).toBe(once);
  });

  it("installs v2 alongside an authored v1 and preserves authored v2 on reopen", async () => {
    const root = await project();
    await run(ensureRegistry(root));
    const v1 = join(root, "src/lib/studio-motion-v1/timing.ts");
    const v2 = join(root, "src/lib/studio-motion-v2/timing.ts");
    const shipped = await readFile(
      join(TEMPLATE, "src/lib/studio-motion-v2/timing.ts"),
      "utf8"
    );
    expect(await readFile(v2, "utf8")).toBe(shipped);
    await writeFile(v1, "// authored v1\n");
    await writeFile(v2, "// authored v2\n");
    await run(ensureRegistry(root));
    expect(await readFile(v1, "utf8")).toBe("// authored v1\n");
    expect(await readFile(v2, "utf8")).toBe("// authored v2\n");
  });

  it("installs v7 alongside old contexts and preserves authored v7 resources on reopen", async () => {
    const root = await project();
    await run(ensureRegistry(root));
    const path = join(root, "src/lib/studio-objects-v7/shaders.tsx");
    expect(await readFile(path, "utf8")).toContain("StudioShaderSlot");
    await writeFile(path, "authored runtime");
    await run(ensureRegistry(root));
    expect(await readFile(path, "utf8")).toBe("authored runtime");
  });

  it("leaves a registry the project already has alone", async () => {
    const root = await project();
    await mkdir(join(root, "src", "videos"), { recursive: true });
    await writeFile(
      join(root, "src", "videos", REGISTRY_FILE),
      "// mine\n",
      "utf8"
    );

    await run(ensureRegistry(root));

    expect(
      await readFile(join(root, "src", "videos", REGISTRY_FILE), "utf8")
    ).toBe("// mine\n");
  });

  it("repairs the old shipped wrapper type without replacing authored registries", async () => {
    const root = await project();
    const shipped = await readFile(join(TEMPLATE, "registry.tsx"), "utf8");
    const old = shipped.replace(
      "withVideos(Root: ComponentType) {",
      "withVideos(Root: ComponentType): ComponentType {"
    );
    const path = join(root, "src", "videos", REGISTRY_FILE);
    await mkdir(join(root, "src", "videos"), { recursive: true });
    await writeFile(path, old);
    await run(ensureRegistry(root));
    expect(await readFile(path, "utf8")).toBe(shipped);
    await writeFile(path, `${old}\n// authored addition\n`);
    await run(ensureRegistry(root));
    expect(await readFile(path, "utf8")).toBe(`${old}\n// authored addition\n`);
  });

  it("says which entry it could not read rather than rewriting it", async () => {
    const root = await project(
      'import { registerRoot } from "remotion";\nregisterRoot(() => null);\n'
    );

    const exit = await Effect.runPromiseExit(ensureRegistry(root));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain("registerRoot(Root)");
    }
  });
});
