"use client";

import {
  EllipsisIcon,
  PencilLineIcon,
  PlugZapIcon,
  Trash2Icon,
} from "@/components/icons";
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
import type { VideoMenu as Menu } from "@/hooks/use-video-menu";
import type { Video } from "@/shared/ipc";

export function VideoMenu({ menu, video }: { menu: Menu; video: Video }) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Options for ${video.name}`}
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
          {/* Only offered for a video the compiled project does not render —
              it writes the studio's scan into the person's own entry point,
              which is a thing to press, never a thing to do for them. */}
          {video.missing ? (
            <DropdownMenuItem onClick={menu.register}>
              <PlugZapIcon />
              Register in this project
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={menu.openRemove} variant="destructive">
            <Trash2Icon />
            Delete video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={menu.setRenaming} open={menu.isRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename video</DialogTitle>
          </DialogHeader>

          <form className="contents" onSubmit={menu.onRenameSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`rename-video-${video.id}`}>Name</Label>
              <Input
                autoFocus
                id={`rename-video-${video.id}`}
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
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {video.name}?</AlertDialogTitle>
            {/* The files stay: deleting here forgets the video and its chats,
                and Undo brings both back. Removing the code is something to
                ask for in a chat. */}
            <AlertDialogDescription>
              It leaves the list with its chats. The files in the project are
              left exactly as they are, and Undo brings the video back.
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
              Delete
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
