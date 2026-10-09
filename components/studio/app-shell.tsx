"use client";
import { memo, useCallback } from "react";
import {
  type Layout,
  type LayoutChangedMeta,
  useDefaultLayout,
} from "react-resizable-panels";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightOpenIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { AnchoredToastProvider, ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFrozenWidth } from "@/hooks/use-frozen-width";
import { usePlatformAttribute } from "@/hooks/use-platform";
import { usePreviewCollapse } from "@/hooks/use-preview-collapse";
import { usePreviewRoom } from "@/hooks/use-preview-room";
import {
  type SidebarCollapse,
  useSidebarCollapse,
} from "@/hooks/use-sidebar-collapse";
import { useSidebarPeek } from "@/hooks/use-sidebar-peek";
import { useBoot } from "@/hooks/use-splash";
import {
  CHAT_MIN_WIDTH,
  PREVIEW_MIN_WIDTH,
  panelIdsOf,
} from "@/lib/studio/panes";
import { layoutStorage } from "@/lib/studio/settings";
import { cn } from "@/lib/utils";
import { ChatPane } from "./chat-pane";
import { CrashBoundary } from "./crash-boundary";
import { OnboardingDialog } from "./onboarding-dialog";
import { PreviewPane } from "./preview-pane";
import { ProjectsPane } from "./projects-pane";
import { QuitGuard } from "./quit-guard";
import { SettingsPage } from "./settings-page";
import { SidebarSlide } from "./sidebar-slide";
import { Splash } from "./splash";
import { StudioProvider, useStudio, useStudioBoot } from "./studio-provider";
import { Titlebar } from "./titlebar";

const SHELL_LAYOUT_ID = "shell";

export function AppShell() {
  usePlatformAttribute();

  return (
    <CrashBoundary>
      <StudioBoot />
    </CrashBoundary>
  );
}

function StudioBoot() {
  const { isBooting, onGone } = useBoot();

  return (
    <StudioProvider splash={<BootSplash onGone={onGone} />}>
      <TooltipProvider delay={500}>
        <ToastProvider>
          <AnchoredToastProvider>
            <ShellLayout isBooting={isBooting} />
            <OnboardingDialog suspended={isBooting} />
            <QuitGuard />
          </AnchoredToastProvider>
        </ToastProvider>
      </TooltipProvider>
    </StudioProvider>
  );
}

function BootSplash({ onGone }: { onGone: () => void }) {
  return <Splash isSettled={useStudioBoot()} onGone={onGone} />;
}

const StillChatPane = memo(ChatPane);

const StillPreviewPane = memo(PreviewPane);

const PANE_SLIDE =
  "transition-[flex-grow] duration-base ease-out motion-reduce:transition-none";

const SIDEBAR_SLIDE = "ease-out motion-reduce:transition-none";

function slideDuration(isEntering: boolean): string {
  return isEntering ? "duration-base" : "duration-180";
}

/* The preview holds the compiled bundle in an iframe, and an iframe that
   changes size every frame of a pane slide is a cross-document layout plus
   the Player rescaling its canvas — the lag the sidebar collapse had. While
   either slide runs, the pane keeps the width it had, pinned to its static
   right edge and clipped, and reflows once when the animation settles. */
function FrozenPane({
  children,
  isFrozen,
}: {
  children: React.ReactNode;
  isFrozen: boolean;
}) {
  const frozen = useFrozenWidth(isFrozen);

  return (
    <div className="flex h-full w-full justify-end overflow-hidden">
      <div
        className={cn("h-full", frozen.width === null ? "w-full" : "shrink-0")}
        ref={frozen.ref}
        style={frozen.width === null ? undefined : { width: frozen.width }}
      >
        {children}
      </div>
    </div>
  );
}

