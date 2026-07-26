import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionItem } from "@/components/studio/session-item";
import type { SessionStatus } from "@/lib/studio/turns";
import type { HistorySession } from "@/shared/ipc";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const ROW = /^A promo/;
const DELETE = /^Delete/;

const SESSION: HistorySession = {
  createdAt: NOW - 7_200_000,
  id: "session-1",
  mode: "auto",
  projectId: "project-1",
  sdkSessionId: "sdk-1",
  title: "A promo for the launch",
  updatedAt: NOW - 120_000,
};

function renderItem(
  shape: { isActive?: boolean; status?: SessionStatus; unread?: boolean } = {}
) {
  return render(
    <SessionItem
      isActive={shape.isActive ?? false}
      onRemove={vi.fn()}
      onSelect={vi.fn()}
      session={SESSION}
      status={shape.status ?? "idle"}
      unread={shape.unread ?? false}
    />
  );
}

describe("SessionItem", () => {
  it("names the session", () => {
    renderItem();

    expect(screen.getByRole("button", { name: ROW })).toHaveTextContent(
      "A promo for the launch"
    );
  });

  it("shows no marker while the session is idle and read", () => {
    renderItem({ isActive: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("runs the loader while the session is running", () => {
    renderItem({ status: "running" });

    expect(
      screen.getByRole("status", { name: "A promo for the launch is running" })
    ).toBeVisible();
  });

  it("marks a session that is waiting on a permission", () => {
    renderItem({ status: "waiting" });

    expect(
      screen.getByRole("status", {
        name: "A promo for the launch is waiting for an answer",
      })
    ).toBeVisible();
  });

  it("marks a session whose turn failed", () => {
    renderItem({ status: "failed" });

    expect(
      screen.getByRole("status", { name: "A promo for the launch failed" })
    ).toBeVisible();
  });

  it("marks news that arrived while the session was away", () => {
    renderItem({ unread: true });

    expect(
      screen.getByRole("status", { name: "A promo for the launch has news" })
    ).toBeVisible();
  });

  it("keeps the delete button away from a session that is busy", () => {
    renderItem({ status: "running" });

    expect(
      screen.queryByRole("button", { name: DELETE })
    ).not.toBeInTheDocument();
  });

  it("keeps the marker out of the row's own name", () => {
    renderItem({ status: "running" });

    expect(screen.getByRole("button", { name: ROW })).not.toHaveTextContent(
      "is running"
    );
  });
});
