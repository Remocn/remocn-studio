import { afterEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { useChatRowMenu, useVideoRowMenu } from "@/hooks/use-row-menus";
import type { VideoMenu } from "@/hooks/use-video-menu";
import type { Video } from "@/shared/ipc";
import { LINUX, MAC, withAgent } from "@/test/user-agent";

function ChatRow({
  canDelete,
  onDelete,
}: {
  canDelete: boolean;
  onDelete: () => void;
}) {
  const menu = useChatRowMenu(canDelete);
  return (
    <div data-chat-row>
      <button onKeyDown={menu.onKeyDown} type="button">
        Chat
      </button>
      {canDelete ? (
        <button data-row-action="delete" onClick={onDelete} type="button">
          Delete
        </button>
      ) : null}
    </div>
  );
}

const VIDEO = { id: "v1", missing: false, name: "Intro" } as Video;

function videoMenu(overrides: Partial<VideoMenu> = {}): VideoMenu {
  return {
    canRename: true,
    confirmRemove: mock(),
    isRemoving: false,
    isRenaming: false,
    name: "Intro",
    onNameChange: mock(),
    onRenameSubmit: mock(),
    openRemove: mock(),
    openRename: mock(),
    register: mock(),
    setRemoving: mock(),
    setRenaming: mock(),
    ...overrides,
  };
}

function VideoRow({ menu }: { menu: VideoMenu }) {
  const row = useVideoRowMenu(VIDEO, menu);
  return (
    <button onKeyDown={row.onKeyDown} type="button">
      Intro
    </button>
  );
}

describe("useChatRowMenu", () => {
  it("deletes the focused chat on ⌘⌫ through the row's own delete", () => {
    const onDelete = mock();
    render(<ChatRow canDelete onDelete={onDelete} />);

    fireEvent.keyDown(screen.getByRole("button", { name: "Chat" }), {
      key: "Backspace",
      metaKey: true,
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("leaves a plain Backspace alone", () => {
    const onDelete = mock();
    render(<ChatRow canDelete onDelete={onDelete} />);

    fireEvent.keyDown(screen.getByRole("button", { name: "Chat" }), {
      key: "Backspace",
    });

    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("useVideoRowMenu", () => {
  it("renames on F2 and asks to delete on ⌘⌫", () => {
    const menu = videoMenu();
    render(<VideoRow menu={menu} />);
    const row = screen.getByRole("button", { name: "Intro" });

    fireEvent.keyDown(row, { key: "F2" });
    expect(menu.openRename).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(row, { key: "Backspace", metaKey: true });
    expect(menu.openRemove).toHaveBeenCalledTimes(1);
  });
});

describe("the row shortcuts on Linux", () => {
  afterEach(() => {
    withAgent(MAC);
  });

  it("deletes a chat and asks to delete a video on Ctrl+Backspace", () => {
    withAgent(LINUX);
    const onDelete = mock();
    const menu = videoMenu();
    render(
      <>
        <ChatRow canDelete onDelete={onDelete} />
        <VideoRow menu={menu} />
      </>
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Chat" }), {
      key: "Backspace",
      metaKey: true,
    });
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("button", { name: "Chat" }), {
      ctrlKey: true,
      key: "Backspace",
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Intro" }), {
      ctrlKey: true,
      key: "Delete",
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(menu.openRemove).toHaveBeenCalledTimes(1);
  });
});
