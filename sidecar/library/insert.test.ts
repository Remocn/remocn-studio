import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import type { Audiomap } from "@/shared/audiomap";
import { LIBRARY_DIR_ENV, REMOCN_DIR_ENV } from "@/shared/ipc";
import { type AssetDraft, promptAssetOf } from "@/shared/library";
import {
  assetBrief,
  mediaBrief,
  type Placement,
  placeAssets,
  placeMedia,
  sameContent,
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
    audiomap: null,
    dependencies: [],
    description: "",
    duration: null,
    name: "Thing",
    preview: null,
    role: null,
    source: null,
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
  const clip = (name: string, content: string, dir = work): string => {
    const folder = join(dir, `${name}-${content}`);
    mkdirSync(folder, { recursive: true });
    const path = join(folder, name);
    writeFileSync(path, content, "utf8");
    return path;
  };

  const attached = (path: string, name = "intro.mp4") => ({
    mediaType: "video/mp4" as const,
    name,
    path,
  });

  const inProject = (path: string) => readFileSync(join(project, path), "utf8");

  it("copies an attached video into the video's own folder and says where", async () => {
    const [placed] = await run(
      placeMedia(project, "launch", [attached(clip("intro.mp4", "frames"))])
    );

    expect(placed?.copied).toEqual(["public/library/launch/intro.mp4"]);
    expect(placed?.type).toBe("video");
    expect(inProject("public/library/launch/intro.mp4")).toBe("frames");
  });

  it("keeps two videos' clips of the same name apart", async () => {
    await run(
      placeMedia(project, "a", [attached(clip("footage.mp4", "first"))])
    );
    const [placed] = await run(
      placeMedia(project, "b", [attached(clip("footage.mp4", "second"))])
    );

    expect(placed?.copied).toEqual(["public/library/b/footage.mp4"]);
    expect(inProject("public/library/a/footage.mp4")).toBe("first");
    expect(inProject("public/library/b/footage.mp4")).toBe("second");
  });

  it("reuses an identical file rather than copying it again", async () => {
    await run(placeMedia(project, "a", [attached(clip("intro.mp4", "same"))]));
    const [placed] = await run(
      placeMedia(project, "a", [attached(clip("intro.mp4", "same", library))])
    );

    expect(placed?.copied).toEqual([]);
    expect(placed?.skipped).toEqual(["public/library/a/intro.mp4"]);
    expect(readdirSync(join(project, "public/library/a"))).toEqual([
      "intro.mp4",
    ]);
  });

  it("gives a different file under a taken name the next free number", async () => {
    mkdirSync(join(project, "public/library/a"), { recursive: true });
    writeFileSync(join(project, "public/library/a/intro.mp4"), "old", "utf8");

    const [placed] = await run(
      placeMedia(project, "a", [attached(clip("intro.mp4", "new"))])
    );

    expect(placed?.copied).toEqual(["public/library/a/intro-2.mp4"]);
    expect(inProject("public/library/a/intro.mp4")).toBe("old");
    expect(inProject("public/library/a/intro-2.mp4")).toBe("new");
  });

  it("reuses a numbered copy when the same file comes again", async () => {
    await run(placeMedia(project, "a", [attached(clip("intro.mp4", "one"))]));
    await run(placeMedia(project, "a", [attached(clip("intro.mp4", "two"))]));
    const [placed] = await run(
      placeMedia(project, "a", [attached(clip("intro.mp4", "two", library))])
    );

    expect(placed?.skipped).toEqual(["public/library/a/intro-2.mp4"]);
    expect(readdirSync(join(project, "public/library/a")).sort()).toEqual([
      "intro-2.mp4",
      "intro.mp4",
    ]);
  });

  it("lands two different files of one name in one message side by side", async () => {
    const placed = await run(
      placeMedia(project, "a", [
        attached(clip("intro.mp4", "left")),
        attached(clip("intro.mp4", "right")),
      ])
    );

    expect(placed.map((one) => one.copied)).toEqual([
      ["public/library/a/intro.mp4"],
      ["public/library/a/intro-2.mp4"],
    ]);
  });

  it("leaves media already at the top of the library untouched", async () => {
    mkdirSync(join(project, "public/library"), { recursive: true });
    writeFileSync(join(project, "public/library/intro.mp4"), "old", "utf8");

    const [placed] = await run(
      placeMedia(project, "a", [attached(clip("intro.mp4", "new"))])
    );

    expect(placed?.copied).toEqual(["public/library/a/intro.mp4"]);
    expect(inProject("public/library/intro.mp4")).toBe("old");
  });

  it("leaves nothing under the real name when the copy fails", async () => {
    const exit = await Effect.runPromiseExit(
      placeMedia(project, "a", [attached(join(work, "gone.mp4"), "gone.mp4")])
    );

    expect(exit._tag).toBe("Failure");
    expect(existsSync(join(project, "public/library/a/gone.mp4"))).toBe(false);
    expect(
      existsSync(join(project, "public/library/a/.gone.mp4.partial"))
    ).toBe(false);
  });

  it("calls a sound a sound", async () => {
    const [placed] = await run(
      placeMedia(project, "a", [
        {
          mediaType: "audio/wav",
          name: "theme.wav",
          path: clip("theme.wav", "samples"),
        },
      ])
    );

    expect(placed?.type).toBe("audio");
  });
});

