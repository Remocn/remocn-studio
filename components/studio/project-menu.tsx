"use client";

import {
  EllipsisIcon,
  FolderSearchIcon,
  PencilLineIcon,
  Trash2Icon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ProjectCommands, useProjectMenu } from "@/hooks/use-project-menu";
import type { Project } from "@/shared/ipc";

export function ProjectMenu({
  commands,
  project,
}: {
  commands: ProjectCommands;
  project: Project;
}) {
  const menu = useProjectMenu(project, commands);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Options for ${project.name}`}
              className="relative after:absolute after:-inset-y-1 after:-right-1 after:left-0"
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={menu.openRename}>
            <PencilLineIcon />
            Rename…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={menu.locate}>
            <FolderSearchIcon />
            {project.missing ? "Locate…" : "Move…"}
          </DropdownMenuItem>
          {project.missing ? null : (
            <DropdownMenuItem onClick={menu.reveal}>
              <FolderSearchIcon />
              Reveal in Finder
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={menu.openRemove} variant="destructive">
            <Trash2Icon />
            Remove from studio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={menu.setRenaming} open={menu.isRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription className="break-all">
              {project.path}
            </DialogDescription>
          </DialogHeader>

          <form className="contents" onSubmit={menu.onRenameSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`rename-${project.id}`}>Name</Label>
              <Input
                autoFocus
                id={`rename-${project.id}`}
                onChange={menu.onNameChange}
                value={menu.name}
              />
            </div>

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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its sessions and their transcripts go with it. The folder on disk
              is left exactly as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={menu.confirmRemove}
              variant="destructive"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
