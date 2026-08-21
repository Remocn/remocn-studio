// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LIBRARY_DIR_ENV } from "@/shared/ipc";
import type { AssetDraft } from "@/shared/library";
import {
  dismissPaths,
  findAsset,
  layoutOf,
  listAssets,
  removeAsset,
  renameAsset,
  saveAsset,
  unofferedFrom,
} from "@/sidecar/library/store";

let library = "";
let work = "";

function file(name: string, content: string): string {
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
    role: null,
    type: "component",
    ...shape,
  };
}

const run = <A>(effect: Effect.Effect<A, unknown>) =>
  Effect.runPromise(effect as Effect.Effect<A, never>);

beforeEach(() => {
  library = mkdtempSync(join(tmpdir(), "remocn-library-"));
  work = mkdtempSync(join(tmpdir(), "remocn-work-"));
  process.env[LIBRARY_DIR_ENV] = library;
});

afterEach(() => {
  process.env[LIBRARY_DIR_ENV] = undefined;
  rmSync(library, { force: true, recursive: true });
  rmSync(work, { force: true, recursive: true });
});

describe("layoutOf", () => {
  it("keeps the files relative to what they share, so imports survive", () => {
    expect(
      layoutOf(["/p/src/scene/Neon.tsx", "/p/src/scene/lib/ease.ts"])
    ).toEqual({
      base: "/p/src/scene",
      names: ["Neon.tsx", "lib/ease.ts"],
    });
  });

  it("reduces a lone file to its own name", () => {
    expect(layoutOf(["/p/public/logo.png"])).toEqual({
      base: "/p/public",
      names: ["logo.png"],
    });
  });
});

describe("saveAsset", () => {
  it("writes the files and reads them back as one asset", async () => {
    const saved = await run(
      saveAsset(
        draft({
          dependencies: ["three"],
          description: "A neon title",
          files: [file("Neon.tsx", "export const Neon = () => null;")],
          name: "Neon Title",
        })
      )
    );

    expect(saved.slug).toBe("neon-title");
    expect(saved.files).toEqual(["Neon.tsx"]);
    expect(saved.dependencies).toEqual(["three"]);

    const listed = await run(listAssets());
    expect(listed.map((asset) => asset.slug)).toEqual(["neon-title"]);
  });

  it("keeps the role it was saved with, so the pane can file it", async () => {
    const saved = await run(
      saveAsset(
        draft({
          files: [file("Reveal.tsx", "export const Reveal = () => null;")],
          name: "Reveal",
          role: "entry",
        })
      )
    );

    expect(saved.role).toBe("entry");
    expect(await run(findAsset("reveal")).then((found) => found?.role)).toBe(
      "entry"
    );
  });

  it("reads an asset written before roles existed as having none", async () => {
    const saved = await run(
      saveAsset(draft({ files: [file("Old.tsx", "old")], name: "Old" }))
    );

    const manifest = join(library, "assets", saved.slug, "manifest.json");
    const stored = JSON.parse(readFileSync(manifest, "utf8")) as Record<
      string,
      unknown
    >;
    stored.role = undefined;
    writeFileSync(manifest, JSON.stringify(stored), "utf8");

    const reread = await run(findAsset(saved.slug));
    expect(reread?.role).toBeNull();
    expect(reread?.name).toBe("Old");
  });

  it("gives a second asset of the same name its own folder", async () => {
    await run(saveAsset(draft({ files: [file("a.tsx", "a")], name: "Title" })));
    const second = await run(
      saveAsset(draft({ files: [file("b.tsx", "b")], name: "Title" }))
    );

    expect(second.slug).toBe("title-2");
  });

  it("refuses a draft with no files rather than writing an empty folder", async () => {
    const exit = await Effect.runPromiseExit(saveAsset(draft({ files: [] })));

    expect(exit._tag).toBe("Failure");
    expect(await run(listAssets())).toEqual([]);
  });

  it("files the frame handed to it as the asset's preview", async () => {
    const saved = await run(
      saveAsset(
        draft({
          files: [file("intro.mp4", "frames")],
          name: "Intro Clip",
          preview: file("frame.png", "a still"),
          type: "video",
        })
      )
    );

    expect(saved.preview).toBe(
      join(library, "assets", "intro-clip", "preview.png")
    );
    expect(readFileSync(saved.preview ?? "", "utf8")).toBe("a still");
  });

  it("saves the video anyway when its frame could not be taken", async () => {
    const saved = await run(
      saveAsset(
        draft({
          files: [file("intro.mp4", "frames")],
          name: "Intro Clip",
          preview: join(work, "never-written.png"),
          type: "video",
        })
      )
    );

    expect(saved.preview).toBeNull();
    expect(saved.files).toEqual(["intro.mp4"]);
  });

  it("shows a lone image as its own preview", async () => {
    const saved = await run(
      saveAsset(
        draft({ files: [file("logo.png", "bytes")], name: "Logo", type: "img" })
      )
    );

    expect(saved.preview).toBe(join(library, "assets", "logo", "logo.png"));
  });
});

describe("renameAsset and removeAsset", () => {
  it("renames without moving the folder the references point at", async () => {
    const saved = await run(
      saveAsset(draft({ files: [file("a.tsx", "a")], name: "Title" }))
    );

    const renamed = await run(renameAsset(saved.slug, "Opening Title"));

    expect(renamed.name).toBe("Opening Title");
    expect(renamed.slug).toBe(saved.slug);
  });

  it("reports whether there was anything to remove", async () => {
    const saved = await run(
      saveAsset(draft({ files: [file("a.tsx", "a")], name: "Title" }))
    );

    expect(await run(removeAsset(saved.slug))).toBe(true);
    expect(await run(removeAsset(saved.slug))).toBe(false);
    expect(await run(findAsset(saved.slug))).toBeNull();
  });
});

describe("unofferedFrom", () => {
  it("drops a file whose content is already in the library", async () => {
    const kept = file("logo.png", "same bytes");
    await run(saveAsset(draft({ files: [kept], name: "Logo", type: "img" })));

    const copy = file("logo-copy.png", "same bytes");
    const other = file("other.png", "different bytes");

    expect(await run(unofferedFrom([copy, other]))).toEqual([other]);
  });

  it("drops a file that was declined before", async () => {
    const path = file("shot.png", "bytes");

    expect(await run(unofferedFrom([path]))).toEqual([path]);
    expect(await run(dismissPaths([path]))).toBe(1);
    expect(await run(unofferedFrom([path]))).toEqual([]);
  });

  it("offers one of two identical files, not both", async () => {
    const one = file("one.png", "bytes");
    const two = file("two.png", "bytes");

    expect(await run(unofferedFrom([one, two]))).toEqual([one]);
  });
});
