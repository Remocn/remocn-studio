"use client";

import { Effect, Exit } from "effect";
import { useEffect, useMemo, useRef, useState } from "react";
import { installAppMenu, menuShape } from "@/lib/studio/app-menu";
import type { Command } from "@/lib/studio/command-registry";
import { currentPlatform } from "@/lib/studio/platform";

// The menu is chrome, not a feature the app waits on: in a plain browser or
// under happy-dom there is no Tauri transport, so a failed install is swallowed
// and the app simply keeps whatever menu it had. The answer says whether a
// menu is up, which is what decides who fires a menu-owned shortcut.
export function useAppMenu(commands: readonly Command[]): boolean {
  const [isInstalled, setIsInstalled] = useState(false);
  const generation = useRef(0);
  const latest = useRef(commands);
  latest.current = commands;
  const shape = useMemo(() => menuShape(commands), [commands]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the menu is rebuilt when its shape changes and reads the newest commands through the ref, so a `run` closure changing does not swap the whole menu.
  useEffect(() => {
    generation.current += 1;
    const token = generation.current;

    // Only macOS has a global menu bar. Elsewhere Tauri would attach a menu
    // bar to the window above the title bar band, so none is installed and
    // the keyboard reader fires every menu-owned shortcut instead.
    if (currentPlatform() !== "mac") {
      setIsInstalled(false);
      return;
    }

    const isCurrent = () => generation.current === token;
    const run = (id: string) =>
      latest.current.find((command) => command.id === id)?.run();

    Effect.runPromiseExit(installAppMenu(latest.current, run, isCurrent)).then(
      (exit) => {
        if (isCurrent()) {
          setIsInstalled(Exit.isSuccess(exit));
        }
      }
    );
  }, [shape]);

  return isInstalled;
}
