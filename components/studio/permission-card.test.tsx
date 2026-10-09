import { beforeAll, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { PermissionCard } from "@/components/studio/permission-card";
import { loadMarkdownRenderer } from "@/lib/studio/highlighter";
import type { PendingPermission } from "@/lib/studio/turns";

const CWD = "/Users/me/projects/my-video";

const ONCE = /Approve once/;
const BUILD = /Approve and build/;
const RUN = /Approve and let it run/;
const KEEP = /Keep planning/;
const ALWAYS = /Always allow until quit/;
const DECLINE = /Decline/;
const CANCEL = /Cancel turn/;
const SEND_ALL = /Send all 3/;
const SEND_TWO = /Send 2 of 3/;
const SEND_NONE = /Send 0 of 3/;
const SEND_ALL_TWO = /Send all 2/;
const DECLINE_ALL = /Decline all/;
const ALWAYS_ALL = /Always allow all 2 until quit/;
const ANY_ALWAYS = /Always allow/;
const DOOR = /Door closes/;
const RAIN = /Light rain/;
const BELL = /Bell rings/;

function permission(shape: Partial<PendingPermission> = {}): PendingPermission {
  return {
    askedAt: 0,
    id: "p1",
    input: { command: "bun add remotion" },
    name: "Bash",
    reason: "bash",
    ...shape,
  };
}

function renderCard(shape: Partial<PendingPermission> = {}, onAnswer = mock()) {
  render(
    <PermissionCard
      cwd={CWD}
      onAnswer={onAnswer}
      permission={permission(shape)}
    />
  );

  return onAnswer;
}

beforeAll(() => Effect.runPromise(loadMarkdownRenderer));

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

    expect(onAnswer).toHaveBeenCalledWith("p1", "allow", null);
  });

  it("remembers the call for the session as its own choice", () => {
    const onAnswer = renderCard();

    fireEvent.click(screen.getByRole("button", { name: ALWAYS }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "always", null);
  });

  it("declines without stopping the turn", () => {
    const onAnswer = renderCard();

    fireEvent.click(screen.getByRole("button", { name: DECLINE }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "deny", null);
  });

  it("cancels the whole turn", () => {
    const onAnswer = renderCard();

    fireEvent.click(screen.getByRole("button", { name: CANCEL }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "cancel", null);
  });

  it("says what remembering means for a path, not for a command", () => {
    renderCard({
      input: { file_path: "/Users/me/.ssh/config" },
      name: "Write",
      reason: "outside",
    });

    const always = screen.getByRole("button", { name: ALWAYS });
    expect(always).toHaveAccessibleDescription(
      "Don’t ask again for this path until the studio quits"
    );
    expect(always).toHaveAttribute(
      "title",
      "Don’t ask again for this path until the studio quits"
    );
  });
});

describe("PermissionCard, on a plan", () => {
  const plan = {
    input: { plan: "1. Build the title card\n2. Add the outro" },
    name: "ExitPlanMode",
    reason: "plan",
  } as const;

  it("shows the plan instead of a tool call", () => {
    renderCard(plan);

    expect(screen.getByText("Ready to build this plan?")).toBeVisible();
    expect(screen.getByText("Build the title card")).toBeVisible();
    expect(screen.queryByText("ExitPlanMode")).toBeNull();
  });

  it("approves into accept edits", () => {
    const onAnswer = renderCard(plan);

    fireEvent.click(screen.getByRole("button", { name: BUILD }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "allow", "acceptEdits");
  });

  it("approves into auto", () => {
    const onAnswer = renderCard(plan);

    fireEvent.click(screen.getByRole("button", { name: RUN }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "allow", "auto");
  });

  it("sends the plan back without leaving plan mode", () => {
    const onAnswer = renderCard(plan);

    fireEvent.click(screen.getByRole("button", { name: KEEP }));

    expect(onAnswer).toHaveBeenCalledWith("p1", "deny", null);
  });

  it("never offers to remember a plan for the session", () => {
    renderCard(plan);

    expect(screen.queryByRole("button", { name: ALWAYS })).toBeNull();
  });
});

describe("PermissionCard, gathering asks raised together", () => {
  function sound(id: string, text: string): PendingPermission {
    return permission({
      id,
      input: {
        description: `ElevenLabs · Studio\nSound effect\n${text}\nThis request spends credits on your ElevenLabs account.`,
      },
      name: "Generate sound effect",
      reason: "outward",
    });
  }

  const sounds = [
    sound("s1", "Door closes"),
    sound("s2", "Light rain"),
    sound("s3", "Bell rings"),
  ];

  function renderBatch(
    asks: readonly PendingPermission[] = sounds,
    onAnswer = mock()
  ) {
    const view = render(
      <PermissionCard
        asks={asks}
        cwd={CWD}
        onAnswer={onAnswer}
        permission={asks[0]}
      />
    );
    return { onAnswer, view };
  }

  it("lists every request on one card, titled with the count", () => {
    renderBatch();

    expect(
      screen.getByText("Send these 3 requests to a connected service?")
    ).toBeVisible();
    expect(screen.getByText(DOOR)).toBeVisible();
    expect(screen.getByText(RAIN)).toBeVisible();
    expect(screen.getByText(BELL)).toBeVisible();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: ANY_ALWAYS })).toBeNull();
  });

  it("sends every request once with one choice", () => {
    const { onAnswer } = renderBatch();

    fireEvent.click(screen.getByRole("button", { name: SEND_ALL }));

    expect(onAnswer.mock.calls).toEqual([
      ["s1", "allow", null],
      ["s2", "allow", null],
      ["s3", "allow", null],
    ]);
  });

  it("declines the requests the person unchecked", () => {
    const { onAnswer } = renderBatch();

    fireEvent.click(screen.getByRole("checkbox", { name: RAIN }));
    fireEvent.click(screen.getByRole("button", { name: SEND_TWO }));

    expect(onAnswer.mock.calls).toEqual([
      ["s1", "allow", null],
      ["s2", "deny", null],
      ["s3", "allow", null],
    ]);
  });

  it("offers nothing to send once every request is unchecked", () => {
    const { onAnswer } = renderBatch();

    for (const box of screen.getAllByRole("checkbox")) {
      fireEvent.click(box);
    }

    expect(screen.getByRole("button", { name: SEND_NONE })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: DECLINE_ALL }));
    expect(onAnswer.mock.calls).toEqual([
      ["s1", "deny", null],
      ["s2", "deny", null],
      ["s3", "deny", null],
    ]);
  });

  it("declines every request on Escape", () => {
    const { onAnswer } = renderBatch();

    fireEvent.keyDown(screen.getByRole("button", { name: SEND_ALL }), {
      key: "Escape",
    });

    expect(onAnswer.mock.calls).toEqual([
      ["s1", "deny", null],
      ["s2", "deny", null],
      ["s3", "deny", null],
    ]);
  });

  it("cancels the turn once", () => {
    const { onAnswer } = renderBatch();

    fireEvent.click(screen.getByRole("button", { name: CANCEL }));

    expect(onAnswer.mock.calls).toEqual([["s1", "cancel", null]]);
  });

  it("remembers each checked command by itself", () => {
    const commands = [
      permission({ id: "c1", input: { command: "ls ~/Desktop" } }),
      permission({ id: "c2", input: { command: "ls ~/Movies" } }),
    ];
    const { onAnswer } = renderBatch(commands);

    expect(screen.getByText("Approve these 2 commands?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: ALWAYS_ALL }));

    expect(onAnswer.mock.calls).toEqual([
      ["c1", "always", null],
      ["c2", "always", null],
    ]);
  });

  it("takes in a request that arrives while it is up, checked, without moving focus", () => {
    const onAnswer = mock();
    const { view } = renderBatch(sounds.slice(0, 2), onAnswer);
    expect(screen.getByRole("button", { name: SEND_ALL_TWO })).toHaveFocus();

    view.rerender(
      <PermissionCard
        asks={sounds}
        cwd={CWD}
        onAnswer={onAnswer}
        permission={sounds[0]}
      />
    );

    expect(
      screen.getByText("Send these 3 requests to a connected service?")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: SEND_ALL })).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: BELL })).toBeChecked();
  });
});
