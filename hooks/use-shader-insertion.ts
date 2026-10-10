"use client";

import { Effect, Exit, Fiber } from "effect";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { causeMessage } from "@/lib/error-message";
import type { PreviewMessageOf } from "@/lib/studio/preview";
import {
  insertShader,
  shaderInsertionStatus,
  shaderTargets,
} from "@/lib/studio/shaders";
import { BUNDLED_PREFIX } from "@/shared/library";
import { shaderTargetsAtFrame } from "@/shared/shader-target";
import type {
  ShaderInserted,
  ShaderInsertionStatus,
  ShaderInsertRequest,
  ShaderProgress,
  ShaderTargets,
} from "@/shared/shaders";
import type { ManagedObjects } from "./use-managed-objects";
import {
  type PreviewControl,
  usePreviewEpoch,
  usePreviewMessage,
} from "./use-preview";

interface InsertionState {
  readonly error: string | null;
  readonly phase: "preparing" | "preview" | "failed" | "complete";
  readonly progress: ShaderProgress | null;
  readonly request: ShaderInsertRequest;
  readonly result: ShaderInserted | null;
  readonly uncertain?: boolean;
  readonly unstarted?: boolean;
}

function storageKey(projectId: string, video: string) {
  return `remocn:shader-insertion:${JSON.stringify([projectId, video])}`;
}
function recoveryId(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, id: string | null) {
  try {
    if (id === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, id);
    }
  } catch {
    return false;
  }
}

