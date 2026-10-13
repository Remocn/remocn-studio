"use client";

import { Effect, type Exit, Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFileExists } from "@/hooks/use-file-exists";
import { useRevealInFinder } from "@/hooks/use-reveal-in-finder";
import type { Selection } from "@/hooks/use-selections";
import { causeMessage } from "@/lib/error-message";
import {
  type ExportBrief,
  exportBrief,
  exportPercent,
  exportStatus,
  folderLabel,
  pendingEdits,
  renderExport,
  targetPath,
} from "@/lib/studio/export";
import type { PreviewMetadata } from "@/lib/studio/preview";
import { readExportSettings, saveExportSettings } from "@/lib/studio/settings";
import { pickFolder } from "@/lib/studio/shell";
import type { SidecarError } from "@/lib/studio/sidecar";
import { clipTime } from "@/lib/studio/time";
import {
  type CompositionSize,
  changeSettings,
  DEFAULT_EXPORT_SETTINGS,
  EXPORT_FORMATS,
  EXPORT_PRESETS,
  EXPORT_QUALITIES,
  EXPORT_RESOLUTIONS,
  type ExportReview,
  type ExportSettings,
  FORMAT_SPECS,
  presetSettings,
  reviewExport,
  stemFrom,
  stemOf,
  typedName,
} from "@/shared/export";
import type { ExportEvent, Exported } from "@/shared/ipc";

// The result belongs to a video, not to a project: with several videos in one
// folder, keying by project alone would show one video's render in another's
// panel. `composition` is that identity, and it is already a setting here.
export type ExportState =
  | {
      composition: string;
      event: ExportEvent | null;
      notices: readonly string[];
      phase: "running";
      projectId: string;
      startedAt: number;
    }
  | {
      composition: string;
      exported: Exported;
      phase: "done";
      projectId: string;
    }
  | {
      composition: string;
      message: string;
      phase: "failed";
      projectId: string;
    }
  | { phase: "idle" };

export interface Exporting {
  brief: ExportBrief | null;
  cancel: () => void;
  canExport: boolean;
  canRetry: boolean;
  choose: (patch: Partial<Omit<ExportSettings, "preset">>) => void;
  chooseFolder: () => void;
  chooseFormat: (value: unknown) => void;
  choosePreset: (value: unknown) => void;
  chooseQuality: (value: unknown) => void;
  chooseResolution: (value: unknown) => void;
  close: () => void;
  confirmCancel: () => void;
  dismiss: () => void;
  duration: string | null;
  fileName: string;
  folder: string;
  isConfirmingCancel: boolean;
  isOpen: boolean;
  isRunning: boolean;
  keepExporting: () => void;
  notices: readonly string[];
  onConfirmChange: (open: boolean) => void;
  open: () => void;
  pending: number;
  percent: number | null;
  rename: (event: React.ChangeEvent<HTMLInputElement>) => void;
  render: () => void;
  requestCancel: () => void;
  result: Exported | null;
  retry: () => void;
  reveal: () => Promise<void>;
  review: ExportReview;
  settings: ExportSettings;
  size: CompositionSize;
  start: () => void;
  state: ExportState;
  status: string | null;
  target: string;
  trouble: string | null;
  unavailable: string | null;
  willReplace: boolean;
}

export interface ExportOptions {
  composition: string | null;
  isServing: boolean;
  managedPending?: number;
  metadata?: PreviewMetadata | null;
  openedProjectId: string | null;
  pick?: typeof pickFolder;
  projectId: string | null;
  projectPath?: string;
  selections?: readonly Selection[];
}

const IDLE: ExportState = { phase: "idle" };

export const CONFIRM_CANCEL_AFTER_MS = 5000;

export const RESULT_SHOWN_MS = 15_000;

interface Run {
  outputPath: string | null;
  settings: ExportSettings;
}

const NO_SIZE: CompositionSize = { height: 0, width: 0 };

