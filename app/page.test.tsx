import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Page from "@/app/page";
import type { HistorySession, Project } from "@/shared/ipc";

const PICKED_FOLDER = "/Users/me/projects/my-video";
const SESSION_ROW = /^A promo for the launch/;
const WORDMARK = /^emocn/;
const STARTUP = "Make a video by describing it";

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
  await screen.findByRole("heading", { name: "Projects" });
}

// The startup state offers the same action, so this names the sidebar's copy —
// the one that is there whether or not a project is open.
async function openFolderButton() {
  const [sidebar] = await screen.findAllByRole("button", {
    name: "Open an existing project",
  });
  return sidebar;
}

// The preview leaves once the project list comes back empty, so its own
// "show" button is the marker for a settled, project-less shell.
function showPreviewButton() {
  return screen.findByRole("button", { name: "Show the preview" });
}

describe("app shell", () => {
  beforeEach(() => {
    mockStudio();
  });

  it("renders the three panes", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();

    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Chat" })).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Preview" })
    ).toBeVisible();
  });

  it("keeps the preview out of the way until there is a project", async () => {
    await renderShell();
    await showPreviewButton();

    expect(
      screen.queryByRole("heading", { name: "Preview" })
    ).not.toBeInTheDocument();
  });

  it("brings the preview back, and lets it be dismissed again", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();
    await screen.findByRole("heading", { name: "Preview" });

    fireEvent.click(screen.getByRole("button", { name: "Hide the preview" }));

    expect(
      screen.queryByRole("heading", { name: "Preview" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show the preview" }));

    expect(screen.getByRole("heading", { name: "Preview" })).toBeVisible();
  });

  it("opens the new project dialog with the project list hidden", async () => {
    await renderShell();
    await showPreviewButton();
    fireEvent.click(
      screen.getByRole("button", { name: "Hide the project list" })
    );

    const [cta] = screen.getAllByRole("button", { name: "New Project" });
    fireEvent.click(cta);

    expect(
      await screen.findByRole("heading", { name: "New project" })
    ).toBeVisible();
  });

  it("lets the project list be dismissed and brought back", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    await screen.findByText("my-video");

    fireEvent.click(
      screen.getByRole("button", { name: "Hide the project list" })
    );

    expect(
      screen.queryByRole("heading", { name: "Projects" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("my-video")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show the project list" })
    );

    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();
    expect(await screen.findByText("my-video")).toBeVisible();
  });

  it("keeps the chat clear of the window buttons on its own", async () => {
    const { container } = render(<Page />);
    await screen.findByRole("heading", { name: "Chat" });

    fireEvent.click(
      await screen.findByRole("button", { name: "Hide the project list" })
    );

    expect(container.querySelector('[data-slot="pane-header"]')).toHaveClass(
      "pl-(--titlebar-inline-inset)"
    );
  });

  it("lets the transcript be selected, unlike the rest of the shell", async () => {
    const { container } = render(<Page />);
    await screen.findByRole("heading", { name: "Chat" });

    expect(
      container.querySelector('[data-slot="message-scroller-content"]')
    ).toHaveAttribute("data-selectable");
  });

  it("leaves the projects pane bare and offers to create one instead", async () => {
    await renderShell();
    await showPreviewButton();

    const create = screen.getAllByRole("button", { name: "New Project" });

    expect(screen.getByRole("heading", { name: STARTUP })).toBeVisible();
    expect(create).toHaveLength(2);
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("walks a first-time user through the steps, ending on the CTA", async () => {
    await renderShell();
    await showPreviewButton();

    const steps = screen.getByRole("list", { name: "Getting started" });

    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(within(steps).getByText("Start a project")).toBeVisible();
    expect(within(steps).getByText("Export the mp4")).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Open an existing project" })
    ).toHaveLength(2);
  });

  it("names the app at the head of the sidebar, and never a folder", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();

    // The lockup spells the name with the mark as its "R", so the text beside
    // the glyph starts at "emocn" — nothing else in the shell draws that.
    expect(await screen.findByText(WORDMARK)).toBeVisible();
    expect(screen.getAllByText("my-video")).toHaveLength(1);
  });

  it("opens the picked folder into the pane", async () => {
    mockStudio({ folder: PICKED_FOLDER });
    await renderShell();

    fireEvent.click(await openFolderButton());

    expect(await screen.findByText("my-video")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: STARTUP })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("keeps the empty states when the picker is dismissed", async () => {
    mockStudio({ folder: null });
    await renderShell();
    await showPreviewButton();

    fireEvent.click(await openFolderButton());

    expect(await screen.findByRole("heading", { name: STARTUP })).toBeVisible();
    expect(screen.queryByText("my-video")).not.toBeInTheDocument();
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

    const [header] = await screen.findAllByRole("button", {
      name: "New Project",
    });

    expect(header).toBeVisible();
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
