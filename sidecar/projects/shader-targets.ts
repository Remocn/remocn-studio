import { readFile } from "node:fs/promises";
import { semver } from "bun";
import { Effect, Schema } from "effect";
import { TEMPLATE_DIR_ENV } from "@/shared/ipc";
import { ShaderManifest } from "@/shared/shader-manifest";
import {
  ShaderIdentifier,
  type ShaderSlotReport,
  type ShaderTarget,
} from "@/shared/shader-target";
import { isRemoved, type StudioDocument } from "@/shared/studio-document";
import {
  SHADER_UPGRADE_MIN_VERSION,
  VIDEO_ORIGIN_FILE,
  VideoOrigin,
} from "@/shared/video-origin";
import { ShaderError, shaderFailure, shaderIO } from "../library/shaders";
import { contained, hashBytes, hashSources } from "./config";
import {
  type PlannedShaderScene,
  planStructuredShaderConnection,
} from "./shader-adaptation";
import { readStudioDocument } from "./studio-document";

const decodeVideo = Schema.decodeUnknownEffect(ShaderIdentifier);
const decodeManifest = Schema.decodeUnknownEffect(ShaderManifest);
const decodeOrigin = Schema.decodeUnknownEffect(
  Schema.fromJsonString(VideoOrigin)
);
const META =
  /export const meta = \{\s*durationInFrames: (\d+),\s*fps: (\d+),\s*height: (\d+),\s*width: (\d+),\s*\};/;
const LEGACY_IMPORT = /studio-objects-v[56]/g;

export const sourceRevision = hashSources;

export const shaderVideoPath = Effect.fn("shaderVideoPath")(function* (
  video: string
) {
  yield* decodeVideo(video).pipe(
    Effect.mapError(
      () =>
        new ShaderError({
          message: "Choose a valid Studio video before adding a shader.",
        })
    )
  );
  return `src/videos/${video}`;
});

export function readShaderFile(root: string, path: string) {
  return shaderIO(async () =>
    readFile(await contained(root, path), "utf8").catch(
      (cause: NodeJS.ErrnoException) => {
        if (cause.code === "ENOENT") {
          return null;
        }
        throw cause;
      }
    )
  );
}

export const readShaderManifest = Effect.fn("readShaderManifest")(function* (
  root: string,
  video: string
) {
  const folder = yield* shaderVideoPath(video);
  const text = yield* readShaderFile(root, `${folder}/studio-shaders.json`);
  if (text === null) {
    return null;
  }
  const raw = yield* Effect.try({
    catch: () =>
      new ShaderError({
        message: "The shader insertion manifest is not valid JSON.",
      }),
    try: () => JSON.parse(text) as unknown,
  });
  const manifest = yield* decodeManifest(raw, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ShaderError({
          message: `Unsupported shader insertion manifest: ${cause.message}`,
        })
    )
  );
  if (
    manifest.video !== video ||
    manifest.sourceRevision !== sourceRevision(manifest.sources)
  ) {
    return yield* shaderFailure(
      "The shader insertion manifest does not match this video and its source bindings."
    );
  }
  return manifest;
});

export const validateShaderSources = Effect.fn("validateShaderSources")(
  function* (root: string, manifest: ShaderManifest) {
    yield* Effect.forEach(Object.entries(manifest.sources), ([path, hash]) =>
      Effect.gen(function* () {
        const content = yield* readShaderFile(root, path);
        if (content === null || hashBytes(content) !== hash) {
          return yield* shaderFailure(
            `${path} changed since its shader slots were connected. Reconnect the authored slots before adding a shader.`
          );
        }
      })
    );
  }
);

export interface ShaderSourceEdit {
  readonly after: string | null;
  readonly before: string | null;
  readonly path: string;
}

