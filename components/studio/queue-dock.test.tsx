import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueueDock } from "@/components/studio/queue-dock";
import type { Queue } from "@/hooks/use-queue";
import type { QueuedMessage } from "@/lib/studio/turns";

const TRIGGER = /^Queue, /;

function message(id: string, text: string): QueuedMessage {
  return {
    assets: [],
    attachments: [],
    effort: null,
    elements: [],
    id,
    media: [],
    model: null,
    playing: null,
    projectId: "project-1",
    text,
  };
}

function queue(items: QueuedMessage[], canEdit = true): Queue {
  return { canEdit, items, onEdit: vi.fn(), onRemove: vi.fn() };
}

function open(control: Queue) {
  render(<QueueDock queue={control} />);
  fireEvent.click(screen.getByRole("button", { name: TRIGGER }));
}

describe("QueueDock", () => {
  it("draws nothing at all while the queue is empty", () => {
    render(<QueueDock queue={queue([])} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("collapses to the message that goes out next, and how many wait", () => {
    render(
      <QueueDock
        queue={queue([message("a", "now in red"), message("b", "then export")])}
      />
    );

    expect(screen.getByText("now in red")).toBeVisible();
    expect(screen.getByText("2 queued")).toBeVisible();
    expect(screen.queryByText("then export")).not.toBeInTheDocument();
  });

  it("opens into the whole queue, and closes again", () => {
    const control = queue([
      message("a", "now in red"),
      message("b", "then export"),
    ]);
    open(control);

    expect(screen.getByText("then export")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: TRIGGER }));

    expect(screen.queryByText("then export")).not.toBeInTheDocument();
  });

  it("keeps the queue in the order it was written", () => {
    open(queue([message("a", "now in red"), message("b", "then export")]));

    expect(
      screen.getAllByRole("listitem").map((row) => row.textContent)
    ).toEqual(["now in red", "then export"]);
  });

  it("hands the row's id to the delete button", () => {
    const control = queue([message("a", "now in red")]);
    open(control);

    const remove = screen.getByRole("button", {
      name: "Remove queued message 1",
    });
    fireEvent.click(remove);

    expect(remove).toHaveValue("a");
    expect(control.onRemove).toHaveBeenCalledTimes(1);
  });

  it("puts a message back in the composer when its row is clicked", () => {
    const control = queue([message("a", "now in red")]);
    open(control);

    fireEvent.click(screen.getByRole("button", { name: "now in red" }));

    expect(control.onEdit).toHaveBeenCalledTimes(1);
  });

  it("says why a message cannot be edited instead of doing nothing", () => {
    open(queue([message("a", "now in red")], false));

    const row = screen.getByRole("button", { name: "now in red" });
    expect(row).toBeDisabled();
    expect(row).toHaveAttribute(
      "title",
      "Clear the composer to edit this message"
    );
  });

  it("names a wordless message by what it carries", () => {
    const carried = {
      ...message("a", ""),
      attachments: [
        {
          mediaType: "image/png" as const,
          name: "shot.png",
          path: "/Users/me/Desktop/shot.png",
        },
      ],
    };
    render(<QueueDock queue={queue([carried])} />);

    expect(screen.getByText("1 attachment")).toBeVisible();
  });
});
