import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join, parse, relative } from "node:path";
import { Effect } from "effect";
import { errorMessage } from "@/lib/error-message";
import { type Audiomap, audiomapBrief } from "@/shared/audiomap";
import type { PromptMedia } from "@/shared/ipc";
import {
  type AssetType,
  bundledNameOf,
  isBundledSlug,
  type PromptAsset,
} from "@/shared/library";
import type { MotionRole } from "@/shared/motion";
import { referenceOf } from "@/shared/references";
import { CAPTION_BRIEF } from "../agent/captions";
import { isInstalled } from "../environment";
import { addCommand, pmOf } from "../package-manager";
import { remotionRootOf } from "../preview/project";
import { bundledPlan } from "./bundled";
import { findAsset, LibraryError } from "./store";

export const MEDIA_FOLDER = "public/library";
export const COMPONENT_FOLDER = "src/library";

export interface Placement {
  readonly audiomap: Audiomap | null;
  readonly captionStyle?: string;
  readonly copied: readonly string[];
  readonly missing: readonly string[];
  readonly name: string;
  readonly reason: string | null;
  readonly role: MotionRole | null;
  readonly skipped: readonly string[];
  readonly type: AssetType;
}

export function addCommandFor(cwd: string): string {
  return addCommand(pmOf(remotionRootOf(cwd)).manager);
}

export function placeAssets(
  cwd: string,
  assets: readonly PromptAsset[]
): Effect.Effect<readonly Placement[], LibraryError> {
  return Effect.forEach(assets, (asset) => place(cwd, asset));
}

export function placeMedia(
  cwd: string,
  video: string,
  media: readonly PromptMedia[]
): Effect.Effect<readonly Placement[], LibraryError> {
  const folder = `${MEDIA_FOLDER}/${video}`;
  const dir = join(remotionRootOf(cwd), folder);

  return Effect.forEach(media, (item) =>
    landMedia(item.path, dir, folder).pipe(
      Effect.map(
        (landed): Placement => ({
          audiomap: item.audiomap ?? null,
          copied: landed.copied,
          missing: [],
          name: item.name,
          reason: null,
          role: null,
          skipped: landed.skipped,
          type: item.mediaType.startsWith("video/") ? "video" : "audio",
        })
      )
    )
  );
}

export function sameContent(
  one: string,
  other: string
): Effect.Effect<boolean, LibraryError> {
  return Effect.tryPromise({
    catch: (cause) => new LibraryError({ message: errorMessage(cause) }),
    try: async () => {
      const [first, second] = await Promise.all([stat(one), stat(other)]);

      if (!(first.isFile() && second.isFile()) || first.size !== second.size) {
        return false;
      }

      const [left, right] = await Promise.all([digest(one), digest(other)]);
      return left === right;
    },
  });
}

