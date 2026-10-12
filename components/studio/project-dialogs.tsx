"use client";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectMenu } from "@/hooks/use-project-menu";
import type { Project } from "@/shared/ipc";

// The project's actions live in the native Project menu now; what stays in the
// webview is only what a native menu cannot draw — the rename form and the
// remove confirmation.
export function ProjectDialogs({
  menu,
  project,
}: {
  menu: ProjectMenu;
  project: Project | null;
}) {
  if (project === null) {
    return null;
  }

  return (
    <>
      <Dialog onOpenChange={menu.setRenaming} open={menu.isRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription className="break-words">
              {project.path}
            </DialogDescription>
          </DialogHeader>

          <form className="contents" onSubmit={menu.onRenameSubmit}>
            <DialogPanel className="flex flex-col gap-2">
              <Label htmlFor={`rename-${project.id}`}>Name</Label>
              <Input
                autoFocus
                id={`rename-${project.id}`}
                onChange={menu.onNameChange}
                value={menu.name}
              />
            </DialogPanel>

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button disabled={!menu.canRename} type="submit">
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={menu.setRemoving} open={menu.isRemoving}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its sessions and their transcripts go with it. The folder on disk
              is left exactly as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              Cancel
            </AlertDialogClose>
            <AlertDialogClose
              onClick={menu.confirmRemove}
              render={<Button variant="destructive" />}
            >
              Remove
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
