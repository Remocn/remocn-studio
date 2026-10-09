import { expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useCallback, useState } from "react";
import { useDialCommit } from "@/hooks/use-dial-commit";
import { ShaderPalette } from "./shader-palette";

it("reorders with held arrow keys as one commit, keeping focus on the same stop", async () => {
  const commit = mock();
  const changed = mock();
  function Palette() {
    const [value, setValue] = useState(["#ff0000", "#00ff00", "#0000ff"]);
    const finish = useDialCommit(commit);
    const change = useCallback(
      (next: string[]) => {
        setValue(next);
        changed(next);
        finish();
      },
      [finish]
    );
    return (
      <ShaderPalette label="Colors" max={3} onChange={change} value={value} />
    );
  }
  render(<Palette />);
  const handle = screen.getByRole("button", { name: "Move color 1" });
  handle.focus();
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  fireEvent.keyDown(handle, { key: "ArrowDown", repeat: true });
  await act(async () => {
    await Promise.resolve();
  });
  expect(commit).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Move color 3" })
  );
  fireEvent.keyUp(handle, { key: "ArrowDown" });
  await act(async () => {
    await Promise.resolve();
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenLastCalledWith(["#00ff00", "#0000ff", "#ff0000"]);
  expect(screen.getByRole("button", { name: "Add color" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Remove color 2" }));
  expect(screen.getByRole("button", { name: "Add color" })).not.toBeDisabled();
});

it("reorders by pointer as one gesture and leaves the moved stop focused", async () => {
  const commit = mock();
  const changed = mock();
  function Palette() {
    const [value, setValue] = useState(["#ff0000", "#00ff00", "#0000ff"]);
    const finish = useDialCommit(commit);
    const change = useCallback(
      (next: string[]) => {
        setValue(next);
        changed(next);
        finish();
      },
      [finish]
    );
    return <ShaderPalette label="Colors" onChange={change} value={value} />;
  }
  const view = render(<Palette />);
  const rows = [...view.container.querySelectorAll("[data-color-stop]")];
  for (const [index, row] of rows.entries()) {
    Object.defineProperty(row, "getBoundingClientRect", {
      value: () => ({ bottom: index * 40 + 40, top: index * 40 }),
    });
  }
  const handle = screen.getByRole("button", { name: "Move color 1" });
  Object.defineProperty(handle, "setPointerCapture", { value: mock() });
  handle.focus();
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 });
  await act(async () => {
    await Promise.resolve();
  });
  expect(changed).toHaveBeenLastCalledWith(["#00ff00", "#0000ff", "#ff0000"]);
  expect(commit).not.toHaveBeenCalled();
  fireEvent.pointerUp(handle, { pointerId: 1 });
  await act(async () => {
    await Promise.resolve();
  });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(handle);
});
