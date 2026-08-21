import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Data, Effect, Exit, Schema } from "effect";
import { errorMessage } from "@/lib/error-message";
import type { StockProgress, StockQuery } from "@/shared/ipc";
import {
  type Asset,
  assetTypeOfStock,
  extensionOf,
  type StockItem,
  type StockKind,
  type StockPage,
  slugOf,
  sourceOf,
} from "@/shared/library";
import { type LibraryError, libraryRoot, saveAsset } from "./store";

export class StockError extends Data.TaggedError("StockError")<{
  message: string;
}> {}

export const NO_KEY =
  "Searching Pexels needs an API key — add one in Settings, or set REMOCN_STUDIO_PEXELS_KEY.";

export const PER_PAGE = 30;

const KEY_FILE = "stock.json";

const PHOTO_ENDPOINT = "https://api.pexels.com/v1/search";
const VIDEO_ENDPOINT = "https://api.pexels.com/videos/search";

const PROGRESS_STEP = 512 * 1024;

const failed = (cause: unknown) =>
  new StockError({ message: errorMessage(cause) });

function attempt<A>(run: () => Promise<A>): Effect.Effect<A, StockError> {
  return Effect.tryPromise({ catch: failed, try: run });
}

const StockKeyFile = Schema.Struct({
  pexelsKey: Schema.NullOr(Schema.NonEmptyString).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
});

const decodeKeyFile = Schema.decodeUnknownExit(StockKeyFile);

const maybe = Schema.NullOr(Schema.String).pipe(
  Schema.withDecodingDefault(Effect.succeed(null))
);

const PexelsPhoto = Schema.Struct({
  alt: maybe,
  height: Schema.Int,
  id: Schema.Int,
  photographer: maybe,
  photographer_url: maybe,
  src: Schema.Struct({
    large: maybe,
    medium: maybe,
    original: Schema.NonEmptyString,
  }),
  url: maybe,
  width: Schema.Int,
});

const PexelsVideo = Schema.Struct({
  duration: Schema.NullOr(Schema.Finite).pipe(
    Schema.withDecodingDefault(Effect.succeed(null))
  ),
  height: Schema.Int,
  id: Schema.Int,
  image: Schema.NonEmptyString,
  url: maybe,
  user: Schema.Struct({ name: maybe, url: maybe }).pipe(
    Schema.withDecodingDefault(Effect.succeed({}))
  ),
  video_files: Schema.Array(
    Schema.Struct({
      file_type: maybe,
      link: Schema.NonEmptyString,
      width: Schema.NullOr(Schema.Int).pipe(
        Schema.withDecodingDefault(Effect.succeed(null))
      ),
    })
  ),
  width: Schema.Int,
});

const PexelsPhotoPage = Schema.Struct({
  photos: Schema.Array(Schema.Unknown),
  total_results: Schema.Int,
});

const PexelsVideoPage = Schema.Struct({
  total_results: Schema.Int,
  videos: Schema.Array(Schema.Unknown),
});

const decodePhoto = Schema.decodeUnknownExit(PexelsPhoto);
const decodeVideo = Schema.decodeUnknownExit(PexelsVideo);
const decodePhotoPage = Schema.decodeUnknownEffect(PexelsPhotoPage);
const decodeVideoPage = Schema.decodeUnknownEffect(PexelsVideoPage);

type PexelsVideo = (typeof PexelsVideo)["Type"];

export function photoItemOf(raw: unknown): StockItem | null {
  const decoded = decodePhoto(raw);
  if (!Exit.isSuccess(decoded)) {
    return null;
  }

  const photo = decoded.value;
  const author = photo.photographer ?? "";
  const by = author.length > 0 ? author : "Pexels";
  const alt = shortened(photo.alt?.trim() ?? "");
  const name = alt.length > 0 ? alt : `Photo by ${by}`;

  return {
    author,
    authorUrl: photo.photographer_url ?? "",
    download: photo.src.original,
    duration: null,
    height: photo.height,
    id: String(photo.id),
    kind: "photo",
    name,
    thumbnail: photo.src.medium ?? photo.src.large ?? photo.src.original,
    url: photo.url ?? "",
    width: photo.width,
  };
}

