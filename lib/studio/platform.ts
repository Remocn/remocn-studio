export type Platform = "linux" | "mac" | "windows";

const MAC_AGENT = /mac|iphone|ipad|ipod|darwin/i;

const WINDOWS_AGENT = /windows/i;

export function platformOf(userAgent: string): Platform {
  if (MAC_AGENT.test(userAgent)) {
    return "mac";
  }

  if (WINDOWS_AGENT.test(userAgent)) {
    return "windows";
  }

  return "linux";
}

export function currentPlatform(): Platform {
  return typeof navigator === "undefined"
    ? "mac"
    : platformOf(navigator.userAgent);
}

export function modKeyLabel(platform: Platform = currentPlatform()): string {
  return platform === "mac" ? "⌘" : "Ctrl";
}

export function modKeyCombo(
  key: string,
  platform: Platform = currentPlatform()
): string {
  return platform === "mac" ? `⌘${key}` : `Ctrl+${key}`;
}

export function fileManagerName(
  platform: Platform = currentPlatform()
): string {
  if (platform === "mac") {
    return "Finder";
  }

  return platform === "windows" ? "File Explorer" : "Files";
}

// Linux terminals keep Ctrl+V for the shell, so a paste there takes Shift.
export function terminalPasteHint(
  platform: Platform = currentPlatform()
): string {
  if (platform === "mac") {
    return "⌘V, then Enter";
  }

  return platform === "linux"
    ? "Ctrl+Shift+V, then Enter"
    : "Ctrl+V, then Enter";
}

export function keyringName(platform: Platform = currentPlatform()): string {
  return platform === "mac" ? "this Mac’s keychain" : "your system keyring";
}
