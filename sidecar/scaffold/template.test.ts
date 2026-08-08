// @vitest-environment node
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { beforeAll, describe, expect, it } from "vitest";
import { causeMessage } from "@/lib/error-message";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import {
  expandTemplate,
  packageName,
  sized,
} from "@/sidecar/scaffold/template";

const TEMPLATE = join(process.cwd(), "templates", "remotion");
const COMPOSITION = /<Composition/g;
const LANDSCAPE = { height: 1080, width: 1920 };
const VERTICAL = { height: 1920, width: 1080 };

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

  it("declares its dimensions as literals the wizard can rewrite", async () => {
    const root = await readFile(join(TEMPLATE, "src", "Root.tsx"), "utf8");

    expect(sized(root, VERTICAL)).toContain("width={1080}");
    expect(sized(root, VERTICAL)).toContain("height={1920}");
  });
});

describe("sized", () => {
  it("says which file drifted rather than silently keeping the old size", () => {
    expect(() => sized('<Composition id="Main" />', LANDSCAPE)).toThrow(
      "Root.tsx"
    );
  });
});

describe("expandTemplate", () => {
  beforeAll(() => {
    process.env[TEMPLATE_DIR_ENV] = TEMPLATE;
  });

  it("writes the template into a folder that does not exist yet", async () => {
    const target = await folder("launch-film");

    await run(expandTemplate(target, LANDSCAPE));

    const manifest = JSON.parse(
      await readFile(join(target, "package.json"), "utf8")
    ) as { dependencies: Record<string, string>; name: string };

    expect(manifest.name).toBe("launch-film");
    expect(manifest.dependencies.remotion).toBeDefined();
    expect(await readFile(join(target, "src", "Root.tsx"), "utf8")).toContain(
      'id="Main"'
    );
  });

  it("writes the chosen dimensions into the one composition", async () => {
    const target = await folder("reel");

    await run(expandTemplate(target, VERTICAL));

    const root = await readFile(join(target, "src", "Root.tsx"), "utf8");

    expect(root).toContain("width={1080}");
    expect(root).toContain("height={1920}");
    expect(root.match(COMPOSITION)).toHaveLength(1);
  });

  it("leaves a file that is already there alone", async () => {
    const target = await folder("promo");

    await run(expandTemplate(target, LANDSCAPE));
    await writeFile(join(target, "src", "Main.tsx"), "// mine\n", "utf8");
    await run(expandTemplate(target, VERTICAL));

    expect(await readFile(join(target, "src", "Main.tsx"), "utf8")).toBe(
      "// mine\n"
    );
    expect(await readFile(join(target, "src", "Root.tsx"), "utf8")).toContain(
      "width={1920}"
    );
  });

  it("says so rather than half-copying when there is no template", async () => {
    const kept = process.env[TEMPLATE_DIR_ENV] ?? TEMPLATE;
    Reflect.deleteProperty(process.env, TEMPLATE_DIR_ENV);

    const exit = await Effect.runPromiseExit(
      expandTemplate(await folder("nowhere"), LANDSCAPE)
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
