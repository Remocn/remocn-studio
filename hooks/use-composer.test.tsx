import { mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useComposer } from "@/hooks/use-composer";
import type { PromptElement } from "@/shared/ipc";
import type { Asset } from "@/shared/library";

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

function asset(slug: string, name: string): Asset {
  return {
    category: null,
    clip: null,
    createdAt: 0,
    dependencies: [],
    description: "",
    duration: null,
    files: [`${slug}.tsx`],
    name,
    path: `/library/assets/${slug}`,
    preview: null,
    proxied: false,
    slug,
    type: "component",
  };
}

function typing(text: string) {
  return {
    currentTarget: { selectionStart: text.length, value: text },
    target: { selectionStart: text.length, value: text },
  } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
}

function clickOn(value: string) {
  return {
    currentTarget: { value },
  } as unknown as React.MouseEvent<HTMLButtonElement>;
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
    expect(result.current.counts).toEqual({ asset: 0, element: 0, image: 1 });
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

  it("numbers each asset from its own list", () => {
    const { result } = composer();

    act(() => {
      result.current.pick(asset("neon", "Neon Title"));
    });
    act(() => {
      result.current.pick(asset("logo", "Logo"));
    });

    expect(result.current.value).toBe("[Asset #1] [Asset #2] ");
    expect(result.current.counts).toEqual({ asset: 2, element: 0, image: 0 });
  });

  it("refers to an asset picked twice with the number it already has", () => {
    const { result } = composer();

    act(() => {
      result.current.pick(asset("neon", "Neon Title"));
    });
    act(() => {
      result.current.pick(asset("neon", "Neon Title"));
    });

    expect(result.current.value).toBe("[Asset #1] [Asset #1] ");
    expect(result.current.assets.items).toHaveLength(1);
  });

  it("takes the reference out with the asset and renumbers the rest", () => {
    const { result } = composer();

    act(() => {
      result.current.pick(asset("neon", "Neon Title"));
    });
    act(() => {
      result.current.pick(asset("logo", "Logo"));
    });
    act(() => {
      result.current.onRemoveAsset(clickOn("0"));
    });

    expect(result.current.value).toBe("[Asset #1] ");
    expect(result.current.assets.items.map((item) => item.slug)).toEqual([
      "logo",
    ]);
  });

  it("keeps the assets when the project changes, since they are not its own", () => {
    const { rerender, result } = composer();

    act(() => {
      result.current.pick(asset("neon", "Neon Title"));
    });

    rerender({ projectId: "project-2" });

    expect(result.current.assets.items).toHaveLength(1);
    expect(result.current.value).toContain("[Asset #1]");
  });

  it("can send a message that is nothing but an asset", () => {
    const { result } = composer();

    expect(result.current.canSubmit).toBe(false);

    act(() => {
      result.current.pick(asset("neon", "Neon Title"));
    });

    expect(result.current.canSubmit).toBe(true);
  });

  it("holds video and audio in their own list, outside the reference numbering", () => {
    const { result } = composer();

    act(() => {
      result.current.media.attach(["/tmp/intro.mp4", "/tmp/theme.wav"]);
    });

    expect(result.current.media.items.map((item) => item.mediaType)).toEqual([
      "video/mp4",
      "audio/wav",
    ]);
    expect(result.current.value).toBe("");
    expect(result.current.counts).toEqual({ asset: 0, element: 0, image: 0 });
  });

  it("refuses a picture in the media list, which belongs to the model", () => {
    const { result } = composer();

    act(() => {
      result.current.media.attach(["/tmp/shot.png", "/tmp/intro.mp4"]);
    });

    expect(result.current.media.items.map((item) => item.name)).toEqual([
      "intro.mp4",
    ]);
  });

  it("takes the same file once, however many times it is dropped", () => {
    const { result } = composer();

    act(() => {
      result.current.media.attach(["/tmp/intro.mp4"]);
    });
    act(() => {
      result.current.media.attach(["/tmp/intro.mp4"]);
    });

    expect(result.current.media.items).toHaveLength(1);
  });

  it("can send a message that is nothing but a video", () => {
    const { result } = composer();

    expect(result.current.canSubmit).toBe(false);

    act(() => {
      result.current.media.attach(["/tmp/intro.mp4"]);
    });

    expect(result.current.canSubmit).toBe(true);
  });

  it("removes a media card by the index on the button", () => {
    const { result } = composer();

    act(() => {
      result.current.media.attach(["/tmp/intro.mp4", "/tmp/theme.wav"]);
    });
    act(() => {
      result.current.onRemoveMedia(clickOn("0"));
    });

    expect(result.current.media.items.map((item) => item.name)).toEqual([
      "theme.wav",
    ]);
  });

  it("lays a dropped mix out into the list each kind belongs in", () => {
    const { result } = composer();

    act(() => {
      result.current.drop([
        "/tmp/shot.png",
        "/tmp/intro.mp4",
        "/tmp/theme.wav",
      ]);
    });

    expect(result.current.attachments.items.map((item) => item.name)).toEqual([
      "shot.png",
    ]);
    expect(result.current.media.items.map((item) => item.name)).toEqual([
      "intro.mp4",
      "theme.wav",
    ]);
  });

  it("refers to a dropped picture the way a pasted one is referred to", () => {
    const { result } = composer();

    act(() => {
      result.current.onChange(typing("use this"));
    });
    act(() => {
      result.current.drop(["/tmp/shot.png", "/tmp/logo.png"]);
    });

    expect(result.current.value).toBe("use this [Image #1] [Image #2] ");
    expect(result.current.counts).toEqual({ asset: 0, element: 0, image: 2 });
  });

  it("leaves the text alone when the drop held no picture", () => {
    const { result } = composer();

    act(() => {
      result.current.drop(["/tmp/intro.mp4"]);
    });

    expect(result.current.value).toBe("");
    expect(result.current.canSubmit).toBe(true);
  });

  it("writes no second reference for a picture already attached", () => {
    const { result } = composer();

    act(() => {
      result.current.drop(["/tmp/shot.png"]);
    });
    act(() => {
      result.current.drop(["/tmp/shot.png"]);
    });

    expect(result.current.value).toBe("[Image #1] ");
    expect(result.current.attachments.items).toHaveLength(1);
  });

  // These handlers are handed to memoised rows in the assets panel. Reminting
  // them per keystroke would re-render every row while you type.
  it("keeps the callbacks that insert at the caret stable as the text changes", () => {
    const { result } = composer();
    const { pick, select, write } = result.current;

    act(() => {
      result.current.onChange(typing("a first line"));
    });
    act(() => {
      result.current.onChange(typing("a first line and a second"));
    });

    expect(result.current.value).toBe("a first line and a second");
    expect(result.current.pick).toBe(pick);
    expect(result.current.write).toBe(write);
    expect(result.current.select).toBe(select);
  });

  it("still inserts against the text as it stands now, not as it was", () => {
    const { result } = composer();

    act(() => {
      result.current.onChange(typing("use this"));
    });
    act(() => {
      result.current.pick(asset("neon", "Neon Title"));
    });

    expect(result.current.value).toBe("use this [Asset #1] ");
  });

  it("writes a ready phrase at the caret without adding a reference", () => {
    const { result } = composer();

    act(() => {
      result.current.write("save this to the library");
    });

    expect(result.current.value).toBe("save this to the library ");
    expect(result.current.counts).toEqual({ asset: 0, element: 0, image: 0 });
  });
});
