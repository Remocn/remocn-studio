import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import Page from "@/app/page";
import { ThemeProvider } from "@/components/theme-provider";
import type { EnvironmentCheck } from "@/shared/ipc";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";
import { LINUX, MAC, withAgent } from "@/test/user-agent";

const STORE_RID = 7;
const REMOCN_ACCOUNT = /Remocn account/;

const SIDECAR_READY = {
  attempt: 0,
  detail: null,
  logPath: "/tmp/sidecar.log",
  phase: "ready",
  pid: 1234,
};

const CLAUDE_ROW: EnvironmentCheck = {
  detail: "Pro",
  fix: null,
  id: "claude",
  state: "ok",
  title: "Claude Code is logged in",
};

const CODEX_ROW: EnvironmentCheck = {
  detail: "Sign in with codex login.",
  fix: { step: "signin", type: "provider" },
  id: "codex",
  state: "failed",
  title: "Codex is not logged in",
};

const NOT_ALLOWED = /Your desktop has not allowed the studio to notify/;

const REFUSED_ON_MAC =
  /Notifications are off for the studio in System Settings/;

const NEVER_ASKED_ON_MAC = /macOS has not allowed the studio to notify yet/;

function notificationShim(permission: "default" | "denied" | "granted") {
  return {
    permission,
    requestPermission: () => Promise.resolve(permission),
  };
}

function mockStudio(
  written: [string, unknown][],
  entries: readonly [string, unknown][] = []
) {
  mockIPC(
    (cmd, payload) => {
      if (cmd === "plugin:store|load") {
        return STORE_RID;
      }
      if (cmd === "plugin:store|entries") {
        return entries;
      }
      if (cmd === "plugin:store|save") {
        return null;
      }
      if (cmd === "plugin:store|set") {
        const { key, value } = payload as { key: string; value: unknown };
        written.push([key, value]);
        return null;
      }
      if (cmd === "plugin:notification|is_permission_granted") {
        return false;
      }
      if (cmd === "studio_build") {
        return {
          environment: "development",
          os: "15.5",
          updatesInPlace: true,
          version: "0.3.0",
        };
      }
      if (cmd === "sidecar_status") {
        return SIDECAR_READY;
      }
      if (cmd === "sidecar_request") {
        const { method } = payload as { method: string };
        if (method === "agent.accounts") {
          return [CLAUDE_ROW, CODEX_ROW];
        }
        if (method === "history.sessions" || method === "library.list") {
          return [];
        }
        if (method === "project.list") {
          return [];
        }
        throw new Error(`unexpected sidecar method: ${method}`);
      }
      throw new Error(`unexpected command: ${cmd}`);
    },
    { shouldMockEvents: true }
  );
}

async function renderShell() {
  render(
    <ThemeProvider>
      <Page />
    </ThemeProvider>
  );
  await screen.findByRole("navigation", { name: "Library views" });
}

async function openSettings() {
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
  return await screen.findByRole("region", { name: "Settings" });
}

const OPT_IN_WORDING = /Off unless you turn it on/;
const NEVER_SENT_WORDING = /prompts, your conversations with the agent/;
const COMMAND_GLYPH = /⌘/;