export function videoItemOf(raw: unknown): StockItem | null {
  const decoded = decodeVideo(raw);
  if (!Exit.isSuccess(decoded)) {
    return null;
  }

  const video = decoded.value;
  const link = bestFileOf(video);
  if (link === null) {
    return null;
  }

  const author = video.user.name ?? "";
  const by = author.length > 0 ? author : "Pexels";
  const name = titleOf(video.url ?? "") ?? `Video by ${by}`;

  return {
    author,
    authorUrl: video.user.url ?? "",
    download: link,
    duration: video.duration,
    height: video.height,
    id: String(video.id),
    kind: "video",
    name,
    thumbnail: video.image,
    url: video.url ?? "",
    width: video.width,
  };
}

// The largest mp4 is the original upload more often than not, and anything
// past the preview's comfort is the proxy machinery's problem, not a reason
// to download a smaller cut.
function bestFileOf(video: PexelsVideo): string | null {
  const files = video.video_files.filter(
    (file) => file.file_type === null || file.file_type === "video/mp4"
  );
  const pool = files.length > 0 ? files : video.video_files;

  let best: string | null = null;
  let bestWidth = -1;

  for (const file of pool) {
    const width = file.width ?? 0;
    if (width > bestWidth) {
      best = file.link;
      bestWidth = width;
    }
  }

  return best;
}

// Pexels alt texts are whole sentences these days, and the sentence becomes
// the asset's name and its folder — so it is cut at a word boundary rather
// than carried in full.
const NAME_LIMIT = 60;
const TRAILING_MARKS = /[,.;:!?]+$/;

function shortened(text: string): string {
  if (text.length <= NAME_LIMIT) {
    return text;
  }

  const cut = text.slice(0, NAME_LIMIT + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut.slice(0, NAME_LIMIT)).replace(
    TRAILING_MARKS,
    ""
  );
}

// A Pexels video page is /video/<words-of-the-title>-<id>/ and the words are
// the only title the API carries.
const VIDEO_TITLE = /\/video\/([a-z0-9-]+?)(?:-\d+)?\/?$/;

