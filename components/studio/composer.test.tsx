import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/studio/composer";
import { StudioProvider } from "@/components/studio/studio-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SessionMode } from "@/shared/ipc";

interface ComposerShape {
  mode?: SessionMode;
  onModeChange?: (value: string) => void;
}

const PICKED = ["/Users/me/Desktop/shot.png"];

const READY = {
  attempt: 0,
  detail: null,
  logPath: "/tmp/sidecar.log",
  phase: "ready",
  pid: 1234,
};

const DOWN = {
  attempt: 4,
  detail: "the sidecar stopped with exit code 1",
  logPath: "/tmp/sidecar.log",
  phase: "down",
  pid: null,
};

function mockShell(status: unknown, picked: string[] | null = PICKED) {
  mockIPC(
    (cmd) => {
      if (cmd === "plugin:dialog|open") {
        return picked;
      }
      if (cmd === "sidecar_status") {
        return status;
      }
      throw new Error(`unexpected command: ${cmd}`);
    },
    { shouldMockEvents: true }
  );
}

function mockShellReadyOnSecondLook() {
  const seen: unknown[] = [];

  mockIPC(
    (cmd) => {
      if (cmd !== "sidecar_status") {
        throw new Error(`unexpected command: ${cmd}`);
      }
      seen.push(cmd);
      return seen.length === 1
        ? { ...READY, attempt: 1, phase: "starting", pid: null }
        : READY;
    },
    { shouldMockEvents: true }
  );
}

async function renderComposer(
  onSubmit = vi.fn(),
  { mode = "auto", onModeChange = vi.fn() }: ComposerShape = {}
) {
  render(
    <StudioProvider>
      <TooltipProvider>
        <Composer
          context={{ maxTokens: 200_000, totalTokens: 50_000 }}
          disabled={false}
          isRunning={false}
          isWaiting={false}
          mode={mode}
          onModeChange={onModeChange}
          onStop={vi.fn()}
          onSubmit={onSubmit}
        />
      </TooltipProvider>
    </StudioProvider>
  );

  return {
    onModeChange,
    onSubmit,
    textarea: await screen.findByRole("textbox", { name: "Message Claude" }),
  };
}

describe("Composer", () => {
  beforeEach(() => {
    mockShell(READY);
  });

  it("offers the mode, the model and the effort next to the send button", async () => {
    await renderComposer();

    expect(screen.getByRole("button", { name: "Mode: Auto" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Model: Default" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Effort: Default" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("picks a mode from the menu", async () => {
    const { onModeChange } = await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Mode: Auto" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Plan" })
    );

    expect(onModeChange).toHaveBeenCalledWith("plan", expect.anything());
  });

  it("shows the mode the open session is already in", async () => {
    await renderComposer(vi.fn(), { mode: "acceptEdits" });

    expect(
      screen.getByRole("button", { name: "Mode: Accept edits" })
    ).toBeVisible();
  });

  it("picks an effort level from the menu", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Effort: Default" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Max" }));

    expect(screen.getByRole("button", { name: "Effort: Max" })).toBeVisible();
  });

  it("shows how much of the context window is gone", async () => {
    await renderComposer();

    expect(screen.getByTitle("Context used: 25%")).toBeInTheDocument();
  });

  it("attaches a picked image and sends it with the message", async () => {
    const { onSubmit, textarea } = await renderComposer();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add to this message" })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Add image" })
    );

    expect(await screen.findByText("shot.png")).toBeVisible();

    fireEvent.change(textarea, { target: { value: "use this frame" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledWith("use this frame", [
      {
        mediaType: "image/png",
        name: "shot.png",
        path: "/Users/me/Desktop/shot.png",
      },
    ]);
  });

  it("refuses to send while the sidecar is down, and offers a restart", async () => {
    mockShell(DOWN);
    const { textarea } = await renderComposer();

    fireEvent.change(textarea, { target: { value: "build a scene" } });

    expect(
      await screen.findByText("The sidecar is not running.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Restart it" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("notices the sidecar came up even if it missed the event", async () => {
    mockShellReadyOnSecondLook();
    await renderComposer();

    expect(await screen.findByText("Starting the sidecar…")).toBeVisible();

    await waitFor(
      () =>
        expect(
          screen.queryByText("Starting the sidecar…")
        ).not.toBeInTheDocument(),
      { timeout: 3000 }
    );
  });

  it("says the sidecar is coming up instead of waiting silently", async () => {
    mockShell({ ...READY, attempt: 1, phase: "starting", pid: null });
    const { textarea } = await renderComposer();

    fireEvent.change(textarea, { target: { value: "build a scene" } });

    expect(await screen.findByText("Starting the sidecar…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("drops an attachment again", async () => {
    await renderComposer();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add to this message" })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Add image" })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove shot.png" })
    );

    expect(screen.queryByText("shot.png")).not.toBeInTheDocument();
  });
});
