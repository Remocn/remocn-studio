// @vitest-environment node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIBRARY_DIR_ENV, REMOCN_DIR_ENV } from "@/shared/ipc";
import { type AssetDraft, promptAssetOf } from "@/shared/library";
import {
  assetBrief,
  mediaBrief,
  type Placement,
  placeAssets,
  placeMedia,
} from "@/sidecar/library/insert";
import { saveAsset } from "@/sidecar/library/store";

let library = "";
let work = "";
let project = "";

const run = <A>(effect: Effect.Effect<A, unknown>) =>
  Effect.runPromise(effect as Effect.Effect<A, never>);

function source(name: string, content: string): string {
  const path = join(work, name);
  writeFileSync(path, content, "utf8");
  return path;
}

function draft(shape: Partial<AssetDraft> & { files: string[] }): AssetDraft {
  return {
    dependencies: [],
    description: "",
    duration: null,
    name: "Thing",
    preview: null,
    type: "component",
    ...shape,
  };
}

beforeEach(() => {
  library = mkdtempSync(join(tmpdir(), "remocn-library-"));
  work = mkdtempSync(join(tmpdir(), "remocn-work-"));
  project = mkdtempSync(join(tmpdir(), "remocn-project-"));
  process.env[LIBRARY_DIR_ENV] = library;
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ dependencies: { remotion: "4.0.0" }, name: "demo" }),
    "utf8"
  );
});

afterEach(() => {
  process.env[LIBRARY_DIR_ENV] = undefined;
  for (const dir of [library, work, project]) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("placeAssets", () => {
  it("copies a component under src/library and says where it landed", async () => {
    const saved = await run(
      saveAsset(
        draft({
          files: [source("Neon.tsx", "export const Neon = 1;")],
          name: "Neon Title",
        })
      )
    );

    const [placed] = await run(placeAssets(project, [promptAssetOf(saved)]));

    expect(placed?.copied).toEqual(["src/library/neon-title/Neon.tsx"]);
    expect(placed?.skipped).toEqual([]);
    expect(
      readFileSync(join(project, "src/library/neon-title/Neon.tsx"), "utf8")
    ).toBe("export const Neon = 1;");
  });

  it("copies media under public/library", async () => {
    const saved = await run(
      saveAsset(
        draft({
          files: [source("logo.png", "bytes")],
          name: "Logo",
          type: "img",
        })
      )
    );

    const [placed] = await run(placeAssets(project, [promptAssetOf(saved)]));

    expect(placed?.copied).toEqual(["public/library/logo.png"]);
  });

  it("never overwrites what the agent already edited", async () => {
    const saved = await run(
      saveAsset(
        draft({ files: [source("Neon.tsx", "original")], name: "Neon Title" })
      )
    );

    const target = join(project, "src/library/neon-title");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "Neon.tsx"), "edited by the agent", "utf8");

    const [placed] = await run(placeAssets(project, [promptAssetOf(saved)]));

    expect(placed?.copied).toEqual([]);
    expect(placed?.skipped).toEqual(["src/library/neon-title/Neon.tsx"]);
    expect(readFileSync(join(target, "Neon.tsx"), "utf8")).toBe(
      "edited by the agent"
    );
  });

  it("names the packages the project does not have", async () => {
    const saved = await run(
      saveAsset(
        draft({
          dependencies: ["three", "remotion"],
          files: [source("Neon.tsx", "x")],
          name: "Neon Title",
        })
      )
    );

    mkdirSync(join(project, "node_modules/remotion"), { recursive: true });
    writeFileSync(
      join(project, "node_modules/remotion/package.json"),
      "{}",
      "utf8"
    );

    const [placed] = await run(placeAssets(project, [promptAssetOf(saved)]));

    expect(placed?.missing).toEqual(["three"]);
  });

  it("says so rather than failing when the asset was deleted meanwhile", async () => {
    const [placed] = await run(
      placeAssets(project, [
        { name: "Gone", preview: null, slug: "gone", type: "component" },
      ])
    );

    expect(placed?.reason).toContain("no longer in the library");
    expect(placed?.copied).toEqual([]);
  });
});

describe("placeMedia", () => {
  it("copies an attached video into public/library and says where", async () => {
    const clip = join(work, "intro.mp4");
    writeFileSync(clip, "frames", "utf8");

    const [placed] = await run(
      placeMedia(project, [
        { mediaType: "video/mp4", name: "intro.mp4", path: clip },
      ])
    );

    expect(placed?.copied).toEqual(["public/library/intro.mp4"]);
    expect(placed?.type).toBe("video");
    expect(
      readFileSync(join(project, "public/library/intro.mp4"), "utf8")
    ).toBe("frames");
  });

  it("leaves a file already in the project untouched", async () => {
    const clip = join(work, "intro.mp4");
    writeFileSync(clip, "new", "utf8");

    mkdirSync(join(project, "public/library"), { recursive: true });
    writeFileSync(join(project, "public/library/intro.mp4"), "old", "utf8");

    const [placed] = await run(
      placeMedia(project, [
        { mediaType: "video/mp4", name: "intro.mp4", path: clip },
      ])
    );

    expect(placed?.skipped).toEqual(["public/library/intro.mp4"]);
    expect(
      readFileSync(join(project, "public/library/intro.mp4"), "utf8")
    ).toBe("old");
  });

  it("calls a sound a sound", async () => {
    const theme = join(work, "theme.wav");
    writeFileSync(theme, "samples", "utf8");

    const [placed] = await run(
      placeMedia(project, [
        { mediaType: "audio/wav", name: "theme.wav", path: theme },
      ])
    );

    expect(placed?.type).toBe("audio");
  });
});

