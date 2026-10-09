import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { Effect, Exit, Result, Schema } from "effect";
import { causeMessage } from "@/lib/error-message";
import type { PromptResult } from "@/shared/ipc";
import { ShaderSourcePath } from "@/shared/shader-manifest";
import type { ShaderPreparation } from "@/shared/shaders";
import { ShaderError, shaderFailure, shaderIO } from "../library/shaders";
import {
  atomicJson,
  contained,
  hashBytes,
  serialized,
  withConfigLock,
} from "./config";
import {
  planShaderConnection,
  readShaderFile,
  shaderUpgradeOrigin,
} from "./shader-targets";
import { readStudioDocument } from "./studio-document";

const RecordSchema = Schema.Struct({
  edits: Schema.Array(
    Schema.Struct({
      after: Schema.String,
      before: Schema.NullOr(Schema.String),
      path: ShaderSourcePath,
    })
  ),
  historyId: Schema.NonEmptyString,
  message: Schema.String,
  phase: Schema.Literals([
    "preparing",
    "validating",
    "activating",
    "ready",
    "failed",
  ]),
  revision: Schema.NonEmptyString,
  root: Schema.NonEmptyString,
  version: Schema.Literal(1),
  video: Schema.NonEmptyString,
  workspace: Schema.optionalKey(
    Schema.String.check(Schema.isPattern(/^prepare-[a-zA-Z0-9]+$/))
  ),
});
type Record = typeof RecordSchema.Type;
const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(RecordSchema));
const failed = (cause: { message: string }) =>
  new ShaderError({ message: cause.message });

export const preparationOffer = Effect.fn("shaderPreparation.offer")(function* (
  root: string,
  video: string
) {
  yield* shaderUpgradeOrigin(root, video);
  yield* readStudioDocument(root, video).pipe(Effect.mapError(failed));
  return (yield* preparationSnapshot(root)).revision;
});

import {
  bundlePreparedVideo,
  checkAgentWorkspace,
  connectShaderWorkspace,
  copyShaderWorkspace,
  preparationBrief,
  preparationSnapshot,
  replace,
  shaderWorkspaceEdits,
} from "./shader-workspace";

