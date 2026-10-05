import { describe, expect, it, spyOn } from "bun:test";
import { ru } from "@daypicker/react/locale";
import { render, screen } from "@testing-library/react";
import { Calendar } from "@/components/ui/calendar";

describe("Calendar month labels", () => {
  it("uses the calendar locale even when the host has a different locale", () => {
    const hostFormatter = spyOn(
      Date.prototype,
      "toLocaleString"
    ).mockReturnValue("host-specific month");
    try {
      const view = render(
        <Calendar
          captionLayout="dropdown"
          defaultMonth={new Date(2026, 9, 1)}
        />
      );
      expect(screen.getByRole("option", { name: "Oct" })).toBeVisible();
      expect(hostFormatter).not.toHaveBeenCalled();

      view.rerender(
        <Calendar
          captionLayout="dropdown"
          defaultMonth={new Date(2026, 9, 1)}
          locale={ru}
        />
      );
      expect(screen.getByRole("option", { name: "окт." })).toBeVisible();
    } finally {
      hostFormatter.mockRestore();
    }
  });
});
