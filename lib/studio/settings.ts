import { load } from "@tauri-apps/plugin-store";
import { Effect } from "effect";
import type { LayoutStorage } from "react-resizable-panels";
import { type EffortLevel, isEffortLevel } from "@/shared/ipc";

const SETTINGS_FILE = "settings.json";
const PROJECT_FOLDER_KEY = "projectFolder";
const CLAUDE_MODEL_KEY = "claudeModel";
const CLAUDE_EFFORT_KEY = "claudeEffort";
const LAYOUT_KEY_PREFIX = "layout:";

const cache = new Map<string, string>();

const openStore = Effect.runSync(
  Effect.cached(Effect.tryPromise(() => load(SETTINGS_FILE)))
);

export interface StudioSettings {
  claudeEffort: EffortLevel | null;
  claudeModel: string | null;
  projectFolder: string | null;
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
      projectFolder: cache.get(PROJECT_FOLDER_KEY) ?? null,
    };
  })
);

function effortOf(value: string | undefined): EffortLevel | null {
  return isEffortLevel(value) ? value : null;
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

export function saveProjectFolder(folder: string): Effect.Effect<void> {
  return Effect.sync(() => {
    cache.set(PROJECT_FOLDER_KEY, folder);
  }).pipe(Effect.andThen(persist(PROJECT_FOLDER_KEY, folder)));
}

export function saveClaudeModel(model: string | null): Effect.Effect<void> {
  return remember(CLAUDE_MODEL_KEY, model);
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
