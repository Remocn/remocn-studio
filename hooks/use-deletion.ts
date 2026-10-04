"use client";

import { Duration, Effect, Exit } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastManager } from "@/components/ui/toast";
import { causeMessage } from "@/lib/error-message";
import { restoreCode } from "@/lib/studio/code-removal";
import {
  type ContextAction,
  popupContextMenu,
} from "@/lib/studio/context-menu";
import type { PreviewMessageOf } from "@/lib/studio/preview";
import { SCENE_DEFINITION } from "@/shared/studio-document";
import type { CodeRemoved, Inspection } from "./use-inspect";
import type { ManagedObjects, Removal } from "./use-managed-objects";
import { type PreviewControl, usePreviewMessage } from "./use-preview";

const UNDO_WINDOW = "10 seconds";

export const SCENE_REASON =
  "A scene cannot be deleted: its place on the timeline lives in the code.";
export const OFF_SCREEN_REASON =
  "Move to a frame where this object is on screen to delete it.";
export const SAVING_REASON =
  "Wait for the change to finish saving, then delete.";
export const TURN_REASON =
  "The agent is editing this video. Delete it when the turn ends.";
export const UPGRADED =
  "This video now uses the studio's v6 runtime so its objects can be deleted.";

export interface DeletionTarget {
  label: string;
  reason: string | null;
}

export interface Notice {
  description?: string;
  title: string;
  type?: "error";
  undo?: () => void;
}

interface CodeEntry {
  at: number;
  label: string;
  removal: string;
}

type Managed = Pick<
  ManagedObjects,
  | "busy"
  | "canUndo"
  | "enabled"
  | "isOpen"
  | "objects"
  | "remove"
  | "selected"
  | "undo"
  | "undoableAt"
  | "undoOperation"
>;

type Inspect = Pick<Inspection, "card" | "removal" | "removeCard">;

interface Options {
  inspect: Inspect;
  isTurnRunning: boolean;
  managed: Managed | undefined;
  notify?: (notice: Notice) => void;
  popup?: (actions: readonly ContextAction[]) => void;
  preview: PreviewControl;
  projectId: string | null;
  restore?: typeof restoreCode;
  undoWindow?: Duration.Input;
}

function toast(undoWindow: Duration.Input) {
  return (notice: Notice) => {
    toastManager.add({
      ...(notice.undo === undefined
        ? {}
        : { actionProps: { children: "Undo", onClick: notice.undo } }),
      ...(notice.description === undefined
        ? {}
        : { description: notice.description }),
      timeout: Duration.toMillis(undoWindow),
      title: notice.title,
      ...(notice.type === undefined ? {} : { type: notice.type }),
    });
  };
}

function showMenu(actions: readonly ContextAction[]): void {
  Effect.runFork(Effect.ignore(popupContextMenu(actions)));
}

export function managedTarget(
  managed: Managed | undefined,
  objectId: string,
  present: ReadonlySet<string> | null
): DeletionTarget | null {
  const object = managed?.objects.find((item) => item.id === objectId);
  if (managed === undefined || !managed.enabled || object === undefined) {
    return null;
  }
  const refused = (reason: string) => ({ label: "Delete", reason });
  if (object.definition === SCENE_DEFINITION) {
    return refused(SCENE_REASON);
  }
  if (present !== null && !present.has(objectId)) {
    return refused(OFF_SCREEN_REASON);
  }
  if (managed.busy) {
    return refused(SAVING_REASON);
  }
  return { label: "Delete", reason: null };
}

