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

        <form className="contents" onSubmit={control.onSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-project-name">Name</Label>
              {/* A folder name is a slug, not prose or an identity: spelling
                  suggestions, autofill and a password manager's overlay are all
                  noise on top of a field where they can never be right. */}
              <Input
                autoComplete="off"
                autoFocus
                data-1p-ignore
                data-lpignore="true"
                id="new-project-name"
                onChange={control.onNameChange}
                placeholder="launch-film"
                spellCheck="false"
                value={control.name}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="new-project-location">Location</Label>
              <Button
                className="justify-start font-normal"
                id="new-project-location"
                onClick={control.pickParent}
                type="button"
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
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button disabled={!control.canCreate} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
