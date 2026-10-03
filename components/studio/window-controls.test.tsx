import { afterEach, describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { WindowControls } from "@/components/studio/window-controls";
import { LINUX, MAC, withAgent } from "@/test/user-agent";

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
