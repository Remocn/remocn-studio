import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionItem } from "@/components/studio/session-item";
import type { SessionRow } from "@/lib/studio/groups";
import type { HistorySession } from "@/shared/ipc";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const MINUTE = 60_000;
const ROW = /^A promo/;
const DELETE = /^Delete/;
const HOVER_FADE = /group-hover\/session:opacity-0/;
const TRACE = /at frame/;

const SESSION: HistorySession = {
  createdAt: NOW - 7_200_000,
  id: "session-1",
  mode: "auto",
  projectId: "project-1",
  sdkSessionId: "sdk-1",
  title: "A promo for the launch",
  updatedAt: NOW - 2 * MINUTE,
};

const IDLE_ROW: SessionRow = {
  askedAt: null,
  error: null,
  progress: null,
  session: SESSION,
  startedAt: null,
  status: "idle",
  task: null,
  tool: null,
  unread: false,
};

function renderItem(shape: Partial<SessionRow> & { isActive?: boolean } = {}) {
  const { isActive, ...row } = shape;

  return render(
    <SessionItem
      isActive={isActive ?? false}
      now={NOW}
      onRemove={vi.fn()}
      onSelect={vi.fn()}
      row={{ ...IDLE_ROW, ...row }}
    />
  );
}

describe("SessionItem", () => {
  it("names the session", () => {
    renderItem();

    expect(screen.getByText("A promo for the launch")).toBeVisible();
    expect(screen.getByRole("button", { name: ROW })).toHaveValue("session-1");
  });

  it("shows no marker while the session is idle and read", () => {
    renderItem({ isActive: true });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("says when a settled session was last touched", () => {
    renderItem();

    expect(screen.getByText("2m ago")).toBeVisible();
  });

  it("runs the loader while the session is running", () => {
    renderItem({ status: "running" });

    expect(
      screen.getByRole("img", { name: "A promo for the launch is running" })
    ).toBeVisible();
  });

  it("says how long a running turn has been going, instead of the time", () => {
    renderItem({ startedAt: NOW - 2 * MINUTE, status: "running" });

    expect(screen.getByText("Running · 2m")).toBeVisible();
    expect(screen.queryByText("2m ago")).not.toBeInTheDocument();
  });

  it("marks a session that is waiting on a permission", () => {
    renderItem({ status: "waiting" });

    expect(
      screen.getByRole("img", {
        name: "A promo for the launch is waiting for an answer",
      })
    ).toBeVisible();
  });

  it("says how long it has been waiting and which tool is asking", () => {
    renderItem({
      askedAt: NOW - 4 * MINUTE,
      status: "waiting",
      tool: "Bash",
    });

    expect(screen.getByText("Waiting 4m · Bash")).toBeVisible();
  });

  it("marks a session whose turn failed", () => {
    renderItem({ error: "the sidecar is not running", status: "failed" });

    expect(
      screen.getByRole("img", { name: "A promo for the launch failed" })
    ).toBeVisible();
  });

  it("shows the first line of the error a turn failed with", () => {
    renderItem({
      error: "the sidecar is not running\n  at frame()",
      status: "failed",
    });

    expect(screen.getByText("the sidecar is not running")).toBeVisible();
    expect(screen.queryByText(TRACE)).not.toBeInTheDocument();
  });

  it("marks news that arrived while the session was away", () => {
    renderItem({ unread: true });

    expect(
      screen.getByRole("img", { name: "A promo for the launch has news" })
    ).toBeVisible();
  });

  it("keeps the delete button away from a session that is busy", () => {
    renderItem({ status: "running" });

    expect(
      screen.queryByRole("button", { name: DELETE })
    ).not.toBeInTheDocument();
  });

  it("keeps the marker and the delete button on the same row", () => {
    renderItem({ error: "boom", status: "failed" });

    const marker = screen.getByRole("img", {
      name: "A promo for the launch failed",
    });

    expect(marker).toBeVisible();
    expect(marker.getAttribute("class")).not.toMatch(HOVER_FADE);
    expect(screen.getByRole("button", { name: DELETE })).toBeVisible();
  });

  it("keeps the marker and the meta line out of the row's own name", () => {
    renderItem({
      askedAt: NOW - 4 * MINUTE,
      status: "waiting",
      tool: "Bash",
    });

    expect(screen.getByRole("button", { name: ROW })).toHaveAccessibleName(
      "A promo for the launch"
    );
  });
});
