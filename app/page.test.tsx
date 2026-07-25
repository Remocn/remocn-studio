import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";

const PICKED_FOLDER = "/Users/me/projects/my-video";

function mockFolderPicker(result: string | null) {
  mockIPC((cmd) => {
    if (cmd === "plugin:dialog|open") {
      return result;
    }
    throw new Error(`unexpected command: ${cmd}`);
  });
}

async function renderShell() {
  render(<Page />);
  await screen.findByRole("button", { name: "Export" });
}

function openFolderButtons() {
  return screen.getAllByRole("button", { name: "Open folder" });
}

describe("app shell", () => {
  it("renders the three panes", async () => {
    await renderShell();

    expect(screen.getByRole("heading", { name: "Sessions" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Chat" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Preview" })).toBeVisible();
  });

  it("says every pane is empty when no folder is open", async () => {
    await renderShell();

    expect(screen.getAllByText("No folder open")).toHaveLength(3);
    expect(openFolderButtons()).toHaveLength(2);
  });

  it("shows the chosen folder in the title bar", async () => {
    mockFolderPicker(PICKED_FOLDER);
    await renderShell();

    fireEvent.click(openFolderButtons()[0]);

    expect(await screen.findByText("my-video")).toBeVisible();
    expect(screen.queryByText("No folder open")).not.toBeInTheDocument();
  });

  it("keeps the empty states when the picker is dismissed", async () => {
    mockFolderPicker(null);
    await renderShell();

    fireEvent.click(openFolderButtons()[0]);

    expect(await screen.findAllByText("No folder open")).toHaveLength(3);
  });
});
