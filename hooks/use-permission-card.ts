"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type PermissionAction,
  permissionChoices,
} from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import type { SessionMode } from "@/shared/ipc";

export interface PermissionCard {
  first: RefObject<HTMLButtonElement | null>;
  onChoose: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function usePermissionCard(
  permission: PendingPermission,
  onAnswer: (
    id: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void
): PermissionCard {
  const first = useRef<HTMLButtonElement>(null);

  // Locking the composer drops focus on <body>; the ask is the thing to answer,
  // so the keyboard lands on it. The card is keyed by the ask's id where it is
  // rendered, so the next ask in the queue mounts fresh and takes focus too.
  useEffect(() => {
    first.current?.focus();
  }, []);

  const onChoose = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const chosen = permissionChoices(permission.reason).find(
        (choice) => choice.id === event.currentTarget.value
      );

      if (chosen !== undefined) {
        onAnswer(permission.id, chosen.action, chosen.mode);
      }
    },
    [onAnswer, permission]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") {
        return;
      }

      const declined = permissionChoices(permission.reason).find(
        (choice) => choice.action === "deny"
      );

      if (declined !== undefined) {
        event.preventDefault();
        onAnswer(permission.id, declined.action, declined.mode);
      }
    },
    [onAnswer, permission]
  );

  return useMemo(() => ({ first, onChoose, onKeyDown }), [onChoose, onKeyDown]);
}
