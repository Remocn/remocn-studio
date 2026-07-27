"use client";

import { useCallback, useMemo, useState } from "react";
import type { PaneGroup, SessionRow } from "@/lib/studio/groups";

export interface VisibleSessions {
  hidden: number;
  showAll: () => void;
  visible: readonly SessionRow[];
}

export function useVisibleSessions(group: PaneGroup): VisibleSessions {
  const [isFull, setIsFull] = useState(false);

  const showAll = useCallback(() => setIsFull(true), []);

  return useMemo(
    () => ({
      hidden: isFull ? 0 : group.hidden,
      showAll,
      visible: isFull ? group.rows : group.visible,
    }),
    [group, isFull, showAll]
  );
}
