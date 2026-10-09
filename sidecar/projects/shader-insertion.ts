import { realpath } from "node:fs/promises";
import { Effect, Schema, Semaphore } from "effect";
import {
  ShaderManifest as Manifest,
  type ShaderManifest,
} from "@/shared/shader-manifest";
import { type ShaderTarget, sameShaderTarget } from "@/shared/shader-target";
import {
  type ShaderInserted,
  type ShaderInsertionStatus,
  type ShaderInsertRequest,
  type ShaderProgress,
  type ShaderTargetReport,
  type ShaderTargets,
  shaderCreation,
} from "@/shared/shaders";
import {
  isCreationOperation,
  type StudioCreateOperation,
  type StudioSnapshot,
} from "@/shared/studio-document";
import { VIDEO_ORIGIN_FILE } from "@/shared/video-origin";
import {
  checkShaderResources,
  ShaderError,
  type ShaderResourcePlan,
  shaderDescriptor,
  shaderFailure,
  shaderIO,
  shaderResourcePlan,
} from "../library/shaders";
import { remotionRootOf } from "../preview/project";
import {
  checkPaperDependencies,
  preparePaperDependencies,
} from "../scaffold/install";
import { hashBytes, serialized, withConfigLock } from "./config";
import { makeShaderJournal, type ShaderJournalRecord } from "./shader-journal";
import {
  checkedShaderTargets,
  planShaderConnection,
  readShaderFile,
  type ShaderSourceEdit,
  shaderUpgradeOrigin,
  sourceRevision,
  validateShaderSources,
} from "./shader-targets";
import { commitStudioCreation, readStudioDocument } from "./studio-document";

const failure = (cause: { readonly message: string }) =>
  new ShaderError({ message: cause.message });
type Progress = (progress: ShaderProgress) => Effect.Effect<void>;
type Prepare = (
  root: string,
  log: (message: string) => Effect.Effect<void>
) => Effect.Effect<void, { readonly message: string }>;

function inserted(
  snapshot: StudioSnapshot,
  operation: StudioCreateOperation
): ShaderInserted {
  return {
    receipt: {
      objectId: operation.objectId,
      operationId: operation.id,
      target: operation.target,
    },
    snapshot,
  };
}

function requestMatches(left: ShaderInsertRequest, right: ShaderInsertRequest) {
  return (
    left.objectId === right.objectId &&
    left.operationId === right.operationId &&
    left.slug === right.slug &&
    sameShaderTarget(left.target, right.target)
  );
}

function scoped(root: string, video: string) {
  return JSON.stringify([root, video]);
}