export function useExport({
  managedPending = 0,
  composition,
  isServing,
  metadata = null,
  openedProjectId,
  pick = pickFolder,
  projectId,
  projectPath,
  selections = [],
}: ExportOptions): Exporting {
  const sidecar = useRef({ pick });
  sidecar.current = { pick };
  const [state, setState] = useState<ExportState>(IDLE);
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>(
    DEFAULT_EXPORT_SETTINGS
  );
  const previousLocation = useRef({ projectId, projectPath });
  useEffect(() => {
    const previous = previousLocation.current;
    previousLocation.current = { projectId, projectPath };
    const oldPath = previous.projectPath;
    if (
      previous.projectId !== projectId ||
      !oldPath ||
      !projectPath ||
      oldPath === projectPath
    ) {
      return;
    }
    setState((current) => {
      if (
        current.phase !== "done" ||
        current.projectId !== projectId ||
        !current.exported.path.startsWith(`${oldPath}/`)
      ) {
        return current;
      }
      return {
        ...current,
        exported: {
          ...current.exported,
          path: `${projectPath}${current.exported.path.slice(oldPath.length)}`,
        },
      };
    });
  }, [projectId, projectPath]);
  const inflight = useRef<Fiber.Fiber<Exported, SidecarError> | null>(null);
  const lastRun = useRef<Run | null>(null);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  const cancel = useCallback(() => {
    const fiber = inflight.current;

    setIsConfirmingCancel(false);
    if (fiber !== null) {
      Effect.runFork(Fiber.interrupt(fiber));
    }
  }, []);

  const mine = ownedBy(state, projectId, composition);
  const runningSince = mine?.phase === "running" ? mine.startedAt : null;

  const requestCancel = useCallback(() => {
    if (runningSince === null) {
      return;
    }
    if (Date.now() - runningSince < CONFIRM_CANCEL_AFTER_MS) {
      cancel();
      return;
    }
    setIsConfirmingCancel(true);
  }, [cancel, runningSince]);

  const onConfirmChange = useCallback(
    (next: boolean) => {
      if (next) {
        requestCancel();
        return;
      }
      setIsConfirmingCancel(false);
    },
    [requestCancel]
  );

  const keepExporting = useCallback(() => setIsConfirmingCancel(false), []);

  useEffect(() => {
    if (runningSince === null) {
      setIsConfirmingCancel(false);
    }
  }, [runningSince]);

  const dismiss = useCallback(() => {
    setState((current) =>
      current.phase === "done" || current.phase === "failed" ? IDLE : current
    );
  }, []);
  const result = mine?.phase === "done" ? mine.exported : null;
  const { error, reveal } = useRevealInFinder(result?.path ?? null);

  useEffect(() => {
    if (result === null) {
      return;
    }
    const timer = setTimeout(dismiss, RESULT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [dismiss, result]);

  const size = useMemo(
    () =>
      metadata === null
        ? NO_SIZE
        : { height: metadata.height, width: metadata.width },
    [metadata]
  );

  const pending = useMemo(() => pendingEdits(selections), [selections]);

  const unavailable =
    managedPending > 0
      ? "Finish saving or discard the pending object changes before exporting."
      : unavailableOf({
          busyElsewhere: state.phase === "running" && mine === null,
          composition,
          isServing,
          openedProjectId,
          pending,
          projectId,
        });

  const review = useMemo(() => reviewExport(settings, size), [settings, size]);

  // The stem the person typed, if they typed one. Leaving it null is what lets
  // the name follow the preset and the format: pick YouTube and the file
  // becomes `Intro-youtube.mp4` without anyone editing anything.
  const [stem, setStem] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);

  const fileName = `${stem ?? stemOf({ composition: composition ?? "video", preset: settings.preset })}.${FORMAT_SPECS[settings.format].extension}`;

  const target = useMemo(
    () => targetPath({ fileName, folder, root: projectPath ?? null }),
    [fileName, folder, projectPath]
  );

  const willReplace = useFileExists(
    isOpen && target.startsWith("/") ? target : null
  );

  const shown = useMemo(
    () => folderLabel(folder, projectPath ?? null),
    [folder, projectPath]
  );

  // What no control on the dialog says, so the summary is a reading of the
  // result rather than a restatement of the pills above it.
  const duration = useMemo(
    () =>
      metadata === null || metadata.fps <= 0
        ? null
        : clipTime(metadata.durationInFrames / metadata.fps),
    [metadata]
  );

  const open = useCallback(() => {
    if (unavailable !== null || projectId === null) {
      return;
    }

    const remembered = readExportSettings(projectId);

    setSettings(
      remembered === null ? DEFAULT_EXPORT_SETTINGS : remembered.settings
    );
    setFolder(remembered?.folder ?? null);
    setStem(null);
    setIsOpen(true);
  }, [projectId, unavailable]);

  const rename = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setStem(stemFrom(typedName(event.currentTarget.value), settings.format));
    },
    [settings.format]
  );

  const chooseFolder = useCallback(() => {
    Effect.runFork(
      sidecar.current.pick("Choose where to save the video").pipe(
        Effect.catch(() => Effect.succeed(null)),
        Effect.tap((picked) =>
          Effect.sync(() => {
            if (picked !== null) {
              setFolder(picked);
            }
          })
        )
      )
    );
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const choose = useCallback(
    (patch: Partial<Omit<ExportSettings, "preset">>) =>
      setSettings((current) => changeSettings(current, patch)),
    []
  );

  const choosePreset = useCallback((value: unknown) => {
    if (!oneOf(EXPORT_PRESETS, value)) {
      return;
    }

    setSettings((current) =>
      value === "custom" ? { ...current, preset: value } : presetSettings(value)
    );
  }, []);

  const chooseFormat = useCallback(
    (value: unknown) => {
      if (oneOf(EXPORT_FORMATS, value)) {
        choose({ format: value });
      }
    },
    [choose]
  );

  const chooseQuality = useCallback(
    (value: unknown) => {
      if (oneOf(EXPORT_QUALITIES, value)) {
        choose({ quality: value });
      }
    },
    [choose]
  );

  const chooseResolution = useCallback(
    (value: unknown) => {
      if (oneOf(EXPORT_RESOLUTIONS, value)) {
        choose({ resolution: value });
      }
    },
    [choose]
  );

  const launch = useCallback(
    (outputPath: string | null, chosen: ExportSettings) => {
      if (projectId === null || composition === null) {
        return;
      }

      lastRun.current = { outputPath, settings: chosen };
      setState({
        composition,
        event: null,
        notices: [],
        phase: "running",
        projectId,
        startedAt: Date.now(),
      });

      const shipping = renderExport(
        {
          composition,
          format: chosen.format,
          outputPath,
          preset: chosen.preset,
          projectId,
          quality: chosen.quality,
          resolution: chosen.resolution,
        },
        (event) =>
          setState((current) =>
            current.phase === "running" &&
            current.projectId === projectId &&
            current.composition === composition
              ? folded(current, event)
              : current
          )
      ).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            inflight.current = null;
            setState(settled(exit, projectId, composition));
          })
        )
      );

      inflight.current = Effect.runFork(shipping);
    },
    [composition, projectId]
  );

  const render = useCallback(() => {
    if (
      unavailable !== null ||
      inflight.current !== null ||
      projectId === null ||
      composition === null ||
      review.problems.length > 0
    ) {
      return;
    }

    setIsOpen(false);

    Effect.runFork(saveExportSettings(projectId, { folder, settings }));

    launch(target, settings);
  }, [
    composition,
    folder,
    launch,
    projectId,
    review.problems.length,
    settings,
    target,
    unavailable,
  ]);

  const canRetry =
    mine?.phase === "failed" &&
    lastRun.current !== null &&
    unavailable === null;

  const retry = useCallback(() => {
    const run = lastRun.current;
    if (!canRetry || run === null || inflight.current !== null) {
      return;
    }
    launch(run.outputPath, run.settings);
  }, [canRetry, launch]);

  const start = useCallback(() => {
    if (isOpen) {
      render();
      return;
    }

    open();
  }, [isOpen, open, render]);

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () => ({
      brief: mine?.phase === "running" ? exportBrief(mine.event) : null,
      cancel,
      canExport: unavailable === null,
      canRetry,
      choose,
      chooseFolder,
      chooseFormat,
      choosePreset,
      chooseQuality,
      chooseResolution,
      close,
      confirmCancel: cancel,
      dismiss,
      duration,
      fileName,
      folder: shown,
      isConfirmingCancel,
      isOpen,
      isRunning: mine?.phase === "running",
      keepExporting,
      notices: mine?.phase === "running" ? mine.notices : [],
      onConfirmChange,
      open,
      pending,
      percent: mine?.phase === "running" ? exportPercent(mine.event) : null,
      rename,
      render,
      requestCancel,
      result,
      retry,
      reveal,
      review,
      settings,
      size,
      start,
      state,
      status: mine?.phase === "running" ? exportStatus(mine.event) : null,
      target,
      trouble: (mine?.phase === "failed" ? mine.message : null) ?? error,
      unavailable,
      willReplace,
    }),
    [
      cancel,
      canRetry,
      choose,
      chooseFolder,
      chooseFormat,
      choosePreset,
      chooseQuality,
      chooseResolution,
      close,
      dismiss,
      duration,
      error,
      fileName,
      isConfirmingCancel,
      isOpen,
      keepExporting,
      mine,
      onConfirmChange,
      open,
      pending,
      rename,
      render,
      requestCancel,
      result,
      retry,
      reveal,
      review,
      settings,
      shown,
      size,
      start,
      state,
      target,
      unavailable,
      willReplace,
    ]
  );
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === "string" && (allowed as readonly string[]).includes(value)
  );
}

