import { mockIPC } from "@tauri-apps/api/mocks";
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

const PASTED = "/Users/me/Library/Application Support/studio/pasted-images";
const ANY_REMOVE = /^Remove/;

function mockShell(
  status: unknown,
  picked: string[] | null = PICKED,
  save: (at: number) => string = (at) => `${PASTED}/image-${at}.png`
) {
  let saved = 0;

  mockIPC(
    (cmd) => {
      if (cmd === "plugin:dialog|open") {
        return picked;
      }
      if (cmd === "sidecar_status") {
        return status;
      }
      if (cmd === "save_pasted_image") {
        saved += 1;
        return save(saved);
      }
      throw new Error(`unexpected command: ${cmd}`);
    },
    { shouldMockEvents: true }
  );

  const internals = window as unknown as {
    __TAURI_INTERNALS__: { convertFileSrc: (path: string) => string };
  };
  internals.__TAURI_INTERNALS__.convertFileSrc = (path) =>
    `asset://localhost/${encodeURIComponent(path)}`;
}

function pngFile(name: string) {
  return new File([new Uint8Array([137, 80, 78, 71])], name, {
    type: "image/png",
  });
}

function paste(textarea: HTMLElement, files: File[]) {
  return fireEvent.paste(textarea, { clipboardData: { files } });
}

function setCaret(textarea: HTMLElement, at: number) {
  (textarea as HTMLTextAreaElement).setSelectionRange(at, at);
}

function textOf(textarea: HTMLElement) {
  return (textarea as HTMLTextAreaElement).value;
}

function typeInto(textarea: HTMLElement, value: string) {
  fireEvent.change(textarea, { target: { value } });
  (textarea as HTMLTextAreaElement).setSelectionRange(
    value.length,
    value.length
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

    expect(await screen.findByRole("img", { name: "shot.png" })).toBeVisible();

    fireEvent.change(textarea, {
      target: { value: "[Image #1] use this frame" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledWith("[Image #1] use this frame", [
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

    expect(screen.queryByRole("img", { name: "shot.png" })).toBeNull();
  });

  it("points at a picked image from the text too", async () => {
    const { textarea } = await renderComposer();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Add to this message" })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Add image" })
    );

    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe("[Image #1] ")
    );
  });

  it("attaches a pasted image and points at it from where the caret was", async () => {
    const { onSubmit, textarea } = await renderComposer();

    typeInto(textarea, "look at ");
    paste(textarea, [pngFile("shot.png")]);

    expect(
      await screen.findByRole("img", { name: "image-1.png" })
    ).toBeVisible();
    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "look at [Image #1] "
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledWith("look at [Image #1] ", [
      {
        mediaType: "image/png",
        name: "image-1.png",
        path: `${PASTED}/image-1.png`,
      },
    ]);
  });

  it("keeps the file's own name", async () => {
    mockShell(READY, PICKED, () => `${PASTED}/desk-reference.jpg`);
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("desk-reference.jpg")]);

    expect(
      await screen.findByRole("img", { name: "desk-reference.jpg" })
    ).toBeVisible();
  });

  it("shows the picture on the card, not just its name", async () => {
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("shot.png")]);

    expect(
      await screen.findByRole("img", { name: "image-1.png" })
    ).toHaveAttribute("src", expect.stringContaining("asset://localhost/"));
  });

  it("falls back to an icon when the file cannot be read", async () => {
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("shot.png")]);
    fireEvent.error(await screen.findByRole("img", { name: "image-1.png" }));

    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove image-1.png" })
    ).toBeVisible();
  });

  it("numbers a run of pasted images in the order they arrived", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);

    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "compare [Image #1] [Image #2] "
      )
    );
  });

  it("renumbers what is left when an attachment goes", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);

    fireEvent.click(
      await screen.findByRole("button", { name: "Remove image-1.png" })
    );

    await waitFor(() =>
      expect((textarea as HTMLTextAreaElement).value).toBe(
        "compare [Image #1] "
      )
    );
    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "image-2.png" })).toBeVisible();
  });

  it("takes the whole reference, and its card, on one backspace", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);
    await waitFor(() =>
      expect(textOf(textarea)).toBe("compare [Image #1] [Image #2] ")
    );

    setCaret(textarea, 18);
    fireEvent.keyDown(textarea, { key: "Backspace" });

    await waitFor(() => expect(textOf(textarea)).toBe("compare [Image #1] "));
    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "image-2.png" })).toBeVisible();
  });

  it("takes the card when the reference is deleted wholesale", async () => {
    const { textarea } = await renderComposer();

    typeInto(textarea, "compare ");
    paste(textarea, [pngFile("one.png"), pngFile("two.png")]);
    await waitFor(() =>
      expect(textOf(textarea)).toBe("compare [Image #1] [Image #2] ")
    );

    fireEvent.change(textarea, {
      target: { value: "compare  [Image #2] " },
    });

    await waitFor(() => expect(textOf(textarea)).toBe("compare  [Image #1] "));
    expect(screen.queryByRole("img", { name: "image-1.png" })).toBeNull();
    expect(screen.getByRole("img", { name: "image-2.png" })).toBeVisible();
  });

  it("leaves an ordinary backspace to the browser", async () => {
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("one.png")]);
    await waitFor(() => expect(textOf(textarea)).toBe("[Image #1] "));

    setCaret(textarea, 11);
    const event = createEvent.keyDown(textarea, { key: "Backspace" });
    fireEvent(textarea, event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByRole("img", { name: "image-1.png" })).toBeVisible();
  });

  it("leaves an ordinary text paste alone", async () => {
    const { textarea } = await renderComposer();

    const event = createEvent.paste(textarea, {
      clipboardData: { files: [] },
    });
    fireEvent(textarea, event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("button", { name: ANY_REMOVE })).toBeNull();
  });

  it("says why a paste did not land instead of ignoring it", async () => {
    mockShell(READY, PICKED, () => {
      throw new Error("there is no app data directory");
    });
    const { textarea } = await renderComposer();

    paste(textarea, [pngFile("shot.png")]);

    expect(
      await screen.findByText("there is no app data directory")
    ).toBeVisible();
  });
});
