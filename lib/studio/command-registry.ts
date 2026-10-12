import { currentPlatform, type Platform } from "@/lib/studio/platform";

export type CommandGroup = "actions" | "projects" | "videos";

export type MenuName = "app" | "file" | "project" | "video" | "view";

export type ShortcutOwner = "menu" | "page";

export interface Shortcut {
  readonly alt?: boolean;
  readonly key: string;
  readonly shift?: boolean;
}

export interface Command {
  readonly checked?: boolean;
  readonly detail?: string;
  readonly enabled: true | { readonly reason: string };
  readonly group: CommandGroup;
  readonly id: string;
  readonly menu?: MenuName;
  readonly run: () => void;
  readonly separatorBefore?: boolean;
  readonly shortcut?: Shortcut;
  readonly title: string;
}

export const SHORTCUT_IDS = [
  "palette",
  "new-chat",
  "new-video",
  "new-project",
  "open-folder",
  "settings",
  "export",
  "inspect",
  "snapshot",
  "sidebar",
  "preview",
  "pane-projects",
  "pane-assets",
  "pane-components",
  "docs",
  "previous-video",
  "next-video",
  "stop-turn",
  "restart-sidecar",
] as const;

export type ShortcutId = (typeof SHORTCUT_IDS)[number];

export interface ShortcutEntry extends Shortcut {
  readonly owner: ShortcutOwner;
}

export const SHORTCUTS: Readonly<Record<ShortcutId, ShortcutEntry>> = {
  docs: { key: "d", owner: "menu" },
  export: { key: "e", owner: "menu" },
  inspect: { key: "i", owner: "menu" },
  "new-chat": { key: "t", owner: "menu" },
  "new-project": { key: "n", owner: "menu", shift: true },
  "new-video": { key: "n", owner: "menu" },
  "next-video": { alt: true, key: "ArrowDown", owner: "menu" },
  "open-folder": { key: "o", owner: "menu" },
  palette: { key: "k", owner: "page" },
  "pane-assets": { key: "2", owner: "menu" },
  "pane-components": { key: "3", owner: "menu" },
  "pane-projects": { key: "1", owner: "menu" },
  preview: { key: "\\", owner: "menu" },
  "previous-video": { alt: true, key: "ArrowUp", owner: "menu" },
  "restart-sidecar": { key: "r", owner: "menu", shift: true },
  settings: { key: ",", owner: "page" },
  sidebar: { key: "b", owner: "menu" },
  snapshot: { key: "s", owner: "menu", shift: true },
  "stop-turn": { key: ".", owner: "menu" },
};

export const SHORTCUT_TITLES: Readonly<Record<ShortcutId, string>> = {
  docs: "Switch between Preview and Docs",
  export: "Export",
  inspect: "Inspect",
  "new-chat": "New Chat",
  "new-project": "New Project",
  "new-video": "New Video",
  "next-video": "Next video",
  "open-folder": "Open Folder",
  palette: "Open the command palette",
  "pane-assets": "Sidebar: Assets",
  "pane-components": "Sidebar: Components",
  "pane-projects": "Sidebar: Projects",
  preview: "Show or hide the preview",
  "previous-video": "Previous video",
  "restart-sidecar": "Restart the studio's helper",
  settings: "Settings",
  sidebar: "Show or hide the project list",
  snapshot: "Snapshot",
  "stop-turn": "Stop the running turn",
};

export interface HotkeyGroup {
  readonly ids: readonly ShortcutId[];
  readonly title: string;
}

export const HOTKEY_GROUPS: readonly HotkeyGroup[] = [
  { ids: ["palette", "settings"], title: "Studio" },
  {
    ids: ["new-chat", "new-video", "new-project", "open-folder"],
    title: "Project",
  },
  {
    ids: [
      "sidebar",
      "preview",
      "pane-projects",
      "pane-assets",
      "pane-components",
      "docs",
      "restart-sidecar",
    ],
    title: "View",
  },
  {
    ids: [
      "export",
      "inspect",
      "snapshot",
      "stop-turn",
      "previous-video",
      "next-video",
    ],
    title: "Video",
  },
];

