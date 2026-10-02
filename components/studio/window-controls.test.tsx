import { afterEach, describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { WindowControls } from "@/components/studio/window-controls";

const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";

function withAgent(agent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: agent,
  });
}

afterEach(() => {
  withAgent(LINUX);
});

describe("WindowControls", () => {
  it("draws close, minimise and maximise on Linux", async () => {
    withAgent(LINUX);
    render(<WindowControls />);

    expect(await screen.findByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Minimise" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Maximise" })).toBeTruthy();
  });

  it("draws nothing where the system draws its own", () => {
    withAgent(MAC);
    render(<WindowControls />);

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