export function makeShaderInsertions(
  dataDirectory: string,
  prepare: Prepare = preparePaperDependencies
) {
  const journal = makeShaderJournal(dataDirectory);
  const current = new Map<string, readonly ShaderTarget[]>();
  const reportOrder = new Map<string, number>();
  let sequence = 0;
  const listeners = new Map<string, Set<() => void>>();
  const lanes = new Map<string, Semaphore.Semaphore>();
  const rootOf = (folder: string) =>
    shaderIO(() => realpath(remotionRootOf(folder)));
  const read = (root: string, video: string) =>
    readStudioDocument(root, video).pipe(Effect.mapError(failure));
  const publish = (key: string, nextTargets: readonly ShaderTarget[]) => {
    current.set(key, nextTargets);
    for (const listener of listeners.get(key) ?? []) {
      listener();
    }
  };
  const lane = (root: string) => {
    const known = lanes.get(root);
    if (known) {
      return known;
    }
    const created = Semaphore.makeUnsafe(1);
    lanes.set(root, created);
    return created;
  };

  const targets = Effect.fn("shaderInsertion.targets")(function* (
    folder: string,
    query: ShaderTargetReport
  ) {
    sequence += 1;
    const order = sequence;
    const root = yield* rootOf(folder);
    const key = scoped(root, query.video);
    // File reads can finish out of order across a preview rebuild.
    // A superseded report must neither replace nor clear the newer scene.
    if (query.report !== undefined) {
      reportOrder.set(key, Math.max(order, reportOrder.get(key) ?? 0));
    }
    const publishReport = (next: readonly ShaderTarget[]) => {
      if (order < (reportOrder.get(key) ?? 0)) {
        return;
      }
      reportOrder.set(key, order);
      publish(key, next);
    };
    const work = Effect.gen(function* () {
      const plan = yield* planShaderConnection(root, query.video);
      const snapshot = yield* read(root, query.video);
      if (query.generation === null) {
        return {
          adaptation: plan.adaptation,
          reason: "Waiting for this video's editable preview.",
          targets: [],
        } satisfies ShaderTargets;
      }
      if (plan.adaptation) {
        const sources = Object.fromEntries(
          plan.edits.map((edit) => [
            edit.path,
            hashBytes(JSON.stringify(edit.before)),
          ])
        );
        const plannedTargets: ShaderTarget[] = plan.scenes.map(
          ({ source: _source, ...scene }) => ({
            ...scene,
            generation: query.generation ?? "",
            projectId: query.projectId,
            sourceRevision: sourceRevision(sources),
            video: query.video,
          })
        );
        publishReport(plannedTargets);
        return {
          adaptation: true,
          reason: null,
          targets: plannedTargets,
        } satisfies ShaderTargets;
      }
      if (query.report !== undefined) {
        const checked = yield* Effect.try({
          catch: (cause) =>
            cause instanceof ShaderError
              ? cause
              : new ShaderError({
                  message: "The shader slot report is invalid.",
                }),
          try: () =>
            checkedShaderTargets(
              query.projectId,
              snapshot.document,
              plan.manifest,
              query.generation ?? "",
              query.report ?? []
            ),
        });
        publishReport(checked);
      }
      const found = (current.get(key) ?? []).filter(
        (target) =>
          target.generation === query.generation &&
          target.sourceRevision === plan.manifest.sourceRevision
      );
      return {
        adaptation: false,
        reason: found.length
          ? null
          : "No supported shader scene is active at this frame.",
        targets: found,
      } satisfies ShaderTargets;
    });
    return yield* work.pipe(
      Effect.onError(() => Effect.sync(() => publishReport([])))
    );
  });

  const verifiedTarget = (
    root: string,
    request: ShaderInsertRequest,
    manifest: ShaderManifest
  ) =>
    Effect.gen(function* () {
      yield* validateShaderSources(root, manifest);
      const target = current
        .get(scoped(root, request.target.video))
        ?.find(
          (item) =>
            item.slotId === request.target.slotId &&
            item.sceneId === request.target.sceneId &&
            item.projectId === request.target.projectId &&
            item.sourceRevision === manifest.sourceRevision
        );
      if (!target) {
        return yield* shaderFailure(
          "The shader scene changed or its current preview has not confirmed the insertion slot."
        );
      }
      return target;
    });

  const waitForTarget = (
    root: string,
    request: ShaderInsertRequest,
    manifest: ShaderManifest
  ) => {
    const key = scoped(root, request.target.video);
    return Effect.callback<ShaderTarget, ShaderError>((resume) => {
      const check = () => {
        const found = current
          .get(key)
          ?.find(
            (target) =>
              target.slotId === request.target.slotId &&
              target.sceneId === request.target.sceneId &&
              target.projectId === request.target.projectId &&
              target.sourceRevision === manifest.sourceRevision
          );
        if (found) {
          resume(Effect.succeed(found));
        }
      };
      const waiting = listeners.get(key) ?? new Set<() => void>();
      waiting.add(check);
      listeners.set(key, waiting);
      check();
      return Effect.sync(() => {
        waiting.delete(check);
        if (!waiting.size) {
          listeners.delete(key);
        }
      });
    }).pipe(
      Effect.timeout("30 seconds"),
      Effect.mapError(
        () =>
          new ShaderError({
            message:
              "The preview did not confirm the prepared shader slot. Reload the preview and retry this insertion.",
          })
      )
    );
  };

  const status = Effect.fn("shaderInsertion.status")(function* (
    folder: string,
    video: string,
    operationId: string
  ): Effect.fn.Return<ShaderInsertionStatus, ShaderError> {
    const root = yield* rootOf(folder);
    const snapshot = yield* read(root, video);
    const operation = snapshot.document.operations.find(
      (item) => item.id === operationId
    );
    if (operation && isCreationOperation(operation)) {
      return { result: inserted(snapshot, operation), state: "saved" };
    }
    const record = yield* journal.read(root, video, operationId);
    if (!record) {
      return { state: "unknown" };
    }
    if (record.phase === "failed" || record.phase === "cancelled") {
      return {
        message:
          record.error ??
          "Insertion was cancelled before saving. Prepared packages remain available for retry.",
        request: record.request,
        state: "failed",
      };
    }
    return { request: record.request, state: "preparing" };
  });

  const insert = Effect.fn("shaderInsertion.insert")(function* (
    folder: string,
    request: ShaderInsertRequest,
    progress: Progress
  ) {
    const root = yield* rootOf(folder);
    const key = scoped(root, request.target.video);
    const report = (phase: ShaderProgress["phase"], message: string) =>
      progress({
        message,
        operationId: request.operationId,
        phase,
        projectId: request.target.projectId,
        video: request.target.video,
      });
    return yield* lane(root).withPermits(1)(
      Effect.gen(function* () {
        yield* report(
          "validate",
          "Checking the target scene and saved insertion."
        );
        const saved = yield* read(root, request.target.video);
        const previous = yield* journal.read(
          root,
          request.target.video,
          request.operationId
        );
        if (previous && !requestMatches(previous.request, request)) {
          return yield* shaderFailure(
            "This insertion ID already belongs to a different request."
          );
        }
        const recovered = yield* recoverReceipt(saved, request);
        if (recovered) {
          return recovered;
        }
        const active = current
          .get(key)
          ?.find((target) => target.slotId === request.target.slotId);
        if (
          !(previous || (active && sameShaderTarget(active, request.target)))
        ) {
          return yield* shaderFailure(
            "The target scene changed. Refresh the preview before adding a shader."
          );
        }
        const plan = yield* shaderResourcePlan(request.slug);
        const resources = {
          ...plan,
          files: yield* checkShaderResources(root, plan),
        };
        yield* checkPaperDependencies(root).pipe(Effect.mapError(failure));
        const { record, manifest, adaptation } = yield* prepareJournalPlan(
          root,
          request,
          previous,
          resources
        ).pipe(
          Effect.tapError((error) =>
            previous
              ? journal.save({
                  ...previous,
                  error: error.message,
                  phase: "failed",
                })
              : Effect.void
          )
        );
        yield* journal.save(record);
        const work = Effect.gen(function* () {
          yield* report("dependencies", "Preparing Paper shader dependencies.");
          yield* prepare(root, (message) =>
            report("dependencies", message)
          ).pipe(Effect.mapError(failure));
          yield* report(
            "resources",
            "Preparing the project's shader renderer."
          );
          yield* journal.prepare(record, resources.files);
          yield* report(
            "connect",
            adaptation
              ? "Connecting a shader slot between this video's background and content."
              : "Connecting the prepared shader implementation."
          );
          yield* shaderIO(() =>
            serialized(root, () =>
              withConfigLock(root, () =>
                Effect.runPromise(
                  verifyUpgradeOrigin(root, record).pipe(
                    Effect.andThen(journal.activate(record))
                  )
                )
              )
            )
          ).pipe(Effect.uninterruptible);
          yield* report(
            "capability",
            "Waiting for the current preview to confirm the shader slot."
          );
          const target = yield* waitForTarget(root, request, manifest);
          if (
            target.from !== request.target.from ||
            target.durationInFrames !== request.target.durationInFrames ||
            target.fps !== request.target.fps
          ) {
            return yield* shaderFailure(
              "The target scene timing changed during preparation. Refresh the preview before adding this shader."
            );
          }
          const latest = yield* read(root, request.target.video);
          const orders = latest.document.objects
            .filter((object) => object.shader?.slotId === target.slotId)
            .map((object) => Number(object.values.order));
          const order = orders.length ? Math.max(...orders) + 1 : 0;
          const operation = shaderCreation(
            resources.descriptor,
            target,
            request.operationId,
            request.objectId,
            order
          );
          yield* report("commit", "Saving the shader instance.");
          const snapshot = yield* commitStudioCreation(
            root,
            request.target.video,
            operation,
            verifyUpgradeOrigin(root, record).pipe(
              Effect.andThen(verifiedTarget(root, request, manifest))
            )
          ).pipe(Effect.mapError(failure));
          const result = inserted(snapshot, operation);
          yield* journal.save({
            ...record,
            phase: "committed",
            receipt: result.receipt,
          });
          yield* report(
            "preview",
            "Shader saved. Waiting for its rendered preview."
          );
          return result;
        });
        const rollback = Effect.gen(function* () {
          const latest = yield* read(root, request.target.video);
          if (
            latest.document.operations.some(
              (operation) => operation.id === request.operationId
            )
          ) {
            return;
          }
          yield* shaderIO(() =>
            serialized(root, () =>
              withConfigLock(root, () =>
                Effect.runPromise(journal.rollback(record))
              )
            )
          );
          publish(key, []);
        }).pipe(Effect.uninterruptible);
        return yield* work.pipe(
          Effect.onError(() =>
            rollback.pipe(
              Effect.catch((error) => report("validate", error.message))
            )
          )
        );
      })
    );
  });
  const waitForPrepared = (folder: string, projectId: string, video: string) =>
    Effect.gen(function* () {
      const root = yield* rootOf(folder);
      const plan = yield* planShaderConnection(root, video);
      if (plan.adaptation) {
        return yield* shaderFailure(
          "The agent has not connected shader slots."
        );
      }
      yield* Effect.callback<void, ShaderError>((resume) => {
        const key = scoped(root, video);
        const check = () => {
          if (
            current
              .get(key)
              ?.some(
                (target) =>
                  target.projectId === projectId &&
                  target.sourceRevision === plan.manifest.sourceRevision
              )
          ) {
            resume(Effect.void);
          }
        };
        const waiting = listeners.get(key) ?? new Set<() => void>();
        waiting.add(check);
        listeners.set(key, waiting);
        check();
        return Effect.sync(() => {
          waiting.delete(check);
          if (!waiting.size) {
            listeners.delete(key);
          }
        });
      }).pipe(
        Effect.timeout("30 seconds"),
        Effect.mapError(
          () =>
            new ShaderError({
              message:
                "The preview did not confirm a prepared scene. Preparation was rolled back. Open this video and retry.",
            })
        )
      );
    });
  const invalidate = (folder: string, video: string) =>
    rootOf(folder).pipe(
      Effect.tap((root) =>
        Effect.sync(() => {
          const key = scoped(root, video);
          sequence += 1;
          reportOrder.set(key, sequence);
          publish(key, []);
        })
      )
    );
  return { insert, invalidate, status, targets, waitForPrepared };
}

