"use client";

import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

export const THEME_CHOICES = ["dark", "light", "system"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    typeof value === "string" &&
    (THEME_CHOICES as readonly string[]).includes(value)
  );
}

export interface ThemeSelection {
  choice: ThemeChoice | null;
  select: (choice: ThemeChoice) => void;
}

// next-themes reads its stored value only on the client, so the choice is
// `null` until the first effect has run — a control rendered before that
// would flash the default and then jump.
export function useThemeChoice(): ThemeSelection {
  const { setTheme, theme } = useTheme();
  const [isMounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const choice = isMounted && isThemeChoice(theme) ? theme : null;

  return useMemo(() => ({ choice, select: setTheme }), [choice, setTheme]);
}