export function useShaderInsertion({
  projectId,
  preview,
  managed,
  enabled,
  insert = insertShader,
  targets = shaderTargets,
  status = shaderInsertionStatus,
  prepare,
}: {
  projectId: string | null;
  preview: PreviewControl;
  managed: ManagedObjects;
  enabled: boolean;
  insert?: typeof insertShader;
  targets?: typeof shaderTargets;
  status?: typeof shaderInsertionStatus;
  prepare?: (revision: string) => boolean;
}) {
  const video = preview.composition;
  const scope = projectId && video ? storageKey(projectId, video) : null;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [capabilities, setCapabilities] = useState<ShaderTargets>({
    adaptation: false,
    reason: "Open a video to add a shader.",
    targets: [],
  });
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const wasEnabled = useRef(enabled);
  const preparationPrevious = useRef<string | null>(null);
  const [preparationStarting, setPreparationStarting] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [state, setState] = useState<InsertionState | null>(null);
  const [recovery, setRecovery] = useState<{
    id: string;
    error: string | null;
  } | null>(null);
  const [frame, setFrame] = useState(preview.frameOf);
  const generation = useRef<string | null>(null);
  const retiredGenerations = useRef(new Set<string>());
  const lastReport = useRef<PreviewMessageOf<"shader.targets"> | null>(null);
  const acknowledgements = useRef(
    new Map<string, PreviewMessageOf<"shader.ready">>()
  );
  const running = useRef<Fiber.Fiber<unknown, unknown> | null>(null);
  const pending = useRef<InsertionState | null>(null);
  const sequence = useRef(0);
  const epoch = usePreviewEpoch(preview);
  const publish = useCallback((next: InsertionState | null) => {
    pending.current = next;
    setState(next);
  }, []);
  const reconcile = useCallback(
    (id: string) => {
      if (!(scope && projectId && video)) {
        return;
      }
      const owned = scope;
      setRecovery({ error: null, id });
      Effect.runPromiseExit(status({ operationId: id, projectId, video })).then(
        (result) => {
          if (scopeRef.current !== owned) {
            return;
          }
          if (Exit.isFailure(result)) {
            setRecovery({
              error:
                causeMessage(result.cause) ??
                "Could not check the previous shader insertion. Retry before exporting.",
              id,
            });
            return;
          }
          setRecovery(null);
          if (result.value.state === "unknown") {
            remember(owned, null);
            return;
          }
          publish(recoveredState(result.value, id));
        }
      );
    },
    [scope, projectId, video, status, publish]
  );

  const refresh = useCallback(
    async (report?: PreviewMessageOf<"shader.targets">) => {
      if (!(projectId && video && scope)) {
        return;
      }
      const requestScope = scope;
      sequence.current += 1;
      const token = sequence.current;
      setCapabilities({
        adaptation: false,
        reason: "Checking the scene…",
        targets: [],
      });
      const result = await Effect.runPromiseExit(
        targets({
          generation: report?.generation ?? generation.current,
          projectId,
          video,
          ...(report ? { report: report.targets } : {}),
        })
      );
      if (scopeRef.current !== requestScope || token !== sequence.current) {
        return;
      }
      if (Exit.isSuccess(result)) {
        setCapabilities(result.value);
        if (
          result.value.preparation &&
          result.value.preparation.historyId !== preparationPrevious.current
        ) {
          setPreparationStarting(false);
        }
        return result.value;
      }
      setCapabilities({
        adaptation: false,
        reason:
          causeMessage(result.cause) ?? "The shader target is unavailable.",
        targets: [],
      });
    },
    [projectId, video, scope, targets]
  );

  const onTargets = useCallback(
    (message: PreviewMessageOf<"shader.targets">) => {
      if (
        message.video !== video ||
        retiredGenerations.current.has(message.generation)
      ) {
        return;
      }
      lastReport.current = message;
      if (
        generation.current === null ||
        generation.current === message.generation
      ) {
        refresh(message);
      }
    },
    [refresh, video]
  );
  const onManagedReady = useCallback(
    (message: PreviewMessageOf<"studio.ready">) => {
      if (
        message.video !== video ||
        retiredGenerations.current.has(message.generation)
      ) {
        return;
      }
      if (generation.current && generation.current !== message.generation) {
        retiredGenerations.current.add(generation.current);
      }
      generation.current = message.generation;
      const report = lastReport.current;
      refresh(report?.generation === message.generation ? report : undefined);
    },
    [refresh, video]
  );
  const onShaderReady = useCallback(
    (message: PreviewMessageOf<"shader.ready">) => {
      if (
        message.video !== video ||
        retiredGenerations.current.has(message.generation)
      ) {
        return;
      }
      acknowledgements.current.set(message.operationId, message);
      setState((value) => (value ? { ...value } : null));
    },
    [video]
  );
  const onShaderError = useCallback(
    (message: PreviewMessageOf<"shader.error">) => {
      const owner = pending.current;
      if (
        message.video !== video ||
        message.generation !== generation.current ||
        message.objectId !== owner?.request.objectId
      ) {
        return;
      }
      acknowledgements.current.delete(owner.request.operationId);
      publish({ ...owner, error: message.message, phase: "failed" });
    },
    [publish, video]
  );
  usePreviewMessage(preview, "studio.ready", onManagedReady);
  usePreviewMessage(preview, "shader.targets", onTargets);
  usePreviewMessage(preview, "shader.ready", onShaderReady);
  usePreviewMessage(preview, "shader.error", onShaderError);

  const launch = useCallback(
    (request: ShaderInsertRequest) => {
      if (running.current || !scope) {
        return;
      }
      const requestScope = scope;
      remember(scope, request.operationId);
      const initial: InsertionState = {
        error: null,
        phase: "preparing",
        progress: null,
        request,
        result: null,
      };
      publish(initial);
      const progress = (event: ShaderProgress) => {
        if (
          scopeRef.current !== requestScope ||
          event.operationId !== request.operationId
        ) {
          return;
        }
        const owner = pending.current;
        if (owner?.request.operationId === request.operationId) {
          publish({ ...owner, progress: event });
        }
      };
      const work = Effect.gen(function* () {
        const result = yield* Effect.exit(insert(request, progress));
        if (scopeRef.current !== requestScope) {
          return;
        }
        if (Exit.isSuccess(result)) {
          publish({ ...initial, phase: "preview", result: result.value });
        } else {
          const reconciled = yield* Effect.exit(
            status({
              operationId: request.operationId,
              projectId: request.target.projectId,
              video: request.target.video,
            })
          );
          if (scopeRef.current !== requestScope) {
            return;
          }
          const saved =
            Exit.isSuccess(reconciled) && reconciled.value.state === "saved"
              ? reconciled.value.result
              : null;
          publish({
            ...initial,
            error:
              causeMessage(result.cause) ??
              "Insertion was cancelled. Retry or check its saved state.",
            phase: "failed",
            result: saved,
            uncertain:
              Exit.isFailure(reconciled) ||
              (Exit.isSuccess(reconciled) &&
                reconciled.value.state === "preparing"),
            unstarted:
              Exit.isSuccess(reconciled) &&
              reconciled.value.state === "unknown",
          });
        }
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            if (scopeRef.current === requestScope) {
              running.current = null;
            }
          })
        )
      );
      running.current = Effect.runFork(work);
    },
    [insert, publish, scope, status]
  );

  useEffect(
    () => preview.onFrame(() => setFrame(preview.frameOf())),
    [preview]
  );
  useEffect(() => {
    sequence.current += 1;
    generation.current = null;
    retiredGenerations.current.clear();
    setFrame(preview.frameOf());
    lastReport.current = null;
    acknowledgements.current.clear();
    setChosen(null);
    setPreparationError(null);
    setPreparationStarting(false);
    setRecovery(null);
    publish(null);
    setCapabilities({
      adaptation: false,
      reason:
        projectId && video
          ? "Waiting for the preview's shader targets."
          : "Open a video to add a shader.",
      targets: [],
    });
    if (!(scope && projectId && video)) {
      return;
    }
    const id = recoveryId(scope);
    if (id) {
      reconcile(id);
    }
    preview.channel.send({ type: "studio.request" });
    return () => {
      const fiber = running.current;
      running.current = null;
      if (fiber) {
        Effect.runFork(Fiber.interrupt(fiber));
      }
    };
  }, [
    scope,
    projectId,
    video,
    preview.channel,
    preview.frameOf,
    publish,
    reconcile,
  ]);

  useEffect(() => {
    if (!scope) {
      return;
    }
    generation.current = null;
    setCapabilities({
      adaptation: false,
      reason: "Checking this video's shader support…",
      targets: [],
    });
    refresh();
    if (epoch.url !== null) {
      preview.channel.send({ type: "studio.request" });
    }
  }, [epoch.url, preview.channel, refresh, scope]);

  useEffect(() => {
    if (!state?.result || state.phase === "complete" || !scope) {
      return;
    }
    const ack = acknowledgements.current.get(state.request.operationId);
    if (
      !ack ||
      ack.objectId !== state.request.objectId ||
      ack.slotId !== state.request.target.slotId ||
      ack.video !== video ||
      ack.generation !== generation.current
    ) {
      return;
    }
    if (
      !managed.acceptInserted(
        state.result.snapshot,
        ack.objectId,
        ack.generation
      )
    ) {
      return;
    }
    remember(scope, null);
    publish({ ...state, error: null, phase: "complete" });
  }, [state, scope, video, managed, publish]);

  useEffect(() => {
    if (state?.phase !== "preview") {
      return;
    }
    const timeout = Effect.sleep("15 seconds").pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          const owner = pending.current;
          if (owner?.phase === "preview") {
            publish({
              ...owner,
              error:
                "The shader is saved, but its preview has not confirmed rendering. Retry the preview or Undo.",
              phase: "failed",
            });
          }
        })
      )
    );
    const fiber = Effect.runFork(timeout);
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [state?.phase, publish]);

  const eligible = useMemo(
    () => shaderTargetsAtFrame(capabilities.targets, frame),
    [capabilities.targets, frame]
  );
  const target =
    eligible.find((item) => item.slotId === chosen) ??
    (eligible.length === 1 ? eligible[0] : null);
  const busy = state?.phase === "preparing" || state?.phase === "preview";
  const preparing =
    preparationStarting ||
    (capabilities.preparation !== undefined &&
      !["ready", "failed"].includes(capabilities.preparation.phase));
  const blockExport =
    preparing ||
    recovery !== null ||
    (state !== null &&
      state.phase !== "complete" &&
      (busy || state.result !== null || state.uncertain === true));
  let unavailable = capabilities.reason;
  if (!target && unavailable === null) {
    unavailable =
      eligible.length > 1
        ? "Choose a scene for this shader."
        : "No supported shader scene is active at this frame.";
  }
  if (busy) {
    unavailable = "A shader is being added.";
  }
  if (blockExport && !busy) {
    unavailable =
      "Resolve the previous shader insertion before adding another.";
  }
  if (!enabled) {
    unavailable = "Finish the current edit before adding a shader.";
  }

  if (preparing) {
    unavailable =
      capabilities.preparation?.message ?? "Starting shader preparation…";
  }

  const onPick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (unavailable || !target) {
        return;
      }
      launch({
        objectId: `shader-${crypto.randomUUID()}`,
        operationId: crypto.randomUUID(),
        slug: event.currentTarget.value.replace(BUNDLED_PREFIX, ""),
        target,
      });
    },
    [launch, target, unavailable]
  );
  const retry = useCallback(() => {
    if (recovery) {
      reconcile(recovery.id);
      return;
    }
    const owner = pending.current;
    if (!owner) {
      refresh();
      return;
    }
    if (owner.result) {
      publish({ ...owner, error: null, phase: "preview" });
      preview.restart();
    } else if (owner.unstarted) {
      const report = lastReport.current;
      refresh(
        report?.generation === generation.current ? report : undefined
      ).then((available) => {
        if (pending.current !== owner || scopeRef.current !== scope) {
          return;
        }
        const next = available?.targets.find(
          (item) =>
            item.slotId === owner.request.target.slotId &&
            item.sceneId === owner.request.target.sceneId &&
            item.generation === generation.current &&
            item.from === owner.request.target.from &&
            item.durationInFrames === owner.request.target.durationInFrames &&
            item.fps === owner.request.target.fps
        );
        if (next) {
          launch({ ...owner.request, target: next });
        }
      });
    } else {
      launch(owner.request);
    }
  }, [launch, preview, publish, refresh, recovery, reconcile, scope]);
  const cancel = useCallback(() => {
    const fiber = running.current;
    const owner = pending.current;
    const ownedScope = scope;
    if (!(owner && fiber && ownedScope)) {
      return;
    }
    publish({ ...owner, error: null, phase: "preparing", uncertain: true });
    const cancelAndCheck = Effect.gen(function* () {
      yield* Fiber.interrupt(fiber);
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const result = yield* status({
          operationId: owner.request.operationId,
          projectId: owner.request.target.projectId,
          video: owner.request.target.video,
        });
        if (result.state !== "preparing") {
          return result;
        }
        yield* Effect.sleep("200 millis");
      }
      return null;
    });
    Effect.runPromiseExit(cancelAndCheck).then((result) => {
      if (
        scopeRef.current !== ownedScope ||
        pending.current?.request.operationId !== owner.request.operationId
      ) {
        return;
      }
      if (Exit.isFailure(result) || result.value === null) {
        publish({
          ...owner,
          error:
            "Cancellation is still being reconciled. Retry to check whether the shader was saved.",
          phase: "failed",
          uncertain: true,
        });
        return;
      }
      const recovered = result.value;
      if (recovered.state === "saved") {
        publish({
          ...owner,
          error: null,
          phase: "preview",
          result: recovered.result,
          uncertain: false,
        });
      } else {
        publish({
          ...owner,
          error: "Insertion was cancelled before saving. Retry to add it.",
          phase: "failed",
          uncertain: false,
        });
      }
    });
  }, [publish, scope, status]);
  const undo = useCallback(() => {
    const owner = pending.current;
    const operation = owner?.result?.snapshot.document.operations.find(
      (item) => item.id === owner.request.operationId
    );
    if (!(owner && operation)) {
      return;
    }
    managed.undoOperation(operation).then((error) => {
      if (
        scopeRef.current !== scope ||
        pending.current?.request.operationId !== owner.request.operationId
      ) {
        return;
      }
      if (error) {
        publish({ ...owner, error, phase: "failed" });
      } else {
        if (scope) {
          remember(scope, null);
        }
        publish(null);
      }
    });
  }, [managed, publish, scope]);
  const prepareVideo = useCallback(() => {
    if (!enabled || preparing || !capabilities.preparationRevision) {
      return;
    }
    if (!prepare) {
      setPreparationError(
        "A configured agent is required. Select an available provider in the chat and retry."
      );
      return;
    }
    if (!prepare(capabilities.preparationRevision)) {
      setPreparationError(
        "Preparation could not start. Finish the current turn and check the selected agent, then retry."
      );
      return;
    }
    setPreparationError(null);
    preparationPrevious.current = capabilities.preparation?.historyId ?? null;
    setPreparationStarting(true);
  }, [
    enabled,
    preparing,
    capabilities.preparationRevision,
    capabilities.preparation?.historyId,
    prepare,
  ]);

  useEffect(() => {
    if (!preparing) {
      return;
    }
    const timer = window.setInterval(
      () => refresh(lastReport.current ?? undefined),
      1000
    );
    return () => window.clearInterval(timer);
  }, [preparing, refresh]);

  useEffect(() => {
    if (!preparationStarting) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPreparationStarting(false);
      setPreparationError(
        "Preparation has not started. Check the chat for the agent's error and retry."
      );
      refresh(lastReport.current ?? undefined);
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [preparationStarting, refresh]);

  // A failed provider can finish before it creates a preparation record.
  useEffect(() => {
    const previous = wasEnabled.current;
    wasEnabled.current = enabled;
    if (enabled && !previous) {
      refresh(lastReport.current ?? undefined);
    }
  }, [enabled, refresh]);

  return useMemo(
    () => ({
      adaptation: capabilities.adaptation,
      blockExport,
      busy,
      cancel,
      canPrepare: capabilities.preparationRevision !== undefined,
      eligible,
      onPick,
      preparation: capabilities.preparation,
      preparationDisabled: !enabled || preparing,
      preparationError,
      prepareVideo,
      preparing,
      recovery,
      retry,
      selectTarget: setChosen,
      state,
      target,
      unavailable,
      undo,
    }),
    [
      capabilities,
      prepareVideo,
      preparationError,
      preparing,
      enabled,
      blockExport,
      busy,
      cancel,
      eligible,
      onPick,
      recovery,
      retry,
      state,
      target,
      unavailable,
      undo,
    ]
  );
}

export type ShaderInsertion = ReturnType<typeof useShaderInsertion>;

function recoveredState(
  recovered: Exclude<ShaderInsertionStatus, { state: "unknown" }>,
  id: string
): InsertionState | null {
  if (recovered.state !== "saved") {
    return {
      error:
        recovered.state === "failed"
          ? recovered.message
          : "Shader preparation was interrupted. Retry to finish this insertion.",
      phase: "failed",
      progress: null,
      request: recovered.request,
      result: null,
      uncertain: recovered.state === "preparing",
    };
  }
  const operation = recovered.result.snapshot.document.operations.find(
    (item) => item.id === id
  );
  if (
    !(operation && "kind" in operation) ||
    operation.kind !== "create" ||
    !operation.object.shader
  ) {
    return null;
  }
  return {
    error: null,
    phase: "preview",
    progress: null,
    request: {
      objectId: operation.objectId,
      operationId: id,
      slug: operation.object.shader.slug,
      target: operation.target,
    },
    result: recovered.result,
  };
}
