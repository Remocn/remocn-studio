import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Page from "@/app/page";
import type { HistorySession, Project } from "@/shared/ipc";

const PICKED_FOLDER = "/Users/me/projects/my-video";
const SESSION_ROW = /^A promo for the launch/;
const WORDMARK = /^emocn/;

const SIDECAR_READY = {
  attempt: 0,
  detail: null,
  logPath: "/tmp/sidecar.log",
  phase: "ready",
  pid: 1234,
};

const PROJECT: Project = {
  createdAt: 1_700_000_000_000,
  id: "project-1",
  missing: false,
  name: "my-video",
  path: PICKED_FOLDER,
  updatedAt: 1_700_000_000_000,
};

const STORED_SESSION: HistorySession = {
  createdAt: 1_700_000_000_000,
  id: "session-1",
  mode: "auto",
  projectId: PROJECT.id,
  sdkSessionId: "sdk-1",
  title: "A promo for the launch",
  updatedAt: 1_700_000_000_000,
};

function mockStudio(
  options: {
    folder?: string | null;
    projects?: Project[];
    sessions?: HistorySession[];
  } = {}
) {
  mockIPC(
    (cmd, payload) => {
      if (cmd === "plugin:dialog|open") {
        return options.folder ?? null;
      }
      if (cmd === "sidecar_status") {
        return SIDECAR_READY;
      }
      if (cmd === "sidecar_request") {
        const { method } = payload as { method: string };
        if (method === "history.sessions") {
          return options.sessions ?? [];
        }
        if (method === "history.blocks") {
          return [];
        }
        if (method === "history.remove") {
          return { removed: true };
        }
        if (method === "project.list") {
          return options.projects ?? [];
        }
        if (method === "project.open") {
          return PROJECT;
        }
        if (method === "preview.start") {
          return new Promise(() => undefined);
        }
        throw new Error(`unexpected sidecar method: ${method}`);
      }
      throw new Error(`unexpected command: ${cmd}`);
    },
    { shouldMockEvents: true }
  );
}

async function renderShell() {
  render(<Page />);
  await screen.findByRole("button", { name: "Export" });
}

function openFolderButton() {
  return screen.findByRole("button", { name: "Open folder" });
}

describe("app shell", () => {
  beforeEach(() => {
    mockStudio();
  });

  it("renders the three panes", async () => {
    await renderShell();

    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Chat" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Preview" })).toBeVisible();
  });

  it("lets the transcript be selected, unlike the rest of the shell", async () => {
    const { container } = render(<Page />);
    await screen.findByRole("button", { name: "Export" });

    expect(
      container.querySelector('[data-slot="message-scroller-content"]')
    ).toHaveAttribute("data-selectable");
  });

  it("says every pane is empty when no project is open", async () => {
    await renderShell();

    expect(await screen.findByText("No projects yet")).toBeVisible();
    expect(screen.getAllByText("No folder open")).toHaveLength(2);
    expect(await openFolderButton()).toBeVisible();
  });

  it("names the app at the head of the sidebar, and never a folder", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();

    // The lockup spells the name with the mark as its "R", so the text beside
    // the glyph starts at "emocn" — nothing else in the shell draws that.
    expect(await screen.findByText(WORDMARK)).toBeVisible();
    expect(screen.getAllByText("my-video")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Open folder" })
    ).not.toBeInTheDocument();
  });

  it("opens the picked folder into the pane", async () => {
    mockStudio({ folder: PICKED_FOLDER });
    await renderShell();

    fireEvent.click(await openFolderButton());

    expect(await screen.findByText("my-video")).toBeVisible();
    expect(screen.queryByText("No folder open")).not.toBeInTheDocument();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("keeps the empty states when the picker is dismissed", async () => {
    mockStudio({ folder: null });
    await renderShell();

    fireEvent.click(await openFolderButton());

    expect(await screen.findByText("No projects yet")).toBeVisible();
    expect(screen.getAllByText("No folder open")).toHaveLength(2);
  });

  it("lists stored sessions and opens the one that is clicked", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();

    fireEvent.click(
      await screen.findByRole("button", {
        name: SESSION_ROW,
      })
    );

    expect(await screen.findByText("my-video")).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "A promo for the launch" })
    ).toBeVisible();
  });

  it("drops a deleted session and puts the chat back on a new one", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));
    await screen.findByRole("heading", { name: "A promo for the launch" });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete A promo for the launch" })
    );

    expect(
      screen.queryByRole("button", { name: SESSION_ROW })
    ).not.toBeInTheDocument();
    expect(await screen.findByText("No sessions yet")).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "New session" })
    ).toBeVisible();
  });

  it("offers to undo a delete, and puts the session back where it was", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));
    await screen.findByRole("heading", { name: "A promo for the launch" });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete A promo for the launch" })
    );

    expect(await screen.findByText("Session deleted")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(
      await screen.findByRole("button", { name: SESSION_ROW })
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "A promo for the launch" })
    ).toBeVisible();
  });

  it("offers a way to start a project from the header", async () => {
    await renderShell();

    expect(
      await screen.findByRole("button", { name: "New Project" })
    ).toBeVisible();
  });

  it("says so when the history cannot be read", async () => {
    mockIPC(
      (cmd) => {
        if (cmd === "sidecar_status") {
          return SIDECAR_READY;
        }
        if (cmd === "sidecar_request") {
          throw new Error("the sidecar is not running");
        }
        throw new Error(`unexpected command: ${cmd}`);
      },
      { shouldMockEvents: true }
    );
    await renderShell();

    expect(await screen.findByText("History is unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
