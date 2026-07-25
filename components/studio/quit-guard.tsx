"use client";

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
import { useQuitGuard } from "@/hooks/use-quit-guard";
import { useStudio } from "./studio-provider";

export function QuitGuard() {
  const { hasRunningTurns } = useStudio();
  const guard = useQuitGuard(hasRunningTurns);

  return (
    <AlertDialog onOpenChange={guard.setAsking} open={guard.isAsking}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quit while Claude is working?</AlertDialogTitle>
          <AlertDialogDescription>
            Turns still running are stopped where they are. Whatever has already
            been written to disk stays; the block being streamed is lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep working</AlertDialogCancel>
          <AlertDialogAction onClick={guard.quitAnyway} variant="destructive">
            Quit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
