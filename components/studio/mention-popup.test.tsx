import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MentionPopup } from "@/components/studio/mention-popup";
import type { MentionItem, Mentions } from "@/hooks/use-mentions";

const ITEMS: MentionItem[] = Array.from({ length: 12 }, (_unused, index) => ({
  folder: false,
  hint: "src/scenes",
  label: `Scene${index}.tsx`,
  path: `src/scenes/Scene${index}.tsx`,
}));

const scrolled = vi.fn();

function popup(shape: Partial<Mentions> = {}): Mentions {
  return {
    active: 0,
    close: vi.fn(),
    error: null,
    isLoading: false,
    isOpen: true,
    items: ITEMS,
    keyed: 0,
    note: null,
    onChoose: vi.fn(),
    onHold: vi.fn(),
    onKeyDown: vi.fn(),
    onPoint: vi.fn(),
    sync: vi.fn(),
    ...shape,
  };
}

describe("MentionPopup", () => {
  beforeEach(() => {
    scrolled.mockClear();
    (
      Element.prototype as unknown as { scrollIntoView: () => void }
    ).scrollIntoView = scrolled;
  });

  it("draws nothing while the list is shut", () => {
    render(<MentionPopup mentions={popup({ isOpen: false })} />);

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("marks the row the keyboard is on", () => {
    render(<MentionPopup mentions={popup({ active: 3 })} />);

    const rows = screen.getAllByRole("option");

    expect(rows.at(3)?.getAttribute("aria-selected")).toBe("true");
    expect(rows.at(0)?.getAttribute("aria-selected")).toBe("false");
  });

  it("scrolls the row the keyboard moved to into view", () => {
    const { rerender } = render(
      <MentionPopup mentions={popup({ active: 0, keyed: 0 })} />
    );

    scrolled.mockClear();
    rerender(<MentionPopup mentions={popup({ active: 9, keyed: 1 })} />);

    expect(scrolled).toHaveBeenCalledTimes(1);
  });

  it("does not scroll again when the list re-renders for another reason", () => {
    const { rerender } = render(
      <MentionPopup mentions={popup({ active: 4, keyed: 2 })} />
    );

    scrolled.mockClear();
    rerender(<MentionPopup mentions={popup({ active: 4, keyed: 2 })} />);

    expect(scrolled).not.toHaveBeenCalled();
  });

  it("scrolls a surviving row that the filter moved to another place", () => {
    const { rerender } = render(
      <MentionPopup mentions={popup({ active: 8, keyed: 3 })} />
    );

    scrolled.mockClear();
    rerender(
      <MentionPopup
        mentions={popup({ active: 0, items: [ITEMS[8], ITEMS[2]], keyed: 3 })}
      />
    );

    expect(scrolled).toHaveBeenCalledTimes(1);
  });

  it("says why there is nothing to choose from", () => {
    render(
      <MentionPopup
        mentions={popup({ error: "/nowhere could not be listed", items: [] })}
      />
    );

    expect(screen.getByText("/nowhere could not be listed")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
