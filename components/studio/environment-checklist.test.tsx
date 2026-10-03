import { afterEach, describe, expect, it, mock } from "bun:test";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/react";
import { EnvironmentChecklist } from "@/components/studio/environment-checklist";
import type { Environment } from "@/hooks/use-environment";
import type { EnvironmentCheck } from "@/shared/ipc";
import { stubGlobal, unstubAllGlobals } from "@/test/stub-global";
import { LINUX, MAC, withAgent } from "@/test/user-agent";

const UPGRADE_BUTTON = /Upgrade Remotion/;
const PACKAGE_MANAGER = /package manager/;
const DOWNLOADING = /Downloading/;

const OUTDATED: EnvironmentCheck = {
  detail: "This project declares remotion 4.0.481.",
  fix: {
    packages: ["@remotion/cli", "remotion"],
    type: "upgrade",
    version: "4.0.520",
  },
  id: "remotion",
  state: "warn",
  title: "Text and type editing needs Remotion 4.0.513 or newer",
};

function environment(
  troubles: readonly EnvironmentCheck[],
  overrides: Partial<Environment> = {}
): Environment {
  return {
    checks: troubles,
    download: null,
    error: null,
    install: mock(),
    installNode: mock(),
    isBlocking: false,
    isChecking: false,
    isInstalling: false,
    isInstallingNode: false,
    isUpgrading: false,
    output: null,
    recheck: mock(),
    troubles,
    upgrade: mock(),
    ...overrides,
  };
}

describe("the Upgrade Remotion row", () => {
  it("offers the upgrade, and runs nothing until it is pressed", () => {
    const upgrade = mock();

    render(
      <EnvironmentChecklist
        environment={environment([OUTDATED], { upgrade })}
      />
    );

    expect(
      screen.getByText("Text and type editing needs Remotion 4.0.513 or newer")
    ).toBeDefined();
    expect(upgrade).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Upgrade Remotion" }));

    expect(upgrade).toHaveBeenCalledTimes(1);
  });

  it("shows what the manager is saying while it runs", () => {
    render(
      <EnvironmentChecklist
        environment={environment([OUTDATED], {
          isUpgrading: true,
          output: "resolving @remotion/cli",
        })}
      />
    );

    const button = screen.getByRole("button", { name: UPGRADE_BUTTON });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("resolving @remotion/cli")).toBeDefined();
  });

  it("does not claim a project that only warns cannot run", () => {
    render(<EnvironmentChecklist environment={environment([OUTDATED])} />);

    expect(
      screen.getByText("This project has one thing worth fixing")
    ).toBeDefined();
  });

  it("still says a project is not ready when something failed", () => {
    render(
      <EnvironmentChecklist
        environment={environment([
          OUTDATED,
          {
            detail: null,
            fix: { type: "install" },
            id: "dependencies",
            state: "failed",
            title: "Dependencies are not installed",
          },
        ])}
      />
    );

    expect(screen.getByText("This project is not ready to run")).toBeDefined();
  });

  it("offers no upgrade for a row whose fix is something else", () => {
    render(
      <EnvironmentChecklist
        environment={environment([
          {
            detail: null,
            fix: { type: "install" },
            id: "dependencies",
            state: "failed",
            title: "Dependencies are not installed",
          },
        ])}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Upgrade Remotion" })
    ).toBeNull();
  });
});

const NO_NODE: EnvironmentCheck = {
  detail:
    "This project installs with npm install, and npm is not on this machine.",
  fix: { type: "node" },
  id: "manager",
  state: "failed",
  title: "Node.js (npm) is not installed",
};

describe("the Node.js row", () => {
  afterEach(() => {
    withAgent(LINUX);
  });

  it("downloads the installer on macOS and shows how far it has got", async () => {
    withAgent(MAC);

    render(
      <EnvironmentChecklist
        environment={environment([NO_NODE], {
          download: { received: 50, total: 200, type: "progress" },
          isInstallingNode: true,
        })}
      />
    );

    expect(await screen.findByText("Downloading… 25%")).toBeDefined();
    expect(screen.queryByText(PACKAGE_MANAGER)).toBeNull();
  });

  it("opens the download page and says a package manager works too", () => {
    const installNode = mock();

    render(
      <EnvironmentChecklist
        environment={environment([NO_NODE], { installNode })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Install Node.js" }));

    expect(installNode).toHaveBeenCalledTimes(1);
    expect(screen.getByText(PACKAGE_MANAGER)).toBeDefined();
    expect(screen.queryByText(DOWNLOADING)).toBeNull();
  });
});

const CODEX_SIGNED_OUT: EnvironmentCheck = {
  detail: "Codex is installed but not logged in.",
  fix: { step: "signin", type: "provider" },
  id: "codex",
  state: "failed",
  title: "Codex is not logged in",
};

describe("Open in Terminal", () => {
  afterEach(() => {
    unstubAllGlobals();
  });

  it("copies the command, opens a terminal, and says to paste with Shift", async () => {
    const opened: string[] = [];
    const copied: string[] = [];
    stubGlobal("navigator", {
      ...navigator,
      clipboard: {
        writeText: (text: string) => {
          copied.push(text);
          return Promise.resolve();
        },
      },
    });
    mockIPC((command) => {
      opened.push(command);
      return null;
    });

    render(
      <EnvironmentChecklist environment={environment([CODEX_SIGNED_OUT])} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open in Terminal" }));

    expect(
      await screen.findByRole("button", { name: "Ctrl+Shift+V, then Enter" })
    ).toBeDefined();
    expect(opened).toEqual(["open_terminal"]);
    expect(copied).toHaveLength(1);
  });
});