function titleOf(url: string): string | null {
  const match = VIDEO_TITLE.exec(url);
  if (match?.[1] === undefined) {
    return null;
  }

  const words = match[1].split("-").filter((word) => word.length > 0);
  if (words.length === 0) {
    return null;
  }

  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function pageOf(
  kind: StockKind,
  page: number,
  total: number,
  entries: readonly unknown[]
): StockPage {
  const items = entries
    .map((entry) =>
      kind === "photo" ? photoItemOf(entry) : videoItemOf(entry)
    )
    .filter((item): item is StockItem => item !== null);

  return {
    items,
    nextPage: page * PER_PAGE < total ? page + 1 : null,
    total,
  };
}

// The static property access is what lets `bun build --env` bake the app's
// own key into the release bundle; in debug the same expression reads the
// repo's .env, which the core hands over with --env-file.
function shippedKey(): string | null {
  return process.env.REMOCN_STUDIO_PEXELS_KEY ?? null;
}

export function stockKey(): Effect.Effect<string | null, StockError> {
  return attempt(async () => {
    const stored = await storedKey();
    return stored ?? shippedKey();
  });
}

export function stockConfigured(): Effect.Effect<boolean, StockError> {
  return Effect.map(stockKey(), (key) => key !== null);
}

export function setStockKey(
  key: string | null
): Effect.Effect<boolean, StockError> {
  return attempt(async () => {
    const file = join(libraryRoot(), KEY_FILE);

    if (key === null) {
      await unlink(file).catch(() => undefined);
    } else {
      await writeFile(
        file,
        `${JSON.stringify({ pexelsKey: key }, null, 2)}\n`,
        "utf8"
      );
    }

    return key !== null || shippedKey() !== null;
  });
}

async function storedKey(): Promise<string | null> {
  try {
    const source = await readFile(join(libraryRoot(), KEY_FILE), "utf8");
    const decoded = decodeKeyFile(JSON.parse(source));
    return Exit.isSuccess(decoded) ? decoded.value.pexelsKey : null;
  } catch {
    return null;
  }
}

export function searchStock(
  query: StockQuery,
  fetcher: typeof fetch = fetch
): Effect.Effect<StockPage, StockError> {
  return Effect.gen(function* () {
    const key = yield* stockKey();
    if (key === null) {
      return yield* Effect.fail(new StockError({ message: NO_KEY }));
    }

    const endpoint = query.kind === "photo" ? PHOTO_ENDPOINT : VIDEO_ENDPOINT;
    const url = new URL(endpoint);
    url.searchParams.set("query", query.query);
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("per_page", String(PER_PAGE));

    const answer = yield* attempt(() =>
      fetcher(url, { headers: { authorization: key } })
    );

    if (answer.status === 401 || answer.status === 403) {
      return yield* Effect.fail(
        new StockError({
          message: "Pexels refused the API key — check it in Settings.",
        })
      );
    }
    if (answer.status === 429) {
      return yield* Effect.fail(
        new StockError({
          message: "Pexels is rate-limiting this key — try again in a minute.",
        })
      );
    }
    if (!answer.ok) {
      return yield* Effect.fail(
        new StockError({ message: `Pexels answered ${answer.status}.` })
      );
    }

    const body = yield* attempt(() => answer.json());

    if (query.kind === "photo") {
      const decoded = yield* decodePhotoPage(body).pipe(
        Effect.mapError(failed)
      );
      return pageOf("photo", query.page, decoded.total_results, decoded.photos);
    }

    const decoded = yield* decodeVideoPage(body).pipe(Effect.mapError(failed));
    return pageOf("video", query.page, decoded.total_results, decoded.videos);
  });
}

export function saveStock(
  item: StockItem,
  onProgress: (progress: StockProgress) => void,
  fetcher: typeof fetch = fetch
): Effect.Effect<Asset, StockError | LibraryError> {
  return Effect.gen(function* () {
    const dir = yield* attempt(() => mkdtemp(join(tmpdir(), "remocn-stock-")));

    const saved = Effect.gen(function* () {
      const file = yield* attempt(() =>
        download(item, dir, onProgress, fetcher)
      );

      return yield* saveAsset({
        dependencies: [],
        description: attributionOf(item),
        duration: item.duration,
        files: [file],
        name: item.name,
        preview: null,
        role: null,
        source: sourceOf(item),
        type: assetTypeOfStock(item.kind),
      });
    });

    return yield* saved.pipe(
      Effect.ensuring(
        Effect.promise(() =>
          rm(dir, { force: true, recursive: true }).catch(() => undefined)
        )
      )
    );
  });
}

export function attributionOf(item: StockItem): string {
  const what = item.kind === "photo" ? "Photo" : "Video";
  return item.author.length > 0
    ? `${what} by ${item.author} on Pexels`
    : `${what} from Pexels`;
}

export function downloadNameOf(item: StockItem): string {
  const fromUrl = extensionOf(basename(new URL(item.download).pathname));
  const fallback = item.kind === "photo" ? "jpg" : "mp4";
  const extension = fromUrl.length > 0 ? fromUrl : fallback;

  return `${slugOf(item.name)}.${extension}`;
}

async function download(
  item: StockItem,
  dir: string,
  onProgress: (progress: StockProgress) => void,
  fetcher: typeof fetch
): Promise<string> {
  const answer = await fetcher(item.download);
  if (!answer.ok || answer.body === null) {
    throw new Error(`the download answered ${answer.status}`);
  }

  const length = answer.headers.get("content-length");
  const total = length === null ? null : Number.parseInt(length, 10) || null;
  const path = join(dir, downloadNameOf(item));

  const sink = createWriteStream(path);
  const reader = answer.body.getReader();

  let received = 0;
  let announced = 0;

  try {
    for (;;) {
      // biome-ignore lint/performance/noAwaitInLoops: a download is a stream — each chunk exists only after the previous one arrived
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      received += value.byteLength;
      if (received - announced >= PROGRESS_STEP) {
        announced = received;
        onProgress({ received, total });
      }

      await new Promise<void>((resolve, reject) => {
        sink.write(value, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  } finally {
    await new Promise<void>((resolve) => sink.end(() => resolve()));
  }

  onProgress({ received, total: total ?? received });

  return path;
}