async function digest(path: string): Promise<string> {
  const hash = createHash("sha256");

  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

interface Landed {
  readonly copied: readonly string[];
  readonly skipped: readonly string[];
}

function landMedia(
  from: string,
  dir: string,
  folder: string
): Effect.Effect<Landed, LibraryError> {
  const { ext, name } = parse(basename(from));

  const landAt = (suffix: number): Effect.Effect<Landed, LibraryError> =>
    Effect.suspend(() => {
      const file = suffix === 1 ? `${name}${ext}` : `${name}-${suffix}${ext}`;
      const target = join(dir, file);
      const shown = `${folder}/${file}`;

      if (!existsSync(target)) {
        return copyWhole(from, dir, file).pipe(
          Effect.as<Landed>({ copied: [shown], skipped: [] })
        );
      }

      return sameContent(from, target).pipe(
        Effect.flatMap((same) =>
          same
            ? Effect.succeed<Landed>({ copied: [], skipped: [shown] })
            : landAt(suffix + 1)
        )
      );
    });

  return landAt(1);
}

function copyWhole(
  from: string,
  dir: string,
  file: string
): Effect.Effect<void, LibraryError> {
  return Effect.tryPromise({
    catch: (cause) => new LibraryError({ message: errorMessage(cause) }),
    try: async () => {
      const partial = join(dir, `.${file}.partial`);
      await mkdir(dir, { recursive: true });

      try {
        await copyFile(from, partial);
        await rename(partial, join(dir, file));
      } catch (cause) {
        await rm(partial, { force: true });
        throw cause;
      }
    },
  });
}

export function mediaBrief(placements: readonly Placement[]): string | null {
  if (placements.length === 0) {
    return null;
  }

  const blocks = placements.map((placement) => {
    const [first] = [...placement.copied, ...placement.skipped];
    const where =
      first === undefined
        ? "could not be copied into the project."
        : `sits at ${first} — reference it with staticFile(${JSON.stringify(relative("public", first))}).`;

    const head = `${placement.name} (${placement.type}) ${where}`;
    return placement.audiomap === null
      ? head
      : `${head}\n${audiomapBrief(placement.audiomap)}`;
  });

  return `The person attached this media to the message. It is already copied into the project — use it where it now sits rather than looking for it anywhere else.\n\n${blocks.join("\n")}`;
}

export function assetBrief(
  placements: readonly Placement[],
  add: string
): string | null {
  if (placements.length === 0) {
    return null;
  }

  const blocks = placements.map((placement, index) =>
    describe(placement, index, add)
  );

  return `The assets referenced above come from the studio's library and are already copied into this project. Use them where they now sit — do not rewrite them from scratch, and do not read anything from the library folder.\n\n${blocks.join("\n\n")}`;
}

function describe(placement: Placement, index: number, add: string): string {
  const head =
    placement.role === null
      ? `${referenceOf("asset", index)} ${placement.name}`
      : `${referenceOf("asset", index)} ${placement.name} (${placement.role})`;

  if (placement.reason !== null) {
    return `${head} ${placement.reason}`;
  }

  const lines = [head];
  if (placement.captionStyle) {
    lines.push(
      `Selected caption style: ${placement.captionStyle}.`,
      CAPTION_BRIEF
    );
  }

  if (placement.copied.length > 0) {
    lines.push(`copied into the project: ${placement.copied.join(", ")}`);
  }

  if (placement.skipped.length > 0) {
    lines.push(
      `already in the project, untouched: ${placement.skipped.join(", ")}`
    );
  }

  if (placement.type === "component") {
    lines.push(
      "import it from there; it is ordinary Remotion code you may edit."
    );
  } else {
    const [first] = [...placement.copied, ...placement.skipped];
    if (first !== undefined) {
      lines.push(
        `reference it with staticFile(${JSON.stringify(relative("public", first))}).`
      );
    }
  }

  if (placement.audiomap !== null) {
    lines.push(audiomapBrief(placement.audiomap));
  }

  if (placement.missing.length > 0) {
    lines.push(
      `not installed yet: ${placement.missing.join(", ")} — run ${add} for them before importing.`
    );
  }

  return lines.join("\n");
}

// A bundled component lands in the registry's own layout —
// src/components/remocn/<name>.tsx plus the shared src/lib/remocn-* runtime —
// so a second component reusing the runtime skips it by the same
// never-overwrite rule that keeps an agent's edits safe.
function placeBundled(
  cwd: string,
  asset: PromptAsset
): Effect.Effect<Placement, LibraryError> {
  return Effect.flatMap(bundledPlan(bundledNameOf(asset.slug)), (plan) => {
    if (plan === null) {
      return Effect.succeed<Placement>({
        audiomap: null,
        copied: [],
        missing: [],
        name: asset.name,
        reason:
          "is not among the bundled remocn components, so nothing was copied.",
        role: null,
        skipped: [],
        type: asset.type,
      });
    }

    const root = remotionRootOf(cwd);

    return Effect.tryPromise({
      catch: (cause) => new LibraryError({ message: errorMessage(cause) }),
      try: () => copyPlanned(root, plan.files),
    }).pipe(
      Effect.map((landed) => ({
        ...(plan.captionStyle ? { captionStyle: plan.captionStyle } : {}),
        audiomap: null,
        copied: landed.copied,
        missing: plan.dependencies.filter((name) => !isInstalled(root, name)),
        name: plan.title,
        reason: null,
        role: plan.role,
        skipped: landed.skipped,
        type: "component" as const,
      }))
    );
  });
}

function place(
  cwd: string,
  asset: PromptAsset
): Effect.Effect<Placement, LibraryError> {
  if (isBundledSlug(asset.slug)) {
    return placeBundled(cwd, asset);
  }

  return Effect.flatMap(findAsset(asset.slug), (found) => {
    if (found === null) {
      return Effect.succeed<Placement>({
        audiomap: null,
        copied: [],
        missing: [],
        name: asset.name,
        reason:
          "is no longer in the library, so nothing was copied — build it from scratch or ask for it again.",
        role: null,
        skipped: [],
        type: asset.type,
      });
    }

    const root = remotionRootOf(cwd);
    const folder =
      found.type === "component"
        ? join(COMPONENT_FOLDER, found.slug)
        : MEDIA_FOLDER;

    return Effect.tryPromise({
      catch: (cause) => new LibraryError({ message: errorMessage(cause) }),
      try: () => copyInto(found.path, root, folder, found.files),
    }).pipe(
      Effect.map((landed) => ({
        audiomap: found.audiomap,
        copied: landed.copied,
        missing: found.dependencies.filter((name) => !isInstalled(root, name)),
        name: found.name,
        reason: null,
        role: found.role,
        skipped: landed.skipped,
        type: found.type,
      }))
    );
  });
}

async function copyPlanned(
  root: string,
  files: readonly { from: string; target: string }[]
): Promise<{ copied: string[]; skipped: string[] }> {
  const landed = await Promise.all(
    files.map(async (file) => {
      const target = join(root, file.target);

      if (existsSync(target)) {
        return { shown: file.target, written: false };
      }

      await mkdir(dirname(target), { recursive: true });
      await copyFile(file.from, target);
      return { shown: file.target, written: true };
    })
  );

  return {
    copied: landed.filter((one) => one.written).map((one) => one.shown),
    skipped: landed.filter((one) => !one.written).map((one) => one.shown),
  };
}

async function copyInto(
  from: string,
  root: string,
  folder: string,
  files: readonly string[]
): Promise<{ copied: string[]; skipped: string[] }> {
  const landed = await Promise.all(
    files.map(async (file) => {
      const target = join(root, folder, file);
      const shown = `${folder}/${file}`;

      if (existsSync(target)) {
        return { shown, written: false };
      }

      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(from, file), target);
      return { shown, written: true };
    })
  );

  return {
    copied: landed.filter((one) => one.written).map((one) => one.shown),
    skipped: landed.filter((one) => !one.written).map((one) => one.shown),
  };
}