const decodeManifest = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Manifest)
);
const parsePreparedManifest = (text: string) =>
  decodeManifest(text, { onExcessProperty: "error" }).pipe(
    Effect.mapError((cause) => new ShaderError({ message: cause.message }))
  );

const registryEdit = Effect.fn("shaderInsertion.registryEdit")(function* (
  root: string,
  prior: ShaderManifest,
  slug: string,
  sourceEdits: readonly ShaderSourceEdit[]
) {
  const descriptor = yield* shaderDescriptor(slug);
  const existing = prior.implementations.find((entry) => entry.slug === slug);
  if (existing && existing.revision !== descriptor.revision) {
    return yield* shaderFailure(
      "This video uses a different saved shader revision. Its implementation was preserved."
    );
  }
  const implementations = existing
    ? prior.implementations
    : [...prior.implementations, { revision: descriptor.revision, slug }];
  const descriptors = yield* Effect.forEach(implementations, (entry) =>
    shaderDescriptor(entry.slug)
  );
  if (
    descriptors.some(
      (entry, index) => entry.revision !== implementations[index].revision
    )
  ) {
    return yield* shaderFailure(
      "A saved shader implementation is not supported by this insertion adapter."
    );
  }
  const registryPath = `src/videos/${prior.video}/shader-registry.ts`;
  const imports = descriptors
    .map(
      (entry) =>
        `import { ${entry.exportName}Adapter } from "../../lib/studio-shaders-v1/${entry.slug.replace("shader-", "")}";`
    )
    .join("\n");
  const entries = descriptors
    .map(
      (entry) =>
        `${JSON.stringify(entry.slug)}: {revision: ${JSON.stringify(entry.revision)}, component: ${entry.exportName}Adapter}`
    )
    .join(",\n");
  const after = `import type { ShaderRegistry } from "../../lib/studio-objects-v7/shaders";\n${imports}\nexport const shaderRegistry: ShaderRegistry = {${entries}};\n`;
  const planned = sourceEdits.find((edit) => edit.path === registryPath);
  const before = planned
    ? planned.before
    : yield* readShaderFile(root, registryPath);
  const sources = { ...prior.sources, [registryPath]: hashBytes(after) };
  const manifest: ShaderManifest = {
    ...prior,
    implementations,
    sourceRevision: sourceRevision(sources),
    sources,
  };
  const manifestPath = `src/videos/${prior.video}/studio-shaders.json`;
  const manifestBefore = yield* readShaderFile(root, manifestPath);
  return {
    edits: [
      ...sourceEdits.filter((edit) => edit.path !== registryPath),
      { after, before, path: registryPath },
      {
        after: `${JSON.stringify(manifest, null, 2)}\n`,
        before: manifestBefore,
        path: manifestPath,
      },
    ],
    manifest,
  };
});

