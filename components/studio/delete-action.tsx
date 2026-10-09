"use client";

import type { PointerEvent } from "react";
import { Trash2Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DeletionTarget } from "@/hooks/use-deletion";

function keepFocus(event: PointerEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export function DeleteAction({
  onDelete,
  target,
}: {
  onDelete: () => void;
  target: DeletionTarget | null;
}) {
  if (target === null) {
    return null;
  }
  const refused = target.reason !== null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-disabled={refused || undefined}
            aria-label={target.label}
            className="text-muted-foreground aria-disabled:cursor-default aria-disabled:opacity-50"
            onClick={refused ? undefined : onDelete}
            onPointerDown={keepFocus}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <Trash2Icon />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {target.reason ?? target.label}
      </TooltipContent>
    </Tooltip>
  );
}