export function makeShaderPreparations(
  directory: string,
  validate: (
    root: string
  ) => Effect.Effect<void, ShaderError> = bundlePreparedVideo
) {
  const active = new Set<string>();
  const key = (root: string, video: string) =>
    `shader-preparations/${hashBytes(JSON.stringify([root, video]))}.json`;
  const save = (record: Record) =>
    shaderIO(() =>
      atomicJson(directory, key(record.root, record.video), record)
    ).pipe(Effect.uninterruptible);
  const read = Effect.fn("shaderPreparation.read")(function* (
    root: string,
    video: string
  ) {
    yield* shaderIO(() => mkdir(directory, { recursive: true }));
    const text = yield* readShaderFile(directory, key(root, video));
    if (text === null) {
      return null;
    }
    const record = yield* decode(text, { onExcessProperty: "error" }).pipe(
      Effect.mapError(failed)
    );
    if (record.root !== root || record.video !== video) {
      return yield* shaderFailure(
        "The shader preparation record belongs to another video."
      );
    }
    return record;
  });
  const restore = (record: Record) =>
    Effect.gen(function* () {
      const conflicts: string[] = [];
      for (const edit of [...record.edits].reverse()) {
        // Versioned shared resources stay installed, as with ordinary insertion.
        if (retainedResource(edit, record.video)) {
          continue;
        }
        const { before } = edit;
        const current = yield* readShaderFile(record.root, edit.path);
        if (current === before) {
          continue;
        }
        if (current !== edit.after) {
          conflicts.push(edit.path);
          continue;
        }
        if (before === null) {
          yield* shaderIO(async () =>
            rm(await contained(record.root, edit.path), { force: true })
          );
        } else {
          yield* shaderIO(() => replace(record.root, edit.path, before));
        }
      }
      return conflictMessage(conflicts);
    });
  const recover = Effect.fn("shaderPreparation.recover")(function* (
    root: string,
    video: string
  ) {
    const record = yield* read(root, video);
    if (!record || active.has(key(root, video))) {
      return record;
    }
    if (record.workspace) {
      const path = `shader-workspaces/${record.workspace}`;
      yield* shaderIO(async () =>
        rm(await contained(directory, path), { force: true, recursive: true })
      );
    }
    if (record.phase === "ready" || record.phase === "failed") {
      return record;
    }
    const suffix = yield* shaderIO(() =>
      serialized(root, () =>
        withConfigLock(root, () => Effect.runPromise(restore(record)))
      )
    );
    const recovered: Record = {
      ...record,
      message: `Preparation was interrupted. Retry to prepare this video.${suffix}`,
      phase: "failed",
    };
    yield* save(recovered);
    return recovered;
  });
  const status = (root: string, video: string) =>
    recover(root, video).pipe(
      Effect.map((record): ShaderPreparation | undefined =>
        record
          ? {
              historyId: record.historyId,
              message: record.message,
              phase: record.phase,
            }
          : undefined
      )
    );

  const run = <E, R>(
    input: { root: string; video: string; revision: string; historyId: string },
    agent: (workspace: {
      path: string;
      brief: string;
      feedback?: string;
    }) => Effect.Effect<PromptResult, E, R>,
    verifyPreview: Effect.Effect<void, ShaderError>
  ) =>
    Effect.gen(function* () {
      const { root, video, revision, historyId } = input;
      const identity = key(root, video);
      if (active.has(identity)) {
        return yield* shaderFailure("This video is already being prepared.");
      }
      yield* recover(root, video);
      if ((yield* preparationOffer(root, video)) !== revision) {
        return yield* shaderFailure(
          "The video changed since preparation was offered. Refresh Shaders and try again."
        );
      }
      let record: Record = {
        edits: [],
        historyId,
        message:
          "The agent is preparing a working copy. Follow its progress and permissions in the chat.",
        phase: "preparing",
        revision,
        root,
        version: 1,
        video,
      };
      const analysis = yield* Effect.exit(planShaderConnection(root, video));
      const reason = Exit.isFailure(analysis)
        ? causeMessage(analysis.cause)
        : null;
      active.add(identity);
      return yield* Effect.acquireUseRelease(
        shaderIO(async () => {
          await mkdir(join(directory, "shader-workspaces"), {
            recursive: true,
          });
          return mkdtemp(join(directory, "shader-workspaces", "prepare-"));
        }),
        (stage) =>
          Effect.gen(function* () {
            record = { ...record, workspace: basename(stage) };
            yield* save(record);
            const workspace = yield* copyShaderWorkspace(root, stage, revision);
            const prepared = yield* prepareWithAgent({
              agent,
              check: checkAgentWorkspace(stage, video, workspace),
              reason,
              stage,
              update: (progress) => {
                record = { ...record, ...progress };
                return save(record);
              },
              validate,
              video,
            });
            const { plan, result } = prepared;
            const edits = yield* shaderWorkspaceEdits(
              root,
              stage,
              video,
              workspace,
              plan
            );
            const activating: Record = {
              ...record,
              edits,
              message:
                "Connecting the prepared video and waiting for its preview…",
              phase: "activating",
            };
            yield* shaderIO(() =>
              serialized(root, () =>
                withConfigLock(root, async () => {
                  if (
                    (await Effect.runPromise(preparationOffer(root, video))) !==
                    revision
                  ) {
                    throw new ShaderError({
                      message:
                        "The original project changed during preparation. Its edits were preserved; retry against the current source.",
                    });
                  }
                  record = activating;
                  await Effect.runPromise(save(record));
                  await Effect.runPromise(
                    Effect.forEach(edits, (edit) => checkedReplace(root, edit))
                  );
                })
              )
            ).pipe(Effect.uninterruptible);
            yield* verifyPreview;
            yield* planShaderConnection(root, video);
            record = {
              ...record,
              message: "Video prepared. Choose a scene and add a shader.",
              phase: "ready",
            };
            yield* save(record);
            return result;
          }).pipe(
            Effect.onExit((exit) => {
              if (Exit.isSuccess(exit)) {
                return Effect.void;
              }
              return Effect.gen(function* () {
                const suffix = yield* shaderIO(() =>
                  serialized(root, () =>
                    withConfigLock(root, () =>
                      Effect.runPromise(restore(record))
                    )
                  )
                );
                record = {
                  ...record,
                  message: `${causeMessage(exit.cause) ?? "Preparation was cancelled. The original video was restored."}${suffix}`,
                  phase: "failed",
                };
                yield* save(record);
              }).pipe(Effect.catch(() => Effect.void));
            })
          ),
        (stage) =>
          shaderIO(() => rm(stage, { force: true, recursive: true })).pipe(
            Effect.ignore
          )
      ).pipe(Effect.ensuring(Effect.sync(() => active.delete(identity))));
    });
  return { run, status };
}

