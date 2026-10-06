"use client";

import {
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type LayerRow,
  layersOf,
  nextPresent,
  sceneRowOf,
  visibleRows,
  withAncestors,
} from "@/lib/studio/layers";
import { currentPlatform, isModKey } from "@/lib/studio/platform";
import type { PreviewScene } from "@/lib/studio/preview";
import type { Deletion } from "./use-deletion";
import type { ManagedObjects } from "./use-managed-objects";
import { type PreviewControl, usePreviewReport } from "./use-preview";

const CONTROLS =
  "button,input,textarea,select,a,[contenteditable],[data-canvas-chrome]";

type Managed = Pick<
  ManagedObjects,
  "enabled" | "error" | "isOpen" | "loading" | "objects" | "select" | "selected"
>;

function fromControl(event: Event) {
  return event
    .composedPath()
    .some(
      (item) =>
        item instanceof Element &&
        item.getRootNode() === document &&
        item.matches(CONTROLS)
    );
}

export type InspectorView = "layers" | "properties";

const NO_SCENES: readonly PreviewScene[] = [];

type Deleting = Pick<Deletion, "openRowMenu" | "remove" | "undo">;

function deletes(event: KeyboardEvent): boolean {
  return (
    (event.key === "Backspace" || event.key === "Delete") &&
    !(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
  );
}

function undoes(event: KeyboardEvent): boolean {
  const other = currentPlatform() === "mac" ? event.ctrlKey : event.metaKey;

  return (
    event.key.toLowerCase() === "z" &&
    isModKey(event) &&
    !(other || event.altKey || event.shiftKey)
  );
}

function shortcut(event: KeyboardEvent, deletion: Deleting | undefined) {
  if (deletes(event)) {
    deletion?.remove();
  } else if (undoes(event)) {
    deletion?.undo();
  } else {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
}

export function useCanvasLayers({
  deletion,
  hasRoom = true,
  managed,
  preview,
  scenes = NO_SCENES,
  seekTo,
  selection,
  viewport,
}: {
  deletion?: Deleting;
  hasRoom?: boolean;
  managed: Managed | undefined;
  preview: PreviewControl;
  scenes?: readonly PreviewScene[];
  seekTo?: (frame: number) => void;
  selection: unknown;
  viewport: RefObject<HTMLElement | null>;
}) {
  const [layersFor, setLayersFor] = useState<unknown>(null);
  const [chosen, setChosen] = useState(true);
  const [peek, setPeek] = useState(false);
  if (hasRoom && peek) {
    setPeek(false);
  }
  const shown = hasRoom ? chosen : peek;
  const setShown = hasRoom ? setChosen : setPeek;
  if (selection === null && layersFor !== null) {
    setLayersFor(null);
  }
  const view: InspectorView =
    selection !== null && layersFor !== selection ? "properties" : "layers";
  const objects = managed?.objects;
  const rows = useMemo(() => layersOf(objects ?? []), [objects]);
  const selectedId =
    managed?.isOpen === true ? (managed.selected?.id ?? null) : null;
  const { send } = preview.channel;
  const selectObject = managed?.select;

  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  );
  const [revealed, setRevealed] = useState<string | null>(null);
  if (selectedId !== revealed) {
    setRevealed(selectedId);
    const ancestors =
      rows.find((row) => row.id === selectedId)?.ancestors ?? [];
    if (ancestors.some((id) => overrides.has(id))) {
      const next = new Map(overrides);
      for (const id of ancestors) {
        next.delete(id);
      }
      setOverrides(next);
    }
  }

  const presence = usePreviewReport(preview, "studio.present", "build");
  const present = useMemo<ReadonlySet<string> | null>(
    () => (presence === null ? null : new Set(presence.ids)),
    [presence]
  );

  const live = useMemo(
    () => (present === null ? null : withAncestors(rows, present)),
    [present, rows]
  );
  const held = useMemo(
    () => withAncestors(rows, selectedId === null ? [] : [selectedId]),
    [rows, selectedId]
  );
  const isOpen = useCallback(
    (row: LayerRow) =>
      overrides.get(row.id) ??
      (live === null || live.has(row.id) || held.has(row.id)),
    [held, live, overrides]
  );
  const visible = useMemo(() => visibleRows(rows, isOpen), [isOpen, rows]);
  const onToggle = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const row = rows.find((item) => item.id === event.currentTarget.value);
      if (row) {
        setOverrides((current) => new Map(current).set(row.id, !isOpen(row)));
      }
    },
    [isOpen, rows]
  );

  const hover = useCallback(
    (objectId: string | null) => send({ objectId, type: "studio.hover" }),
    [send]
  );

  const sceneStart = useCallback(
    (objectId: string): number | null => {
      const offScreen = present !== null && !present.has(objectId);
      const owner = sceneRowOf(rows, objectId, offScreen);
      const scene = scenes.find((item) => item.name === owner?.label);
      return scene ? scene.from : null;
    },
    [present, rows, scenes]
  );

  const select = useCallback(
    (objectId: string) => {
      hover(null);
      setLayersFor(null);
      const start = sceneStart(objectId);
      if (start !== null) {
        seekTo?.(start);
      }
      selectObject?.(objectId);
    },
    [hover, sceneStart, seekTo, selectObject]
  );

  const onEnter = useCallback(
    (event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>) =>
      hover(event.currentTarget.value),
    [hover]
  );
  const onLeave = useCallback(() => hover(null), [hover]);
  const choose = useCallback(
    (next: unknown) => setLayersFor(next === "layers" ? selection : null),
    [selection]
  );
  const toggle = useCallback(() => setShown((value) => !value), [setShown]);
  const onView = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const next = event.currentTarget.value;
      if (shown && next === view) {
        setShown(false);
        return;
      }
      setShown(true);
      choose(next);
    },
    [choose, setShown, shown, view]
  );
  const onSelect = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => select(event.currentTarget.value),
    [select]
  );
  const openRowMenu = deletion?.openRowMenu;
  const onRowMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      openRowMenu?.(event.currentTarget.value);
    },
    [openRowMenu]
  );

  const tab = useRef({ deletion, present, rows, select, selectedId });
  tab.current = { deletion, present, rows, select, selectedId };

  useEffect(() => {
    const node = viewport.current;
    if (!node) {
      return;
    }
    const keydown = (event: KeyboardEvent) => {
      if (node.hasAttribute("data-preview-editing") || fromControl(event)) {
        return;
      }
      const { current } = tab;
      if (shortcut(event, current.deletion)) {
        return;
      }
      if (
        event.key !== "Tab" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const next = nextPresent(
        current.rows,
        current.present ?? new Set(current.rows.map((row) => row.id)),
        current.selectedId,
        event.shiftKey ? -1 : 1
      );
      if (next === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      current.select(next);
    };
    node.addEventListener("keydown", keydown, true);
    return () => node.removeEventListener("keydown", keydown, true);
  }, [viewport]);

  const enabled = managed?.enabled ?? false;
  const error = managed?.error ?? null;
  const loading = managed?.loading ?? false;
  return useMemo(
    () => ({
      active: shown ? view : null,
      choose,
      enabled,
      error,
      floating: !hasRoom && peek,
      hover,
      isOpen,
      isPresent: (row: LayerRow) => present === null || present.has(row.id),
      loading,
      onEnter,
      onLeave,
      onRowMenu,
      onSelect,
      onToggle,
      onView,
      rows,
      select,
      selectedId,
      shown,
      toggle,
      view,
      visible,
    }),
    [
      choose,
      enabled,
      error,
      hasRoom,
      hover,
      isOpen,
      loading,
      onEnter,
      onLeave,
      onRowMenu,
      onSelect,
      onToggle,
      onView,
      peek,
      present,
      rows,
      select,
      selectedId,
      shown,
      toggle,
      view,
      visible,
    ]
  );
}

export type CanvasLayers = ReturnType<typeof useCanvasLayers>;
