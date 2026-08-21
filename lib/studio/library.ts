import { Effect } from "effect";
import {
  newRequestId,
  requestSidecar,
  type SidecarError,
} from "@/lib/studio/sidecar";
import type { PromptMedia } from "@/shared/ipc";
import type { Asset, AssetDraft } from "@/shared/library";

export const SAVE_ELEMENT_PROMPT =
  "Save this to the asset library so I can reuse it in other videos — work out which files it needs and save them together under a name I would recognise.";

export const SAVE_SCENE_PROMPT =
  "Save the animation we just worked on to the asset library so I can reuse it in other videos — work out which files it needs and save them together under a name I would recognise.";

export const listAssets: Effect.Effect<readonly Asset[], SidecarError> =
  Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({ id, method: "library.list", params: null });
  });

export const listBundled: Effect.Effect<readonly Asset[], SidecarError> =
  Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.bundled",
      params: null,
    });
  });

export function saveAsset(
  draft: AssetDraft
): Effect.Effect<Asset, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.save",
      params: draft,
    });
  });
}

export function renameAsset(
  slug: string,
  name: string
): Effect.Effect<Asset, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.rename",
      params: { name, slug },
    });
  });
}

export function previewAsset(
  slug: string,
  path: string,
  duration: number | null = null
): Effect.Effect<Asset, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.preview",
      params: { duration, path, slug },
    });
  });
}

export function proxyAsset(
  slug: string,
  path: string | null
): Effect.Effect<Asset, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.proxy",
      params: { path, slug },
    });
  });
}

export function removeAsset(
  slug: string
): Effect.Effect<boolean, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "library.remove",
      params: { slug },
    });

    return answer.removed;
  });
}

export function offerableAttachments(
  attachments: readonly PromptMedia[]
): Effect.Effect<readonly PromptMedia[], SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    return yield* requestSidecar({
      id,
      method: "library.offer",
      params: { attachments },
    });
  });
}

export function dismissAttachments(
  attachments: readonly PromptMedia[]
): Effect.Effect<number, SidecarError> {
  return Effect.gen(function* () {
    const id = yield* newRequestId;

    const answer = yield* requestSidecar({
      id,
      method: "library.dismiss",
      params: { attachments },
    });

    return answer.dismissed;
  });
}

export function draftFromAttachment(
  attachment: PromptMedia,
  type: AssetDraft["type"],
  still: { duration: number | null; path: string } = {
    duration: null,
    path: "",
  }
): AssetDraft {
  return {
    dependencies: [],
    description: "",
    duration: still.duration,
    files: [attachment.path],
    name: attachment.name,
    preview: still.path.length === 0 ? null : still.path,
    role: null,
    source: null,
    type,
  };
}