function folded(
  current: Extract<ExportState, { phase: "running" }>,
  event: ExportEvent
): ExportState {
  return event.type === "notice"
    ? { ...current, notices: [...current.notices, event.message] }
    : { ...current, event };
}

function ownedBy(
  state: ExportState,
  projectId: string | null,
  composition: string | null
): Exclude<ExportState, { phase: "idle" }> | null {
  return state.phase !== "idle" &&
    state.projectId === projectId &&
    state.composition === composition
    ? state
    : null;
}

function settled(
  exit: Exit.Exit<Exported, SidecarError>,
  projectId: string,
  composition: string
): ExportState {
  if (exit._tag === "Success") {
    return { composition, exported: exit.value, phase: "done", projectId };
  }

  const message = causeMessage(exit.cause);

  return message === null
    ? IDLE
    : { composition, message, phase: "failed", projectId };
}

export function pendingEditsReason(count: number): string {
  const named = count === 1 ? "an element change" : `${count} element changes`;

  return `The composer is holding ${named} that are not in the code yet. Send the message, or take the chip off, and the export will match what you are looking at.`;
}

function unavailableOf(state: {
  busyElsewhere: boolean;
  composition: string | null;
  isServing: boolean;
  openedProjectId: string | null;
  pending: number;
  projectId: string | null;
}): string | null {
  if (state.projectId === null) {
    return "Open a project to export it.";
  }
  // Inspect and Snapshot already refuse this; Export renders from the same
  // preview and would have put the other project's video into its out/ while
  // the person read this one's conversation.
  if (
    state.openedProjectId !== null &&
    state.openedProjectId !== state.projectId
  ) {
    return "The preview is showing another project, not the one this chat belongs to.";
  }
  if (state.busyElsewhere) {
    return "Another project is exporting, and only one export runs at a time.";
  }
  if (!state.isServing) {
    return "The preview has to be running before it can be exported.";
  }
  if (state.composition === null) {
    return "There is no video to export.";
  }
  if (state.pending > 0) {
    return pendingEditsReason(state.pending);
  }
  return null;
}
