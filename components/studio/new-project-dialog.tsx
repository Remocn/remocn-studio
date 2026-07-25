"use client";

import { FolderOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewProject } from "@/hooks/use-new-project";

export function NewProjectDialog({ control }: { control: NewProject }) {
  return (
    <Dialog onOpenChange={control.setOpen} open={control.isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A folder is created for it. Claude writes the Remotion project
            inside.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              autoFocus
              id="new-project-name"
              onChange={control.onNameChange}
              placeholder="launch-film"
              value={control.name}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Location</Label>
            <Button
              className="justify-start font-normal"
              onClick={control.pickParent}
              variant="outline"
            >
              <FolderOpenIcon data-icon="inline-start" />
              <span className="truncate">
                {control.parent ?? "Choose a folder…"}
              </span>
            </Button>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={!control.canCreate} onClick={control.submit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
