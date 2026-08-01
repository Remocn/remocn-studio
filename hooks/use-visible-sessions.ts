"use client";

import { useCallback, useMemo, useState } from "react";
import type { PaneGroup, SessionRow } from "@/lib/studio/groups";

export interface VisibleSessions {
  hidden: number;
  isFull: boolean;
  toggle: () => void;
  visible: readonly SessionRow[];
}

export function useVisibleSessions(group: PaneGroup): VisibleSessions {
  const [isFull, setIsFull] = useState(false);

  const toggle = useCallback(() => setIsFull((current) => !current), []);

  return useMemo(
    () => ({
      hidden: isFull ? 0 : group.hidden,
      isFull,
      toggle,
      visible: isFull ? group.rows : group.visible,
    }),
    [group, isFull, toggle]
  );
}