describe("sameContent", () => {
  it("knows an identical file", async () => {
    expect(
      await run(sameContent(source("a.mp4", "abc"), source("b.mp4", "abc")))
    ).toBe(true);
  });

  it("tells apart files of one size with different bytes", async () => {
    expect(
      await run(sameContent(source("a.mp4", "abc"), source("b.mp4", "abd")))
    ).toBe(false);
  });

  it("tells apart files of different sizes", async () => {
    expect(
      await run(sameContent(source("a.mp4", "abc"), source("b.mp4", "abcd")))
    ).toBe(false);
  });
});

describe("mediaBrief", () => {
  it("says nothing when no media was attached", () => {
    expect(mediaBrief([])).toBeNull();
  });

  it("gives the staticFile path rather than the one on the person's disk", () => {
    const brief = mediaBrief([
      {
        audiomap: null,
        copied: ["public/library/intro.mp4"],
        missing: [],
        name: "intro.mp4",
        reason: null,
        role: null,
        skipped: [],
        type: "video",
      },
    ]);

    expect(brief).toContain('staticFile("library/intro.mp4")');
    expect(brief).toContain("intro.mp4 (video)");
  });

  it("names the clip inside the video's own folder", () => {
    const brief = mediaBrief([
      {
        audiomap: null,
        copied: [],
        missing: [],
        name: "intro.mp4",
        reason: null,
        role: null,
        skipped: ["public/library/launch/intro-2.mp4"],
        type: "video",
      },
    ]);

    expect(brief).toContain(
      'sits at public/library/launch/intro-2.mp4 — reference it with staticFile("library/launch/intro-2.mp4")'
    );
  });

  it("carries the audiomap of an analysed track", () => {
    const brief = mediaBrief([
      {
        audiomap: MAP,
        copied: ["public/library/theme.wav"],
        missing: [],
        name: "theme.wav",
        reason: null,
        role: null,
        skipped: [],
        type: "audio",
      },
    ]);

    expect(brief).toContain("pacing: beat_cut");
    expect(brief).toContain("hard stops (s): 4.00");
    expect(brief).toContain("beats (s): 0.00, 0.50");
  });
});

const MAP: Audiomap = {
  beats: [0, 0.5, 1, 1.5],
  bpm: 120,
  duration: 6,
  hardStops: [4],
  onsetRate: 2,
  onsets: [0, 0.5, 1, 1.5],
  pacing: "beat_cut",
  phases: [{ from: 0, level: "high", to: 6 }],
  silences: [],
  version: 1,
};