export const shaderUpgradeOrigin = Effect.fn("shaderUpgradeOrigin")(function* (
  root: string,
  video: string
) {
  const folder = yield* shaderVideoPath(video);
  const path = `${folder}/${VIDEO_ORIGIN_FILE}`;
  const text = yield* readShaderFile(root, path);
  if (text === null) {
    return { after: null, before: null, path } satisfies ShaderSourceEdit;
  }
  const origin = yield* decodeOrigin(text, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      () =>
        new ShaderError({
          message:
            "This video's creation metadata is invalid. Its creating Studio version cannot be verified for automatic shader preparation.",
        })
    )
  );
  if (
    semver.order(origin.createdWithStudioVersion, SHADER_UPGRADE_MIN_VERSION) <
    0
  ) {
    return yield* shaderFailure(
      `This video was created with Studio ${origin.createdWithStudioVersion}. Automatic shader preparation requires creation with Studio 1.0.0 or newer. Updating Studio does not change the video's creation version.`
    );
  }
  // A no-op journal edit checks provenance at activation and on recovery without
  // rewriting it or binding already-connected slots to creation metadata forever.
  return { after: text, before: text, path } satisfies ShaderSourceEdit;
});

function normalizedTemplate(source: string) {
  return source
    .replaceAll("\r\n", "\n")
    .replace(META, "export const meta = __META__;")
    .replace(LEGACY_IMPORT, "studio-objects-v6")
    .trim();
}

export const planShaderConnection = Effect.fn("planShaderConnection")(
  function* (root: string, video: string) {
    const folder = yield* shaderVideoPath(video);
    const manifest = yield* readShaderManifest(root, video);
    if (manifest) {
      yield* validateShaderSources(root, manifest);
      return {
        adaptation: false,
        durationInFrames: null,
        edits: [] as readonly ShaderSourceEdit[],
        fps: null,
        manifest,
        scenes: [] as readonly PlannedShaderScene[],
      };
    }
    const origin = yield* shaderUpgradeOrigin(root, video);
    const template = process.env[TEMPLATE_DIR_ENV];
    if (!template) {
      return yield* shaderFailure(
        "Studio's shader compatibility resources are unavailable."
      );
    }
    const path = `${folder}/index.tsx`;
    const source = yield* readShaderFile(root, path);
    const legacy = yield* readShaderFile(
      template,
      "src/lib/studio-objects-v7/legacy-video.tsx.txt"
    );
    const structured =
      source &&
      legacy &&
      normalizedTemplate(source) !== normalizedTemplate(legacy);
    if (!(source && legacy)) {
      return yield* shaderFailure(
        "The video source or compatibility resources are missing."
      );
    }
    const runtimeGuards: ShaderSourceEdit[] = [];
    for (const version of ["5", "6"]) {
      const runtimePath = `src/lib/studio-objects-v${version}/index.tsx`;
      const actual = yield* readShaderFile(root, runtimePath);
      const supported = yield* readShaderFile(template, runtimePath);
      if (actual !== supported || actual === null) {
        return yield* shaderFailure(
          `${runtimePath} is missing or modified. Studio cannot safely migrate its provider and hooks.`
        );
      }
      runtimeGuards.push({ after: actual, before: actual, path: runtimePath });
    }
    if (structured) {
      const snapshot = yield* readStudioDocument(root, video).pipe(
        Effect.mapError((error) => new ShaderError({ message: error.message }))
      );
      const plan = yield* planStructuredShaderConnection(
        root,
        folder,
        snapshot.document
      );
      const registry = `import type { ShaderRegistry } from "../../lib/studio-objects-v7/shaders";\nexport const shaderRegistry: ShaderRegistry = {};\n`;
      const edits = [
        ...plan.edits,
        { after: registry, before: null, path: `${folder}/shader-registry.ts` },
      ];
      const sources = Object.fromEntries(
        edits.map((edit) => [edit.path, hashBytes(edit.after ?? "")])
      );
      const connected: ShaderManifest = {
        implementations: [],
        slots: plan.scenes.map((scene) => ({
          id: scene.slotId,
          label: scene.label,
          sceneId: scene.sceneId,
          source: scene.source,
        })),
        sourceRevision: sourceRevision(sources),
        sources,
        version: 1,
        video,
      };
      return {
        ...plan,
        adaptation: true,
        edits: [...edits, ...runtimeGuards, origin],
        manifest: connected,
      };
    }
    const metadata = source.match(META);
    if (!metadata || Number(metadata[1]) < 1 || Number(metadata[2]) < 1) {
      return yield* shaderFailure(
        "The video needs a valid duration and frame rate before connecting a shader slot."
      );
    }
    if (
      (yield* readShaderFile(root, `${folder}/shader-registry.ts`)) !== null
    ) {
      return yield* shaderFailure(
        "This video already has an authored shader registry without a matching manifest."
      );
    }
    const after = source
      .replace(LEGACY_IMPORT, "studio-objects-v7")
      .replace(
        'import document from "./studio.json";',
        'import document from "./studio.json";\nimport { StudioShaderSlot } from "../../lib/studio-objects-v7/shaders";\nimport shaderManifest from "./studio-shaders.json";\nimport { shaderRegistry } from "./shader-registry";'
      )
      .replace(
        "export default function Video() {",
        "export default function Video() {\n  const { durationInFrames } = useVideoConfig();"
      )
      .replace(
        "        <Backdrop />",
        '        <Backdrop />\n        <StudioShaderSlot id="root-shaders" label="Whole video" durationInFrames={durationInFrames} sourceRevision={shaderManifest.sourceRevision} registry={shaderRegistry} />'
      );
    const registry = `import type { ShaderRegistry } from "../../lib/studio-objects-v7/shaders";\nexport const shaderRegistry: ShaderRegistry = {};\n`;
    const sources = {
      [path]: hashBytes(after),
      [`${folder}/shader-registry.ts`]: hashBytes(registry),
    };
    const connected: ShaderManifest = {
      implementations: [],
      slots: [
        {
          id: "root-shaders",
          label: "Whole video",
          sceneId: null,
          source: path,
        },
      ],
      sourceRevision: sourceRevision(sources),
      sources,
      version: 1,
      video,
    };
    return {
      adaptation: true,
      durationInFrames: Number(metadata[1]),
      edits: [
        { after, before: source, path },
        { after: registry, before: null, path: `${folder}/shader-registry.ts` },
        ...runtimeGuards,
        origin,
      ],
      fps: Number(metadata[2]),
      manifest: connected,
      scenes: [
        {
          contract: 1 as const,
          durationInFrames: Number(metadata[1]),
          fps: Number(metadata[2]),
          from: 0,
          label: "Whole video",
          sceneId: null,
          slotId: "root-shaders",
          source: path,
        },
      ],
    };
  }
);

