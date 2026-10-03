import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "@/components/studio/command-palette";
import type { CommandPalette as Palette } from "@/hooks/use-command-palette";
import { type Command, SHORTCUTS } from "@/lib/studio/command-registry";

function command(
  id: string,
  title: string,
  extra: Partial<Command> = {}
): Command {
  return {
    enabled: true,
    group: "actions",
    id,
    run: () => undefined,
    title,
    ...extra,
  };
}

const SNAPSHOT_NAME = /Snapshot/;
const NOTHING_MATCHES = /Nothing matches\./;

const EXPORT = command("export", "Export…", { shortcut: SHORTCUTS.export });
const SNAPSHOT = command("snapshot", "Snapshot", {
  enabled: { reason: "The preview is not running yet." },
});
const CHAT = command("chat:s1", "First cut", {
  checked: true,
  detail: "Intro",
  group: "videos",
});

function palette(overrides: Partial<Palette> = {}): Palette {
  return {
    close: mock(),
    commands: [EXPORT, SNAPSHOT, CHAT],
    groups: [
      { id: "actions", items: [EXPORT, SNAPSHOT], label: "Actions" },
      { id: "videos", items: [CHAT], label: "Videos" },
    ],
    isOpen: true,
    onInputKeyDown: mock(),
    onPick: mock(),
    onQueryChange: mock(),
    query: "",
    run: mock(() => true),
    setOpen: mock(),
    toggle: mock(),
    ...overrides,
  };
}

describe("CommandPalette", () => {
  it("renders the groups with shortcuts, reasons and the open mark", () => {
    render(<CommandPalette palette={palette()} />);

    expect(screen.getByText("Actions")).toBeVisible();
    expect(screen.getByText("Videos")).toBeVisible();
    expect(screen.getByText("Export…")).toBeVisible();
    expect(screen.getByText("Ctrl+E")).toBeVisible();
    expect(screen.getByText("The preview is not running yet.")).toBeVisible();
    expect(
      screen.getByRole("option", { name: "First cut, open" })
    ).toBeVisible();
    expect(screen.getByText("Intro")).toBeVisible();
  });

  it("marks a refused entry disabled", () => {
    render(<CommandPalette palette={palette()} />);

    expect(screen.getByRole("option", { name: SNAPSHOT_NAME })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("hands a click on an entry to the palette", () => {
    const view = palette();
    render(<CommandPalette palette={view} />);

    fireEvent.click(screen.getByText("Export…"));

    expect(view.onPick).toHaveBeenCalledTimes(1);
  });

  it("hands Escape on the input to the palette", () => {
    const view = palette();
    render(<CommandPalette palette={view} />);

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    expect(view.onInputKeyDown).toHaveBeenCalledTimes(1);
  });

  it("says in words when nothing matches", () => {
    render(<CommandPalette palette={palette({ groups: [], query: "zzz" })} />);

    expect(screen.getByText(NOTHING_MATCHES)).toBeVisible();
  });

  it("renders nothing while closed", () => {
    render(<CommandPalette palette={palette({ isOpen: false })} />);

    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
