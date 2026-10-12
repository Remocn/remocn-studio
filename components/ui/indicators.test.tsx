import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Meter, MeterValue } from "@/components/ui/meter";
import { Progress, ProgressValue } from "@/components/ui/progress";

const INDICATORS = [
  {
    name: "Progress",
    Root: Progress,
    role: "progressbar",
    Value: ProgressValue,
  },
  { name: "Meter", Root: Meter, role: "meter", Value: MeterValue },
] as const;

describe("Indicator number formatting", () => {
  for (const { Root, Value, name, role } of INDICATORS) {
    it(`${name} uses a stable default and respects an explicit locale`, () => {
      expect(
        renderToString(
          <Root value={62}>
            <Value />
          </Root>
        )
      ).toContain('aria-valuetext="62%"');
      const view = render(
        <Root value={62}>
          <Value />
        </Root>
      );
      expect(screen.getByRole(role)).toHaveAttribute("aria-valuenow", "62");
      expect(screen.getByRole(role)).toHaveAttribute("aria-valuetext", "62%");
      expect(screen.getByText("62%")).toBeVisible();

      view.rerender(
        <Root locale="ru-RU" value={62}>
          <Value />
        </Root>
      );
      const localized = new Intl.NumberFormat("ru-RU", {
        style: "percent",
      }).format(0.62);
      expect(screen.getByRole(role)).toHaveAttribute(
        "aria-valuetext",
        localized
      );
    });
  }
});
