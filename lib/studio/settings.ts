import { load } from "@tauri-apps/plugin-store";
import { Effect } from "effect";
import type { LayoutStorage } from "react-resizable-panels";

const SETTINGS_FILE = "settings.json";
const PROJECT_FOLDER_KEY = "projectFolder";
const LAYOUT_KEY_PREFIX = "layout:";

const cache = new Map<string, string>();

const openStore = Effect.runSync(
  Effect.cached(Effect.tryPromise(() => load(SETTINGS_FILE)))
);

export interface StudioSettings {
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
    return { projectFolder: cache.get(PROJECT_FOLDER_KEY) ?? null };
  })
);

function write(key: string, value: string): void {
  cache.set(key, value);
  Effect.runFork(
    Effect.ignore(
      openStore.pipe(
        Effect.flatMap((store) =>
          Effect.tryPromise(() => store.set(key, value))
        )
      )
    )
  );
}

export function saveProjectFolder(folder: string): void {
  write(PROJECT_FOLDER_KEY, folder);
}

export const layoutStorage: LayoutStorage = {
  getItem: (key) => cache.get(LAYOUT_KEY_PREFIX + key) ?? null,
  setItem: (key, value) => write(LAYOUT_KEY_PREFIX + key, value),
};
