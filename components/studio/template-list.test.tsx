import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemplateList } from "@/components/studio/template-list";
import { PROMPT_TEMPLATES } from "@/lib/studio/templates";

describe("TemplateList", () => {
  it("shows a row per template", () => {
    render(<TemplateList onPick={vi.fn()} />);

    for (const template of PROMPT_TEMPLATES) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${template.title}`) })
      ).toBeInTheDocument();
    }
  });

  it("hands over the picked template's prompt, and only that", async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<TemplateList onPick={onPick} />);

    const [, , template] = PROMPT_TEMPLATES;
    if (template === undefined) {
      throw new Error("expected a third template");
    }
    await user.click(
      screen.getByRole("button", { name: new RegExp(`^${template.title}`) })
    );

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(template.prompt);
  });
});
