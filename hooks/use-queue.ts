"use client";

import type { MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import type { Composer } from "@/hooks/use-composer";
import type { OpenTurn } from "@/hooks/use-open-turn";
import type { QueuedMessage } from "@/lib/studio/turns";

export interface Queue {
  canEdit: boolean;
  items: readonly QueuedMessage[];
  onEdit: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function useQueue(turn: OpenTurn, composer: Composer): Queue {
  const { queue, removeQueued } = turn;
  const { isEmpty, restore } = composer;

  const onRemove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      removeQueued(event.currentTarget.value);
    },
    [removeQueued]
  );

  const onEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const found = queue.find(
        (message) => message.id === event.currentTarget.value
      );
      if (!isEmpty || found === undefined) {
        return;
      }

      removeQueued(found.id);
      restore(found);
    },
    [isEmpty, queue, removeQueued, restore]
  );

  return useMemo(
    () => ({ canEdit: isEmpty, items: queue, onEdit, onRemove }),
    [isEmpty, onEdit, onRemove, queue]
  );
}
