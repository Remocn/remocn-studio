"use client";

import { Effect } from "effect";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import type { VideoMenu } from "@/hooks/use-video-menu";
import {
  type ContextAction,
  popupContextMenu,
} from "@/lib/studio/context-menu";
import { isModKey } from "@/lib/studio/platform";
import type { Video } from "@/shared/ipc";

export interface RowMenu {
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const ROW_ACTION = "data-row-action";

function presser(row: Element | null) {
  return (action: string) => () => {
    row
      ?.querySelector<HTMLButtonElement>(`[${ROW_ACTION}="${action}"]`)
      ?.click();
  };
}

function isDelete(event: KeyboardEvent<HTMLElement>): boolean {
  return (
    isModKey(event) &&
    !event.altKey &&
    !event.shiftKey &&
    (event.key === "Backspace" || event.key === "Delete")
  );
}

function show(actions: readonly ContextAction[]): void {
  Effect.runFork(Effect.ignore(popupContextMenu(actions)));
}

export function useVideoRowMenu(video: Video, menu: VideoMenu): RowMenu {
  const { missing } = video;
  const { openRemove, openRename, register } = menu;

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      const press = presser(event.currentTarget.closest("[data-video-row]"));
      show([
        { id: "open", run: press("open"), text: "Open" },
        {
          enabled: !missing,
          id: "new-chat",
          run: press("new-chat"),
          text: "New Chat",
        },
        {
          id: "rename",
          run: openRename,
          separatorBefore: true,
          text: "Rename…",
        },
        ...(missing
          ? [
              {
                id: "register",
                run: register,
                text: "Register in this project",
              },
            ]
          : []),
        {
          id: "delete",
          run: openRemove,
          separatorBefore: true,
          text: "Delete Video…",
        },
      ]);
    },
    [missing, openRemove, openRename, register]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "F2") {
        event.preventDefault();
        openRename();
        return;
      }
      if (isDelete(event)) {
        event.preventDefault();
        openRemove();
      }
    },
    [openRemove, openRename]
  );

  return useMemo(
    () => ({ onContextMenu, onKeyDown }),
    [onContextMenu, onKeyDown]
  );
}

export function useChatRowMenu(canDelete: boolean): RowMenu {
  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      const press = presser(event.currentTarget.closest("[data-chat-row]"));
      show([
        { id: "open", run: press("open"), text: "Open" },
        {
          enabled: canDelete,
          id: "delete",
          run: press("delete"),
          separatorBefore: true,
          text: "Delete Chat",
        },
      ]);
    },
    [canDelete]
  );

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!isDelete(event)) {
      return;
    }
    event.preventDefault();
    presser(event.currentTarget.closest("[data-chat-row]"))("delete")();
  }, []);

  return useMemo(
    () => ({ onContextMenu, onKeyDown }),
    [onContextMenu, onKeyDown]
  );
}
