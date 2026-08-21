import { Effect, Schema } from "effect";
import { MotionRole } from "./motion";

export const ASSET_TYPES = ["img", "video", "audio", "component"] as const;

export const AssetType = Schema.Literals(ASSET_TYPES);

export type AssetType = (typeof AssetType)["Type"];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  audio: "Audio",
  component: "Component",
  img: "Image",
  video: "Video",
};

const EXTENSIONS: Record<string, AssetType> = {
  aac: "audio",
  avif: "img",
  flac: "audio",
  gif: "img",
  jpeg: "img",
  jpg: "img",
  js: "component",
  jsx: "component",
  m4a: "audio",
  mov: "video",
  mp3: "audio",
  mp4: "video",
  ogg: "audio",
  png: "img",
  svg: "img",
  ts: "component",
  tsx: "component",
  wav: "audio",
  webm: "video",
  webp: "img",
};

const UNSAFE = /[^a-z0-9._-]+/g;
const EDGES = /^[-_.]+|[-_.]+$/g;
const FALLBACK_SLUG = "asset";

const names = Schema.Array(Schema.NonEmptyString).pipe(
  Schema.withDecodingDefault(Effect.succeed([]))
);

export const STOCK_PROVIDERS = ["pexels"] as const;

export const StockProvider = Schema.Literals(STOCK_PROVIDERS);

export type StockProvider = (typeof StockProvider)["Type"];

export const AssetSource = Schema.Struct({
  author: Schema.String,
  authorUrl: Schema.String,
  id: Schema.NonEmptyString,
  provider: StockProvider,
  url: Schema.String,
});

export type AssetSource = (typeof AssetSource)["Type"];

export const STOCK_KINDS = ["photo", "video"] as const;

export const StockKind = Schema.Literals(STOCK_KINDS);

export type StockKind = (typeof StockKind)["Type"];

export const StockItem = Schema.Struct({
  author: Schema.String,
  authorUrl: Schema.String,
  download: Schema.NonEmptyString,
  duration: Schema.NullOr(Schema.Finite),
  height: Schema.Int,
  id: Schema.NonEmptyString,
  kind: StockKind,
  name: Schema.NonEmptyString,
  thumbnail: Schema.NonEmptyString,
  url: Schema.String,
  width: Schema.Int,
});

export type StockItem = (typeof StockItem)["Type"];

export const StockPage = Schema.Struct({
  items: Schema.Array(StockItem),
  nextPage: Schema.NullOr(Schema.Int),
  total: Schema.Int,
});

export type StockPage = (typeof StockPage)["Type"];

export function sourceOf(item: StockItem): AssetSource {
  return {
    author: item.author,
    authorUrl: item.authorUrl,
    id: item.id,
    provider: "pexels",
    url: item.url,
  };
}

export function assetTypeOfStock(kind: StockKind): AssetType {
  return kind === "photo" ? "img" : "video";
}

export const PROXY_HEIGHT = 1080;

export const AssetManifest = Schema.Struct({
  createdAt: Schema.Int.pipe(Schema.withDecodingDefault(Effect.succeed(0))),
  dependencies: names,
  description: Schema.String.pipe(
    Schema.withDecodingDefault(Effect.succeed(""))
  ),
  duration: Schema.NullOr(Schema.Finite).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  files: Schema.Array(Schema.NonEmptyString),
  hashes: names,
  name: Schema.NonEmptyString,
  preview: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  proxied: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false))
  ),
  proxy: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  role: Schema.NullOr(MotionRole).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  source: Schema.NullOr(AssetSource).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  type: AssetType,
});

export type AssetManifest = (typeof AssetManifest)["Type"];

export const Asset = Schema.Struct({
  category: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  clip: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  createdAt: Schema.Int,
  dependencies: Schema.Array(Schema.NonEmptyString),
  description: Schema.String,
  duration: Schema.NullOr(Schema.Finite),
  files: Schema.Array(Schema.NonEmptyString),
  name: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  preview: Schema.NullOr(Schema.NonEmptyString),
  proxied: Schema.Boolean,
  role: Schema.NullOr(MotionRole),
  slug: Schema.NonEmptyString,
  source: Schema.NullOr(AssetSource),
  type: AssetType,
});

