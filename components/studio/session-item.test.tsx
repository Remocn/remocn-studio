import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionItem } from "@/components/studio/session-item";
import type { HistorySession } from "@/shared/ipc";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const ROW = /^A promo/;

const SESSION: HistorySession = {
  createdAt: NOW - 7_200_000,
  folder: "/Users/me/projects/my-video",
  id: "session-1",
  sdkSessionId: "sdk-1",
  title: "A promo for the launch",
  updatedAt: NOW - 120_000,
};

function renderItem(shape: { isActive?: boolean; isThinking?: boolean } = {}) {
  return render(
    <SessionItem
      isActive={shape.isActive ?? false}
      isThinking={shape.isThinking ?? false}
      now={NOW}
      onRemove={vi.fn()}
      onSelect={vi.fn()}
      session={SESSION}
    />
  );
}

describe("SessionItem", () => {
  it("names the session and where it lives", () => {
    renderItem();

    expect(screen.getByRole("button", { name: ROW })).toHaveTextContent(
      "my-video · 2m ago"
    );
  });

  it("shows no loader while the session is idle", () => {
    renderItem({ isActive: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("runs the loader while the session is thinking", () => {
    renderItem({ isActive: true, isThinking: true });

    expect(
      screen.getByRole("status", { name: "A promo for the launch is running" })
    ).toBeVisible();
  });

  it("keeps the loader out of the row's own name", () => {
    renderItem({ isActive: true, isThinking: true });

    expect(screen.getByRole("button", { name: ROW })).not.toHaveTextContent(
      "is running"
    );
  });
});
