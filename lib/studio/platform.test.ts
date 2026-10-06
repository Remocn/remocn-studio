import { describe, expect, it } from "bun:test";
import {
  fileManagerName,
  keyringName,
  modKeyCombo,
  modKeyLabel,
  platformOf,
  terminalOpenHint,
  terminalPasteHint,
} from "./platform";

describe("platformOf", () => {
  it("reads a macOS webview", () => {
    expect(
      platformOf(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
      )
    ).toBe("mac");
  });

  it("reads jsdom's node-flavoured agent as the host platform", () => {
    expect(
      platformOf("Mozilla/5.0 (darwin) AppleWebKit/537.36 jsdom/24.0.0")
    ).toBe("mac");
  });

  it("reads WebView2", () => {
    expect(
      platformOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    ).toBe("windows");
  });

  it("reads WebKitGTK", () => {
    expect(
      platformOf("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15")
    ).toBe("linux");
  });
});

describe("labels", () => {
  it("names the modifier per platform", () => {
    expect(modKeyLabel("mac")).toBe("⌘");
    expect(modKeyLabel("windows")).toBe("Ctrl");
    expect(modKeyLabel("linux")).toBe("Ctrl");
  });

  it("joins a combo the way each platform writes it", () => {
    expect(modKeyCombo("V", "mac")).toBe("⌘V");
    expect(modKeyCombo("V", "windows")).toBe("Ctrl+V");
  });

  it("names the file manager per platform", () => {
    expect(fileManagerName("mac")).toBe("Finder");
    expect(fileManagerName("windows")).toBe("File Explorer");
    expect(fileManagerName("linux")).toBe("Files");
  });

  it("names the keychain on macOS and the keyring elsewhere", () => {
    expect(keyringName("mac")).toBe("this Mac’s keychain");
    expect(keyringName("linux")).toBe("your system keyring");
  });

  it("says Terminal on macOS and the person's own terminal elsewhere", () => {
    expect(terminalOpenHint("mac")).toContain("an empty Terminal window");
    expect(terminalOpenHint("linux")).toContain(
      "an empty window of your terminal"
    );
  });

  it("tells a Linux terminal to paste with Shift", () => {
    expect(terminalPasteHint("linux")).toBe("Ctrl+Shift+V, then Enter");
    expect(terminalPasteHint("mac")).toBe("⌘V, then Enter");
    expect(terminalPasteHint("windows")).toBe("Ctrl+V, then Enter");
  });
});
