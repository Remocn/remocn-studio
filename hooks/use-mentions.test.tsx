import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useComposer } from "@/hooks/use-composer";

const FILES = [
  "package.json",
  "src/Root.tsx",
  "src/scenes/Intro.tsx",
  "src/scenes/Outro.tsx",
];

const FOLDERS: Record<
  string,
  { directory: boolean; name: string }[] | undefined
> = {
  "/Users/me/": [
    { directory: true, name: "Movies" },
    { directory: false, name: "notes.txt" },
  ],
  "/Users/me/Movies/": [{ directory: false, name: "clip.mp4" }],
};

const TRAILING_SLASH = /\/$/;

interface Calls {
  asked: string[];
  listed: number;
}

function install(truncated = false): Calls {
  const calls: Calls = { asked: [], listed: 0 };

  mockIPC((cmd, payload) => {
    if (cmd !== "sidecar_request") {
      return;
    }

    const { method, params } = payload as {
      method: string;
      params: Record<string, string>;
    };

    if (method === "project.files") {
      calls.listed += 1;
      return { files: FILES, root: "/Users/me/video", truncated };
    }

    if (method === "files.list") {
      calls.asked.push(params.path);
      const entries = FOLDERS[params.path];
      if (entries === undefined) {
        throw new Error(`${params.path} could not be listed`);
      }
      return { entries, path: params.path.replace(TRAILING_SLASH, "") };
    }
  });

  return calls;
}

function typing(text: string, caret = text.length) {
  return {
    currentTarget: { selectionStart: caret, value: text },
    target: { selectionStart: caret, value: text },
  } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
}

function pressing(key: string, text: string) {
  return {
    altKey: false,
    currentTarget: { selectionEnd: 0, selectionStart: 0, value: text },
    key,
    metaKey: false,
    preventDefault: vi.fn(),
    shiftKey: false,
  } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
}

function clicking(index: number) {
  return {
    currentTarget: { value: String(index) },
  } as unknown as React.MouseEvent<HTMLButtonElement>;
}

function composer(onSubmit = vi.fn()) {
  return renderHook(() => useComposer({ onSubmit, projectId: "project-1" }));
}

async function opened(text: string) {
  const rendered = composer();

  act(() => {
    rendered.result.current.onChange(typing(text));
  });

  await waitFor(() =>
    expect(rendered.result.current.mentions.items.length).toBeGreaterThan(0)
  );

  return rendered;
}

describe("mentions in the composer", () => {
  beforeEach(() => {
    clearMocks();
  });

  it("stays shut until an @ is typed", () => {
    install();
    const { result } = composer();

    act(() => {
      result.current.onChange(typing("fix the intro"));
    });

    expect(result.current.mentions.isOpen).toBe(false);
    expect(result.current.mentions.items).toEqual([]);
  });

  it("offers the project's files, best match first", async () => {
    install();
    const { result } = await opened("fix @intro");

    expect(result.current.mentions.items.at(0)).toMatchObject({
      folder: false,
      hint: "src/scenes",
      label: "Intro.tsx",
      path: "src/scenes/Intro.tsx",
    });
  });

  it("writes the chosen file into the message as a backticked path", async () => {
    install();
    const { result } = await opened("fix @intro");

    act(() => {
      result.current.onKeyDown(pressing("Enter", "fix @intro"));
    });

    expect(result.current.value).toBe("fix `src/scenes/Intro.tsx` ");
    expect(result.current.mentions.isOpen).toBe(false);
  });

  it("sends the message rather than a file when nothing matches", async () => {
    install();
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useComposer({ onSubmit, projectId: "project-1" })
    );

    act(() => {
      result.current.onChange(typing("ship @zzz"));
    });

    await waitFor(() => expect(result.current.mentions.isOpen).toBe(true));
    expect(result.current.mentions.items).toEqual([]);

    act(() => {
      result.current.onKeyDown(pressing("Enter", "ship @zzz"));
    });

    expect(onSubmit).toHaveBeenCalledWith("ship @zzz", [], [], [], []);
  });

  it("closes on Escape and leaves the @ as plain text", async () => {
    install();
    const { result } = await opened("fix @intro");

    act(() => {
      result.current.onKeyDown(pressing("Escape", "fix @intro"));
    });

    expect(result.current.mentions.isOpen).toBe(false);
    expect(result.current.value).toBe("fix @intro");
  });

  it("does not reopen on the mention it was dismissed on", async () => {
    install();
    const { result } = await opened("fix @intro");

    act(() => {
      result.current.onKeyDown(pressing("Escape", "fix @intro"));
      result.current.onChange(typing("fix @intros"));
    });

    expect(result.current.mentions.isOpen).toBe(false);
  });

  it("reads the list once per project, however much is typed", async () => {
    const calls = install();
    const { result } = await opened("fix @intro");

    act(() => {
      result.current.onChange(typing("fix @intro."));
    });
    await waitFor(() => expect(result.current.mentions.isOpen).toBe(true));

    expect(calls.listed).toBe(1);
  });

  it("browses the filesystem when the query is an absolute path", async () => {
    install();
    const { result } = await opened("use @/Users/me/");

    expect(result.current.mentions.items.map((row) => row.label)).toEqual([
      "Movies",
      "notes.txt",
    ]);
  });

  it("drills into a folder without closing, and keeps the @", async () => {
    const calls = install();
    const { result } = await opened("use @/Users/me/");

    act(() => {
      result.current.mentions.onChoose(clicking(0));
    });

    expect(result.current.value).toBe("use @/Users/me/Movies/");
    expect(result.current.mentions.isOpen).toBe(true);

    await waitFor(() =>
      expect(result.current.mentions.items.map((row) => row.label)).toEqual([
        "clip.mp4",
      ])
    );
    expect(calls.asked).toEqual(["/Users/me/", "/Users/me/Movies/"]);
  });

  it("writes an absolute path for a file outside the project", async () => {
    install();
    const { result } = await opened("use @/Users/me/no");

    act(() => {
      result.current.onKeyDown(pressing("Enter", "use @/Users/me/no"));
    });

    expect(result.current.value).toBe("use `/Users/me/notes.txt` ");
  });

  it("says why a folder could not be read", async () => {
    install();
    const { result } = composer();

    act(() => {
      result.current.onChange(typing("use @/nowhere/"));
    });

    await waitFor(() =>
      expect(result.current.mentions.error).toContain("could not be listed")
    );
    expect(result.current.mentions.items).toEqual([]);
  });
});
