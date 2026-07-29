import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useComposer } from "@/hooks/use-composer";
import type { PromptElement } from "@/shared/ipc";

const PASTED = "/Users/me/Library/Application Support/studio/pasted.png";

const ELEMENT: PromptElement = {
  column: 7,
  component: "TitleCard",
  composition: "Main",
  file: "/Users/me/projects/my-video/src/TitleCard.tsx",
  fps: 30,
  frame: 42,
  html: "<h1>Hello</h1>",
  line: 12,
  scene: null,
  stack: [],
};

const RECT = { height: 0.2, width: 0.5, x: 0.25, y: 0.4 };

function pngFile(name: string) {
  return new File([new Uint8Array([137, 80, 78, 71])], name, {
    type: "image/png",
  });
}

function composer(projectId: string | null = "project-1") {
  return renderHook(
    (props: { projectId: string | null }) =>
      useComposer({ onSubmit: vi.fn(), projectId: props.projectId }),
    { initialProps: { projectId } }
  );
}

describe("useComposer", () => {
  beforeEach(() => {
    mockIPC((cmd) => {
      if (cmd === "save_pasted_image") {
        return PASTED;
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
  });

  it("numbers each selection from its own list", () => {
    const { result } = composer();

    act(() => {
      result.current.select(ELEMENT, RECT, "make this bigger");
    });
    act(() => {
      result.current.select(ELEMENT, RECT, "and this smaller");
    });

    expect(result.current.value).toBe(
      "make this bigger [Element #1] and this smaller [Element #2] "
    );
    expect(result.current.selections.items).toHaveLength(2);
  });

  it("drops the element references when the open session moves project", async () => {
    const { rerender, result } = composer();

    await act(async () => {
      await result.current.attachments.attach([pngFile("shot.png")]);
    });
    act(() => {
      result.current.select(ELEMENT, RECT, "make this bigger");
    });

    expect(result.current.value).toContain("[Element #1]");

    rerender({ projectId: "project-2" });

    expect(result.current.value).not.toContain("[Element #1]");
    expect(result.current.value).toContain("make this bigger");
    expect(result.current.selections.items).toHaveLength(0);
  });

  it("leaves the images alone when the project changes", async () => {
    const { rerender, result } = composer();

    await act(async () => {
      await result.current.attachments.attach([pngFile("shot.png")]);
    });
    act(() => {
      result.current.select(ELEMENT, RECT, "make this bigger");
    });

    rerender({ projectId: "project-2" });

    expect(result.current.attachments.items).toHaveLength(1);
    expect(result.current.counts).toEqual({ element: 0, image: 1 });
  });

  it("keeps the selections while the project stays the same", () => {
    const { rerender, result } = composer();

    act(() => {
      result.current.select(ELEMENT, RECT, "make this bigger");
    });

    rerender({ projectId: "project-1" });

    expect(result.current.selections.items).toHaveLength(1);
    expect(result.current.value).toContain("[Element #1]");
  });

  it("keeps a selection made before the first project resolved", () => {
    const { rerender, result } = composer(null);

    act(() => {
      result.current.select(ELEMENT, RECT, "make this bigger");
    });

    rerender({ projectId: "project-1" });

    expect(result.current.selections.items).toHaveLength(1);
  });

  it("has nothing to send until there is something in it", () => {
    const { result } = composer();

    expect(result.current.canSubmit).toBe(false);

    act(() => {
      result.current.select(ELEMENT, RECT, "");
    });

    expect(result.current.canSubmit).toBe(true);
  });
});