describe("mediaBrief", () => {
  it("says nothing when no media was attached", () => {
    expect(mediaBrief([])).toBeNull();
  });

  it("gives the staticFile path rather than the one on the person's disk", () => {
    const brief = mediaBrief([
      {
        copied: ["public/library/intro.mp4"],
        missing: [],
        name: "intro.mp4",
        reason: null,
        skipped: [],
        type: "video",
      },
    ]);

    expect(brief).toContain('staticFile("library/intro.mp4")');
    expect(brief).toContain("intro.mp4 (video)");
  });
});

describe("assetBrief", () => {
  const placement = (shape: Partial<Placement>): Placement => ({
    copied: [],
    missing: [],
    name: "Neon Title",
    reason: null,
    skipped: [],
    type: "component",
    ...shape,
  });

  it("says nothing at all when no asset was referenced", () => {
    expect(assetBrief([])).toBeNull();
  });

  it("numbers each block against the reference in the message", () => {
    const brief = assetBrief([
      placement({ copied: ["src/library/a/A.tsx"] }),
      placement({
        copied: ["public/library/logo.png"],
        name: "Logo",
        type: "img",
      }),
    ]);

    expect(brief).toContain("[Asset #1] Neon Title");
    expect(brief).toContain("[Asset #2] Logo");
  });

  it("tells the agent how to reference media, not how to import it", () => {
    const brief = assetBrief([
      placement({
        copied: ["public/library/logo.png"],
        name: "Logo",
        type: "img",
      }),
    ]);

    expect(brief).toContain('staticFile("library/logo.png")');
  });

  it("names the untouched files so earlier edits are not rewritten", () => {
    const brief = assetBrief([placement({ skipped: ["src/library/a/A.tsx"] })]);

    expect(brief).toContain("already in the project, untouched");
  });

  it("asks for the missing packages by name", () => {
    const brief = assetBrief([placement({ missing: ["three"] })]);

    expect(brief).toContain("not installed yet: three");
    expect(brief).toContain("bun add");
  });
});

describe("placeAssets with a bundled component", () => {
  let vendor = "";

  const vendored = (
    name: string,
    manifest: Record<string, unknown>,
    files: Record<string, string>
  ) => {
    const dir = join(vendor, "registry", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest), "utf8");
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(join(dir, file), content, "utf8");
    }
  };

  beforeEach(() => {
    vendor = mkdtempSync(join(tmpdir(), "remocn-vendor-"));
    process.env[REMOCN_DIR_ENV] = vendor;

    vendored(
      "typewriter",
      {
        category: "Typography",
        dependencies: ["remotion", "culori"],
        description: "",
        files: [
          {
            file: "typewriter.tsx",
            target: "src/components/remocn/typewriter.tsx",
          },
        ],
        name: "typewriter",
        registryDependencies: ["remocn-ui"],
        title: "Typewriter",
      },
      { "typewriter.tsx": "export const T = 1;" }
    );
    vendored(
      "remocn-ui",
      {
        category: null,
        dependencies: ["remotion"],
        description: "",
        files: [{ file: "index.ts", target: "src/lib/remocn-ui/index.ts" }],
        name: "remocn-ui",
        registryDependencies: [],
        title: "remocn-ui",
      },
      { "index.ts": "export const ui = 1;" }
    );
  });

  afterEach(() => {
    process.env[REMOCN_DIR_ENV] = undefined;
    rmSync(vendor, { force: true, recursive: true });
  });

  const picked = {
    name: "Typewriter",
    preview: null,
    slug: "remocn/typewriter",
    type: "component" as const,
  };

  it("lands the registry layout, closure included", async () => {
    const [placed] = await run(placeAssets(project, [picked]));

    expect(placed?.copied).toEqual([
      "src/components/remocn/typewriter.tsx",
      "src/lib/remocn-ui/index.ts",
    ]);
    expect(
      readFileSync(
        join(project, "src/components/remocn/typewriter.tsx"),
        "utf8"
      )
    ).toBe("export const T = 1;");
  });

  it("never overwrites, so a second insertion skips the shared runtime", async () => {
    await run(placeAssets(project, [picked]));
    const [placed] = await run(placeAssets(project, [picked]));

    expect(placed?.copied).toEqual([]);
    expect(placed?.skipped).toEqual([
      "src/components/remocn/typewriter.tsx",
      "src/lib/remocn-ui/index.ts",
    ]);
  });

  it("names the npm packages the project does not have", async () => {
    mkdirSync(join(project, "node_modules/remotion"), { recursive: true });
    writeFileSync(
      join(project, "node_modules/remotion/package.json"),
      JSON.stringify({ name: "remotion" }),
      "utf8"
    );

    const [placed] = await run(placeAssets(project, [picked]));

    expect(placed?.missing).toEqual(["culori"]);
  });

  it("answers with a sentence for a name that is not bundled", async () => {
    const [placed] = await run(
      placeAssets(project, [{ ...picked, slug: "remocn/nothing" }])
    );

    expect(placed?.copied).toEqual([]);
    expect(placed?.reason).toContain("not among the bundled");
  });
});
