"use client";

import type { MouseEvent } from "react";
import { memo, useId } from "react";
import {
  ChevronRight,
  CircleAlertIcon,
  CircleQuestionMarkIcon,
  ClapperboardIcon,
  FileQuestionIcon,
  SquarePenIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DotmSquare1 } from "@/components/ui/dotm-square-1";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVideoRowMenu } from "@/hooks/use-row-menus";
import { useVideoMenu, type VideoCommands } from "@/hooks/use-video-menu";
import { useVisibleSessions } from "@/hooks/use-visible-sessions";
import type { Rollup as GroupRollup, PaneGroup } from "@/lib/studio/groups";
import { cn } from "@/lib/utils";
import { SessionItem } from "./session-item";
import { VideoMenu } from "./video-menu";

function VideoGroupBlock({
  activeSessionId,
  commands,
  compact = false,
  group,
  isExpanded,
  now,
  onNewSession,
  onOpen,
  onRemoveSession,
  onSelectSession,
  onToggle,
}: {
  activeSessionId: string | null;
  commands: VideoCommands;
  compact?: boolean;
  group: PaneGroup;
  isExpanded: boolean;
  now: number;
  onNewSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemoveSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onSelectSession: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { hidden, isFull, toggle, visible } = useVisibleSessions(group);
  const { video } = group;
  const panelId = useId();
  const rows = compact
    ? group.rows.toSorted((a, b) => b.session.updatedAt - a.session.updatedAt)
    : visible;
  const menu = useVideoMenu(video, commands);
  const rowMenu = useVideoRowMenu(video, menu);

  return (
    <SidebarMenuItem data-video-row>
      {/* The row opens the video's most recent chat; the chevron beside it
          expands the list. They were the same click, so a video could look
          selected — expanded and highlighted — while an unrelated chat drove
          the preview, the conventions and Export, which is the divergence
          "the open chat determines everything" exists to prevent. */}
      <SidebarMenuButton
        aria-keyshortcuts="F2 Meta+Backspace"
        className={cn(
          "pr-20 font-medium hover:bg-accent active:bg-accent",
          compact && "h-7 gap-2 px-2 pr-20 font-normal"
        )}
        data-row-action="open"
        onClick={onOpen}
        onContextMenu={rowMenu.onContextMenu}
        onKeyDown={rowMenu.onKeyDown}
        value={video.id}
      >
        {/* Only the name dims for a video the bundle no longer names: its
            chats are still worth reading, so the chevron and the menu keep
            full contrast. */}
        {compact ? <ClapperboardIcon className="size-4 shrink-0" /> : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            video.missing && "text-sidebar-foreground/70"
          )}
        >
          {video.name}
        </span>
        {video.missing ? (
          <Tooltip>
            <TooltipTrigger render={<span className="shrink-0" />}>
              <FileQuestionIcon className="size-3 text-muted-foreground" />
              <span className="sr-only">
                Nothing in this project renders {video.compositionId} anymore
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Nothing in this project renders {video.compositionId} anymore
            </TooltipContent>
          </Tooltip>
        ) : null}
        {isExpanded ? null : <Rollup rollup={group.rollup} />}
      </SidebarMenuButton>

      <div
        className={cn(
          "absolute top-1 right-1 flex items-center",
          compact && "top-0.5 gap-0.5"
        )}
      >
        {/* `has-[[data-popup-open]]` keeps the cluster visible while its menu
            is open: the popup is portalled, so hover and focus-within both
            read false the moment it opens. The chevron sits outside it, at the
            row's own right edge, because it is not a hover affordance — it is
            the other half of the gesture. */}
        <div className="flex items-center gap-[inherit] opacity-0 pointer-coarse:opacity-100 focus-within:opacity-100 group-hover/menu-item:opacity-100 has-[[data-popup-open]]:opacity-100">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={`New chat about ${video.name}`}
                  className="relative after:absolute after:-inset-y-1 after:right-0 after:-left-1"
                  data-row-action="new-chat"
                  disabled={video.missing}
                  onClick={onNewSession}
                  size="icon-xs"
                  value={video.id}
                  variant="ghost"
                />
              }
            >
              <SquarePenIcon />
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat here</TooltipContent>
          </Tooltip>

          <VideoMenu menu={menu} video={video} />
        </div>

        <Button
          aria-controls={panelId}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Hide" : "Show"} the chats about ${video.name}`}
          className="relative text-muted-foreground/70 after:absolute after:-inset-1"
          onClick={onToggle}
          size="icon-xs"
          value={video.id}
          variant="ghost"
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform duration-fast ease-out",
              isExpanded && "rotate-90"
            )}
          />
        </Button>
      </div>

      {isExpanded ? (
        // `role="list"` survives preflight's list-style:none, which WKWebView
        // otherwise takes as a reason to drop list semantics entirely.
        <SidebarMenuSub
          className={cn(
            "mx-0 translate-x-0 gap-0.5 border-l-0 px-0",
            compact && "ml-3 gap-0 border-l pl-1"
          )}
          id={panelId}
          role="list"
        >
          {rows.map((row) => (
            <SidebarMenuSubItem key={row.session.id}>
              <SessionItem
                compact={compact}
                isActive={row.session.id === activeSessionId}
                now={now}
                onRemove={onRemoveSession}
                onSelect={onSelectSession}
                row={row}
              />
            </SidebarMenuSubItem>
          ))}

          {group.rows.length === 0 ? (
            <SidebarMenuSubItem className="py-1.5 pr-2 pl-7 text-muted-foreground text-xs">
              No chats yet
            </SidebarMenuSubItem>
          ) : null}

          {!compact && (hidden > 0 || isFull) ? (
            <SidebarMenuSubItem>
              <Button
                className="w-full justify-start pl-7 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
                onClick={toggle}
                size="sm"
                variant="ghost"
              >
                {hidden > 0 ? `Show ${hidden} more` : "Show less"}
              </Button>
            </SidebarMenuSubItem>
          ) : null}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}

export const VideoGroup = memo(VideoGroupBlock);

const ROLLUP_WORD: Record<GroupRollup["status"], string> = {
  failed: "failed",
  running: "running",
  unread: "unread",
  waiting: "waiting",
};

function Rollup({ rollup }: { rollup: GroupRollup | null }) {
  if (rollup === null) {
    return null;
  }

  const { count, status } = rollup;
  const label = `${count} ${count === 1 ? "chat" : "chats"} ${ROLLUP_WORD[status]}`;

  return (
    <span
      aria-label={label}
      className="flex shrink-0 items-center gap-1 font-normal text-2xs text-muted-foreground tabular-nums"
      role="img"
    >
      {status === "waiting" ? (
        <>
          <CircleQuestionMarkIcon className="size-4 shrink-0 text-sidebar-primary" />
          <span aria-hidden="true">{count}</span>
        </>
      ) : null}
      {status === "running" ? (
        <DotmSquare1
          ariaLabel=""
          className="shrink-0"
          colorPreset="grad-prism"
          dotSize={2}
          size={16}
        />
      ) : null}
      {status === "failed" ? (
        <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
      ) : null}
      {status === "unread" ? (
        <>
          <span className="size-2 shrink-0 rounded-full bg-sidebar-primary" />
          <span aria-hidden="true">{count}</span>
        </>
      ) : null}
    </span>
  );
}
