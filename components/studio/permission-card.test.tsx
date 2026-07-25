import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PermissionCard } from "@/components/studio/permission-card";
import type { PendingPermission } from "@/lib/studio/turns";

const CWD = "/Users/me/projects/my-video";

const ONCE = /Approve once/;
const ALWAYS = /Always allow this session/;
const DECLINE = /Decline/;
const CANCEL = /Cancel turn/;

function permission(shape: Partial<PendingPermission> = {}): PendingPermission {
  return {
    id: "p1",
    input: { command: "bun add remotion" },
    name: "Bash",
    reason: "bash",
    ...shape,
  };
}

function renderCard(
  shape: Partial<PendingPermission> = {},
  onAnswer = vi.fn()
) {
  render(
    <PermissionCard
      cwd={CWD}
      onAnswer={onAnswer}
      permission={permission(shape)}
    />
  );

  return onAnswer;
}

describe("PermissionCard", () => {
  it("names the tool and shows the command it is asking about", () => {
    renderCard();

    expect(screen.getByText("Approve this command?")).toBeVisible();
    expect(screen.getByText("Bash")).toBeVisible();
    expect(screen.getByText("bun add remotion")).toBeVisible();
  });

  it("shows the resolved path when the call leaves the folder", () => {
    renderCard({
      input: { file_path: "/Users/me/.ssh/config" },
      name: "Write",
      reason: "outside",
    });

    expect(
      screen.getByText("Approve this path outside the project?")
    ).toBeVisible();
    expect(screen.getByText("/Users/me/.ssh/config")).toBeVisible();
  });

  it("offers four choices, none of them a checkbox", () => {
    renderCard();

    expect(screen.getByRole("button", { name: ONCE })).toBeVisible();
    expect(screen.getByRole("button", { name: ALWAYS })).toBeVisible();
    expect(screen.getByRole("button", { name: DECLINE })).toBeVisible();
    expect(screen.getByRole("button", { name: CANCEL })).toBeVisible();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("approves just this request", () => {
    const onAnswer = renderCard();

    fireEvent.click(screen.getByRole("button", { name: ONCE }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "allow");
  });

  it("remembers the call for the session as its own choice", () => {
    const onAnswer = renderCard();

    fireEvent.click(screen.getByRole("button", { name: ALWAYS }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "always");
  });

  it("declines without stopping the turn", () => {
    const onAnswer = renderCard();

    fireEvent.click(screen.getByRole("button", { name: DECLINE }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "deny");
  });

  it("cancels the whole turn", () => {
    const onAnswer = renderCard();

    fireEvent.click(screen.getByRole("button", { name: CANCEL }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "cancel");
  });

  it("says what remembering means for a path, not for a command", () => {
    renderCard({
      input: { file_path: "/Users/me/.ssh/config" },
      name: "Write",
      reason: "outside",
    });

    expect(
      screen.getByText("Don't ask again for this path this session")
    ).toBeVisible();
  });
});
