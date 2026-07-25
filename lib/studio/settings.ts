import { load, type Store } from "@tauri-apps/plugin-store";
import type { LayoutStorage } from "react-resizable-panels";

const SETTINGS_FILE = "settings.json";
const PROJECT_FOLDER_KEY = "projectFolder";
const LAYOUT_KEY_PREFIX = "layout:";

const cache = new Map<string, string>();

let store: Store | null = null;
let opening: Promise<Store | null> | null = null;

function openStore(): Promise<Store | null> {
  if (store) {
    return Promise.resolve(store);
  }
  opening ??= load(SETTINGS_FILE)
    .then((opened) => {
      store = opened;
      return opened;
    })
    .catch(() => {
      opening = null;
      return null;
    });
  return opening;
}

export interface StudioSettings {
  projectFolder: string | null;
}

export async function hydrateSettings(): Promise<StudioSettings> {
  const opened = await openStore();
  cache.clear();

  if (opened) {
    for (const [key, value] of await opened.entries()) {
      if (typeof value === "string") {
        cache.set(key, value);
      }
    }
  }

  return { projectFolder: cache.get(PROJECT_FOLDER_KEY) ?? null };
}

function write(key: string, value: string): void {
  cache.set(key, value);

  openStore()
    .then((opened) => opened?.set(key, value))
    .catch(() => undefined);
}

export function saveProjectFolder(folder: string): void {
  write(PROJECT_FOLDER_KEY, folder);
}

export const layoutStorage: LayoutStorage = {
  getItem: (key) => cache.get(LAYOUT_KEY_PREFIX + key) ?? null,
  setItem: (key, value) => write(LAYOUT_KEY_PREFIX + key, value),
};
