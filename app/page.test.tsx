import { beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import { MotionConfig } from "motion/react";
import Page from "@/app/page";
import type {
  HistorySession,
  Project,
  TranscriptEntry,
  Video,
} from "@/shared/ipc";
import type { Asset } from "@/shared/library";

const PICKED_FOLDER = "/Users/me/projects/my-video";
const PROJECT_CHAT = /^Project chat/;
const SESSION_ROW = /^A promo for the launch/;
const PRODUCT_DEMO_ROW = /^Product demo/;
const LAUNCH_TEASER_ROW = /^Launch teaser/;
const WORDMARK = /^emocn/;
const STARTUP = "Make a video by describing it";
const SIDECAR_DOWN = /the sidecar is not running/;

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
  name: "My video",
  path: PICKED_FOLDER,
  updatedAt: 1_700_000_000_000,
};

const VIDEO: Video = {
  compositionId: "my-video",
  createdAt: 1_700_000_000_000,
  deletedAt: null,
  id: "video-1",
  missing: false,
  name: "My video",
  projectId: PROJECT.id,
  updatedAt: 1_700_000_000_000,
};

const SECOND_VIDEO: Video = {
  compositionId: "second-video",
  createdAt: 1_700_000_000_000,
  deletedAt: null,
  id: "video-2",
  missing: false,
  name: "Second video",
  projectId: PROJECT.id,
  updatedAt: 1_700_000_000_000,
};

const STORED_SESSION: HistorySession = {
  createdAt: 1_700_000_000_000,
  id: "session-1",
  mode: "auto",
  projectId: PROJECT.id,
  provider: "claude" as const,
  sdkSessionId: "sdk-1",
  title: "A promo for the launch",
  updatedAt: 1_700_000_000_000,
  videoId: VIDEO.id,
};

function mockStudio(
  options: {
    assets?: Asset[];
    bundled?: Asset[];
    blocks?: TranscriptEntry[];
    folder?: string | null;
    projects?:
      | Project[]
      | Promise<Project[]>
      | (() => Project[] | Promise<Project[]>);
    sessions?: HistorySession[];
    videos?: Video[];
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
          return options.blocks ?? [];
        }
        if (method === "history.remove") {
          return { removed: true };
        }
        if (method === "library.list") {
          return options.assets ?? [];
        }
        if (method === "library.bundled") {
          return options.bundled ?? [];
        }
        if (method === "project.list") {
          const { projects } = options;
          return typeof projects === "function" ? projects() : (projects ?? []);
        }
        if (method === "video.documents") {
          return {
            files: [],
            folder: `${PICKED_FOLDER}/src/videos/my-video/docs`,
          };
        }
        if (method === "video.list") {
          const { projectId } = (payload as { params: { projectId: string } })
            .params;
          return (options.videos ?? [VIDEO]).filter(
            (video) => video.projectId === projectId
          );
        }
        if (method === "video.reconcile") {
          const { projectId } = (payload as { params: { projectId: string } })
            .params;
          return (options.videos ?? [VIDEO]).filter(
            (video) => video.projectId === projectId
          );
        }
        if (method === "project.open") {
          return PROJECT;
        }
        if (method === "project.settingsGet") {
          return {
            brand: null,
            name: PROJECT.name,
            projectId: PROJECT.id,
            revision: 1,
            schemaVersion: 1,
          };
        }
        if (method === "video.brandStatus") {
          return null;
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

const OLDER_CHAT = /The older one/;

async function renderShell() {
  // Happy DOM cannot render WAAPI frames; assert navigation without tweening.
  render(
    <MotionConfig skipAnimations>
      <Page />
    </MotionConfig>
  );
  await screen.findByRole("navigation", { name: "Library views" });
}

async function openAssets() {
  fireEvent.click(await screen.findByRole("button", { name: "Assets" }));
  await screen.findByRole("region", { name: "Library" });
}

async function openProjects() {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Library views" })).getByRole(
      "button",
      { name: "Projects" }
    )
  );
  return await screen.findByRole("complementary", {
    name: "Projects navigation",
  });
}

async function pickProject(name: string) {
  const navigation = await openProjects();
  fireEvent.click(await within(navigation).findByRole("button", { name }));
}

// Picking a folder moved to the native File menu, which jsdom cannot open, so
// the route these tests drive is the startup screen's own button — on screen
// in every projectless shell.
async function openFolderButton() {
  return await screen.findByRole("button", {
    name: "Open an existing project",
  });
}

