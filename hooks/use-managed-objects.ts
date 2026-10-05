"use client";

import { Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { causeMessage } from "@/lib/error-message";
import { inlineTextField } from "@/lib/studio/inline-text";
import {
  readManagedObjects,
  removeManagedObject,
  writeManagedObject,
} from "@/lib/studio/managed-objects";
import type { StagedDocument } from "@/lib/studio/native-preview";
import {
  hideCommand,
  managedSelector,
  type PreviewCommand,
  type PreviewMessageOf,
  unhideCommand,
} from "@/lib/studio/preview";
import type { PreviewChannel } from "@/lib/studio/preview-channel";
import {
  fieldProblem,
  inverseStudioOperation,
  isObjectOperation,
  isRemoved,
  SCENE_DEFINITION,
  type StudioDefinition,
  type StudioFieldOperation,
  type StudioObject,
  type StudioObjectOperation,
  type StudioOperation,
  type StudioSnapshot,
  type StudioValue,
  sameStudioValue,
  studioOperationChanges,
} from "@/shared/studio-document";
import { GEOMETRY_KEYS, type GeometryBinding } from "@/shared/studio-geometry";
import {
  type PreviewControl,
  usePreviewEpoch,
  usePreviewMessage,
} from "./use-preview";

interface Draft {
  attempted: boolean;
  error: string | null;
  operation: StudioFieldOperation;
  saving: boolean;
}

export interface VideoRef {
  readonly projectId: string;
  readonly video: string;
}

export type Removal =
  | {
      readonly from: VideoRef;
      readonly label: string;
      readonly ok: true;
      readonly operation: StudioObjectOperation;
      readonly upgraded: string | null;
    }
  | { readonly error: string; readonly ok: false };

interface Session {
  awaitingOperation: string | null;
  commitAgain: boolean;
  dismissed: boolean;
  drafts: Map<string, Draft>;
  epoch: number;
  error: string | null;
  generation: string | null;
  loading: boolean;
  open: boolean;
  projectId: string;
  removing: boolean;
  renderedOperation: string | null;
  selected: string | null;
  snapshot: StudioSnapshot | null;
  undoing: boolean;
  video: string;
  writing: boolean;
  written: Map<string, number>;
}

type GeometryBegin = PreviewMessageOf<"studio.geometry.begin">;
type GeometryCommit = PreviewMessageOf<"studio.geometry.commit">;
type TextRequest = PreviewMessageOf<"studio.text.request">;
type TextCommit = PreviewMessageOf<"studio.text.commit">;

const LIVE = [
  "studio.geometry.begin",
  "studio.geometry.cancel",
  "studio.geometry.commit",
  "studio.geometry.request",
  "studio.text.cancel",
  "studio.text.commit",
  "studio.text.request",
] as const;
type LiveType = (typeof LIVE)[number];
type Live = { [K in LiveType]: (message: PreviewMessageOf<K>) => void };

function useLiveMessages(
  channel: PreviewChannel,
  live: { readonly current: Live | null },
  owned: () => boolean
): void {
  useEffect(() => {
    const listen = <K extends LiveType>(type: K) =>
      channel.on(type, (message) => {
        if (owned()) {
          live.current?.[type](message);
        }
      });
    const stops = LIVE.map(listen);
    return () => {
      for (const stop of stops) {
        stop();
      }
    };
  }, [channel, live, owned]);
}

interface Options {
  armed: boolean;
  enabled: boolean;
  inlineEnabled?: boolean;
  preview: PreviewControl;
  projectId: string | null;
  read?: typeof readManagedObjects;
  removeObject?: typeof removeManagedObject;
  write?: typeof writeManagedObject;
}

export function useManagedObjects({
  projectId,
  preview,
  enabled,
  inlineEnabled = enabled,
  armed,
  read = readManagedObjects,
  removeObject = removeManagedObject,
  write = writeManagedObject,
}: Options) {
  const [localRevision, repaint] = useState(0);
  const sessions = useRef(new Map<string, Session>());
  const active = useRef<Session | null>(null);
  const commitRef = useRef<(owner: Session | null) => void>(() => undefined);
  const { channel, composition } = preview;
  const { send } = channel;
  const served = usePreviewEpoch(preview).url;
  const allowed = useRef(enabled);
  allowed.current = enabled;
  const inlineOn = inlineEnabled && enabled;
  const inlineAllowed = useRef(inlineOn);
  inlineAllowed.current = inlineOn;
  const inline = useRef<{
    generation: string;
    operation: StudioFieldOperation;
    owner: Session;
    requestId: string;
  } | null>(null);
  const geometry = useRef<{
    binding: GeometryBinding;
    generation: string;
    objectId: string;
    owner: Session;
    requestId: string;
    snapshot: StudioSnapshot;
  } | null>(null);
  const live = useRef<Live | null>(null);
  const geometryConfigRef = useRef<Extract<
    PreviewCommand,
    { type: "studio.geometry.config" }
  > | null>(null);
  const publish = useCallback(() => repaint((value) => value + 1), []);
  const cancelInline = useCallback(() => {
    const editing = inline.current;
    inline.current = null;
    if (editing !== null) {
      send({
        error: null,
        requestId: editing.requestId,
        type: "studio.text.close",
      });
      publish();
    }
  }, [publish, send]);
  const cancelGeometry = useCallback(() => {
    const gesture = geometry.current;
    geometry.current = null;
    if (gesture !== null) {
      send({
        error: "The transform was cancelled.",
        requestId: gesture.requestId,
        type: "studio.geometry.result",
      });
      publish();
    }
  }, [publish, send]);
  const key = registerSession(sessions.current, projectId, composition);
  const session = key === null ? null : (sessions.current.get(key) ?? null);
  active.current = session;

  const broadcast = useCallback(
    (
      owner: Session,
      operation: Pick<
        StudioFieldOperation,
        "field" | "objectId" | "after" | "changes"
      >
    ) => {
      if (active.current !== owner || owner.generation === null) {
        return;
      }
      if (operation.changes?.length) {
        send({
          generation: owner.generation,
          objectId: operation.objectId,
          type: "studio.batch",
          values: Object.fromEntries([
            [operation.field, operation.after],
            ...operation.changes.map((item) => [item.field, item.after]),
          ]),
        });
        return;
      }
      send({
        field: operation.field,
        generation: owner.generation,
        objectId: operation.objectId,
        type: "studio.draft",
        value: operation.after,
      });
    },
    [send]
  );

  const replay = useCallback(
    (owner: Session, snapshot: StudioSnapshot) => {
      for (const object of snapshot.document.objects) {
        for (const [field, value] of Object.entries(object.values)) {
          broadcast(owner, { after: value, field, objectId: object.id });
        }
      }
      for (const draft of owner.drafts.values()) {
        if (draft.error === null) {
          broadcast(owner, draft.operation);
        }
      }
    },
    [broadcast]
  );

  const reload = useCallback(() => {
    const owner = active.current;
    if (owner === null || !allowed.current || owner.generation === null) {
      return;
    }
    owner.epoch += 1;
    const { epoch } = owner;
    owner.loading = true;
    publish();
    Effect.runPromiseExit(
      read({ projectId: owner.projectId, video: owner.video })
    ).then((result) => {
      if (epoch !== owner.epoch) {
        return;
      }
      owner.loading = false;
      if (Exit.isFailure(result)) {
        owner.error =
          causeMessage(result.cause) ??
          "The object's properties could not be loaded.";
      } else {
        owner.snapshot = result.value;
        owner.error = null;
        if (
          owner.selected !== null &&
          (!result.value.document.objects.some(
            (object) => object.id === owner.selected
          ) ||
            isRemoved(result.value.document.objects, owner.selected))
        ) {
          owner.selected = null;
        }
        replay(owner, result.value);
      }
      publish();
    });
  }, [publish, read, replay]);

  const owned = useCallback(
    () => active.current !== null && allowed.current,
    []
  );
  useLiveMessages(channel, live, owned);

  const onReady = useCallback(
    (message: PreviewMessageOf<"studio.ready">) => {
      const owner = active.current;
      if (owner === null || !allowed.current || message.video !== owner.video) {
        return;
      }
      if (owner.generation !== message.generation) {
        cancelInline();
        cancelGeometry();
      }
      owner.generation = message.generation;
      owner.renderedOperation = message.lastOperationId;
      reload();
    },
    [cancelGeometry, cancelInline, reload]
  );
  usePreviewMessage(preview, "studio.ready", onReady);

  const onSelect = useCallback(
    (message: PreviewMessageOf<"studio.select">) => {
      const owner = active.current;
      if (
        owner === null ||
        !allowed.current ||
        message.video !== owner.video ||
        message.generation !== owner.generation
      ) {
        return;
      }
      commitRef.current(owner);
      owner.dismissed = false;
      owner.selected = message.objectId;
      owner.open = true;
      publish();
    },
    [publish]
  );
  usePreviewMessage(preview, "studio.select", onSelect);

  const onSelection = useCallback(() => {
    const owner = active.current;
    if (owner === null || !allowed.current) {
      return;
    }
    commitRef.current(owner);
    owner.dismissed = true;
    owner.open = false;
    publish();
  }, [publish]);
  usePreviewMessage(preview, "selection", onSelection);

  // biome-ignore lint/correctness/useExhaustiveDependencies: an open text edit is cancelled whenever the session, the permissions or the served preview change
  useEffect(
    () => cancelInline,
    [cancelInline, session, enabled, inlineEnabled, served]
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: a live gesture is cancelled whenever the session, the permissions or the served preview change
  useEffect(
    () => cancelGeometry,
    [cancelGeometry, session, enabled, inlineEnabled, served]
  );

  useEffect(() => {
    if (enabled && key !== null && preview.isServing) {
      send({ type: "studio.request" });
    }
  }, [enabled, key, preview.isServing, send]);

  useEffect(() => {
    if (armed && session) {
      session.dismissed = false;
      publish();
    }
  }, [armed, session, publish]);

  const isOpen =
    enabled &&
    session !== null &&
    (session.open ||
      (armed && !session.dismissed && session.generation !== null));
  const selected =
    session?.snapshot?.document.objects.find(
      (object, _index, all) =>
        object.id === session.selected && !isRemoved(all, object.id)
    ) ?? null;
  const definition =
    session?.snapshot?.document.definitions.find(
      (item) => item.id === selected?.definition
    ) ?? null;
  const generation = session?.generation;
  const revision = session?.snapshot?.revision;
  const video = session?.video;
  useEffect(() => {
    if (!(generation && revision && video)) {
      return;
    }
    send({
      generation,
      objectId: isOpen ? (selected?.id ?? null) : null,
      type: "studio.highlight",
      video,
    });
  }, [isOpen, selected?.id, send, generation, revision, video]);

  const geometryAvailable =
    inlineEnabled &&
    enabled &&
    isOpen &&
    !session?.loading &&
    !session?.writing &&
    !session?.undoing &&
    session?.drafts.size === 0 &&
    inline.current === null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessions are mutated in place, so localRevision is what invalidates the held draft values
  const geometryConfig = useMemo(() => {
    if (!(generation && video)) {
      return null;
    }
    return {
      enabled: geometryAvailable,
      fields: geometryFields(session, selected, definition),
      generation,
      objectId: isOpen ? (selected?.id ?? null) : null,
      type: "studio.geometry.config" as const,
      video,
    };
  }, [
    definition,
    generation,
    geometryAvailable,
    isOpen,
    localRevision,
    selected,
    session,
    video,
  ]);
  geometryConfigRef.current = geometryConfig;
  useEffect(() => {
    if (geometryConfig) {
      send(geometryConfig);
    }
  }, [geometryConfig, send]);

  const select = useCallback(
    (id: string) => {
      cancelGeometry();
      const owner = active.current;
      if (owner !== null) {
        commitRef.current(owner);
        owner.dismissed = false;
        owner.selected = id;
        owner.open = true;
        publish();
      }
    },
    [cancelGeometry, publish]
  );

  const open = useCallback(() => {
    const owner = active.current;
    if (owner !== null && owner.generation !== null && allowed.current) {
      owner.dismissed = false;
      owner.open = true;
      publish();
    }
  }, [publish]);

  const change = useCallback(
    (fieldId: string, value: StudioValue) => {
      const owner = active.current;
      const object = owner?.snapshot?.document.objects.find(
        (item) => item.id === owner.selected
      );
      const declared = owner?.snapshot?.document.definitions.find(
        (item) => item.id === object?.definition
      );
      const field = declared?.fields.find((item) => item.id === fieldId);
      if (
        !allowed.current ||
        geometry.current !== null ||
        inline.current !== null ||
        owner === null ||
        object === undefined ||
        declared === undefined ||
        field === undefined
      ) {
        return;
      }
      const address = JSON.stringify([object.id, fieldId]);
      const held = draftForField(owner, object.id, fieldId)?.draft;
      if (held?.attempted || owner.undoing) {
        return;
      }
      const operation = {
        ...(held?.operation ?? {
          before: object.values[fieldId],
          definition: declared,
          field: fieldId,
          id: crypto.randomUUID(),
          objectId: object.id,
        }),
        after: value,
      };
      if (sameStudioValue(value, operation.before)) {
        owner.drafts.delete(address);
        broadcast(owner, operation);
        publish();
        return;
      }
      const error = fieldProblem(field, value);
      owner.drafts.set(address, {
        attempted: false,
        error,
        operation,
        saving: false,
      });
      if (error === null) {
        broadcast(owner, operation);
      }
      publish();
    },
    [broadcast, publish]
  );

  const commitOwner = useCallback(
    (owner: Session | null) => {
      if (owner === null || !allowed.current || owner.undoing) {
        return;
      }
      if (owner.writing) {
        owner.commitAgain = true;
        return;
      }
      const pending = [...owner.drafts.entries()].filter(
        ([, draft]) => !draft.saving && draft.error === null
      );
      if (pending.length === 0) {
        return;
      }
      owner.writing = true;
      for (const [, draft] of pending) {
        draft.saving = true;
        draft.attempted = true;
      }
      publish();
      Effect.runPromiseExit(
        Effect.forEach(
          pending,
          ([address, draft]) =>
            Effect.gen(function* () {
              const result = yield* Effect.exit(
                write({
                  operation: draft.operation,
                  projectId: owner.projectId,
                  video: owner.video,
                })
              );
              if (Exit.isFailure(result)) {
                draft.error =
                  causeMessage(result.cause) ??
                  "This change could not be saved.";
                draft.saving = false;
              } else {
                owner.epoch += 1;
                owner.loading = false;
                owner.snapshot = result.value;
                owner.awaitingOperation =
                  result.value.document.operations.at(-1)?.id ?? null;
                owner.written.set(draft.operation.id, Date.now());
                owner.drafts.delete(address);
              }
              publish();
            }),
          { concurrency: 1 }
        )
      ).then((result) => {
        owner.writing = false;
        if (Exit.isFailure(result)) {
          owner.error = causeMessage(result.cause) ?? "Saving failed.";
        }
        publish();
        if (owner.commitAgain) {
          owner.commitAgain = false;
          commitRef.current(owner);
        }
      });
    },
    [publish, write]
  );
  commitRef.current = commitOwner;
  const geometryResult = (requestId: string, error: string | null) =>
    send({
      error,
      requestId,
      type: "studio.geometry.result",
    });
  const beginGeometry = (message: GeometryBegin) => {
    const owner = active.current;
    if (
      !(inlineAllowed.current && owner?.snapshot) ||
      owner.generation !== message.generation ||
      owner.video !== message.video ||
      owner.selected !== message.objectId ||
      owner.loading ||
      owner.writing ||
      owner.undoing ||
      owner.drafts.size > 0 ||
      inline.current ||
      geometry.current
    ) {
      geometryResult(
        message.requestId,
        "Finish the current edit before transforming this object."
      );
      return;
    }
    const object = owner.snapshot.document.objects.find(
      (item) => item.id === message.objectId
    );
    const declared = owner.snapshot.document.definitions.find(
      (item) => item.id === object?.definition
    );
    const fields = Object.values(message.binding).filter(
      (field): field is string => field !== null
    );
    if (
      !(object && declared) ||
      new Set(fields).size !== fields.length ||
      geometryMismatch(object, declared, message)
    ) {
      geometryResult(
        message.requestId,
        "This object does not declare editable geometry."
      );
      return;
    }
    geometry.current = {
      binding: message.binding,
      generation: message.generation,
      objectId: object.id,
      owner,
      requestId: message.requestId,
      snapshot: owner.snapshot,
    };
    publish();
  };
  const commitGeometry = (message: GeometryCommit) => {
    const gesture = geometry.current;
    if (gesture?.requestId !== message.requestId) {
      return;
    }
    const { owner, snapshot, objectId, binding } = gesture;
    geometry.current = null;
    const object = snapshot.document.objects.find(
      (item) => item.id === objectId
    );
    const declared = snapshot.document.definitions.find(
      (item) => item.id === object?.definition
    );
    if (
      !inlineAllowed.current ||
      active.current !== owner ||
      owner.generation !== gesture.generation ||
      owner.snapshot?.revision !== snapshot.revision ||
      owner.loading ||
      owner.writing ||
      owner.undoing ||
      owner.drafts.size > 0 ||
      !(object && declared)
    ) {
      geometryResult(
        message.requestId,
        "The object changed during the gesture. Try again."
      );
      publish();
      return;
    }
    const changes = geometryChanges(object, binding, message.values);
    const problem = geometryProblem(declared, changes);
    if (problem) {
      geometryResult(message.requestId, problem);
    } else if (changes.length > 0) {
      const [first, ...rest] = changes;
      const operation: StudioFieldOperation = {
        ...first,
        changes: rest,
        definition: declared,
        id: crypto.randomUUID(),
        objectId,
      };
      owner.drafts.set(JSON.stringify([objectId, first.field]), {
        attempted: false,
        error: null,
        operation,
        saving: false,
      });
      broadcast(owner, operation);
      commitOwner(owner);
      geometryResult(message.requestId, null);
    } else {
      geometryResult(message.requestId, null);
    }
    publish();
  };
  const textReply = (requestId: string, error: string | null) =>
    send({
      error,
      requestId,
      type: "studio.text.close",
    });
  const requestInline = (message: TextRequest) => {
    cancelInline();
    const owner = active.current;
    if (
      !inlineAllowed.current ||
      owner === null ||
      owner.video !== message.video ||
      owner.generation !== message.generation
    ) {
      textReply(
        message.requestId,
        "Text editing is unavailable in this preview."
      );
      return;
    }
    if (
      owner.loading ||
      owner.writing ||
      owner.undoing ||
      owner.drafts.size > 0 ||
      geometry.current
    ) {
      textReply(
        message.requestId,
        "Finish saving the current properties, then edit this text."
      );
      return;
    }
    const object = owner.snapshot?.document.objects.find(
      (item) => item.id === message.objectId
    );
    const declared = owner.snapshot?.document.definitions.find(
      (item) => item.id === object?.definition
    );
    const match =
      object && declared
        ? inlineTextField(object, declared, message.candidates)
        : null;
    if (!(object && declared && match)) {
      textReply(
        message.requestId,
        "Edit this text in Properties; its text field is not uniquely bound."
      );
      return;
    }
    const value = object.values[match.field.id];
    if (typeof value !== "string") {
      return;
    }
    inline.current = {
      generation: message.generation,
      operation: {
        after: value,
        before: value,
        definition: declared,
        field: match.field.id,
        id: crypto.randomUUID(),
        objectId: object.id,
      },
      owner,
      requestId: message.requestId,
    };
    owner.selected = object.id;
    owner.open = true;
    owner.dismissed = false;
    send({
      candidate: match.candidate,
      label: match.field.label,
      requestId: message.requestId,
      type: "studio.text.open",
      value,
    });
    publish();
  };
  const commitInline = (message: TextCommit) => {
    const editing = inline.current;
    if (editing === null || editing.requestId !== message.requestId) {
      return;
    }
    const { owner, operation } = editing;
    const object = owner.snapshot?.document.objects.find(
      (item) => item.id === operation.objectId
    );
    if (
      !inlineAllowed.current ||
      active.current !== owner ||
      owner.generation !== editing.generation ||
      !object ||
      !sameStudioValue(object.values[operation.field], operation.before) ||
      owner.loading ||
      owner.writing ||
      owner.undoing ||
      owner.drafts.size > 0
    ) {
      textReply(
        message.requestId,
        "Properties changed during editing. Copy your text, then reopen the field."
      );
      return;
    }
    inline.current = null;
    if (!sameStudioValue(message.value, operation.before)) {
      const updated = { ...operation, after: message.value };
      owner.drafts.set(JSON.stringify([operation.objectId, operation.field]), {
        attempted: false,
        error: null,
        operation: updated,
        saving: false,
      });
      broadcast(owner, updated);
      commitOwner(owner);
    }
    textReply(message.requestId, null);
    publish();
  };
  live.current = {
    "studio.geometry.begin": beginGeometry,
    "studio.geometry.cancel": (message) => {
      if (geometry.current?.requestId === message.requestId) {
        geometry.current = null;
        publish();
      }
    },
    "studio.geometry.commit": commitGeometry,
    "studio.geometry.request": () => {
      if (geometryConfigRef.current) {
        send(geometryConfigRef.current);
      }
    },
    "studio.text.cancel": (message) => {
      if (inline.current?.requestId === message.requestId) {
        inline.current = null;
        publish();
      }
    },
    "studio.text.commit": commitInline,
    "studio.text.request": requestInline,
  };
  const commit = useCallback(() => commitOwner(active.current), [commitOwner]);
  const acceptsPreview = useCallback((ready: StagedDocument | null) => {
    const owner = active.current;
    if (ready === null || owner === null || owner.video !== ready.video) {
      return true;
    }
    if (
      geometry.current !== null ||
      inline.current !== null ||
      owner.writing ||
      owner.undoing ||
      owner.removing
    ) {
      return false;
    }
    return !rendersBehind(owner, ready.lastOperationId);
  }, []);
  const retry = useCallback(() => {
    const owner = active.current;
    if (!owner) {
      return;
    }
    for (const draft of owner.drafts.values()) {
      if (draft.attempted && !draft.saving) {
        draft.error = null;
      }
    }
    commitOwner(owner);
  }, [commitOwner]);

  const discard = useCallback(() => {
    const owner = active.current;
    if (owner === null) {
      return;
    }
    for (const [address, draft] of owner.drafts) {
      if (draft.saving) {
        continue;
      }
      const object = owner.snapshot?.document.objects.find(
        (item) => item.id === draft.operation.objectId
      );
      broadcast(owner, {
        ...draft.operation,
        after: object?.values[draft.operation.field] ?? draft.operation.before,
        changes: draft.operation.changes?.map((item) => ({
          ...item,
          after: object?.values[item.field] ?? item.before,
        })),
      });
      owner.drafts.delete(address);
    }
    publish();
    reload();
  }, [broadcast, publish, reload]);

  const operations = session?.snapshot?.document.operations ?? [];
  const undoable = lastUndoable(operations);
  const undoOperation = useCallback(
    (target: StudioOperation, from?: VideoRef): Promise<string | null> => {
      const owner = active.current;
      if (owner === null || !allowed.current) {
        return Promise.resolve(null);
      }
      const refusal = undoRefusal(owner, target, from, {
        editing: geometry.current !== null || inline.current !== null,
      });
      if (refusal !== null) {
        return Promise.resolve(refusal || null);
      }
      owner.undoing = true;
      owner.error = null;
      publish();
      const operation = inverseStudioOperation(target, crypto.randomUUID());
      return Effect.runPromiseExit(
        write({
          operation,
          projectId: owner.projectId,
          video: owner.video,
        })
      ).then((result) => {
        owner.undoing = false;
        if (Exit.isFailure(result)) {
          const error =
            causeMessage(result.cause) ?? "The change could not be undone.";
          owner.error = error;
          publish();
          return error;
        }
        owner.epoch += 1;
        owner.loading = false;
        owner.snapshot = result.value;
        owner.awaitingOperation =
          result.value.document.operations.at(-1)?.id ?? null;
        if (isObjectOperation(target)) {
          owner.selected = target.objectId;
          owner.open = true;
          owner.dismissed = false;
        } else if (!isObjectOperation(operation)) {
          broadcast(owner, operation);
        }
        publish();
        return null;
      });
    },
    [broadcast, publish, write]
  );
  const undo = useCallback(
    (): Promise<string | null> =>
      undoable ? undoOperation(undoable) : Promise.resolve(null),
    [undoOperation, undoable]
  );

  const remove = useCallback(
    (objectId: string): Promise<Removal | null> => {
      const owner = active.current;
      const document = owner?.snapshot?.document;
      const object = document?.objects.find((item) => item.id === objectId);
      if (
        owner === null ||
        document === undefined ||
        object === undefined ||
        !allowed.current ||
        owner.undoing ||
        owner.removing ||
        object.definition === SCENE_DEFINITION ||
        isRemoved(document.objects, objectId)
      ) {
        return Promise.resolve(null);
      }
      if ([...owner.drafts.values()].some((draft) => draft.saving)) {
        owner.error = "Wait for the change to finish saving, then delete.";
        publish();
        return Promise.resolve(null);
      }
      cancelInline();
      cancelGeometry();
      const hidden = document.objects
        .filter(
          (item) =>
            !isRemoved(document.objects, item.id) &&
            withinTree(document.objects, item.id, objectId)
        )
        .map((item) => item.id);
      for (const [address, draft] of owner.drafts) {
        if (hidden.includes(draft.operation.objectId)) {
          owner.drafts.delete(address);
        }
      }
      const operation: StudioObjectOperation = {
        id: crypto.randomUUID(),
        kind: "remove",
        objectId,
      };
      const wasSelected =
        owner.selected !== null && hidden.includes(owner.selected);
      send(hideCommand(operation.id, hidden.map(managedSelector)));
      if (wasSelected) {
        send({ type: "inspect.clear" });
        owner.selected = null;
        owner.open = false;
        owner.dismissed = true;
      }
      owner.removing = true;
      owner.error = null;
      publish();
      return Effect.runPromiseExit(
        removeObject({
          operation,
          projectId: owner.projectId,
          video: owner.video,
        })
      ).then((result): Removal => {
        owner.removing = false;
        if (Exit.isFailure(result)) {
          const error =
            causeMessage(result.cause) ?? "The object could not be deleted.";
          send(unhideCommand(operation.id));
          if (wasSelected) {
            owner.selected = objectId;
            owner.open = true;
            owner.dismissed = false;
          }
          owner.error = error;
          if (owner.snapshot !== null) {
            replay(owner, owner.snapshot);
          }
          publish();
          return { error, ok: false };
        }
        owner.epoch += 1;
        owner.loading = false;
        owner.snapshot = {
          document: result.value.document,
          revision: result.value.revision,
        };
        owner.awaitingOperation = operation.id;
        owner.written.set(operation.id, Date.now());
        publish();
        return {
          from: { projectId: owner.projectId, video: owner.video },
          label: object.label,
          ok: true,
          operation,
          upgraded: result.value.upgraded,
        };
      });
    },
    [cancelGeometry, cancelInline, publish, removeObject, replay, send]
  );

  const close = useCallback(() => {
    cancelInline();
    cancelGeometry();
    const owner = active.current;
    if (owner !== null) {
      commit();
      owner.open = false;
      owner.dismissed = true;
      owner.selected = null;
      publish();
    }
  }, [cancelGeometry, cancelInline, commit, publish]);

  const drafts = [...(session?.drafts.values() ?? [])];
  const awaitingPreview =
    session === null
      ? false
      : rendersBehind(session, session.renderedOperation);
  const isGesturing = geometry.current !== null;
  const editingText = inline.current !== null;
  const busy = isBusy(session, drafts) || isGesturing;
  const canUndo =
    enabled &&
    undoable !== undefined &&
    drafts.length === 0 &&
    !isGesturing &&
    !editingText &&
    !session?.undoing;
  const failure =
    session?.error ?? drafts.find((draft) => draft.error)?.error ?? null;
  const isLoading = session?.loading ?? false;
  const allObjects = session?.snapshot?.document.objects ?? NO_OBJECTS;
  const objects = useMemo(
    (): readonly StudioObject[] =>
      allObjects.filter((item) => !isRemoved(allObjects, item.id)),
    [allObjects]
  );
  const undoableAt = stampOf(session, undoable);
  const pending = drafts.length;
  const isLocked = isGesturing || editingText;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the session is mutated in place and `localRevision` is what every mutation publishes
  const fields = useMemo(
    () => fieldStates(session, selected, definition, isLocked),
    [localRevision, session, selected, definition, isLocked]
  );

  return useMemo(
    () => ({
      acceptsPreview,
      awaitingPreview,
      busy,
      canUndo,
      change,
      close,
      commit,
      definition,
      discard,
      editingText,
      enabled,
      error: failure,
      fields,
      isOpen,
      loading: isLoading,
      objects,
      open,
      pending,
      reload,
      remove,
      retry,
      select,
      selected,
      undo,
      undoableAt,
      undoOperation,
    }),
    [
      acceptsPreview,
      awaitingPreview,
      busy,
      canUndo,
      change,
      close,
      commit,
      definition,
      discard,
      editingText,
      enabled,
      failure,
      fields,
      isLoading,
      isOpen,
      objects,
      open,
      pending,
      reload,
      remove,
      retry,
      select,
      selected,
      undo,
      undoableAt,
      undoOperation,
    ]
  );
}

const NO_OBJECTS: readonly StudioObject[] = [];

export type ManagedObjects = ReturnType<typeof useManagedObjects>;

function registerSession(
  sessions: Map<string, Session>,
  projectId: string | null,
  video: string | null
) {
  if (projectId === null || video === null) {
    return null;
  }
  const key = JSON.stringify([projectId, video]);
  if (!sessions.has(key)) {
    sessions.set(key, newSession(projectId, video));
  }
  return key;
}

function newSession(projectId: string, video: string): Session {
  return {
    awaitingOperation: null,
    commitAgain: false,
    dismissed: false,
    drafts: new Map(),
    epoch: 0,
    error: null,
    generation: null,
    loading: false,
    open: false,
    projectId,
    removing: false,
    renderedOperation: null,
    selected: null,
    snapshot: null,
    undoing: false,
    video,
    writing: false,
    written: new Map(),
  };
}

const EDITING_REFUSAL = "Finish the current edit, then undo.";

function undoRefusal(
  owner: Session,
  target: StudioOperation,
  from: VideoRef | undefined,
  state: { editing: boolean }
): string | "" | null {
  if (
    from !== undefined &&
    (from.projectId !== owner.projectId || from.video !== owner.video)
  ) {
    return "Open the video it was deleted from to undo this.";
  }
  if (owner.undoing || owner.removing) {
    return "";
  }
  if (state.editing || owner.drafts.size > 0) {
    return EDITING_REFUSAL;
  }
  if (
    owner.snapshot?.document.operations.some(
      (item) => item.undoOf === target.id
    )
  ) {
    return "This change was already undone.";
  }
  return null;
}

function isBusy(session: Session | null, drafts: readonly Draft[]): boolean {
  return (
    drafts.some((draft) => draft.saving) ||
    session?.undoing === true ||
    session?.removing === true
  );
}

function stampOf(
  session: Session | null,
  undoable: StudioOperation | undefined
): number | null {
  if (undoable === undefined) {
    return null;
  }
  if (session === null) {
    return 0;
  }
  return session.written.get(undoable.id) ?? 0;
}

function withinTree(
  objects: readonly StudioObject[],
  id: string,
  root: string
): boolean {
  const byId = new Map(objects.map((item) => [item.id, item]));
  const visited = new Set<string>();
  let current = byId.get(id);
  while (current !== undefined && !visited.has(current.id)) {
    if (current.id === root) {
      return true;
    }
    visited.add(current.id);
    current =
      current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return false;
}

function geometryFields(
  session: Session | null,
  selected: StudioObject | null,
  definition: StudioDefinition | null
) {
  return (
    definition?.fields.flatMap((field) => {
      const held =
        session && selected
          ? draftForField(session, selected.id, field.id)
          : null;
      const value = held?.change.after ?? selected?.values[field.id];
      return field.type === "number" && typeof value === "number"
        ? [
            {
              id: field.id,
              max: field.max ?? null,
              min: field.min ?? null,
              value,
            },
          ]
        : [];
    }) ?? []
  );
}

function fieldStates(
  session: Session | null,
  selected: StudioObject | null,
  definition: StudioDefinition | null,
  locked: boolean
) {
  return (
    definition?.fields.map((field) => {
      const held =
        session && selected
          ? draftForField(session, selected.id, field.id)
          : null;
      const draft = held?.draft;
      return {
        ...field,
        error: draft?.error ?? null,
        saving: locked || (draft?.attempted ?? false),
        value:
          held?.change.after ?? selected?.values[field.id] ?? field.default,
      };
    }) ?? []
  );
}

function lastUndoable(operations: readonly StudioOperation[]) {
  const undone = new Set(
    operations.flatMap((operation) =>
      operation.undoOf ? [operation.undoOf] : []
    )
  );
  return operations.findLast(
    (operation) => !(operation.undoOf || undone.has(operation.id))
  );
}

function geometryMismatch(
  object: StudioObject,
  declared: StudioDefinition,
  message: GeometryBegin
) {
  return GEOMETRY_KEYS.some((axis) => {
    const id = message.binding[axis];
    if (id === null) {
      return axis !== "rotation" || message.values.rotation !== 0;
    }
    const field = declared.fields.find((item) => item.id === id);
    const value = object.values[id];
    return (
      field?.type !== "number" ||
      typeof value !== "number" ||
      !sameStudioValue(value, message.values[axis]) ||
      (field.unit !== undefined &&
        field.unit !== (axis === "rotation" ? "deg" : "px")) ||
      ((axis === "width" || axis === "height") && value < 1)
    );
  });
}

function geometryChanges(
  object: StudioObject,
  binding: GeometryBinding,
  values: GeometryCommit["values"]
) {
  return GEOMETRY_KEYS.flatMap((axis) => {
    const field = binding[axis];
    return field === null || sameStudioValue(object.values[field], values[axis])
      ? []
      : [{ after: values[axis], before: object.values[field], field }];
  });
}

function geometryProblem(
  declared: StudioDefinition,
  changes: readonly { after: StudioValue; field: string }[]
) {
  for (const item of changes) {
    const field = declared.fields.find((entry) => entry.id === item.field);
    const problem = field
      ? fieldProblem(field, item.after)
      : "This object does not declare editable geometry.";
    if (problem !== null) {
      return problem;
    }
  }
  return null;
}

function draftForField(owner: Session, objectId: string, field: string) {
  for (const draft of owner.drafts.values()) {
    if (draft.operation.objectId !== objectId) {
      continue;
    }
    const change = studioOperationChanges(draft.operation).find(
      (item) => item.field === field
    );
    if (change) {
      return { change, draft };
    }
  }
  return null;
}

function rendersBehind(
  session: Session,
  lastOperationId: string | null
): boolean {
  if (!session.awaitingOperation) {
    return false;
  }
  const operations = session.snapshot?.document.operations ?? [];
  const expected = operations.findIndex(
    (operation) => operation.id === session.awaitingOperation
  );
  const rendered = operations.findIndex(
    (operation) => operation.id === lastOperationId
  );
  return expected === -1 || rendered < expected;
}
