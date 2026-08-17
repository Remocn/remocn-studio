import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageText } from "@/components/studio/message-text";
import { countsOf } from "@/shared/references";

function drawn(text: string, counts = countsOf({})) {
  const { container } = render(<MessageText counts={counts} text={text} />);
  return container;
}

describe("MessageText", () => {
  it("gives a tagged file its own chip", () => {
    const chips = drawn("fix `src/scenes/Intro.tsx` please").querySelectorAll(
      ".file-mention"
    );

    expect([...chips].map((chip) => chip.textContent)).toEqual([
      "`src/scenes/Intro.tsx`",
    ]);
  });

  it("leaves a code span that is not a path alone", () => {
    expect(
      drawn("register it in `Main`").querySelectorAll(".file-mention")
    ).toHaveLength(0);
  });

  it("draws the whole message, chips and all", () => {
    const text = "see `src/a.tsx` and `~/clips/b.mp4`";
    expect(drawn(text).textContent).toBe(text);
  });

  it("keeps references in the reference colour, not in a chip", () => {
    const container = drawn("look at [Image #1]", countsOf({ image: 1 }));

    expect(container.querySelectorAll(".text-reference")).toHaveLength(1);
    expect(container.querySelectorAll(".file-mention")).toHaveLength(0);
  });

  it("colours a path that sits beside a reference", () => {
    const container = drawn(
      "[Image #1] belongs in `src/Root.tsx`",
      countsOf({ image: 1 })
    );

    expect(container.querySelectorAll(".text-reference")).toHaveLength(1);
    expect(container.querySelectorAll(".file-mention")).toHaveLength(1);
  });
});
