import { load } from "@tauri-apps/plugin-store";
import { Effect } from "effect";
import type { LayoutStorage } from "react-resizable-panels";
import { type EffortLevel, isEffortLevel } from "@/shared/ipc";

const SETTINGS_FILE = "settings.json";
const PROJECT_FOLDER_KEY = "projectFolder";
const EXPANDED_PROJECTS_KEY = "expandedProjects";
const CLAUDE_MODEL_KEY = "claudeModel";
const CLAUDE_EFFORT_KEY = "claudeEffort";
const PREVIEW_PANE_KEY = "previewPane";
const PROJECTS_PANE_KEY = "projectsPane";
const TASK_DOCK_KEY = "taskDock";
const LAYOUT_KEY_PREFIX = "layout:";

const cache = new Map<string, string>();

const openStore = Effect.runSync(
  Effect.cached(Effect.tryPromise(() => load(SETTINGS_FILE)))
);

export interface StudioSettings {
  claudeEffort: EffortLevel | null;
  claudeModel: string | null;
  expandedProjects: readonly string[];
  legacyProjectFolder: string | null;
  previewPane: boolean | null;
  projectsPane: boolean | null;
  taskDock: boolean | null;
}

export const hydrateSettings: Effect.Effect<StudioSettings> = openStore.pipe(
  Effect.flatMap((store) => Effect.tryPromise(() => store.entries())),
  Effect.orElseSucceed((): [string, unknown][] => []),
  Effect.map((entries) => {
    cache.clear();
    for (const [key, value] of entries) {
      if (typeof value === "string") {
        cache.set(key, value);
      }
    }
    return {
      claudeEffort: effortOf(cache.get(CLAUDE_EFFORT_KEY)),
      claudeModel: cache.get(CLAUDE_MODEL_KEY) ?? null,
      expandedProjects: idsOf(cache.get(EXPANDED_PROJECTS_KEY)),
      legacyProjectFolder: cache.get(PROJECT_FOLDER_KEY) ?? null,
      previewPane: shownOf(cache.get(PREVIEW_PANE_KEY)),
      projectsPane: shownOf(cache.get(PROJECTS_PANE_KEY)),
      taskDock: shownOf(cache.get(TASK_DOCK_KEY)),
    };
  })
);

function effortOf(value: string | undefined): EffortLevel | null {
  return isEffortLevel(value) ? value : null;
}

function shownOf(value: string | undefined): boolean | null {
  if (value === "shown") {
    return true;
  }
  if (value === "hidden") {
    return false;
  }
  return null;
}

function idsOf(value: string | undefined): readonly string[] {
  if (value === undefined) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function persist(key: string, value: string): Effect.Effect<void> {
  return Effect.ignore(
    openStore.pipe(
      Effect.flatMap((opened) =>
        Effect.tryPromise(() => opened.set(key, value))
      )
    )
  );
}

function forget(key: string): Effect.Effect<void> {
  return Effect.ignore(
    openStore.pipe(
      Effect.flatMap((opened) => Effect.tryPromise(() => opened.delete(key)))
    )
  );
}

export const forgetProjectFolder: Effect.Effect<void> = Effect.sync(() => {
  cache.delete(PROJECT_FOLDER_KEY);
}).pipe(Effect.andThen(forget(PROJECT_FOLDER_KEY)));

export function saveExpandedProjects(
  ids: readonly string[]
): Effect.Effect<void> {
  return remember(EXPANDED_PROJECTS_KEY, JSON.stringify(ids));
}

export function saveClaudeModel(model: string | null): Effect.Effect<void> {
  return remember(CLAUDE_MODEL_KEY, model);
}

export function savePreviewPane(shown: boolean): Effect.Effect<void> {
  return remember(PREVIEW_PANE_KEY, shown ? "shown" : "hidden");
}

export function saveProjectsPane(shown: boolean): Effect.Effect<void> {
  return remember(PROJECTS_PANE_KEY, shown ? "shown" : "hidden");
}

export function saveTaskDock(shown: boolean): Effect.Effect<void> {
  return remember(TASK_DOCK_KEY, shown ? "shown" : "hidden");
}

export function saveClaudeEffort(
  effort: EffortLevel | null
): Effect.Effect<void> {
  return remember(CLAUDE_EFFORT_KEY, effort);
}

function remember(key: string, value: string | null): Effect.Effect<void> {
  return Effect.sync(() => {
    if (value === null) {
      cache.delete(key);
      return;
    }
    cache.set(key, value);
  }).pipe(Effect.andThen(value === null ? forget(key) : persist(key, value)));
}

export const layoutStorage: LayoutStorage = {
  getItem: (key) => cache.get(LAYOUT_KEY_PREFIX + key) ?? null,
  setItem: (key, value) => {
    cache.set(LAYOUT_KEY_PREFIX + key, value);
    Effect.runFork(persist(LAYOUT_KEY_PREFIX + key, value));
  },
};