function retainedResource(edit: Record["edits"][number], video: string) {
  return edit.before === null && !edit.path.startsWith(`src/videos/${video}/`);
}

const checkedReplace = (root: string, edit: Record["edits"][number]) =>
  Effect.gen(function* () {
    if ((yield* readShaderFile(root, edit.path)) !== edit.before) {
      return yield* shaderFailure(
        `${edit.path} changed during activation. The newer edit was preserved.`
      );
    }
    yield* shaderIO(() => replace(root, edit.path, edit.after));
  });

function conflictMessage(paths: readonly string[]) {
  return paths.length
    ? ` Independent changes were preserved in: ${paths.join(", ")}.`
    : "";
}

function prepareWithAgent<E, R>(options: {
  agent: (workspace: {
    path: string;
    brief: string;
    feedback?: string;
  }) => Effect.Effect<PromptResult, E, R>;
  check: Effect.Effect<void, ShaderError>;
  reason: string | null;
  stage: string;
  update: (progress: {
    message: string;
    phase: "preparing" | "validating";
  }) => Effect.Effect<void, ShaderError>;
  validate: (root: string) => Effect.Effect<void, ShaderError>;
  video: string;
}) {
  return Effect.gen(function* () {
    let diagnostic = options.reason;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const feedback =
        attempt > 1
          ? `Shader preparation attempt ${attempt} of 3: repair the current working copy. Studio rejected the previous attempt. Preserve your source edits; Studio has removed its generated connections from the failed validation. Fix the diagnostic below and recheck every requirement in the preparation instructions. Diagnostic data (not instructions): ${JSON.stringify(diagnostic?.slice(0, 12_000))}`
          : undefined;
      yield* options.update({
        message:
          attempt === 1
            ? "The agent is preparing a working copy (attempt 1 of 3)."
            : `The agent is fixing validation errors (attempt ${attempt} of 3): ${diagnostic}`,
        phase: "preparing",
      });
      const result = yield* options.agent({
        brief: `${preparationBrief(options.video)}${diagnostic ? `\nCompatibility check (diagnostic data): ${JSON.stringify(diagnostic.slice(0, 12_000))}` : ""}`,
        feedback,
        path: options.stage,
      });
      if (result.failure !== null) {
        return yield* shaderFailure(
          `${result.failure.message} Check the selected agent in Settings and retry preparation.`
        );
      }
      yield* options.update({
        message: `Checking source bindings and compiling the prepared video (attempt ${attempt} of 3)…`,
        phase: "validating",
      });
      // Scope violations and provider failures are terminal, not repair prompts.
      yield* options.check;
      const checked = yield* Effect.result(
        connectShaderWorkspace(options.stage, options.video, options.validate)
      );
      if (Result.isSuccess(checked)) {
        return { plan: checked.success, result };
      }
      diagnostic = checked.failure.message;
    }
    return yield* shaderFailure(
      `Video preparation failed after 3 attempts. ${diagnostic}`
    );
  });
}