export function isShortcutId(value: string): value is ShortcutId {
  return (SHORTCUT_IDS as readonly string[]).includes(value);
}

export function ownerOf(id: string): ShortcutOwner | null {
  return isShortcutId(id) ? SHORTCUTS[id].owner : null;
}

export function sameShortcut(a: Shortcut, b: Shortcut): boolean {
  return (
    a.key === b.key &&
    (a.shift ?? false) === (b.shift ?? false) &&
    (a.alt ?? false) === (b.alt ?? false)
  );
}

export interface KeyReading {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly key: string;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export function shortcutOf(event: KeyReading): Shortcut | null {
  if (!(event.metaKey || event.ctrlKey)) {
    return null;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === "Meta" || key === "Control" || key === "Shift" || key === "Alt") {
    return null;
  }
  return {
    ...(event.altKey ? { alt: true } : {}),
    key,
    ...(event.shiftKey ? { shift: true } : {}),
  };
}

export function findByShortcut(
  commands: readonly Command[],
  shortcut: Shortcut
): Command | null {
  return (
    commands.find(
      (command) =>
        command.shortcut !== undefined &&
        sameShortcut(command.shortcut, shortcut)
    ) ?? null
  );
}

const KEY_GLYPHS: Readonly<Record<string, string>> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
};

export function shortcutKeys(
  shortcut: Shortcut,
  platform: Platform = currentPlatform()
): readonly string[] {
  const glyph = KEY_GLYPHS[shortcut.key] ?? shortcut.key.toUpperCase();
  const parts: string[] = [];
  if (platform === "mac") {
    if (shortcut.alt) {
      parts.push("⌥");
    }
    if (shortcut.shift) {
      parts.push("⇧");
    }
    parts.push("⌘", glyph);
    return parts;
  }
  parts.push("Ctrl");
  if (shortcut.alt) {
    parts.push("Alt");
  }
  if (shortcut.shift) {
    parts.push("Shift");
  }
  parts.push(glyph);
  return parts;
}

export function formatShortcut(
  shortcut: Shortcut,
  platform: Platform = currentPlatform()
): string {
  return shortcutKeys(shortcut, platform).join(platform === "mac" ? "" : "+");
}

const ACCELERATOR_KEYS: Readonly<Record<string, string>> = {
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
};

export function acceleratorOf(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.alt) {
    parts.push("Alt");
  }
  parts.push("CmdOrCtrl");
  if (shortcut.shift) {
    parts.push("Shift");
  }
  parts.push(ACCELERATOR_KEYS[shortcut.key] ?? shortcut.key.toUpperCase());
  return parts.join("+");
}

const MARKS = /\p{M}/gu;
const SPACES = /\s+/;

export function normalizeTitle(text: string): string {
  return text.normalize("NFD").replace(MARKS, "").toLowerCase();
}

export function matchCommands(
  query: string,
  commands: readonly Command[]
): readonly Command[] {
  const words = normalizeTitle(query).split(SPACES).filter(Boolean);
  if (words.length === 0) {
    return commands;
  }
  return commands.filter((command) => {
    const haystack = normalizeTitle(
      command.detail === undefined
        ? command.title
        : `${command.title} ${command.detail}`
    );
    return words.every((word) => haystack.includes(word));
  });
}

export function duplicateShortcuts(
  commands: readonly Command[]
): readonly string[] {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const command of commands) {
    if (command.shortcut === undefined) {
      continue;
    }
    const label = formatShortcut(command.shortcut, "mac");
    const other = seen.get(label);
    if (other !== undefined) {
      clashes.push(`${label}: ${other} and ${command.id}`);
    }
    seen.set(label, command.id);
  }
  return clashes;
}
