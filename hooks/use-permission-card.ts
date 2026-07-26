"use client";

import { useCallback, useMemo } from "react";
import {
  type PermissionAction,
  permissionChoices,
} from "@/lib/studio/permission";
import type { PendingPermission } from "@/lib/studio/turns";
import type { SessionMode } from "@/shared/ipc";

export interface PermissionCard {
  onChoose: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function usePermissionCard(
  permission: PendingPermission,
  onAnswer: (
    id: string,
    action: PermissionAction,
    mode: SessionMode | null
  ) => void
): PermissionCard {
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

  return useMemo(() => ({ onChoose }), [onChoose]);
}
