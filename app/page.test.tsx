import { mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";

const IPC_FAILURE = /IPC failed/;

// Exercises the whole frontend test path in one place: jsdom, React Testing
// Library, the `@/` tsconfig alias, a Base UI–backed shadcn component, and a
// faked Tauri IPC boundary.
describe("Page", () => {
  it("renders the shell", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "remocn studio" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ping the Rust core" })
    ).toBeInTheDocument();
  });

  it("shows what the Rust core returned", async () => {
    mockIPC((cmd, payload) => {
      if (cmd === "greet") {
        const { name } = payload as { name: string };
        return `Hello, ${name}!`;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });

    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Ping the Rust core" }));

    expect(await screen.findByText("Hello, studio!")).toBeInTheDocument();
  });

  it("surfaces an IPC failure instead of staying silent", async () => {
    mockIPC(() => {
      throw new Error("core is down");
    });

    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Ping the Rust core" }));

    expect(await screen.findByText(IPC_FAILURE)).toBeInTheDocument();
  });
});
