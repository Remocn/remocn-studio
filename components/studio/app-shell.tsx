"use client";

import { useDefaultLayout } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { layoutStorage } from "@/lib/studio/settings";
import { ChatPane } from "./chat-pane";
import { PreviewPane } from "./preview-pane";
import { ProjectsPane } from "./projects-pane";
import { StudioProvider } from "./studio-provider";
import { TitleBar } from "./title-bar";

const SHELL_LAYOUT_ID = "shell";

export function AppShell() {
  return (
    <StudioProvider>
      <TooltipProvider delay={500}>
        <ShellLayout />
      </TooltipProvider>
    </StudioProvider>
  );
}

function ShellLayout() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: SHELL_LAYOUT_ID,
    onlySaveAfterUserInteractions: true,
    storage: layoutStorage,
  });

  return (
    <div className="isolate flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <TitleBar />

      <ResizablePanelGroup
        className="min-h-0 flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <ResizablePanel
          defaultSize="240px"
          groupResizeBehavior="preserve-pixel-size"
          id="projects"
          maxSize="380px"
          minSize="200px"
        >
          <ProjectsPane />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="46%" id="chat" minSize="380px">
          <ChatPane />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize="36%" id="preview" minSize="360px">
          <PreviewPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
