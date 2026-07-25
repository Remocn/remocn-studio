import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidecarStatus as SidecarStatusIndicator } from "@/components/studio/sidecar-status";
import { SidecarStreamTest } from "@/components/studio/sidecar-stream-test";
import {
  SIDECAR_STATUS_EVENT,
  type SidecarPhase,
  type SidecarStatus,
} from "@/shared/ipc";

const LOG_PATH = "/Users/me/Library/Logs/com.remocn.remocn-studio/sidecar.log";
const ANY_PHASE = /Sidecar/;
const DOWN = /Sidecar down/;

function status(phase: SidecarPhase, extra?: Partial<SidecarStatus>) {
  return {
    attempt: 0,
    detail: null,
    logPath: LOG_PATH,
    phase,
    pid: 4242,
    ...extra,
  } satisfies SidecarStatus;
}

interface Internals {
  runCallback: (id: number, data: unknown) => void;
}

function deliver(channel: unknown, index: number, message: unknown) {
  const { id } = channel as { id: number };
  (
    window as unknown as { __TAURI_INTERNALS__: Internals }
  ).__TAURI_INTERNALS__.runCallback(id, { index, message });
}

describe("SidecarStatus", () => {
  it("shows the phase the core reported", async () => {
    mockIPC((cmd) => (cmd === "sidecar_status" ? status("ready") : null), {
      shouldMockEvents: true,
    });

    render(<SidecarStatusIndicator />);

    expect(
      await screen.findByRole("button", { name: ANY_PHASE })
    ).toBeVisible();
  });

  it("turns into a visible error when the sidecar goes down", async () => {
    mockIPC((cmd) => (cmd === "sidecar_status" ? status("ready") : null), {
      shouldMockEvents: true,
    });

    render(<SidecarStatusIndicator />);
    await screen.findByRole("button", { name: ANY_PHASE });

    await emit(
      SIDECAR_STATUS_EVENT,
      status("down", {
        attempt: 4,
        detail: "the sidecar stopped with signal 9",
        pid: null,
      })
    );

    const trigger = await screen.findByRole("button", { name: DOWN });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });

  it("opens onto the pid, the log file and a way back up", async () => {
    mockIPC((cmd) => (cmd === "sidecar_status" ? status("ready") : null), {
      shouldMockEvents: true,
    });

    render(<SidecarStatusIndicator />);
    fireEvent.click(await screen.findByRole("button", { name: ANY_PHASE }));

    expect(await screen.findByText("4242")).toBeVisible();
    expect(screen.getByText(LOG_PATH)).toBeVisible();
    expect(screen.getByRole("button", { name: "Restart" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reveal log" })).toBeVisible();
  });

  it("asks the core to restart", async () => {
    const calls: string[] = [];
    mockIPC(
      (cmd) => {
        calls.push(cmd);
        return cmd === "sidecar_status" ? status("down") : null;
      },
      { shouldMockEvents: true }
    );

    render(<SidecarStatusIndicator />);
    fireEvent.click(await screen.findByRole("button", { name: DOWN }));
    fireEvent.click(await screen.findByRole("button", { name: "Restart" }));

    await waitFor(() => {
      expect(calls).toContain("sidecar_restart");
    });
  });
});

describe("SidecarStreamTest", () => {
  it("renders each chunk as it arrives", async () => {
    let channel: unknown = null;
    let finish: (result: unknown) => void = () => undefined;

    mockIPC((cmd, args) => {
      if (cmd !== "sidecar_request") {
        return null;
      }
      channel = (args as Record<string, unknown>).onStream;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });

    render(<SidecarStreamTest disabled={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nothing streamed yet."
    );

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => {
      expect(channel).not.toBeNull();
    });

    deliver(channel, 0, { index: 0, token: "Streaming", total: 2 });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Streaming");
    });

    deliver(channel, 1, { index: 1, token: "straight", total: 2 });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Streaming straight"
      );
    });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();

    finish({ elapsedMs: 4, emitted: 2 });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run" })).toBeVisible();
    });
  });

  it("cancels the request it started, by id", async () => {
    const ids: Record<string, unknown> = {};
    mockIPC((cmd, args) => {
      ids[cmd] = (args as Record<string, unknown>).id;
      return cmd === "sidecar_request" ? new Promise(() => undefined) : null;
    });

    render(<SidecarStreamTest disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(ids.sidecar_cancel).toBeTypeOf("string");
    });
    expect(ids.sidecar_cancel).toBe(ids.sidecar_request);
  });

  it("stays out of the way when the sidecar is not ready", () => {
    mockIPC(() => null);

    render(<SidecarStreamTest disabled={true} />);

    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });
});
