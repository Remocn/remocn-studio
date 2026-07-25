"use client";

import { useCallback, useMemo } from "react";
import type { PermissionAction } from "@/lib/studio/permission";

export interface PermissionCard {
  onChoose: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function usePermissionCard(
  id: string,
  onAnswer: (id: string, action: PermissionAction) => void
): PermissionCard {
  const onChoose = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onAnswer(id, event.currentTarget.value as PermissionAction);
    },
    [id, onAnswer]
  );

  return useMemo(() => ({ onChoose }), [onChoose]);
}