export type Asset = (typeof Asset)["Type"];

export const PromptAsset = Schema.Struct({
  name: Schema.NonEmptyString,
  preview: Schema.NullOr(Schema.NonEmptyString),
  slug: Schema.NonEmptyString,
  type: AssetType,
});

export type PromptAsset = (typeof PromptAsset)["Type"];

export const AssetDraft = Schema.Struct({
  dependencies: Schema.Array(Schema.NonEmptyString),
  description: Schema.String,
  duration: Schema.NullOr(Schema.Finite).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  files: Schema.Array(Schema.NonEmptyString),
  name: Schema.NonEmptyString,
  preview: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  role: Schema.NullOr(MotionRole).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  source: Schema.NullOr(AssetSource).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  type: AssetType,
});

export type AssetDraft = (typeof AssetDraft)["Type"];

export function promptAssetOf(asset: Asset): PromptAsset {
  return {
    name: asset.name,
    preview: asset.preview,
    slug: asset.slug,
    type: asset.type,
  };
}

// What a card falls back to when no still was stored: the video itself, which
// the pane can seek a frame out of. Assets saved before thumbnails existed, and
// any whose frame would not decode, land here. Sound has no such fallback — a
// waveform has to be drawn, so an undrawn one wears its icon.
export function playableFileOf(asset: Asset): string | null {
  const [first] = asset.files;

  return asset.type === "video" && first !== undefined
    ? `${asset.path}/${first}`
    : null;
}

export function hasStill(type: AssetType): boolean {
  return type === "video" || type === "audio";
}

export function stillFileOf(asset: Asset): string | null {
  const [first] = asset.files;

  return hasStill(asset.type) && first !== undefined
    ? `${asset.path}/${first}`
    : null;
}

export function slugOf(name: string): string {
  const slug = name.toLowerCase().replace(UNSAFE, "-").replace(EDGES, "");
  return slug.length === 0 ? FALLBACK_SLUG : slug;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function assetTypeOf(name: string): AssetType | null {
  return EXTENSIONS[extensionOf(name)] ?? null;
}

export function assetTypeFor(files: readonly string[]): AssetType {
  const types = files
    .map(assetTypeOf)
    .filter((type): type is AssetType => type !== null);

  if (types.includes("component")) {
    return "component";
  }

  return types[0] ?? "component";
}

export function isMediaAsset(type: AssetType): boolean {
  return type !== "component";
}

// Bundled remocn components live in the app bundle, not the user's library.
// Their slugs carry the prefix so one PromptAsset shape names both worlds:
// a user slug is a folder name and can never contain a slash.
export const BUNDLED_PREFIX = "remocn/";

export function isBundledSlug(slug: string): boolean {
  return slug.startsWith(BUNDLED_PREFIX);
}

export function bundledNameOf(slug: string): string {
  return slug.slice(BUNDLED_PREFIX.length);
}

// Measured in WebKit on a 15s clip: seeking 3840x2160 costs 59ms at the median
// against 6ms at 1920x1080, and Remotion's preview seeks per frame whenever the
// Player is paused (`seekThreshold` is 0.01s there). 59ms is nearly two frame
// budgets at 30fps, 6ms is a fifth of one — so the target is the height at which
// a seek stops costing a frame, not a round number. Linear playback of 4K was
// almost fine, which is why this is about seeking and nothing else.
export function needsProxy(type: AssetType, height: number): boolean {
  return type === "video" && height > PROXY_HEIGHT;
}

// One file, because a proxy replaces the thing the preview streams and an asset
// of several video files has no single such thing.
export function proxyableFileOf(asset: Asset): string | null {
  const [first] = asset.files;

  return asset.type === "video" &&
    asset.files.length === 1 &&
    first !== undefined
    ? `${asset.path}/${first}`
    : null;
}