export function checkedShaderTargets(
  projectId: string,
  document: StudioDocument,
  manifest: ShaderManifest,
  generation: string,
  reports: readonly ShaderSlotReport[]
): readonly ShaderTarget[] {
  const seen = new Set<string>();
  return reports.map((report) => {
    if (seen.has(report.slotId) || report.occurrences !== 1) {
      throw new ShaderError({
        message:
          "A shader slot is mounted more than once. Give each scene occurrence its own slot before adding a shader.",
      });
    }
    seen.add(report.slotId);
    const binding = manifest.slots.find((slot) => slot.id === report.slotId);
    if (
      !binding ||
      binding.sceneId !== report.sceneId ||
      manifest.video !== document.video ||
      report.sourceRevision !== manifest.sourceRevision
    ) {
      throw new ShaderError({
        message:
          "The shader target report is stale or does not match the video's declared slots.",
      });
    }
    if (
      report.sceneId !== null &&
      (!document.objects.some(
        (object) =>
          object.id === report.sceneId && object.definition === "scene"
      ) ||
        isRemoved(document.objects, report.sceneId))
    ) {
      throw new ShaderError({
        message: "The shader target scene is missing or removed.",
      });
    }
    const { occurrences: _occurrences, ...target } = report;
    return { ...target, generation, projectId, video: document.video };
  });
}
