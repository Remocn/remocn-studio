"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  type Variants,
} from "motion/react";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDownIcon,
  PlusIcon,
  TimeQuarter02Icon,
  UnfoldLessIcon,
  UnfoldMoreIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenu } from "@/components/ui/sidebar";
import { useNavigationMotion } from "@/hooks/use-navigation-motion";
import { useNow } from "@/hooks/use-now";
import type { VideoCommands } from "@/hooks/use-video-menu";
import type { PaneGroup } from "@/lib/studio/groups";
import { cn } from "@/lib/utils";
import { ProjectScaffolding } from "./project-scaffolding";
import { useStudio } from "./studio-provider";
import { VideoGroup } from "./video-group";

export function WorkspaceLists() {
  const {
    actionError,
    folderError,
    activeProject,
    activeSession,
    closeLibrary,
    isLibraryOpen,
    newVideo,
    onRemoveSession,
    onSelectSession,
    groups,
    expandedVideos,
    setVideosExpanded: setVideoChatsExpanded,
    onToggleVideo,
    onOpenVideo,
    onNewSession,
    registerVideo,
    removeVideo,
    renameVideo,
    videosError,
    isLoadingVideos,
    reloadVideos,
    sessionsError,
    projectsError,
    reloadSessions,
    reloadProjects,
  } = useStudio();
  const paneError = actionError ?? folderError;
  const now = useNow();
  const shouldAnimate = useNavigationMotion();
  const navigation = { animate: shouldAnimate(), direction: 1 };
  const retry = useCallback(() => {
    reloadSessions();
    reloadProjects();
    reloadVideos();
  }, [reloadSessions, reloadProjects, reloadVideos]);
  const [videosExpanded, setVideosExpanded] = useState(true);
  const [videosOpen, setVideosOpen] = useState(false);
  const videoViewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (activeProject?.id && videoViewport.current) {
      videoViewport.current.scrollTop = 0;
    }
  }, [activeProject?.id]);
  const toggleVideos = useCallback(
    () => setVideosExpanded((value) => !value),
    []
  );
  const onChat = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      setVideosOpen(false);
      closeLibrary();
      onSelectSession(event);
    },
    [closeLibrary, onSelectSession]
  );
  const onVideo = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      setVideosOpen(false);
      closeLibrary();
      onOpenVideo(event);
    },
    [closeLibrary, onOpenVideo]
  );
  const onNewChat = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      setVideosOpen(false);
      closeLibrary();
      onNewSession(event);
    },
    [closeLibrary, onNewSession]
  );
  const videoCommands: VideoCommands = useMemo(
    () => ({ registerVideo, removeVideo, renameVideo }),
    [registerVideo, removeVideo, renameVideo]
  );
  const projectGroups = useMemo(
    () => groups.filter((group) => group.video.projectId === activeProject?.id),
    [groups, activeProject?.id]
  );
  const hasExpandedChats = projectGroups.some((group) =>
    expandedVideos.has(group.video.id)
  );
  const toggleAllChats = useCallback(() => {
    setVideoChatsExpanded(
      projectGroups.map((group) => group.video.id),
      !hasExpandedChats
    );
    setVideosExpanded(true);
  }, [projectGroups, hasExpandedChats, setVideoChatsExpanded]);
  const toggleAllLabel = hasExpandedChats
    ? "Collapse all chats"
    : "Expand all chats";
  const renderVideo = (group: PaneGroup) => (
    <VideoGroup
      activeSessionId={isLibraryOpen ? null : (activeSession?.id ?? null)}
      commands={videoCommands}
      compact
      group={group}
      isExpanded={expandedVideos.has(group.video.id)}
      key={group.video.id}
      now={now}
      onNewSession={onNewChat}
      onOpen={onVideo}
      onRemoveSession={onRemoveSession}
      onSelectSession={onChat}
      onToggle={onToggleVideo}
    />
  );
  const emptyVideos = activeProject
    ? "No videos in this project yet."
    : "Select a project to see its videos.";
  const videoMessage = isLoadingVideos ? "Loading videos…" : emptyVideos;
  const videoList =
    projectGroups.length > 0 ? (
      <SidebarMenu className="gap-1">
        {projectGroups.map(renderVideo)}
      </SidebarMenu>
    ) : (
      <p className="px-2 py-2 text-muted-foreground text-xs">{videoMessage}</p>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4">
      {sessionsError || projectsError || videosError ? (
        <div
          className="shrink-0 px-2 pb-4 text-muted-foreground text-xs"
          role="status"
        >
          <p>History is unavailable</p>
          <Button
            className="mt-2"
            onClick={retry}
            size="xs"
            variant="secondary"
          >
            Try again
          </Button>
        </div>
      ) : null}
      {paneError === null ? null : (
        <p
          className="shrink-0 break-words px-2 py-2 text-destructive text-xs"
          role="alert"
        >
          {paneError}
        </p>
      )}
      <ProjectScaffolding />
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        data-workspace-lists
      >
        <section aria-label="Videos" className="flex min-h-0 flex-1 flex-col">
          <div className="workspace-scrollbar shrink-0 overflow-y-auto overflow-x-hidden">
            <div className="flex h-6 items-center justify-between pr-1.5">
              <GroupToggle
                expanded={videosExpanded}
                label="Toggle videos"
                onClick={toggleVideos}
              >
                Videos
              </GroupToggle>
              <div className="flex items-center gap-0.5">
                <Button
                  aria-label={toggleAllLabel}
                  disabled={projectGroups.length === 0}
                  onClick={toggleAllChats}
                  size="icon-xs"
                  title={toggleAllLabel}
                  variant="ghost"
                >
                  {hasExpandedChats ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                </Button>
                <HistoryPopover
                  label="All videos"
                  onOpenChange={setVideosOpen}
                  open={videosOpen}
                >
                  {videoList}
                </HistoryPopover>
                <Button
                  aria-label="New video"
                  disabled={activeProject === null || activeProject.missing}
                  onClick={newVideo.open}
                  size="icon-xs"
                  title="New video"
                  variant="ghost"
                >
                  <PlusIcon />
                </Button>
              </div>
            </div>
          </div>
          {videosExpanded ? (
            <div className="flex min-h-0 flex-1 flex-col pt-1">
              <div
                className="workspace-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                ref={videoViewport}
              >
                <AnimatePresence custom={navigation} initial={false}>
                  <VideoListSlide
                    key={activeProject?.id ?? "none"}
                    motion={navigation}
                  >
                    {videoList}
                  </VideoListSlide>
                </AnimatePresence>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function GroupToggle({
  label,
  children,
  expanded,
  onClick,
}: {
  children: ReactNode;
  expanded: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-expanded={expanded}
      aria-label={label}
      className={GROUP}
      onClick={onClick}
      type="button"
    >
      {children}
      <ChevronDownIcon
        className={cn("size-3 shrink-0", !expanded && "-rotate-90")}
      />
    </button>
  );
}

function HistoryPopover({
  children,
  label,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={label}
            size="icon-xs"
            title={label}
            variant="ghost"
          />
        }
      >
        <TimeQuarter02Icon />
      </PopoverTrigger>
      <PopoverPopup
        align="start"
        className="workspace-history w-80 shadow-lg ring-1 ring-border [&_[data-slot=popover-viewport]]:max-h-[min(28rem,var(--available-height))] [&_[data-slot=popover-viewport]]:p-2 [&_[data-slot=popover-viewport]]:pr-0 [&_[data-slot=popover-viewport]]:[--viewport-inline-padding:--spacing(2)]"
        side="right"
        sideOffset={12}
      >
        <PopoverTitle className="px-2 pt-1 pb-2 font-medium text-muted-foreground text-xs">
          {label}
        </PopoverTitle>
        {children}
      </PopoverPopup>
    </Popover>
  );
}

const GROUP =
  "flex h-6 items-center gap-1 rounded-lg px-2 text-left text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-[-2px]";

interface VideoListMotion {
  animate: boolean;
  direction: number;
}

const VIDEO_LIST_VARIANTS: Variants = {
  enter: ({ animate, direction }: VideoListMotion) => ({
    opacity: animate ? 0 : 1,
    transform: `translateX(${animate ? direction * 12 : 0}px)`,
  }),
  exit: ({ animate, direction }: VideoListMotion) => ({
    opacity: 0,
    transform: `translateX(${animate ? direction * -12 : 0}px)`,
    transition: { duration: animate ? 0.12 : 0, ease: [0.32, 0.72, 0, 1] },
  }),
  visible: ({ animate }: VideoListMotion) => ({
    opacity: 1,
    transform: "translateX(0px)",
    transition: { duration: animate ? 0.18 : 0, ease: [0.32, 0.72, 0, 1] },
  }),
};

function VideoListSlide({
  children,
  motion: navigation,
}: {
  children: ReactNode;
  motion: VideoListMotion;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      animate="visible"
      aria-hidden={!present || undefined}
      className={cn(
        "w-full px-0.5",
        !present && "pointer-events-none absolute inset-x-0 top-0"
      )}
      custom={navigation}
      data-animate={navigation.animate}
      data-video-list
      exit="exit"
      inert={!present || undefined}
      initial="enter"
      variants={VIDEO_LIST_VARIANTS}
    >
      {children}
    </motion.div>
  );
}
