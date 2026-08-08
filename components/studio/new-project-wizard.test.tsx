import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewProjectWizard } from "@/components/studio/new-project-wizard";
import type { NewProject } from "@/hooks/use-new-project";
import { DEFAULT_FORMAT, formatById } from "@/lib/studio/formats";

const PARENT = "/Users/me/videos";

function control(shape: Partial<NewProject> = {}): NewProject {
  return {
    canCreate: false,
    close: vi.fn(),
    format: DEFAULT_FORMAT,
    isOpen: true,
    name: "",
    onFormatChange: vi.fn(),
    onNameChange: vi.fn(),
    onSubmit: vi.fn(),
    open: vi.fn(),
    parent: null,
    pickParent: vi.fn(),
    submit: vi.fn(),
    ...shape,
  };
}

function renderWizard(shape: Partial<NewProject> = {}) {
  const value = control(shape);
  render(<NewProjectWizard control={value} entrance={null} />);
  return value;
}

describe("NewProjectWizard", () => {
  it("asks for a name, a location and a ratio in one panel", () => {
    renderWizard();

    expect(screen.getByLabelText("Name")).toBeVisible();
    expect(screen.getByTitle("Choose a folder…")).toBeVisible();
    expect(
      screen.getByRole("radiogroup", { name: "Aspect ratio" })
    ).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("offers 16:9 checked by default and says what each ratio is for", () => {
    renderWizard();

    expect(screen.getByText("16:9")).toBeVisible();
    expect(screen.getByText("1920×1080")).toBeVisible();
    expect(screen.getByText("YouTube")).toBeVisible();
    expect(screen.getByText("Shorts, TikTok, Reels")).toBeVisible();

    const [landscape, vertical] = screen.getAllByRole("radio");

    expect(landscape).toBeChecked();
    expect(vertical).not.toBeChecked();
  });

  it("reports the ratio the user picked", () => {
    const value = renderWizard();
    const [, vertical] = screen.getAllByRole("radio");

    fireEvent.click(vertical as HTMLElement);

    expect(value.onFormatChange).toHaveBeenCalledWith(
      "vertical",
      expect.anything()
    );
  });

  it("takes the whole card as the target, not a radio dot", () => {
    const value = renderWizard();

    fireEvent.click(screen.getByText("9:16"));

    expect(value.onFormatChange).toHaveBeenCalledWith(
      "vertical",
      expect.anything()
    );
  });

  it("marks the chosen ratio rather than the default one", () => {
    renderWizard({ format: formatById("square") });
    const [landscape, , square] = screen.getAllByRole("radio");

    expect(square).toBeChecked();
    expect(landscape).not.toBeChecked();
  });

  it("keeps Create out of reach until there is a name and a folder", () => {
    renderWizard();

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("shows the folder that was picked and lets the project be created", () => {
    renderWizard({ canCreate: true, name: "launch-film", parent: PARENT });

    expect(screen.getByTitle(PARENT)).toBeVisible();
    expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
  });

  it("goes back to where it was opened from", () => {
    const value = renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(value.close).toHaveBeenCalled();
  });
});
