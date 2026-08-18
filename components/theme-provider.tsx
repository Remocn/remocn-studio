"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // Dark stays the default — the editor chrome is designed against the
      // obsidian palette — but the choice now belongs to Settings, System
      // included. next-themes persists it under its own key.
      defaultTheme="dark"
      disableTransitionOnChange
      enableSystem
    >
      {children}
    </NextThemesProvider>
  );
}
