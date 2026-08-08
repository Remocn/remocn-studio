"use client";

import { useState } from "react";

const FORWARD = "animate-screen-in";
const BACKWARD = "animate-screen-back";

export function useEntrance(isAhead: boolean): string | null {
  const [seen, setSeen] = useState<{
    entrance: string | null;
    isAhead: boolean;
  }>({ entrance: null, isAhead });

  if (seen.isAhead !== isAhead) {
    setSeen({ entrance: isAhead ? FORWARD : BACKWARD, isAhead });
    return null;
  }

  return seen.entrance;
}