describe("assetBrief", () => {
  const placement = (shape: Partial<Placement>): Placement => ({
    audiomap: null,
    copied: [],
    missing: [],
    name: "Neon Title",
    reason: null,
    role: null,
    skipped: [],
    type: "component",
    ...shape,
  });

  it("says nothing at all when no asset was referenced", () => {
    expect(assetBrief([], "bun add")).toBeNull();
  });

  it("adds the audiomap under a library track", () => {
    const brief = assetBrief(
      [
        placement({
          audiomap: MAP,
          copied: ["public/library/theme.wav"],
          name: "Theme",
          type: "audio",
        }),
      ],
      "bun add"
    );

    expect(brief).toContain("pacing: beat_cut");
    expect(brief).toContain("multiply by the composition's fps");
  });

  it("numbers each block against the reference in the message", () => {
    const brief = assetBrief(
      [
        placement({ copied: ["src/library/a/A.tsx"] }),
        placement({
          copied: ["public/library/logo.png"],
          name: "Logo",
          type: "img",
        }),
      ],
      "bun add"
    );

    expect(brief).toContain("[Asset #1] Neon Title");
    expect(brief).toContain("[Asset #2] Logo");
  });

  it("tells the agent how to reference media, not how to import it", () => {
    const brief = assetBrief(
      [
        placement({
          copied: ["public/library/logo.png"],
          name: "Logo",
          type: "img",
        }),
      ],
      "bun add"
    );

    expect(brief).toContain('staticFile("library/logo.png")');
  });

  it("names the untouched files so earlier edits are not rewritten", () => {
    const brief = assetBrief(
      [placement({ skipped: ["src/library/a/A.tsx"] })],
      "bun add"
    );

    expect(brief).toContain("already in the project, untouched");
  });

  it("names the role beside the asset, in the words the conventions use", () => {
    const brief = assetBrief(
      [placement({ copied: ["src/library/a/A.tsx"], role: "entry" })],
      "bun add"
    );

    expect(brief).toContain("[Asset #1] Neon Title (entry)");
  });

  it("says nothing about a role for media, which has none", () => {
    const brief = assetBrief(
      [
        placement({
          copied: ["public/library/logo.png"],
          name: "Logo",
          type: "img",
        }),
      ],
      "bun add"
    );

    expect(brief).toContain("[Asset #1] Logo\n");
  });

  it("asks for the missing packages by name", () => {
    const brief = assetBrief(
      [placement({ missing: ["three"] })],
      "npm install"
    );

    expect(brief).toContain("not installed yet: three");
    expect(brief).toContain("run npm install for them");
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

  it("carries the role the studio classified the shipped component with", async () => {
    const [placed] = await run(placeAssets(project, [picked]));

    expect(placed?.role).toBe("entry");
  });

  it("answers with a sentence for a name that is not bundled", async () => {
    const [placed] = await run(
      placeAssets(project, [{ ...picked, slug: "remocn/nothing" }])
    );

    expect(placed?.copied).toEqual([]);
    expect(placed?.reason).toContain("not among the bundled");
  });
});

describe("selected caption styles", () => {
  it("copies the trusted caption closure and gives a style-specific brief without demo timings", async () => {
    const previous = process.env[REMOCN_DIR_ENV];
    process.env[REMOCN_DIR_ENV] = join(import.meta.dirname, "../../remocn");
    try {
      const selected = {
        name: "Untrusted client title",
        preview: null,
        slug: "remocn/caption-karaoke",
        type: "component" as const,
      };
      const placements = await run(placeAssets(project, [selected]));
      expect(placements[0]?.captionStyle).toBe("caption-karaoke");
      expect(placements[0]?.copied).toContain("src/lib/remocn/caption-core.ts");
      expect(
        placements[0]?.copied.some((file) => file.includes("fixture"))
      ).toBe(false);
      const brief = assetBrief(placements, "bun add");
      expect(brief).toContain("Selected caption style: caption-karaoke");
      expect(brief).toContain("local transcription");
      const component = join(
        project,
        "src/components/remocn/caption-karaoke.tsx"
      );
      writeFileSync(component, "user-authored caption renderer");
      const second = await run(placeAssets(project, [selected]));
      expect(second[0]?.skipped).toContain(
        "src/components/remocn/caption-karaoke.tsx"
      );
      expect(readFileSync(component, "utf8")).toBe(
        "user-authored caption renderer"
      );
    } finally {
      if (previous === undefined) {
        delete process.env[REMOCN_DIR_ENV];
      } else {
        process.env[REMOCN_DIR_ENV] = previous;
      }
    }
  });
  it("does not classify an arbitrary client title as a caption", () => {
    const brief = assetBrief(
      [
        {
          audiomap: null,
          copied: ["title.tsx"],
          missing: [],
          name: "Caption Karaoke",
          reason: null,
          role: null,
          skipped: [],
          type: "component",
        },
      ],
      "bun add"
    );
    expect(brief).not.toContain("Selected caption style");
    expect(brief).not.toContain("local transcription");
  });
});
