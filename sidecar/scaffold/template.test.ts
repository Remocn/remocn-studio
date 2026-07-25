// @vitest-environment node
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { beforeAll, describe, expect, it } from "vitest";
import { causeMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { expandTemplate, packageName } from "@/sidecar/scaffold/template";

const TEMPLATE = join(process.cwd(), "templates", "remotion");
const COMPOSITION = /<Composition/g;

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

async function folder(name: string) {
  const parent = await mkdtemp(join(tmpdir(), "remocn-template-"));
  const target = join(parent, name);
  return target;
}

describe("the vendored template", () => {
  it("declares exactly one composition, called Main", async () => {
    const root = await readFile(join(TEMPLATE, "src", "Root.tsx"), "utf8");

    expect(root.match(COMPOSITION)).toHaveLength(1);
    expect(root).toContain('id="Main"');
  });

  it("registers a root from an entry point the preview looks for", async () => {
    const entry = await readFile(join(TEMPLATE, "src", "index.ts"), "utf8");

    expect(entry).toContain("registerRoot");
  });
});

describe("expandTemplate", () => {
  beforeAll(() => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
  });

  it("writes the template into a folder that does not exist yet", async () => {
    const target = await folder("launch-film");

    await run(expandTemplate(target));

    const manifest = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as { dependencies: Record<string, string>; name: string };

    expect(manifest.name).toBe("launch-film");
    expect(manifest.dependencies.remotion).toBeDefined();
    expect(await readFile(join(target, "src", "Root.tsx"), "utf8")).toContain(
      'id="Main"'
    );
  });

  it("leaves a file that is already there alone", async () => {
    const target = await folder("promo");

    await run(expandTemplate(target));
    await writeFile(join(target, "src", "Main.tsx"), "// mine\n", "utf8");
    await run(expandTemplate(target));

    expect(await readFile(join(target, "src", "Main.tsx"), "utf8")).toBe(
      "// mine\n"
    );
  });

  it("says so rather than half-copying when there is no template", async () => {
    const kept = process.env[TEMPLATE_DIR_ENV] ?? TEMPLATE;
    Reflect.deleteProperty(process.env, TEMPLATE_DIR_ENV);

    const exit = await Effect.runPromiseExit(
      expandTemplate(await folder("nowhere"))
    );
    process.env[TEMPLATE_DIR_ENV] = kept;

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeMessage(exit.cause)).toContain(TEMPLATE_DIR_ENV);
    }
  });
});

describe("packageName", () => {
  it("turns a folder name into something npm accepts", () => {
    expect(packageName("/videos/Launch Film")).toBe("launch-film");
    expect(packageName("/videos/-- promo --")).toBe("promo");
    expect(packageName("/videos/漢字")).toBe("remotion-project");
  });
});
