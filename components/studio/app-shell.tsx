"use client";

import { useDefaultLayout } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { panelIdsOf } from "@/lib/studio/panes";
import { layoutStorage } from "@/lib/studio/settings";
import { ChatPane } from "./chat-pane";
import { PreviewPane } from "./preview-pane";
import { ProjectsPane } from "./projects-pane";
import { QuitGuard } from "./quit-guard";
import { StudioProvider, useStudio } from "./studio-provider";

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

function ShellLayout() {
  const { isPreviewShown, isProjectsShown } = useStudio();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_LAYOUT_ID,
    onlySaveAfterUserInteractions: true,
    panelIds: panelIdsOf(isPreviewShown),
    storage: layoutStorage,
  });

  return (
    <div className="isolate flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1">
        {/* The sidebar is not a panel: it holds fixed-width rows and a card
            grid that gain nothing from resizing, so it only ever collapses —
            one width, no handle, nothing for the layout store to remember. */}
        {isProjectsShown ? (
          <div className="w-72 shrink-0 border-pane-border border-r">
            <ProjectsPane />
          </div>
        ) : null}

        <ResizablePanelGroup
          className="min-h-0 flex-1"
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
      </div>
    </div>
  );
}
