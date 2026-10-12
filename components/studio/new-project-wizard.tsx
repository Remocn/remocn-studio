"use client";

import { useCallback } from "react";

import { FolderOpenIcon } from "@/components/icons";
import { MiddleTruncation } from "@/components/middle-truncation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewProject } from "@/hooks/use-new-project";
import { FormatPicker } from "./format-picker";

const RATIO_LABEL = "new-project-ratio";

export function NewProjectWizard({ control }: { control: NewProject }) {
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        control.close();
      }
    },
    [control.close]
  );
  return (
    <Dialog onOpenChange={onOpenChange} open={control.isOpen}>
      <DialogPopup
        bottomStickOnMobile={false}
        className="@container max-w-[816px] overflow-y-auto p-7"
      >
        <DialogHeader className="gap-1.5 p-0 pr-8">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Give it a name, choose a folder and set the format for your first
            video.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-7.5 flex min-w-0 flex-col gap-8"
          onSubmit={control.onSubmit}
        >
          <div className="grid @min-[632px]:grid-cols-[minmax(0,280fr)_minmax(0,456fr)] grid-cols-1 gap-6">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="new-project-name">Name</Label>
              <Input
                autoComplete="off"
                autoFocus
                data-1p-ignore
                data-lpignore="true"
                id="new-project-name"
                onChange={control.onNameChange}
                placeholder="launch-film"
                size="lg"
                spellCheck="false"
                value={control.name}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="new-project-location">Location</Label>
              <Button
                className="w-full min-w-0 justify-start bg-field font-normal"
                id="new-project-location"
                onClick={control.pickParent}
                size="lg"
                variant="outline"
              >
                <FolderOpenIcon />
                <MiddleTruncation className="min-w-0 flex-1 text-left font-mono text-xs">
                  {control.parent ?? "Choose a folder…"}
                </MiddleTruncation>
                <span className="shrink-0 text-muted-foreground text-xs">
                  Browse…
                </span>
              </Button>
            </div>
          </div>
          <FormatPicker
            id={RATIO_LABEL}
            onChange={control.onFormatChange}
            value={control.format}
          />
          <div className="mt-1 flex justify-end gap-2">
            <Button onClick={control.close} size="lg" variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={!control.canCreate}
              size="lg"
              type="submit"
              variant="key-action"
            >
              Create project
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
