"use client";

import { DownloadIcon, FolderOpenIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidecarStatus } from "./sidecar-status";
import { useStudio } from "./studio-provider";

export function TitleBar() {
  const { activeProject, folderError, openFolder } = useStudio();

  return (
    <header
      className="flex h-11 shrink-0 items-center gap-2 border-b bg-sidebar pr-2 pl-(--titlebar-leading-inset)"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 flex-1 items-center" data-tauri-drag-region>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-invalid={folderError !== null}
                className="min-w-0 max-w-full"
                onClick={openFolder}
                size="sm"
                variant="ghost"
              />
            }
          >
            <FolderOpenIcon data-icon="inline-start" />
            <span className="truncate">
              {activeProject?.name ?? "Open folder"}
            </span>
          </TooltipTrigger>
          <TooltipContent align="start" side="bottom">
            <span className="break-all">
              {folderError ??
                activeProject?.path ??
                "Choose a Remotion project"}
            </span>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex shrink-0 items-center" data-tauri-drag-region>
        {activeProject ? (
          <Badge className="font-mono" variant="outline">
            Main
          </Badge>
        ) : null}
      </div>

      <div
        className="flex min-w-0 flex-1 items-center justify-end gap-2"
        data-tauri-drag-region
      >
        <SidecarStatus />

        <Button disabled size="sm" variant="outline">
          <DownloadIcon data-icon="inline-start" />
          Export
        </Button>
      </div>
    </header>
  );
}