function recoverReceipt(
  snapshot: StudioSnapshot,
  request: ShaderInsertRequest
) {
  return Effect.gen(function* () {
    const receipt = snapshot.document.operations.find(
      (item) => item.id === request.operationId
    );
    if (!receipt) {
      return null;
    }
    if (
      !isCreationOperation(receipt) ||
      receipt.objectId !== request.objectId ||
      receipt.object.shader?.slug !== request.slug ||
      receipt.target.slotId !== request.target.slotId ||
      receipt.target.sceneId !== request.target.sceneId ||
      receipt.target.projectId !== request.target.projectId
    ) {
      return yield* shaderFailure(
        "This insertion ID already belongs to a different saved operation."
      );
    }
    return inserted(snapshot, receipt);
  });
}

const prepareJournalPlan = Effect.fn("shaderInsertion.prepareJournalPlan")(
  function* (
    root: string,
    request: ShaderInsertRequest,
    previous: ShaderJournalRecord | null,
    resources: ShaderResourcePlan
  ) {
    const connection =
      previous && previous.phase !== "cancelled"
        ? null
        : yield* planShaderConnection(root, request.target.video);
    let record: ShaderJournalRecord;
    let manifest: ShaderManifest;
    if (connection) {
      if (connection.adaptation) {
        const sources = Object.fromEntries(
          connection.edits.map((edit) => [
            edit.path,
            hashBytes(JSON.stringify(edit.before)),
          ])
        );
        if (sourceRevision(sources) !== request.target.sourceRevision) {
          return yield* shaderFailure(
            "The video source or creation metadata changed. Refresh the preview before preparing shader support."
          );
        }
      }
      const extended = yield* registryEdit(
        root,
        connection.manifest,
        resources.descriptor.slug,
        connection.edits
      );
      ({ manifest } = extended);
      record = {
        edits: extended.edits,
        phase: "planned",
        request,
        resources: resources.files.map(({ path, hash }) => ({
          hash,
          path,
        })),
        root,
        version: 1,
      };
    } else {
      if (!previous) {
        return yield* shaderFailure(
          "The interrupted shader insertion has no preparation journal."
        );
      }
      record = previous;
      const manifestEdit = record.edits.find((edit) =>
        edit.path.endsWith("/studio-shaders.json")
      );
      if (!manifestEdit || manifestEdit.after === null) {
        return yield* shaderFailure(
          "The preparation journal has no shader manifest."
        );
      }
      manifest = yield* parsePreparedManifest(manifestEdit.after);
    }

    const folder = `src/videos/${request.target.video}`;
    if (
      record.edits.some(
        (edit) =>
          edit.path === `${folder}/index.tsx` && edit.before !== edit.after
      ) &&
      !record.edits.some(
        (edit) => edit.path === `${folder}/${VIDEO_ORIGIN_FILE}`
      )
    ) {
      const origin = yield* shaderUpgradeOrigin(root, request.target.video);
      record = { ...record, edits: [...record.edits, origin] };
    }
    yield* verifyUpgradeOrigin(root, record);
    if (
      record.resources.length !== resources.files.length ||
      record.resources.some(
        (file) =>
          !resources.files.some(
            (prepared) =>
              file.path === prepared.path && file.hash === prepared.hash
          )
      )
    ) {
      return yield* shaderFailure(
        "The shader implementation changed since this insertion was prepared."
      );
    }
    yield* Effect.forEach(record.edits, (edit) =>
      Effect.gen(function* () {
        const current = yield* readShaderFile(root, edit.path);
        if (current !== edit.before && current !== edit.after) {
          return yield* shaderFailure(
            `${edit.path} changed independently. Resolve the source conflict before retrying.`
          );
        }
      })
    );
    return { adaptation: connection?.adaptation ?? false, manifest, record };
  }
);

const verifyUpgradeOrigin = Effect.fn("shaderInsertion.verifyUpgradeOrigin")(
  function* (root: string, record: ShaderJournalRecord) {
    const folder = `src/videos/${record.request.target.video}`;
    const origin = record.edits.find(
      (edit) => edit.path === `${folder}/${VIDEO_ORIGIN_FILE}`
    );
    const adapting = record.edits.some(
      (edit) =>
        edit.path === `${folder}/index.tsx` && edit.before !== edit.after
    );
    if (!(adapting || origin)) {
      return;
    }
    const current = yield* shaderUpgradeOrigin(
      root,
      record.request.target.video
    );
    if (!origin) {
      return yield* shaderFailure(
        "This interrupted upgrade predates creation-version verification. Cancel it and start a new shader insertion."
      );
    }
    if (origin.before !== origin.after || current.before !== origin.before) {
      return yield* shaderFailure(
        "The video's creation metadata changed during preparation. Its source was preserved; refresh before retrying."
      );
    }
  }
);
