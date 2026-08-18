import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Page from "@/app/page";
import { ThemeProvider } from "@/components/theme-provider";
import type { EnvironmentCheck } from "@/shared/ipc";

const STORE_RID = 7;

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
  fix: { command: "codex login", type: "command" },
  id: "codex",
  state: "failed",
  title: "Codex is not logged in",
};

function mockStudio(written: [string, unknown][]) {
  mockIPC(
    (cmd, payload) => {
      if (cmd === "plugin:store|load") {
        return STORE_RID;
      }
      if (cmd === "plugin:store|entries") {
        return [];
      }
      if (cmd === "plugin:store|set") {
        const { key, value } = payload as { key: string; value: unknown };
        written.push([key, value]);
        return null;
      }
      if (cmd === "studio_build") {
        return { environment: "development", version: "0.3.0" };
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
  await screen.findByRole("heading", { name: "Projects" });
}

async function openSettings() {
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
  return await screen.findByRole("dialog");
}

describe("the settings dialog", () => {
  let written: [string, unknown][];

  beforeEach(() => {
    written = [];
    mockStudio(written);
  });

  it("opens from the gear on Appearance", async () => {
    await renderShell();
    await openSettings();

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Dark" })).toBeVisible();
  });

  it("opens on Cmd+comma", async () => {
    await renderShell();

    fireEvent.keyDown(window, { key: ",", metaKey: true });

    expect(await screen.findByRole("dialog")).toBeVisible();
  });

  it("switches sections from the rail", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Updates" }));
    expect(screen.getByRole("heading", { name: "Updates" })).toBeVisible();
    expect(screen.getByText("Installed")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Behavior" }));
    expect(screen.getByRole("switch")).toBeVisible();
  });

  it("lists every provider with its probe's answer", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "AI Accounts" }));

    expect(await screen.findByText("Claude Code is logged in")).toBeVisible();
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

  it("applies a theme choice to the document", async () => {
    await renderShell();
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("light")).toBe(true);
    });
  });
});