function ShellPanes({
  className,
  isSliding,
}: {
  className?: string;
  isSliding: boolean;
}) {
  const { hidePreview, isChatPeeking, isChatShown, isPreviewShown } =
    useStudio();
  const collapse = usePreviewCollapse(isPreviewShown, hidePreview);
  const chatPeek = useSidebarCollapse(isChatPeeking, isChatShown);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_LAYOUT_ID,
    onlySaveAfterUserInteractions: true,
    panelIds: panelIdsOf(true),
    storage: layoutStorage,
  });
  const room = usePreviewRoom({
    isShown: isPreviewShown,
    isSliding,
    onLayoutChanged,
    panelRef: collapse.panelRef,
  });
  const onLayout = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      collapse.onLayoutChanged(layout, meta);
      room.onLayoutChanged(layout, meta);
    },
    [collapse.onLayoutChanged, room.onLayoutChanged]
  );

  return (
    <ResizablePanelGroup
      className={cn("min-h-0", className)}
      defaultLayout={defaultLayout}
      elementRef={room.groupRef}
      onLayoutChanged={onLayout}
    >
      <ResizablePanel
        className={cn(
          "studio-boot-transition",
          collapse.isAnimating && PANE_SLIDE
        )}
        defaultSize="56%"
        groupResizeBehavior={
          isPreviewShown ? "preserve-pixel-size" : "preserve-relative-size"
        }
        id="chat"
        maxSize={isChatShown ? "100%" : "0px"}
        minSize={isChatShown ? `${CHAT_MIN_WIDTH}px` : "0px"}
      >
        <div
          className={cn(
            "h-full",
            !isChatShown && [
              "motion-reduce:translate-none absolute inset-y-0 left-0 z-30 w-[min(26rem,calc(100%-3rem))] bg-background transition-[translate] ease-out motion-reduce:transition-opacity",
              slideDuration(chatPeek.isExpanded),
              chatPeek.isExpanded
                ? "translate-x-0"
                : "-translate-x-full motion-reduce:opacity-0",
              !chatPeek.isMounted && "invisible",
            ]
          )}
          inert={!(isChatShown || isChatPeeking)}
          onTransitionEnd={chatPeek.onTransitionEnd}
        >
          <StillChatPane />
        </div>
      </ResizablePanel>
      <ResizableHandle
        className={cn(
          "studio-boot-transition bg-transparent transition-opacity duration-base",
          isPreviewShown && isChatShown ? "opacity-100" : "opacity-0"
        )}
        disabled={!(isPreviewShown && isChatShown)}
      />
      <ResizablePanel
        className={cn(collapse.isAnimating && PANE_SLIDE)}
        collapsedSize="0%"
        collapsible
        defaultSize="44%"
        id="preview"
        minSize={`${PREVIEW_MIN_WIDTH}px`}
        panelRef={collapse.panelRef}
      >
        {collapse.isMounted ? (
          <FrozenPane isFrozen={isSliding || collapse.isAnimating}>
            <StillPreviewPane />
          </FrozenPane>
        ) : null}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function ShellLayout({ isBooting }: { isBooting: boolean }) {
  const {
    hasProjectsRoom,
    isProjectsShown,
    isLibraryOpen,
    mood,
    preferences,
    projects,
    settingsView,
  } = useStudio();
  const collapse = useSidebarCollapse(
    isProjectsShown || isLibraryOpen,
    hasProjectsRoom
  );
  return (
    <div
      className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-sidebar"
      data-studio-booting={isBooting ? "true" : undefined}
    >
      <div className="absolute inset-x-0 top-0">
        <Titlebar
          className="h-[46px]"
          isBooting={isBooting}
          isStill={!preferences.titlebarMotion}
          mood={
            projects.length === 0 || !preferences.titlebarShader ? null : mood
          }
        />
      </div>
      <WindowSidebarToggle />
      <div
        className={cn(
          "studio-boot-transition relative z-10 grid min-h-0 flex-1",
          collapse.isAnimating && [
            "transition-[grid-template-columns]",
            SIDEBAR_SLIDE,
            slideDuration(collapse.isExpanded),
          ],
          collapse.isExpanded
            ? "grid-cols-[238px_minmax(0,1fr)]"
            : "grid-cols-[0rem_minmax(0,1fr)]"
        )}
        data-tauri-drag-region
        inert={settingsView.isOpen || undefined}
        onTransitionEnd={collapse.onTransitionEnd}
      >
        <SidebarSlot collapse={collapse} />
        <div
          className={cn(
            "studio-boot-transition relative mt-[46px] mr-2 mb-2 flex min-h-0 min-w-0 overflow-hidden rounded-2xl bg-background",
            collapse.isAnimating && [
              "transition-[margin]",
              SIDEBAR_SLIDE,
              slideDuration(collapse.isExpanded),
            ],
            isProjectsShown ? "ml-0" : "ml-2"
          )}
          data-slot="workspace-content"
        >
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <ShellPanes className="flex-1" isSliding={collapse.isAnimating} />
            <ShowPreviewButton />
          </div>
        </div>
      </div>
      <SettingsPage />
    </div>
  );
}

function SidebarSlot({ collapse }: { collapse: SidebarCollapse }) {
  const {
    isProjectsPeeking,
    isProjectsShown,
    isLibraryOpen,
    peekProjects,
    settingsView,
  } = useStudio();
  const isDocked = collapse.isMounted;
  const peek = useSidebarCollapse(isProjectsPeeking);
  const hover = useSidebarPeek(isProjectsPeeking, peekProjects);
  let pane: React.ReactNode = null;
  if (isDocked) {
    pane = (
      <div
        className={cn(
          "mt-[46px] w-[238px] shrink-0",
          collapse.isAnimating && [
            "motion-reduce:translate-none starting:-translate-x-full transition-[translate]",
            SIDEBAR_SLIDE,
            slideDuration(collapse.isExpanded),
          ],
          collapse.isExpanded ? "translate-x-0" : "-translate-x-full"
        )}
        inert={!(isProjectsShown || isLibraryOpen)}
      >
        <SidebarSlide
          animate={settingsView.animate}
          offset={settingsView.isOpen ? -1 : 0}
        >
          <ProjectsPane />
        </SidebarSlide>
      </div>
    );
  } else if (peek.isMounted) {
    pane = (
      <div
        className={cn(
          "motion-reduce:translate-none absolute top-[46px] bottom-2 left-2 z-40 w-[238px] starting:-translate-x-[calc(100%+1rem)] overflow-hidden rounded-2xl bg-sidebar transition-[translate] ease-out motion-reduce:starting:opacity-0 motion-reduce:transition-opacity",
          slideDuration(peek.isExpanded),
          peek.isExpanded
            ? "translate-x-0"
            : "-translate-x-[calc(100%+1rem)] motion-reduce:opacity-0"
        )}
        data-tauri-drag-region
        inert={!isProjectsPeeking}
        onPointerDown={hover.onPanelPointerDown}
        onPointerEnter={hover.onPanelEnter}
        onPointerLeave={hover.onPanelLeave}
        onTransitionEnd={peek.onTransitionEnd}
      >
        <ProjectsPane />
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 overflow-hidden" data-tauri-drag-region>
        {pane}
      </div>

      {isProjectsShown ? null : (
        <div
          aria-hidden="true"
          className="absolute top-[46px] bottom-0 left-0 z-20 w-3"
          onPointerEnter={hover.onEdgeEnter}
          onPointerLeave={hover.onEdgeLeave}
        />
      )}
    </>
  );
}

function ShowPreviewButton() {
  const { isPreviewShown, openedProject, togglePreview } = useStudio();

  if (openedProject === null) {
    return null;
  }

  return (
    <div
      aria-hidden={isPreviewShown}
      className={cn(
        "studio-boot-transition absolute top-0 right-2 flex h-10 items-center transition-opacity duration-fast ease-out",
        isPreviewShown ? "pointer-events-none opacity-0" : "opacity-100"
      )}
      inert={isPreviewShown}
    >
      <Button
        aria-expanded={isPreviewShown}
        aria-label="Show the preview"
        onClick={togglePreview}
        size="sm"
      >
        <PanelRightOpenIcon data-icon="inline-start" />
        Preview
      </Button>
    </div>
  );
}

function WindowSidebarToggle() {
  const { isProjectsShown, isLibraryOpen, toggleProjects, settingsView } =
    useStudio();
  return (
    <div className="absolute top-[6px] left-[92px] z-20 flex h-[46px] items-center">
      <Button
        aria-label={
          isProjectsShown ? "Hide the project list" : "Show the project list"
        }
        disabled={settingsView.isOpen || isLibraryOpen}
        onClick={toggleProjects}
        size="icon-sm"
        variant="ghost"
      >
        {isProjectsShown ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
      </Button>
    </div>
  );
}