export function useDeletion({
  inspect,
  isTurnRunning,
  managed,
  notify: given,
  popup = showMenu,
  preview,
  projectId,
  restore = restoreCode,
  undoWindow = UNDO_WINDOW,
}: Options) {
  const notify = useMemo(() => given ?? toast(undoWindow), [given, undoWindow]);
  const [present, setPresent] = useState<ReadonlySet<string> | null>(null);
  const [menuAsked, askMenu] = useState(0);
  const journals = useRef(new Map<string, CodeEntry[]>());
  const { composition } = preview;
  const journal = useCallback(() => {
    const key = JSON.stringify([projectId, composition]);
    const held = journals.current.get(key) ?? [];
    journals.current.set(key, held);
    return held;
  }, [composition, projectId]);

  const onPresent = useCallback(
    (message: PreviewMessageOf<"studio.present">) =>
      setPresent(new Set(message.ids)),
    []
  );
  usePreviewMessage(preview, "studio.present", onPresent);
  const onMenu = useCallback(() => askMenu((count) => count + 1), []);
  usePreviewMessage(preview, "canvas.menu", onMenu);

  const targetFor = useCallback(
    (objectId: string) => managedTarget(managed, objectId, present),
    [managed, present]
  );

  const selectedId =
    managed?.isOpen === true ? (managed.selected?.id ?? null) : null;
  const { removal } = inspect;
  const target = useMemo((): DeletionTarget | null => {
    if (selectedId !== null) {
      return targetFor(selectedId);
    }
    if (removal === null) {
      return null;
    }
    return {
      label: removal.count > 1 ? `Delete all ${removal.count}` : "Delete",
      reason: removal.reason ?? (isTurnRunning ? TURN_REASON : null),
    };
  }, [isTurnRunning, removal, selectedId, targetFor]);

  const restoreEntry = useCallback(
    (entry: CodeEntry) => {
      const held = journal();
      const at = held.indexOf(entry);
      if (at !== -1) {
        held.splice(at, 1);
      }
      if (projectId === null) {
        return;
      }
      Effect.runPromiseExit(
        restore({ projectId, removal: entry.removal })
      ).then((exit) => {
        if (Exit.isFailure(exit)) {
          notify({
            title:
              causeMessage(exit.cause) ?? "The deletion could not be undone.",
            type: "error",
          });
        }
      });
    },
    [journal, notify, projectId, restore]
  );

  const refused = useCallback(
    (error: string | null) => {
      if (error !== null) {
        notify({ title: error, type: "error" });
      }
    },
    [notify]
  );

  const settleManaged = useCallback(
    (outcome: Removal | null) => {
      if (outcome === null) {
        return;
      }
      if (!outcome.ok) {
        notify({ title: outcome.error, type: "error" });
        return;
      }
      const { operation } = outcome;
      notify({
        ...(outcome.upgraded === null ? {} : { description: UPGRADED }),
        title: `Deleted “${outcome.label}”`,
        undo: () => {
          managed?.undoOperation(operation, outcome.from).then(refused);
        },
      });
    },
    [managed, notify, refused]
  );

  const settleCode = useCallback(
    (outcome: CodeRemoved | null) => {
      if (outcome === null) {
        return;
      }
      if (!outcome.ok) {
        notify({ title: outcome.error, type: "error" });
        return;
      }
      const entry = {
        at: Date.now(),
        label: outcome.label,
        removal: outcome.removal,
      };
      journal().push(entry);
      notify({
        title: `Deleted “${outcome.label}”`,
        undo: () => restoreEntry(entry),
      });
    },
    [journal, notify, restoreEntry]
  );

  const removeObject = useCallback(
    (objectId: string) => {
      if (managed === undefined || targetFor(objectId)?.reason !== null) {
        return;
      }
      managed.remove(objectId).then(settleManaged);
    },
    [managed, settleManaged, targetFor]
  );

  const { removeCard } = inspect;
  const remove = useCallback(() => {
    if (target === null || target.reason !== null) {
      return;
    }
    if (selectedId !== null) {
      removeObject(selectedId);
      return;
    }
    removeCard().then(settleCode);
  }, [removeCard, removeObject, selectedId, settleCode, target]);

  const undo = useCallback(() => {
    const last = journal().at(-1);
    const managedAt = managed?.canUndo === true ? managed.undoableAt : null;
    if (last !== undefined && (managedAt === null || last.at >= managedAt)) {
      restoreEntry(last);
      return;
    }
    if (managedAt !== null) {
      managed?.undo().then(refused);
    }
  }, [journal, managed, refused, restoreEntry]);

  const openRowMenu = useCallback(
    (objectId: string) => {
      const row = targetFor(objectId);
      if (row === null) {
        return;
      }
      popup([
        {
          enabled: row.reason === null,
          id: "delete",
          run: () => removeObject(objectId),
          text: row.label,
        },
      ]);
    },
    [popup, removeObject, targetFor]
  );

  const latest = useRef({ popup, remove, target });
  latest.current = { popup, remove, target };
  useEffect(() => {
    if (menuAsked === 0) {
      return;
    }
    const { current } = latest;
    const shown = current.target;
    if (shown === null || shown.reason === SCENE_REASON) {
      return;
    }
    current.popup([
      {
        enabled: shown.reason === null,
        id: "delete",
        run: current.remove,
        text: shown.label,
      },
    ]);
  }, [menuAsked]);

  return useMemo(
    () => ({ openRowMenu, remove, removeObject, target, targetFor, undo }),
    [openRowMenu, remove, removeObject, target, targetFor, undo]
  );
}

export type Deletion = ReturnType<typeof useDeletion>;