describe("the settings page", () => {
  let written: [string, unknown][];

  beforeEach(() => {
    written = [];
    mockStudio(written);
  });

  afterEach(() => {
    unstubAllGlobals();
    withAgent(MAC);
  });

  it("opens from the gear on Appearance", async () => {
    await renderShell();
    await openSettings();

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dark" })).toBeVisible();
  });

  it("names the system rather than macOS on Linux", async () => {
    withAgent(LINUX);
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    expect(await screen.findByText("System")).toBeVisible();
    expect(screen.queryByText("macOS")).toBeNull();
  });

  it("opens on Cmd+comma", async () => {
    await renderShell();

    fireEvent.keyDown(window, { key: ",", metaKey: true });

    expect(
      await screen.findByRole("region", { name: "Settings" })
    ).toBeVisible();
  });

  it("moves focus to Back and restores it without making the window chrome inert", async () => {
    await renderShell();
    const opener = screen.getByRole("button", { name: "Settings" });
    opener.focus();
    await openSettings();
    expect(document.activeElement?.textContent).toBe("Back");
    expect(
      Boolean(
        screen
          .getByRole("button", { name: "Hide the project list" })
          .closest("[inert]")
      )
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(document.activeElement === opener).toBe(true));
  });

  it("switches sections from the rail", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    expect(screen.getByRole("heading", { name: "Updates" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Check now" })).toBeVisible();
    expect(screen.getByText("macOS")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Behavior" }));
    expect(
      screen.getByRole("switch", { name: "Library suggestions" })
    ).toBeVisible();
  });

  it("offers no account section and no account row", async () => {
    await renderShell();
    await openSettings();

    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
    expect(screen.queryByText(REMOCN_ACCOUNT)).toBeNull();
  });

  it("lists and filters shortcuts without changing their bindings", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Hotkeys" }));

    expect(screen.getByRole("heading", { name: "Hotkeys" })).toBeVisible();
    const video = within(screen.getByRole("region", { name: "Video" }));
    expect(video.getByText("Export")).toBeVisible();
    expect(video.getByLabelText("⌘E")).toBeVisible();
    expect(video.getByLabelText("⇧⌘S")).toBeVisible();
    expect(video.getByLabelText("⌥⌘↓")).toBeVisible();
    expect(
      screen
        .getByRole("region", { name: "Settings" })
        .querySelectorAll(
          "input:not([type=search]), button[role=switch], [role=switch]"
        )
    ).toHaveLength(0);
    const search = screen.getByRole("searchbox", { name: "Find a shortcut" });
    fireEvent.change(search, { target: { value: "export" } });
    expect(video.getByText("Export")).toBeVisible();
    expect(video.queryByText("Snapshot") === null).toBe(true);
    fireEvent.change(search, { target: { value: "not-a-shortcut" } });
    expect(
      within(screen.getByRole("region", { name: "Settings" })).getByRole(
        "status"
      ).textContent
    ).toBe("No shortcuts match “not-a-shortcut”.");
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByLabelText("⇧⌘S")).toBeVisible();
    expect(
      screen.getByText(
        "Shortcuts follow your platform. Use Ctrl instead of ⌘ on Windows."
      )
    ).toBeVisible();
  });

  it("lists Ctrl shortcuts on Linux and says nothing of ⌘", async () => {
    withAgent(LINUX);
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Hotkeys" }));

    const video = within(screen.getByRole("region", { name: "Video" }));
    expect(video.getByLabelText("Ctrl+E")).toBeVisible();
    expect(video.getByLabelText("Ctrl+Shift+S")).toBeVisible();
    expect(
      await screen.findByText("Shortcuts follow your platform.")
    ).toBeVisible();
    expect(screen.queryByText(COMMAND_GLYPH)).toBeNull();
  });

  it("keeps the notifications switch unavailable without the desktop app", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(
      await screen.findByText("Notifications need the desktop app.")
    ).toBeVisible();
    expect(screen.getByRole("switch", { name: "Notify me" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(
      screen.queryByRole("button", { name: "Grant permission" })
    ).toBeNull();
  });

  it("reads the master switch as on once macOS agreed, with every event on", async () => {
    stubGlobal("Notification", notificationShim("granted"));
    mockStudio(written, [
      ["notifications", "enabled"],
      ["notifySidecar", "disabled"],
    ]);
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Notify me" })).toBeChecked()
    );
    expect(
      screen.queryByRole("button", { name: "Grant permission" })
    ).toBeNull();
    expect(
      screen.getByRole("switch", { name: "A turn finished" })
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "The studio's helper stopped" })
    ).not.toBeChecked();

    fireEvent.click(
      screen.getByRole("switch", { name: "An export finished or failed" })
    );

    await waitFor(() =>
      expect(written).toContainEqual(["notifyExport", "disabled"])
    );
  });

  it("reads every event as off while the master switch is off", async () => {
    stubGlobal("Notification", notificationShim("granted"));
    mockStudio(written, [["notifications", "disabled"]]);
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    const turn = await screen.findByRole("switch", { name: "A turn finished" });
    expect(turn).not.toBeChecked();
    expect(turn).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("switch", { name: "Notify me" }));

    await waitFor(() => expect(turn).toBeChecked());
  });

  it("offers Grant permission when the desktop said no", async () => {
    withAgent(LINUX);
    stubGlobal("Notification", notificationShim("denied"));
    mockStudio(written, [["notifications", "enabled"]]);
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText(NOT_ALLOWED)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Grant permission" })
    ).toBeVisible();
    expect(screen.getByRole("switch", { name: "Notify me" })).toBeChecked();
  });

  it("offers Grant permission while the desktop has never been asked", async () => {
    withAgent(LINUX);
    stubGlobal("Notification", notificationShim("default"));
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText(NOT_ALLOWED)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Grant permission" })
    ).toBeVisible();
  });

  it("words a refusal on macOS as System Settings", async () => {
    withAgent(MAC);
    stubGlobal("Notification", notificationShim("denied"));
    mockStudio(written, [["notifications", "enabled"]]);
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText(REFUSED_ON_MAC)).toBeVisible();
  });

  it("words a first ask on macOS as macOS's own", async () => {
    withAgent(MAC);
    stubGlobal("Notification", notificationShim("default"));
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText(NEVER_ASKED_ON_MAC)).toBeVisible();
  });

  // Opt-in, and the wording that earns the switch is part of what is being
  // pinned: an app whose promise is that nothing reaches a third party has to
  // say what would, and what never would.
  it("offers crash reports off, and says what they carry", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Behavior" }));

    expect(
      screen.getByRole("switch", { name: "Send crash reports" })
    ).not.toBeChecked();
    expect(screen.getByText(OPT_IN_WORDING)).toBeVisible();
    expect(screen.getByText(NEVER_SENT_WORDING)).toBeVisible();
  });

  it("lists every provider with its probe's answer", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Integrations" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Manage Claude Code" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Set up Codex" }));
    expect(screen.getByText("Claude Code is logged in")).toBeVisible();
    expect(screen.getByText("Codex is not logged in")).toBeVisible();
    expect(screen.getByText("codex login")).toBeVisible();
    // Grok has no row in the mock: unknown must never read as signed out.
    expect(screen.getAllByText("Not checked yet").length).toBeGreaterThan(0);
  });

  it("writes the asset-offers key when the switch is flipped", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Behavior" }));

    const toggle = screen.getByRole("switch", { name: "Library suggestions" });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    await waitFor(() => {
      expect(written).toContainEqual(["assetOffers", "disabled"]);
    });
  });

  it("turns the title bar's shader and its motion off, and remembers both", async () => {
    await renderShell();
    await openSettings();

    const motion = screen.getByRole("switch", { name: "Animate activity" });
    const shader = screen.getByRole("switch", {
      name: "Show activity in title bar",
    });
    expect(shader).toBeChecked();
    expect(motion).toBeChecked();

    fireEvent.click(motion);
    await waitFor(() => {
      expect(written).toContainEqual(["titlebarMotion", "disabled"]);
    });

    fireEvent.click(shader);
    expect(shader).not.toBeChecked();
    expect(motion).toHaveAttribute("data-disabled");
    await waitFor(() => {
      expect(written).toContainEqual(["titlebarShader", "hidden"]);
    });
  });

  it("applies a theme choice to the document", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
  });
});

describe("feature overview entry", () => {
  it("opens from Settings without a project and returns there after closing", async () => {
    const written: [string, unknown][] = [];
    mockStudio(written);
    await renderShell();
    const splash = document.querySelector("[data-splash]");
    if (!splash) {
      throw new Error("No splash");
    }
    await waitFor(() =>
      expect(splash.getAttribute("data-splash")).toBe("leaving")
    );
    const finished = new Event("animationend", { bubbles: true });
    Object.defineProperty(finished, "animationName", { value: "splash-out" });
    fireEvent(splash, finished);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Behavior" }));
    const open = screen.getByRole("button", {
      name: "Explore Studio",
    });
    expect(open).toBeEnabled();
    fireEvent.click(open);
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Explore Studio" })
    ).toBeInTheDocument();
    fireEvent.keyDown(dialog, { code: "Escape", key: "Escape" });
    await waitFor(() =>
      expect(document.querySelector("[role=dialog]") === null).toBe(true)
    );
    expect(
      screen.getByRole("button", { name: "Explore Studio" })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(written.some(([key]) => key === "onboarding")).toBe(true)
    );
  });
});
