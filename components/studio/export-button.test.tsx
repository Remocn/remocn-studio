import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportButton } from "@/components/studio/export-button";
import type { Exporting } from "@/hooks/use-export";

function exporting(overrides: Partial<Exporting> = {}): Exporting {
  return {
    brief: null,
    cancel: () => undefined,
    canExport: true,
    isRunning: false,
    percent: null,
    result: null,
    reveal: () => Promise.resolve(),
    start: () => undefined,
    status: null,
    trouble: null,
    unavailable: null,
    ...overrides,
  };
}

describe("ExportButton", () => {
  it("starts the export when idle", () => {
    const start = vi.fn();
    render(<ExportButton exporting={exporting({ start })} />);

    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toHaveAttribute(
      "title",
      "Render this composition into out/"
    );
    fireEvent.click(button);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("says why it is unavailable rather than disappearing", () => {
    render(
      <ExportButton
        exporting={exporting({
          canExport: false,
          unavailable: "Open a project to export it.",
        })}
      />
    );

    const button = screen.getByRole("button", { name: "Export" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("title", "Open a project to export it.");
  });

  it("names a stage that has no percentage, and clicking cancels", () => {
    const cancel = vi.fn();
    render(
      <ExportButton
        exporting={exporting({
          brief: { label: "Measuring…", percent: null },
          cancel,
          isRunning: true,
          status: "Measuring the composition…",
        })}
      />
    );

    const button = screen.getByRole("button", { name: "Cancel the export" });
    expect(button).toHaveTextContent("Measuring…");
    expect(button).toHaveAttribute("title", "Measuring the composition…");
    fireEvent.click(button);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("wears the stage and its percentage while it renders", () => {
    const cancel = vi.fn();
    render(
      <ExportButton
        exporting={exporting({
          brief: { label: "Rendering · 21%", percent: 21 },
          cancel,
          isRunning: true,
          percent: 21,
          status: "Rendering — 64/300 frames · 21%",
        })}
      />
    );

    const button = screen.getByRole("button", { name: "Cancel the export" });
    expect(button).toHaveTextContent("Rendering · 21%");
    expect(button).toHaveAttribute("title", "Rendering — 64/300 frames · 21%");
    fireEvent.click(button);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
