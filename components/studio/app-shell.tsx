"use client";
import { useDefaultLayout } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { shellMood } from "@/lib/studio/mood";
import { panelIdsOf } from "@/lib/studio/panes";
import { layoutStorage } from "@/lib/studio/settings";
import { cn } from "@/lib/utils";
import { ChatPane } from "./chat-pane";
import { PreviewPane } from "./preview-pane";
import { ProjectsPane } from "./projects-pane";
import { QuitGuard } from "./quit-guard";
import { StudioProvider, useStudio } from "./studio-provider";
import { Titlebar } from "./titlebar";

const SHELL_LAYOUT_ID = "shell";

export function AppShell() {
  return (
    <StudioProvider>
      <TooltipProvider delay={500}>
        <Toaster>
          <ShellLayout />
          <QuitGuard />
        </Toaster>
      </TooltipProvider>
    </StudioProvider>
  );
}

function ShellPanes({ className }: { className?: string }) {
  const { isPreviewShown } = useStudio();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_LAYOUT_ID,
    onlySaveAfterUserInteractions: true,
    panelIds: panelIdsOf(isPreviewShown),
    storage: layoutStorage,
  });

  return (
    <ResizablePanelGroup
      className={cn("min-h-0", className)}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel defaultSize="56%" id="chat" minSize="380px">
        <ChatPane />
      </ResizablePanel>

      {isPreviewShown ? (
        <>
          <ResizableHandle className="bg-pane-border" />

          <ResizablePanel defaultSize="44%" id="preview" minSize="360px">
            <PreviewPane />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}

function ShellLayout() {
  const { isProjectsShown, projects, turns } = useStudio();

  return (
    <div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-sidebar">
      {/* The band belongs to the window, not the sidebar: it runs the full
          width underneath, and the content card rides over it — so there is
          no seam where the sidebar ends. */}
      <div className="absolute inset-x-0 top-0">
        <Titlebar
          className="h-24"
          mood={projects.length === 0 ? null : shellMood(turns)}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* The sidebar is not a panel: it holds fixed-width rows and a card
            grid that gain nothing from resizing, so it only ever collapses —
            one width, no handle, nothing for the layout store to remember.
            Its top offset tucks the brand row under the traffic lights,
            inside the band's glow. */}
        {isProjectsShown ? (
          <div className="mt-8 w-72 shrink-0">
            <ProjectsPane />
          </div>
        ) : null}

        <div
          className={cn(
            "my-2 mr-2 flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-pane-border bg-background",
            isProjectsShown ? "ml-0" : "ml-2"
          )}
        >
          <ShellPanes className="flex-1" />
        </div>
      </div>
    </div>
  );
}