function welcomeReady() {
  return screen.findByRole("heading", { name: STARTUP });
}

describe("app shell", () => {
  beforeEach(() => {
    mockStudio();
  });

  it("renders the three panes", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();

    expect(
      screen.getByRole("navigation", { name: "Library views" })
    ).toBeVisible();
    expect(
      within(
        screen.getByRole("navigation", { name: "Library views" })
      ).queryByRole("button", { name: "Videos" })
    ).toBeNull();
    expect(screen.getByRole("region", { name: "Videos" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Chat" })).toBeVisible();
    expect(await screen.findByRole("button", { name: "Export" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Hide the preview" })
    ).toBeNull();
  });

  it("opens video creation from the sidebar", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();

    const createVideo = within(
      screen.getByRole("region", { name: "Videos" })
    ).getByRole("button", { name: "New video" });
    await waitFor(() => expect(createVideo).toBeEnabled());
    fireEvent.click(createVideo);

    expect(
      await screen.findByRole("heading", { name: "New video" })
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "Library" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("textbox", { name: "Message" })
    ).toBeVisible();
  });

  it("keeps Docs behind a shortcut and offers the way back from it", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(
      await within(screen.getByRole("region", { name: "Videos" })).findByRole(
        "button",
        { name: "My video" }
      )
    );
    await screen.findByRole("button", { name: "Export" });

    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();

    fireEvent.keyDown(window, { key: "d", metaKey: true });
    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Preview" })).toBeNull()
    );
  });

  it("keeps the preview out of the way until there is a project", async () => {
    await renderShell();
    await welcomeReady();

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Export" })
      ).not.toBeInTheDocument()
    );
  });

  it("does not reveal onboarding while stored projects are loading", async () => {
    let finishLoading: (projects: Project[]) => void = () => undefined;
    const projects = new Promise<Project[]>((resolve) => {
      finishLoading = resolve;
    });
    mockStudio({ projects });

    render(<Page />);
    await screen.findByRole("heading", { name: "Chat" });

    expect(
      screen.queryByRole("heading", { name: STARTUP })
    ).not.toBeInTheDocument();

    finishLoading([PROJECT]);
    expect(
      await screen.findByRole("button", { name: "My video" })
    ).toBeVisible();
  });

  // A list that failed is not a list that is empty. Onboarding here told a
  // returning person their projects were gone, and New Project from that
  // screen would have failed the same way with nothing connecting the two.
  it("says the project list could not be read instead of onboarding", async () => {
    let attempts = 0;
    mockStudio({
      projects: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error("the sidecar is not running"))
          : [PROJECT];
      },
    });

    render(<Page />);

    // The sidebar repeats the message; the conversation is where onboarding
    // used to be, so that is where the failure has to be.
    const conversation = within(await screen.findByLabelText("Conversation"));
    expect(
      await conversation.findByText("The project list could not be read")
    ).toBeVisible();
    expect(conversation.getByText(SIDECAR_DOWN)).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: STARTUP })
    ).not.toBeInTheDocument();

    fireEvent.click(conversation.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("button", { name: "My video" })
    ).toBeVisible();
  });

  it("brings the preview back, and lets it be dismissed again", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();
    await screen.findByRole("button", { name: "Export" });
    fireEvent.keyDown(window, { key: "\\", metaKey: true });

    await waitForElementToBeRemoved(() =>
      screen.queryByRole("button", { name: "Export" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Show the preview" }));

    expect(screen.getByRole("button", { name: "Export" })).toBeVisible();
  });

  // "Clicking a video opens its most recent chat" is the invariant the rest of
  // the design leans on — the open chat decides the composition the preview
  // plays, the folder in the conventions and the target of an export. The row
  // only expanded, so a video could look selected while an unrelated chat drove
  // all three.
  it("opens a video's most recent chat when its row is clicked", async () => {
    mockStudio({
      projects: [PROJECT],
      sessions: [
        { ...STORED_SESSION, id: "session-2", title: "The newer one" },
        { ...STORED_SESSION, id: "session-1", title: "The older one" },
      ],
    });
    await renderShell();

    fireEvent.click(
      await within(screen.getByRole("region", { name: "Videos" })).findByRole(
        "button",
        { name: "My video" }
      )
    );

    expect(
      await screen.findByRole("heading", { name: "The newer one" })
    ).toBeVisible();
  });

  it("opens the command palette on Cmd+K and reaches a chat from it", async () => {
    mockStudio({
      projects: [PROJECT],
      sessions: [
        { ...STORED_SESSION, id: "session-2", title: "The newer one" },
        { ...STORED_SESSION, id: "session-1", title: "The older one" },
      ],
    });
    await renderShell();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(await screen.findByRole("combobox")).toBeVisible();

    fireEvent.click(await screen.findByRole("option", { name: OLDER_CHAT }));

    expect(
      await screen.findByRole("heading", { name: "The older one" })
    ).toBeVisible();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("keeps the draft when leaving the library or picking the current chat again", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));
    const message = await screen.findByRole("textbox", { name: "Message" });
    fireEvent.change(message, { target: { value: "Keep this draft" } });

    await openAssets();
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep this draft"
    );

    await openAssets();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.change(await screen.findByRole("combobox"), {
      target: { value: STORED_SESSION.title },
    });
    fireEvent.click(await screen.findByRole("option", { name: SESSION_ROW }));
    expect(
      screen.queryByRole("region", { name: "Library" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep this draft"
    );
  });

  it("keeps the current chat and draft when picking the selected project", async () => {
    const olderChat = {
      ...STORED_SESSION,
      id: "older-chat",
      title: "Earlier conversation",
      updatedAt: STORED_SESSION.updatedAt - 1,
    };
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION, olderChat] });
    await renderShell();
    fireEvent.click(
      await screen.findByRole("button", { name: olderChat.title })
    );
    fireEvent.change(await screen.findByRole("textbox", { name: "Message" }), {
      target: { value: "Keep the earlier draft" },
    });

    await pickProject(PROJECT.name);

    expect(
      screen.getByRole("heading", { name: olderChat.title })
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep the earlier draft"
    );
  });

  it("shows chats by update time and switches only the selected project's list", async () => {
    const otherProject = { ...PROJECT, id: "project-2", name: "Brand film" };
    const emptyProject = { ...PROJECT, id: "project-3", name: "Empty project" };
    const chats = Array.from({ length: 9 }, (_, index) => ({
      ...STORED_SESSION,
      id: `chat-${index}`,
      title: `Project chat ${index}`,
      updatedAt: index,
    }));
    const otherChat = {
      ...STORED_SESSION,
      id: "other-chat",
      projectId: otherProject.id,
      title: "Brand story",
      videoId: "brand-video",
    };
    mockStudio({
      projects: [PROJECT, otherProject, emptyProject],
      sessions: [...chats, otherChat],
      videos: [
        VIDEO,
        {
          ...VIDEO,
          id: "brand-video",
          name: "Brand video",
          projectId: otherProject.id,
        },
      ],
    });
    await renderShell();
    const list = screen.getByRole("region", { name: "Videos" });
    const firstChat = await within(list).findByRole("button", {
      name: "Project chat 0",
    });
    expect(firstChat.closest("[data-video-list]")?.parentElement).toHaveClass(
      "flex-1",
      "min-h-0",
      "overflow-y-auto"
    );
    expect(screen.queryByRole("region", { name: "Projects" })).toBeNull();
    expect(
      within(list).getAllByRole("button", { name: PROJECT_CHAT })
    ).toHaveLength(9);
    expect(
      within(list)
        .getAllByRole("button", { name: PROJECT_CHAT })
        .map((button) => button.getAttribute("value"))
    ).toEqual(chats.toReversed().map((chat) => chat.id));
    expect(
      within(list).queryByRole("button", { name: "Brand story" })
    ).toBeNull();

    const projectNavigation = await openProjects();
    const projectButton = within(projectNavigation).getByRole("button", {
      name: "Brand film",
    });
    fireEvent.pointerDown(projectButton);
    fireEvent.click(projectButton);
    const brandChat = await within(list).findByRole("button", {
      name: "Brand story",
    });
    expect(brandChat.closest("[data-video-list]")).toHaveAttribute(
      "data-animate",
      "true"
    );
    expect(
      within(list).queryByRole("button", { name: "Project chat 0" })
    ).toBeNull();

    const emptyNavigation = await openProjects();
    const emptyButton = within(emptyNavigation).getByRole("button", {
      name: "Empty project",
    });
    fireEvent.keyDown(emptyButton, { key: "Enter" });
    fireEvent.click(emptyButton);
    const empty = await within(list).findByText(
      "No videos in this project yet."
    );
    expect(empty.closest("[data-video-list]")?.parentElement).toHaveClass(
      "flex-1",
      "min-h-0"
    );
    expect(empty.closest("[data-video-list]")).toHaveAttribute(
      "data-animate",
      "false"
    );
    expect(
      within(list).queryByRole("button", { name: "Brand story" })
    ).toBeNull();

    await pickProject(PROJECT.name);
    await within(list).findByRole("button", { name: "Project chat 0" });
    expect(
      within(list).getAllByRole("button", { name: PROJECT_CHAT })
    ).toHaveLength(9);
  });

  it("nests chats under their video and opens or starts a chat in that video", async () => {
    const secondChat = {
      ...STORED_SESSION,
      id: "second-chat",
      title: "Second video discussion",
      videoId: SECOND_VIDEO.id,
    };
    mockStudio({
      projects: [PROJECT],
      sessions: [STORED_SESSION, secondChat],
      videos: [VIDEO, SECOND_VIDEO],
    });
    await renderShell();
    const sidebar = screen.getByRole("region", { name: "Videos" });
    const firstChat = await within(sidebar).findByRole("button", {
      name: SESSION_ROW,
    });
    expect(firstChat.closest("[data-video-row]")).toHaveTextContent(VIDEO.name);
    expect(
      within(sidebar).queryByRole("button", { name: secondChat.title })
    ).toBeNull();

    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: "Show the chats about Second video",
      })
    );
    const nestedChat = within(sidebar).getByRole("button", {
      name: secondChat.title,
    });
    expect(nestedChat.closest("[data-video-row]")).toHaveTextContent(
      SECOND_VIDEO.name
    );
    expect(
      screen.queryByRole("heading", { name: secondChat.title })
    ).toBeNull();

    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: SECOND_VIDEO.name,
      })
    );
    expect(
      await screen.findByRole("heading", { name: secondChat.title })
    ).toBeVisible();
    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Collapse all chats" })
    );
    expect(
      within(sidebar).queryByRole("button", { name: SESSION_ROW })
    ).toBeNull();
    expect(
      within(sidebar).queryByRole("button", { name: secondChat.title })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: secondChat.title })
    ).toBeVisible();
    fireEvent.click(
      within(sidebar).getByRole("button", { name: "Expand all chats" })
    );
    expect(
      within(sidebar).getByRole("button", { name: SESSION_ROW })
    ).toBeVisible();
    expect(
      within(sidebar).getByRole("button", { name: secondChat.title })
    ).toBeVisible();
    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: "New chat about Second video",
      })
    );
    expect(
      await screen.findByRole("heading", { name: "New chat" })
    ).toBeVisible();
  });

  it("keeps complete lists in scroll areas and video history popovers", async () => {
    const chats = Array.from({ length: 30 }, (_, index) => ({
      ...STORED_SESSION,
      id: `chat-${index}`,
      title: `Project chat ${index}`,
      updatedAt: STORED_SESSION.updatedAt + index,
    }));
    const projects = Array.from({ length: 12 }, (_, index) => ({
      ...PROJECT,
      id: `extra-${index}`,
      name: `Extra project ${index}`,
      updatedAt: index,
    }));
    mockStudio({ projects: [PROJECT, ...projects], sessions: chats });
    await renderShell();
    const list = screen.getByRole("region", { name: "Videos" });
    await within(list).findByRole("button", { name: "Project chat 29" });
    expect(
      within(list).getAllByRole("button", { name: PROJECT_CHAT })
    ).toHaveLength(30);
    expect(
      within(list).getByRole("button", { name: "Project chat 0" })
    ).toBeInTheDocument();

    fireEvent.click(within(list).getByRole("button", { name: "All videos" }));
    const chatHistory = screen.getByRole("dialog", {
      name: "All videos",
    });
    expect(
      within(chatHistory).getAllByRole("button", { name: PROJECT_CHAT })
    ).toHaveLength(30);
    fireEvent.click(
      within(chatHistory).getByRole("button", { name: "Project chat 0" })
    );
    expect(
      within(list).getByRole("button", { name: "All videos" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      await screen.findByRole("heading", { name: "Project chat 0" })
    ).toBeVisible();

    const projectList = await openProjects();
    expect(
      within(projectList).getByRole("button", { name: "Extra project 0" })
    ).toBeInTheDocument();
    fireEvent.click(
      within(projectList).getByRole("button", { name: "Extra project 0" })
    );
    expect(
      await within(list).findByText("No videos in this project yet.")
    ).toBeInTheDocument();
  });

  it("opens Projects in the sidebar and returns to the selected project's videos and chats", async () => {
    const otherProject = { ...PROJECT, id: "project-2", name: "Brand film" };
    const otherVideo = {
      ...VIDEO,
      id: "brand-video",
      name: "Brand video",
      projectId: otherProject.id,
    };
    const otherChat = {
      ...STORED_SESSION,
      id: "brand-chat",
      projectId: otherProject.id,
      title: "Brand story",
      updatedAt: STORED_SESSION.updatedAt + 1,
      videoId: otherVideo.id,
    };
    mockStudio({
      projects: [PROJECT, otherProject],
      sessions: [STORED_SESSION, otherChat],
      videos: [VIDEO, otherVideo],
    });
    await renderShell();
    fireEvent.click(
      await screen.findByRole("button", { name: STORED_SESSION.title })
    );
    const menu = screen.getByRole("navigation", { name: "Library views" });
    fireEvent.click(within(menu).getByRole("button", { name: "Projects" }));
    const navigation = await screen.findByRole("complementary", {
      name: "Projects navigation",
    });

    expect(screen.queryByRole("region", { name: "Videos" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: STORED_SESSION.title })
    ).toBeVisible();
    expect(
      within(navigation).getByRole("button", { name: "Create project" })
    ).toBeVisible();
    const projectButtons = within(navigation)
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("value"));
    expect(projectButtons.map((button) => button.textContent)).toEqual([
      "Brand film",
      PROJECT.name,
    ]);
    fireEvent.click(
      within(navigation).getByRole("button", { name: "Brand film" })
    );

    expect(
      screen.queryByRole("complementary", { name: "Projects navigation" })
    ).toBeNull();
    const videos = await screen.findByRole("region", { name: "Videos" });
    expect(
      await within(videos).findByRole("button", { name: "Brand video" })
    ).toBeVisible();
    expect(
      await within(videos).findByRole("button", { name: "Brand story" })
    ).toBeVisible();
    expect(
      within(videos).queryByRole("button", { name: STORED_SESSION.title })
    ).toBeNull();
    expect(screen.getByRole("heading", { name: "Brand story" })).toBeVisible();

    fireEvent.click(within(menu).getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(screen.getByRole("region", { name: "Videos" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Brand story" })).toBeVisible();
  });

  it("preserves the chat draft when choosing the current project from Projects", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    fireEvent.click(
      await screen.findByRole("button", { name: STORED_SESSION.title })
    );
    fireEvent.change(await screen.findByRole("textbox", { name: "Message" }), {
      target: { value: "Keep this project draft" },
    });
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Library views" })
      ).getByRole("button", { name: "Projects" })
    );
    const navigation = await screen.findByRole("complementary", {
      name: "Projects navigation",
    });
    fireEvent.click(
      within(navigation).getByRole("button", { name: PROJECT.name })
    );
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep this project draft"
    );
    expect(
      screen.getByRole("heading", { name: STORED_SESSION.title })
    ).toBeVisible();
  });

  it("replaces navigation for Assets and Components and restores the chat draft", async () => {
    const component: Asset = {
      audiomap: null,
      category: null,
      clip: null,
      createdAt: 1,
      dependencies: [],
      description: "",
      duration: null,
      files: ["Title.tsx"],
      name: "Title reveal",
      path: "/library/title-reveal",
      preview: null,
      proxied: false,
      role: null,
      slug: "title-reveal",
      source: null,
      type: "component",
    };
    mockStudio({
      assets: [component],
      projects: [PROJECT],
      sessions: [STORED_SESSION],
    });
    await renderShell();
    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Message" }), {
      target: { value: "Keep my draft" },
    });
    const assets = screen.getByRole("button", { name: "Assets" });
    assets.focus();
    fireEvent.pointerDown(assets);
    fireEvent.click(assets);
    const navigation = await screen.findByRole("complementary", {
      name: "Assets navigation",
    });
    expect(
      within(navigation).getByRole("button", { name: "Library" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("region", { name: "Videos" })).toBeNull();
    expect(
      within(navigation).getByRole("region", { name: "Library" })
    ).toBeVisible();
    const draft = screen.getByRole("textbox", { name: "Message" });
    expect(draft).toBeVisible();
    expect(draft.closest("[inert]") === null).toBe(true);
    expect(draft).toHaveValue("Keep my draft");
    fireEvent.change(draft, {
      target: { value: "Editing with the library open" },
    });
    expect(
      document.activeElement ===
        within(navigation).getByRole("button", { name: "Back to chat" })
    ).toBe(true);
    expect(
      navigation.closest("[data-sidebar-slide]")?.getAttribute("style")
    ).toContain("transform 200ms");
    fireEvent.click(
      within(navigation).getByRole("button", { name: "Back to chat" })
    );
    await waitFor(() => expect(document.activeElement === assets).toBe(true));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Editing with the library open"
    );

    const components = screen.getByRole("button", {
      name: "Components",
    });
    fireEvent.keyDown(components, { key: "Enter" });
    fireEvent.click(components);
    const sources = await screen.findByRole("navigation", {
      name: "Component sources",
    });
    const componentSidebar = screen.getByRole("complementary", {
      name: "Components navigation",
    });
    expect(
      within(componentSidebar).getByRole("region", { name: "Library" })
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Message" }).closest("[inert]") ===
        null
    ).toBe(true);
    fireEvent.click(within(sources).getByRole("button", { name: "Saved" }));
    expect(
      within(sources).getByRole("button", { name: "Saved" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      sources.closest("[data-sidebar-slide]")?.getAttribute("style")
    ).toContain("transition: none");
    fireEvent.click(
      within(componentSidebar).getByRole("button", {
        name: "Title reveal, Component",
      })
    );
    expect(componentSidebar).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove Title reveal" })
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Editing with the library open [Asset #1] "
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Editing with the library open [Asset #1] "
    );
  });

  it("selects caption styles through the library while preserving the chat draft", async () => {
    const caption: Asset = {
      audiomap: null,
      category: "Captions",
      clip: null,
      createdAt: 1,
      dependencies: [],
      description: "",
      duration: null,
      files: [],
      name: "Karaoke",
      path: "/bundled/caption-karaoke",
      preview: null,
      proxied: false,
      role: null,
      slug: "remocn/caption-karaoke",
      source: null,
      type: "component",
    };
    mockStudio({
      bundled: [
        caption,
        { ...caption, name: "Subtitle", slug: "remocn/caption-subtitle" },
      ],
      projects: [PROJECT],
      sessions: [STORED_SESSION],
    });
    await renderShell();
    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Message" }), {
      target: { value: "Keep my draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Captions" }));
    const pane = await screen.findByRole("complementary", {
      name: "Captions navigation",
    });
    const karaoke = await within(pane).findByRole("button", {
      name: "Karaoke, Component",
    });
    fireEvent.click(karaoke);
    fireEvent.click(
      within(pane).getByRole("button", { name: "Subtitle, Component" })
    );
    fireEvent.click(karaoke);
    expect(
      screen.getAllByRole("button", { name: "Remove Karaoke" })
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Remove Subtitle" })
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep my draft [Asset #1] [Asset #2] [Asset #1] "
    );
    fireEvent.click(within(pane).getByRole("button", { name: "Back to chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Components" }));
    expect(
      screen.queryByRole("button", { name: "Karaoke, Component" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Shaders" }));
    expect(
      await screen.findByRole("complementary", { name: "Shaders navigation" })
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue(
      "Keep my draft [Asset #1] [Asset #2] [Asset #1] "
    );
  });

  it("keeps one project draft across settings tabs and protects it on Back", async () => {
    mockStudio({ projects: [PROJECT] });
    await renderShell();
    await screen.findByRole("button", { name: "My video" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Project" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Project name" }),
      {
        target: { value: "Launch film" },
      }
    );
    fireEvent.click(screen.getByRole("tab", { name: "Brand" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Brand name" }),
      {
        target: { value: "Acme" },
      }
    );
    fireEvent.click(screen.getByRole("tab", { name: "Guidelines" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tone of voice" }), {
      target: { value: "Clear and direct" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      within(screen.getByRole("region", { name: "Settings" })).getByRole(
        "alert"
      )
    ).toHaveTextContent("Save or cancel your project changes");
    fireEvent.click(screen.getByRole("tab", { name: "General" }));
    expect(screen.getByRole("textbox", { name: "Project name" })).toHaveValue(
      "Launch film"
    );
    fireEvent.click(screen.getByRole("tab", { name: "Brand" }));
    expect(screen.getByRole("textbox", { name: "Brand name" })).toHaveValue(
      "Acme"
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel changes" }));
    expect(screen.getByRole("textbox", { name: "Brand name" })).toHaveValue("");
    fireEvent.click(screen.getByRole("tab", { name: "Guidelines" }));
    expect(screen.getByRole("textbox", { name: "Tone of voice" })).toHaveValue(
      ""
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Settings" })
      ).not.toBeInTheDocument()
    );
  });

  // Row and chevron did the same thing, so the affordance that tells "expand"
  // from "open" pointed at nothing.
  it("expands without opening when the chevron alone is clicked", async () => {
    mockStudio({
      projects: [PROJECT],
      sessions: [{ ...STORED_SESSION, videoId: SECOND_VIDEO.id }],
      videos: [VIDEO, SECOND_VIDEO],
    });
    await renderShell();
    await within(screen.getByRole("region", { name: "Videos" })).findByText(
      "Second video"
    );
    await within(screen.getByRole("region", { name: "Videos" })).findByRole(
      "button",
      { name: "Hide the chats about My video" }
    );

    fireEvent.click(
      within(screen.getByRole("region", { name: "Videos" })).getByRole(
        "button",
        {
          name: "Show the chats about Second video",
        }
      )
    );

    // The chat is listed under the video, but it is not the open one: the
    // pane's heading still names the chat that was open before.
    expect(
      await within(screen.getByRole("region", { name: "Videos" })).findByText(
        STORED_SESSION.title
      )
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: STORED_SESSION.title })
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Videos" })).getByRole(
        "button",
        {
          name: "Hide the chats about Second video",
        }
      )
    ).toBeVisible();
  });

  // The band itself is there either way — it is what clears the traffic
  // lights. What arrives with the first project is the state indicator in it.
  it("keeps the state indicator out of an empty app", async () => {
    const { container } = render(<Page />);
    await welcomeReady();

    expect(container.querySelector('[data-slot="titlebar"]')).toBeVisible();
    expect(container.querySelector('[data-slot="titlebar-mood"]')).toBeNull();
  });

  it("lights the band once there is a project", async () => {
    mockStudio({ projects: [PROJECT] });
    const { container } = render(<Page />);
    await screen.findByRole("button", { name: "My video" });

    expect(
      container.querySelector('[data-slot="titlebar-mood"]')
    ).toBeInTheDocument();
  });

  it("opens the new project dialog with the project list hidden", async () => {
    await renderShell();
    await welcomeReady();
    fireEvent.click(
      screen.getByRole("button", { name: "Hide the project list" })
    );

    const [cta] = screen.getAllByRole("button", { name: "New project" });
    fireEvent.click(cta);

    expect(
      await screen.findByRole("heading", { name: "New project" })
    ).toBeVisible();
  });

  it("lets the project list be dismissed and brought back", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();
    await screen.findByRole("button", { name: "My video" });

    fireEvent.click(
      screen.getByRole("button", { name: "Hide the project list" })
    );

    await waitForElementToBeRemoved(() =>
      screen.queryByRole("navigation", { name: "Library views" })
    );
    expect(
      screen.queryByRole("button", { name: "My video" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show the project list" })
    );

    expect(
      screen.getByRole("navigation", { name: "Library views" })
    ).toBeVisible();
    expect(
      await screen.findByRole("button", { name: "My video" })
    ).toBeVisible();
  });

  it("keeps the chat clear of the window buttons on its own", async () => {
    const { container } = render(<Page />);
    await welcomeReady();

    fireEvent.click(
      await screen.findByRole("button", { name: "Hide the project list" })
    );

    expect(
      container.querySelector('[data-slot="workspace-content"]')
    ).toHaveClass("mt-[46px]");
  });

  it("lets the transcript be selected, unlike the rest of the shell", async () => {
    const { container } = render(<Page />);
    await welcomeReady();

    expect(
      container.querySelector('[data-slot="message-scroller-content"]')
    ).toHaveAttribute("data-selectable");
  });

  it("leaves the projects pane bare and offers to create one instead", async () => {
    await renderShell();
    await welcomeReady();

    // The pane's own copies moved into the project switcher's menu, so the
    // startup screen is the only one on screen without opening it.
    const create = screen.getAllByRole("button", { name: "New project" });

    expect(screen.getByRole("heading", { name: STARTUP })).toBeVisible();
    expect(create).toHaveLength(1);
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("lets a first-time user browse four hints without leaving welcome", async () => {
    await renderShell();
    await welcomeReady();

    const tips = within(screen.getByRole("group", { name: "Choose a tip" }));
    expect(tips.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText("Point at what you want to change")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    expect(screen.getByText("Show, don’t describe")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Previous tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous tip" }));
    expect(screen.getByText("Reuse what works")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    expect(screen.getByText("Point at what you want to change")).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: "Open an existing project" })
    ).toHaveLength(1);
  });

  it("names the app in the header and lists projects in their own sidebar", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();

    // The lockup spells the name with the mark as its "R", so the text beside
    // the glyph starts at "emocn" — nothing else in the shell draws that.
    const wordmark = await screen.findByRole("img", {
      name: "Remocn Studio",
    });
    expect(within(wordmark).getByText(WORDMARK)).toBeVisible();

    expect(screen.queryByRole("region", { name: "Projects" })).toBeNull();
    const projects = within(await openProjects());
    expect(
      await projects.findByRole("button", { name: PROJECT.name })
    ).toBeVisible();
  });

  it("opens the picked folder into the pane", async () => {
    mockStudio({ folder: PICKED_FOLDER });
    await renderShell();

    fireEvent.click(await openFolderButton());

    expect(
      await screen.findByRole("button", { name: "My video" })
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: STARTUP })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("keeps the empty states when the picker is dismissed", async () => {
    mockStudio({ folder: null });
    await renderShell();
    await welcomeReady();

    fireEvent.click(await openFolderButton());

    expect(await screen.findByRole("heading", { name: STARTUP })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "My video" })
    ).not.toBeInTheDocument();
  });

  it("lists stored sessions and opens the one that is clicked", async () => {
    mockStudio({ projects: [PROJECT], sessions: [STORED_SESSION] });
    await renderShell();

    fireEvent.click(
      await screen.findByRole("button", {
        name: SESSION_ROW,
      })
    );

    expect(
      await screen.findByRole("button", { name: "My video" })
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "A promo for the launch" })
    ).toBeVisible();
  });

  it("offers the templates on a fresh session, and a pick fills without sending", async () => {
    mockStudio({ folder: PICKED_FOLDER });
    await renderShell();
    fireEvent.click(await openFolderButton());
    await screen.findByText("What should we make?");

    fireEvent.click(screen.getByRole("button", { name: PRODUCT_DEMO_ROW }));

    const field = screen.getByRole("textbox", { name: "Message" });
    expect((field as HTMLTextAreaElement).value).toContain("[product name]");
    expect(screen.getByText("What should we make?")).toBeVisible();
    expect(
      screen.getByRole("button", { name: LAUNCH_TEASER_ROW })
    ).toBeVisible();
  });

  it("keeps the templates out of a session that has already spoken", async () => {
    mockStudio({
      blocks: [{ id: "block-0", kind: "assistant", text: "All done." }],
      projects: [PROJECT],
      sessions: [STORED_SESSION],
    });
    await renderShell();

    fireEvent.click(await screen.findByRole("button", { name: SESSION_ROW }));

    expect(await screen.findByText("All done.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: PRODUCT_DEMO_ROW })
    ).not.toBeInTheDocument();
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
    expect(await screen.findByText("No chats yet")).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "New chat" })
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

    expect(await screen.findByText("Chat deleted")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(
      await screen.findByRole("button", { name: SESSION_ROW })
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "A promo for the launch" })
    ).toBeVisible();
  });

  it("opens the shared project dialog from Projects plus", async () => {
    await renderShell();
    await openProjects();

    fireEvent.click(
      await screen.findByRole("button", { name: "Create project" })
    );
    expect(
      await screen.findByRole("dialog", { name: "New project" })
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
    // The project list failed too, and the conversation says so beside the
    // sidebar: one Try again each.
    expect(
      screen.getByText("The project list could not be read")
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(
      2
    );
  });
});
